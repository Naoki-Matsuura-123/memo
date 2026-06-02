from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import (
    MemoModel, UserModel, RatingAxisModel, MemoRatingModel, RatingVisibilityModel
)
from backend.schemas import (
    RatingAxis, RatingAxisCreate, RatingAxisUpdate,
    MemoRating, RateRequest, VisibilityToggle, VisibilityBulk
)
from backend.routers.memos import get_current_iso_time

router = APIRouter(
    tags=["ratings"]
)

# Helper: スコア正規化（メソッドに応じて生の入力値を正規化スコアに変換）
def normalize_score(raw_value: str, method: str) -> Optional[float]:
    """Convert raw rating input to normalized score based on method."""
    try:
        if method == 'star':
            val = float(raw_value)
            return max(0.0, min(5.0, val))  # Clamp 0-5
        elif method == 'tier':
            tier_map = {'S': 5.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0}
            return tier_map.get(raw_value.upper(), None)
        elif method == 'numeric':
            val = float(raw_value)
            return max(0.0, min(100.0, val))  # Clamp 0-100
    except (ValueError, TypeError):
        return None
    return None


# --- API Endpoints (Rating Axes) ---

@router.get('/memos/{memo_id}/axes', response_model=List[RatingAxis])
def list_axes(memo_id: int, db: Session = Depends(get_db)):
    """指定メモの評価軸一覧を取得する。"""
    return db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).order_by(RatingAxisModel.sort_order).all()

@router.post('/memos/{memo_id}/axes', response_model=RatingAxis, status_code=201)
def create_axis(memo_id: int, data: RatingAxisCreate, db: Session = Depends(get_db)):
    """指定メモに新しい評価軸を追加する。"""
    # Verify memo exists
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail=f'Memo {memo_id} not found')
    if data.method not in ('star', 'tier', 'numeric'):
        raise HTTPException(status_code=400, detail='method must be star, tier, or numeric')
    max_order = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).count()
    axis = RatingAxisModel(
        memo_id=memo_id, name=data.name, method=data.method,
        sort_order=max_order, created_at=get_current_iso_time()
    )
    db.add(axis)
    db.commit()
    db.refresh(axis)
    return axis

@router.put('/axes/{axis_id}', response_model=RatingAxis)
def update_axis(axis_id: int, data: RatingAxisUpdate, db: Session = Depends(get_db)):
    """評価軸の名前やメソッドを更新する。"""
    axis = db.query(RatingAxisModel).filter(RatingAxisModel.id == axis_id).first()
    if not axis:
        raise HTTPException(status_code=404, detail='Axis not found')
    if data.name is not None:
        axis.name = data.name
    if data.method is not None:
        if data.method not in ('star', 'tier', 'numeric'):
            raise HTTPException(status_code=400, detail='method must be star, tier, or numeric')
        axis.method = data.method
    db.commit()
    db.refresh(axis)
    return axis

@router.delete('/axes/{axis_id}', status_code=204)
def delete_axis(axis_id: int, db: Session = Depends(get_db)):
    """評価軸と関連する評価・可視性データを削除する。"""
    axis = db.query(RatingAxisModel).filter(RatingAxisModel.id == axis_id).first()
    if not axis:
        raise HTTPException(status_code=404, detail='Axis not found')
    db.query(MemoRatingModel).filter(MemoRatingModel.axis_id == axis_id).delete(synchronize_session=False)
    db.query(RatingVisibilityModel).filter(RatingVisibilityModel.axis_id == axis_id).delete(synchronize_session=False)
    db.delete(axis)
    db.commit()
    return None


# --- API Endpoints (Ratings) ---

@router.put('/axes/{axis_id}/rate', response_model=MemoRating)
def upsert_rating(axis_id: int, data: RateRequest, db: Session = Depends(get_db)):
    """評価を登録または更新する（Upsert）。"""
    axis = db.query(RatingAxisModel).filter(RatingAxisModel.id == axis_id).first()
    if not axis:
        raise HTTPException(status_code=404, detail='Axis not found')
    user = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    score = normalize_score(data.raw_value, axis.method)
    existing = db.query(MemoRatingModel).filter(
        MemoRatingModel.axis_id == axis_id, MemoRatingModel.user_id == user.id
    ).first()
    if existing:
        existing.score = score
        existing.raw_value = data.raw_value
        existing.updated_at = get_current_iso_time()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        rating = MemoRatingModel(
            axis_id=axis_id, user_id=user.id,
            score=score, raw_value=data.raw_value,
            updated_at=get_current_iso_time()
        )
        db.add(rating)
        db.commit()
        db.refresh(rating)
        return rating

@router.delete('/axes/{axis_id}/rate', status_code=204)
def delete_rating(axis_id: int, db: Session = Depends(get_db)):
    """現在のユーザーの評価を削除する。"""
    user = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    rating = db.query(MemoRatingModel).filter(
        MemoRatingModel.axis_id == axis_id, MemoRatingModel.user_id == user.id
    ).first()
    if not rating:
        raise HTTPException(status_code=404, detail='Rating not found')
    db.delete(rating)
    db.commit()
    return None

