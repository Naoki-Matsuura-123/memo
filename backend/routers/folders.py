from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FolderModel, MemoModel, RatingAxisModel, MemoRatingModel, RatingVisibilityModel, UserModel
from backend.schemas import Folder, FolderCreate, FolderUpdate
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/folders",
    tags=["folders"]
)

@router.get("", response_model=List[Folder])
def list_folders(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """List all folders belonging to the logged-in user."""
    return db.query(FolderModel).filter(FolderModel.user_id == current_user.id).all()

@router.post("", response_model=Folder, status_code=status.HTTP_201_CREATED)
def create_folder(folder_data: FolderCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Create a new folder owned by the current user."""
    # If parent_id is specified, verify it belongs to the user
    if folder_data.parent_id is not None:
        p_folder = db.query(FolderModel).filter(
            FolderModel.id == folder_data.parent_id,
            FolderModel.user_id == current_user.id
        ).first()
        if not p_folder:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent folder not found or access denied"
            )

    db_folder = FolderModel(
        name=folder_data.name,
        parent_id=folder_data.parent_id,
        user_id=current_user.id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.put("/{folder_id}", response_model=Folder)
def update_folder(folder_id: int, folder_update: FolderUpdate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Update a folder owned by the current user."""
    db_folder = db.query(FolderModel).filter(
        FolderModel.id == folder_id,
        FolderModel.user_id == current_user.id
    ).first()
    if db_folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder not found or access denied"
        )
    
    # Verify parent folder belongs to the user
    if folder_update.parent_id is not None:
        p_folder = db.query(FolderModel).filter(
            FolderModel.id == folder_update.parent_id,
            FolderModel.user_id == current_user.id
        ).first()
        if not p_folder:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent folder not found or access denied"
            )
            
        # Prevent circular reference
        if folder_update.parent_id == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A folder cannot be its own parent"
            )
        curr_parent = folder_update.parent_id
        while curr_parent is not None:
            if curr_parent == folder_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot move a folder under itself or its own subfolder"
                )
            p_folder = db.query(FolderModel).filter(FolderModel.id == curr_parent).first()
            if p_folder is None:
                break
            curr_parent = p_folder.parent_id

    db_folder.name = folder_update.name
    db_folder.parent_id = folder_update.parent_id
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: int, delete_content: bool = False, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Delete a folder owned by the current user."""
    db_folder = db.query(FolderModel).filter(
        FolderModel.id == folder_id,
        FolderModel.user_id == current_user.id
    ).first()
    if db_folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder not found or access denied"
        )
    
    def process_delete(fid: int):
        # 自分の所有するサブフォルダのみを再帰削除
        subfolders = db.query(FolderModel).filter(
            FolderModel.parent_id == fid,
            FolderModel.user_id == current_user.id
        ).all()
        for sub in subfolders:
            if delete_content:
                process_delete(sub.id)
            else:
                sub.parent_id = None
        
        if delete_content:
            # 自分が所有しているメモを削除
            memos_to_delete = db.query(MemoModel).filter(
                MemoModel.folder_id == fid,
                MemoModel.user_id == current_user.id
            ).all()
            for m in memos_to_delete:
                axes = db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == m.id).all()
                if axes:
                    axis_ids = [ax.id for ax in axes]
                    db.query(MemoRatingModel).filter(MemoRatingModel.axis_id.in_(axis_ids)).delete(synchronize_session=False)
                    db.query(RatingVisibilityModel).filter(RatingVisibilityModel.axis_id.in_(axis_ids)).delete(synchronize_session=False)
                    db.query(RatingAxisModel).filter(RatingAxisModel.memo_id == m.id).delete(synchronize_session=False)
                db.delete(m)
        else:
            # メモをルートに移動
            db.query(MemoModel).filter(
                MemoModel.folder_id == fid,
                MemoModel.user_id == current_user.id
            ).update(
                {MemoModel.folder_id: None},
                synchronize_session=False
            )
        
        # フォルダ自身を削除
        db.query(FolderModel).filter(FolderModel.id == fid).delete(synchronize_session=False)

    process_delete(folder_id)
    db.commit()
    return None
