from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import MemoModel, TagModel, RatingAxisModel, MemoRatingModel, RatingVisibilityModel, UserModel, MemoShareModel, user_roles
from backend.schemas import Memo, MemoCreate, MemoUpdate
from backend.routers.tags import cleanup_orphaned_tags
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/memos",
    tags=["memos"]
)

# Request schemas for sharing
class ShareRequest(BaseModel):
    username: Optional[str] = None
    role_name: Optional[str] = None
    permission: str  # 'read' | 'write'

# Helper to format datetime in ISO 8601 UTC format
def get_current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()

# Helper to verify permissions
def get_memo_with_permission(db: Session, memo_id: int, user_id: int, required_permission: str = 'read') -> MemoModel:
    """Verify ownership or shared permission (including role-based shares). Returns MemoModel if allowed, else raises HTTP Exception."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memo with id {memo_id} not found"
        )
    
    # 1. Owner check
    if memo.user_id == user_id:
        memo.permission = 'owner'
        return memo
        
    # 2. Get user roles
    roles_query = db.query(user_roles.c.role_id).filter(user_roles.c.user_id == user_id).all()
    user_role_ids = [r[0] for r in roles_query]
    
    # 3. Share check (individual and role)
    conditions = [MemoShareModel.user_id == user_id]
    if user_role_ids:
        conditions.append(MemoShareModel.role_id.in_(user_role_ids))
        
    shares = db.query(MemoShareModel).filter(
        MemoShareModel.memo_id == memo_id,
        or_(*conditions)
    ).all()
    
    if not shares:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
        
    # Resolve conflicting permissions (prefer 'write')
    has_write = any(s.permission == 'write' for s in shares)
    effective_permission = 'write' if has_write else 'read'
        
    if required_permission == 'write' and effective_permission != 'write':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write permission denied (Read-only)"
        )
        
    memo.permission = effective_permission
    return memo

# Helper to calculate average rating (0-100) across all axes
def calculate_memo_average_rating(db: Session, memo_id: int) -> Optional[float]:
    """Calculate the normalized average score (0.0 to 100.0) across all rating axes for a memo."""
    axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).all()
    if not axes:
        return None
        
    axis_ids = [ax.id for ax in axes]
    ratings = db.query(MemoRatingModel).filter(MemoRatingModel.axis_id.in_(axis_ids)).all()
    if not ratings:
        return None
        
    normalized_scores = []
    for r in ratings:
        axis = next((ax for ax in axes if ax.id == r.axis_id), None)
        if not axis or r.score is None:
            continue
        if axis.method == 'star' or axis.method == 'tier':
            normalized_scores.append(r.score * 20.0)
        elif axis.method == 'numeric':
            normalized_scores.append(r.score)
            
    if not normalized_scores:
        return None
        
    return round(sum(normalized_scores) / len(normalized_scores), 2)

# Helper to sync memo tags and cleanup orphan tags
def sync_memo_tags(db: Session, db_memo: MemoModel, tag_names: List[str]):
    unique_names = list(set([name.strip() for name in tag_names if name.strip()]))
    
    tags = []
    for name in unique_names:
        tag = db.query(TagModel).filter(TagModel.name == name).first()
        if not tag:
            tag = TagModel(name=name)
            db.add(tag)
            db.commit()
            db.refresh(tag)
        tags.append(tag)
        
    db_memo.tags = tags
    db.commit()
    cleanup_orphaned_tags(db)

@router.get("", response_model=List[Memo])
def list_memos(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """List all memos owned by or shared with the user (including role-based shares)."""
    # Owned memos
    owned = db.query(MemoModel).filter(MemoModel.user_id == current_user.id).all()
    for m in owned:
        m.permission = 'owner'
        m.average_rating = calculate_memo_average_rating(db, m.id)
        
    # Get user roles
    roles_query = db.query(user_roles.c.role_id).filter(user_roles.c.user_id == current_user.id).all()
    user_role_ids = [r[0] for r in roles_query]
    
    # Shared memos (individual + role-based)
    conditions = [MemoShareModel.user_id == current_user.id]
    if user_role_ids:
        conditions.append(MemoShareModel.role_id.in_(user_role_ids))
        
    shares = db.query(MemoShareModel).filter(or_(*conditions)).all()
    
    # Resolve permissions (prefer 'write')
    memo_permission_map = {}
    for s in shares:
        memo_id = s.memo_id
        permission = s.permission
        if memo_id not in memo_permission_map:
            memo_permission_map[memo_id] = permission
        else:
            if permission == 'write':
                memo_permission_map[memo_id] = 'write'
                
    shared_memos = []
    for memo_id, perm in memo_permission_map.items():
        m = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
        if m:
            if m.user_id == current_user.id:
                continue # Skip if owner (already added)
            m.permission = perm
            m.average_rating = calculate_memo_average_rating(db, m.id)
            shared_memos.append(m)
            
    all_memos = owned + shared_memos
    # Sort by updated_at descending
    all_memos.sort(key=lambda x: x.updated_at, reverse=True)
    return all_memos

@router.get("/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Retrieve a single memo by ID with permission check."""
    memo = get_memo_with_permission(db, memo_id, current_user.id, 'read')
    memo.average_rating = calculate_memo_average_rating(db, memo.id)
    return memo

