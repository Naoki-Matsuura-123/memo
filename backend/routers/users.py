from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import UserModel
from backend.schemas import User

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get('', response_model=List[User])
def list_users(db: Session = Depends(get_db)):
    """全ユーザー一覧を取得する。"""
    return db.query(UserModel).all()

from backend.routers.auth import get_current_user

@router.get('/me', response_model=User)
def read_current_user(current_user: UserModel = Depends(get_current_user)):
    """現在のログインユーザーを取得する。"""
    return current_user
