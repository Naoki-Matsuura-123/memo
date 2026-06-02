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

@router.get('/me', response_model=User)
def get_current_user(db: Session = Depends(get_db)):
    """現在のユーザー（anonymous）を取得する。"""
    user = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
    if not user:
        raise HTTPException(status_code=404, detail='No anonymous user found')
    return user