@router.post("", response_model=Memo, status_code=status.HTTP_201_CREATED)
def create_memo(memo_data: MemoCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Create a new memo owned by the current user."""
    now_str = get_current_iso_time()
    db_memo = MemoModel(
        title=memo_data.title,
        content=memo_data.content,
        folder_id=memo_data.folder_id,
        user_id=current_user.id,
        created_at=now_str,
        updated_at=now_str
    )
    db.add(db_memo)
    db.commit()
    
    if memo_data.tags is not None:
        sync_memo_tags(db, db_memo, memo_data.tags)
        
    db.refresh(db_memo)
    db_memo.permission = 'owner'
    db_memo.average_rating = calculate_memo_average_rating(db, db_memo.id)
    return db_memo

@router.put("/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, memo_update: MemoUpdate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Update an existing memo with write permission check."""
    db_memo = get_memo_with_permission(db, memo_id, current_user.id, 'write')
    
    db_memo.title = memo_update.title
    db_memo.content = memo_update.content
    db_memo.folder_id = memo_update.folder_id
    db_memo.updated_at = get_current_iso_time()
    
    if memo_update.tags is not None:
        sync_memo_tags(db, db_memo, memo_update.tags)
        
    db.commit()
    db.refresh(db_memo)
    # Check permissions again to return correct state
    memo_with_perm = get_memo_with_permission(db, memo_id, current_user.id, 'read')
    memo_with_perm.average_rating = calculate_memo_average_rating(db, memo_with_perm.id)
    return memo_with_perm

@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(memo_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Delete a memo by ID (Only the owner can delete)."""
    db_memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if db_memo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memo with id {memo_id} not found"
        )
        
    # Check ownership
    if db_memo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Delete permission denied (Only the memo owner can delete)"
        )
    
    # Cascade clean up rating resources
    axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).all()
    if axes:
        axis_ids = [ax.id for ax in axes]
        db.query(MemoRatingModel).filter(MemoRatingModel.axis_id.in_(axis_ids)).delete(synchronize_session=False)
        db.query(RatingVisibilityModel).filter(RatingVisibilityModel.axis_id.in_(axis_ids)).delete(synchronize_session=False)
        db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == memo_id).delete(synchronize_session=False)

    db.delete(db_memo)
    db.commit()
    
    cleanup_orphaned_tags(db)
    return None

# --- Sharing APIs ---

@router.get("/{memo_id}/shares")
def list_shares(memo_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """List all sharing permissions for a memo (Only the memo owner can view)."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
        
    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the memo owner can view share settings")
        
    shares = db.query(MemoShareModel).filter(MemoShareModel.memo_id == memo_id).all()
    result = []
    from backend.models import RoleModel
    for s in shares:
        if s.user_id is not None:
            target_user = db.query(UserModel).filter(UserModel.id == s.user_id).first()
            if target_user:
                result.append({
                    "type": "user",
                    "user_id": target_user.id,
                    "username": target_user.username,
                    "display_name": target_user.display_name,
                    "permission": s.permission
                })
        elif s.role_id is not None:
            target_role = db.query(RoleModel).filter(RoleModel.id == s.role_id).first()
            if target_role:
                result.append({
                    "type": "role",
                    "role_id": target_role.id,
                    "role_name": target_role.name,
                    "permission": s.permission
                })
    return result

@router.post("/{memo_id}/shares")
def add_or_update_share(memo_id: int, data: ShareRequest, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Share a memo with another user or a role (Only the memo owner can manage shares)."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
        
    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the memo owner can manage shares")
        
    if data.permission not in ('read', 'write'):
        raise HTTPException(status_code=400, detail="permission must be 'read' or 'write'")
        
    if data.username is None and data.role_name is None:
        raise HTTPException(status_code=400, detail="Either username or role_name must be provided")
        
    from backend.models import RoleModel
    
    if data.username is not None:
        # User share
        target_user = db.query(UserModel).filter(UserModel.username == data.username.lower()).first()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"User '{data.username}' not found")
            
        if target_user.id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot share a memo with yourself")
            
        share = db.query(MemoShareModel).filter(
            MemoShareModel.memo_id == memo_id,
            MemoShareModel.user_id == target_user.id
        ).first()
        
        if share:
            share.permission = data.permission
            db.commit()
            db.refresh(share)
        else:
            share = MemoShareModel(
                memo_id=memo_id,
                user_id=target_user.id,
                role_id=None,
                permission=data.permission
            )
            db.add(share)
            db.commit()
            db.refresh(share)
            
        return {
            "status": "success",
            "type": "user",
            "user_id": target_user.id,
            "username": target_user.username,
            "display_name": target_user.display_name,
            "permission": share.permission
        }
        
    else:
        # Role share
        target_role = db.query(RoleModel).filter(RoleModel.name == data.role_name.lower()).first()
        if not target_role:
            raise HTTPException(status_code=404, detail=f"Role '{data.role_name}' not found")
            
        share = db.query(MemoShareModel).filter(
            MemoShareModel.memo_id == memo_id,
            MemoShareModel.role_id == target_role.id
        ).first()
        
        if share:
            share.permission = data.permission
            db.commit()
            db.refresh(share)
        else:
            share = MemoShareModel(
                memo_id=memo_id,
                user_id=None,
                role_id=target_role.id,
                permission=data.permission
            )
            db.add(share)
            db.commit()
            db.refresh(share)
            
        return {
            "status": "success",
            "type": "role",
            "role_id": target_role.id,
            "role_name": target_role.name,
            "permission": share.permission
        }

@router.delete("/{memo_id}/shares/user/{target_user_id}")
def remove_user_share(memo_id: int, target_user_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Remove sharing permissions for a user (Only the memo owner can manage shares)."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
        
    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the memo owner can manage shares")
        
    share = db.query(MemoShareModel).filter(
        MemoShareModel.memo_id == memo_id,
        MemoShareModel.user_id == target_user_id
    ).first()
    
    if not share:
        raise HTTPException(status_code=404, detail="Share permission not found for this user")
        
    db.delete(share)
    db.commit()
    return {"status": "success"}

@router.delete("/{memo_id}/shares/role/{target_role_id}")
def remove_role_share(memo_id: int, target_role_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Remove sharing permissions for a role (Only the memo owner can manage shares)."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
        
    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the memo owner can manage shares")
        
    share = db.query(MemoShareModel).filter(
        MemoShareModel.memo_id == memo_id,
        MemoShareModel.role_id == target_role_id
    ).first()
    
    if not share:
        raise HTTPException(status_code=404, detail="Share permission not found for this role")
        
    db.delete(share)
    db.commit()
    return {"status": "success"}
