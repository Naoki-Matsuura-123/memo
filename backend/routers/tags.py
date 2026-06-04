from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import TagModel, memo_tags, MemoModel, MemoShareModel, UserModel
from backend.schemas import TagWithCount
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/tags",
    tags=["tags"]
)

def cleanup_orphaned_tags(db: Session):
    """Delete tags that are no longer associated with any memos."""
    db.query(TagModel).filter(~TagModel.memos.any()).delete(synchronize_session=False)
    db.commit()

@router.get("", response_model=List[TagWithCount])
def list_tags(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """List all tags along with their memo counts for memos visible to the current user."""
    # Find all visible memo IDs (owned or shared)
    owned_memo_ids = db.query(MemoModel.id).filter(MemoModel.user_id == current_user.id).subquery()
    shared_memo_ids = db.query(MemoShareModel.memo_id).filter(MemoShareModel.user_id == current_user.id).subquery()
    
    results = db.query(
        TagModel.id,
        TagModel.name,
        func.count(memo_tags.c.memo_id).label("memo_count")
    ).join(
        memo_tags, TagModel.id == memo_tags.c.tag_id
    ).filter(
        (memo_tags.c.memo_id.in_(owned_memo_ids)) | 
        (memo_tags.c.memo_id.in_(shared_memo_ids))
    ).group_by(
        TagModel.id
    ).order_by(
        TagModel.name
    ).all()
    
    return [
        {"id": r.id, "name": r.name, "memo_count": r.memo_count}
        for r in results
    ]