@router.get('/memos/{memo_id}/ratings')
def get_memo_ratings(memo_id: int, db: Session = Depends(get_db)):
    """指定メモの全評価軸・全評価データを取得する。"""
    axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).order_by(RatingAxisModel.sort_order).all()
    result = []
    for axis in axes:
        ratings = db.query(MemoRatingModel).filter(MemoRatingModel.axis_id == axis.id).all()
        result.append({
            'axis': {'id': axis.id, 'name': axis.name, 'method': axis.method, 'sort_order': axis.sort_order},
            'ratings': [{'id': r.id, 'user_id': r.user_id, 'score': r.score, 'raw_value': r.raw_value, 'updated_at': r.updated_at} for r in ratings]
        })
    return result


# --- API Endpoints (Visibility) ---

@router.get('/memos/{memo_id}/visibility')
def get_visibility(memo_id: int, db: Session = Depends(get_db)):
    """指定メモの可視性グリッドを取得する。"""
    viewer = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).all()
    users = db.query(UserModel).all()
    grid = []
    for u in users:
        row = {'user_id': u.id, 'username': u.username, 'display_name': u.display_name, 'axes': {}}
        for ax in axes:
            vis = db.query(RatingVisibilityModel).filter(
                RatingVisibilityModel.viewer_user_id == viewer.id,
                RatingVisibilityModel.target_user_id == u.id,
                RatingVisibilityModel.axis_id == ax.id
            ).first()
            row['axes'][str(ax.id)] = vis.visible if vis else 1  # Default visible
        grid.append(row)
    return {'viewer_user_id': viewer.id, 'grid': grid}

@router.put('/visibility/toggle')
def toggle_visibility(data: VisibilityToggle, db: Session = Depends(get_db)):
    """個別の可視性を切り替える。"""
    viewer = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    existing = db.query(RatingVisibilityModel).filter(
        RatingVisibilityModel.viewer_user_id == viewer.id,
        RatingVisibilityModel.target_user_id == data.target_user_id,
        RatingVisibilityModel.axis_id == data.axis_id
    ).first()
    if existing:
        existing.visible = 1 if data.visible else 0
        db.commit()
        db.refresh(existing)
        return {'id': existing.id, 'visible': bool(existing.visible)}
    else:
        vis = RatingVisibilityModel(
            viewer_user_id=viewer.id, target_user_id=data.target_user_id,
            axis_id=data.axis_id, visible=1 if data.visible else 0
        )
        db.add(vis)
        db.commit()
        db.refresh(vis)
        return {'id': vis.id, 'visible': bool(vis.visible)}

@router.put('/visibility/bulk')
def bulk_visibility(data: VisibilityBulk, db: Session = Depends(get_db)):
    """可視性を一括で切り替える。"""
    viewer = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    if data.mode == 'all_on':
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id).update({'visible': 1}, synchronize_session=False)
    elif data.mode == 'all_off':
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id).update({'visible': 0}, synchronize_session=False)
    elif data.mode == 'user_on' and data.target_user_id:
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id, RatingVisibilityModel.target_user_id == data.target_user_id).update({'visible': 1}, synchronize_session=False)
    elif data.mode == 'user_off' and data.target_user_id:
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id, RatingVisibilityModel.target_user_id == data.target_user_id).update({'visible': 0}, synchronize_session=False)
    elif data.mode == 'axis_on' and data.axis_id:
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id, RatingVisibilityModel.axis_id == data.axis_id).update({'visible': 1}, synchronize_session=False)
    elif data.mode == 'axis_off' and data.axis_id:
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.viewer_user_id == viewer.id, RatingVisibilityModel.axis_id == data.axis_id).update({'visible': 0}, synchronize_session=False)
    db.commit()
    return {'status': 'ok', 'mode': data.mode}


# --- API Endpoints (Rating Summary) ---

@router.get('/memos/{memo_id}/ratings/summary')
def ratings_summary(memo_id: int, db: Session = Depends(get_db)):
    """指定メモの評価サマリー（可視性フィルタ適用済み）を取得する。"""
    viewer = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).order_by(RatingAxisModel.sort_order).all()
    summaries = []
    for axis in axes:
        ratings = db.query(MemoRatingModel).filter(MemoRatingModel.axis_id == axis.id).all()
        # Filter by visibility
        visible_ratings = []
        for r in ratings:
            vis = db.query(RatingVisibilityModel).filter(
                RatingVisibilityModel.viewer_user_id == viewer.id,
                RatingVisibilityModel.target_user_id == r.user_id,
                RatingVisibilityModel.axis_id == axis.id
            ).first()
            if vis is None or vis.visible == 1:
                visible_ratings.append(r)
        scores = [r.score for r in visible_ratings if r.score is not None]
        avg = sum(scores) / len(scores) if scores else None
        tier_counts = {}
        if axis.method == 'tier':
            for r in visible_ratings:
                if r.raw_value:
                    tier_counts[r.raw_value.upper()] = tier_counts.get(r.raw_value.upper(), 0) + 1
        summaries.append({
            'axis_id': axis.id, 'axis_name': axis.name, 'method': axis.method,
            'average_score': round(avg, 2) if avg is not None else None,
            'count': len(visible_ratings),
            'tier_distribution': tier_counts if tier_counts else None
        })
    return summaries
