from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import MemoModel
from backend.schemas import Memo, MemoCreate, MemoUpdate

router = APIRouter(
    prefix="/memos",
    tags=["memos"]
)

# Helper to format datetime in ISO 8601 UTC format
def get_current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()

@router.get("", response_model=List[Memo])
def list_memos(db: Session = Depends(get_db)):
    """List all memos, sorted by last updated first (descending)."""
    return db.query(MemoModel).order_by(MemoModel.updated_at.desc()).all()

@router.get("/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, db: Session = Depends(get_db)):
    """Retrieve a single memo by ID."""
    memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if memo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memo with id {memo_id} not found"
        )
    return memo

@router.post("", response_model=Memo, status_code=status.HTTP_201_CREATED)
def create_memo(memo_data: MemoCreate, db: Session = Depends(get_db)):
    """Create a new memo."""
    now_str = get_current_iso_time()
    db_memo = MemoModel(
        title=memo_data.title,
        content=memo_data.content,
        folder_id=memo_data.folder_id,
        created_at=now_str,
        updated_at=now_str
    )
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo

@router.put("/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, memo_update: MemoUpdate, db: Session = Depends(get_db)):
    """Update an existing memo."""
    db_memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if db_memo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memo with id {memo_id} not found"
        )
    
    db_memo.title = memo_update.title
    db_memo.content = memo_update.content
    db_memo.folder_id = memo_update.folder_id
    db_memo.updated_at = get_current_iso_time()
    
    db.commit()
    db.refresh(db_memo)
    return db_memo

@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    """Delete a memo by ID."""
    db_memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
    if db_memo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memo with id {memo_id} not found"
        )
    
    db.delete(db_memo)
    db.commit()
    return None
