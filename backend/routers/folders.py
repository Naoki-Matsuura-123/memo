from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FolderModel, MemoModel
from backend.schemas import Folder, FolderCreate, FolderUpdate

router = APIRouter(
    prefix="/folders",
    tags=["folders"]
)

@router.get("", response_model=List[Folder])
def list_folders(db: Session = Depends(get_db)):
    """List all folders."""
    return db.query(FolderModel).all()

@router.post("", response_model=Folder, status_code=status.HTTP_201_CREATED)
def create_folder(folder_data: FolderCreate, db: Session = Depends(get_db)):
    """Create a new folder."""
    db_folder = FolderModel(
        name=folder_data.name,
        parent_id=folder_data.parent_id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.put("/{folder_id}", response_model=Folder)
def update_folder(folder_id: int, folder_update: FolderUpdate, db: Session = Depends(get_db)):
    """Rename a folder."""
    db_folder = db.query(FolderModel).filter(FolderModel.id == folder_id).first()
    if db_folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with id {folder_id} not found"
        )
    db_folder.name = folder_update.name
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: int, delete_content: bool = False, db: Session = Depends(get_db)):
    """Delete a folder.
    
    If delete_content is True, bulk-deletes all memos inside that folder.
    If delete_content is False (Default), moves all memos to root (folder_id = None).
    """
    db_folder = db.query(FolderModel).filter(FolderModel.id == folder_id).first()
    if db_folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with id {folder_id} not found"
        )
    
    if delete_content:
        # Delete all memos belonging to this folder
        db.query(MemoModel).filter(MemoModel.folder_id == folder_id).delete(synchronize_session=False)
    else:
        # Safely detach memos from this folder (move to root)
        db.query(MemoModel).filter(MemoModel.folder_id == folder_id).update(
            {MemoModel.folder_id: None},
            synchronize_session=False
        )
        
    db.delete(db_folder)
    db.commit()
    return None
