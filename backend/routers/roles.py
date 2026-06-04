from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import RoleModel, UserModel, user_roles
from backend.schemas import Role, RoleCreate, UserRoleAdd, User
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/roles",
    tags=["roles"]
)

# Seed default roles
def seed_default_roles(db: Session):
    default_roles = [
        {"name": "admin", "description": "管理者権限グループ"},
        {"name": "general", "description": "一般グループ"},
        {"name": "developer", "description": "開発チーム"}
    ]
    for r_data in default_roles:
        existing = db.query(RoleModel).filter(RoleModel.name == r_data["name"]).first()
        if not existing:
            db.add(RoleModel(name=r_data["name"], description=r_data["description"]))
    db.commit()

@router.get("", response_model=List[Role])
def list_roles(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """全ロール一覧を取得する。"""
    return db.query(RoleModel).order_by(RoleModel.name).all()

@router.post("", response_model=Role, status_code=status.HTTP_201_CREATED)
def create_role(data: RoleCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """新規ロールを作成する。"""
    existing = db.query(RoleModel).filter(RoleModel.name == data.name.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role already exists"
        )
    role = RoleModel(name=data.name.lower(), description=data.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role

@router.get("/{role_id}/users", response_model=List[User])
def list_role_users(role_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """ロールに所属する全ユーザー一覧を取得する。"""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    users = db.query(UserModel).join(
        user_roles, UserModel.id == user_roles.c.user_id
    ).filter(
        user_roles.c.role_id == role_id
    ).all()
    return users

@router.post("/{role_id}/users", status_code=status.HTTP_200_OK)
def add_user_to_role(role_id: int, data: UserRoleAdd, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """ユーザーをロールに追加する。"""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    user = db.query(UserModel).filter(UserModel.username == data.username.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{data.username}' not found")
        
    # Check if already added
    existing = db.execute(
        user_roles.select().where(
            user_roles.c.user_id == user.id,
            user_roles.c.role_id == role_id
        )
    ).first()
    
    if existing:
        return {"status": "success", "message": "User already in role"}
        
    db.execute(
        user_roles.insert().values(user_id=user.id, role_id=role_id)
    )
    db.commit()
    return {"status": "success", "message": f"Added {user.username} to {role.name}"}

@router.delete("/{role_id}/users/{user_id}", status_code=status.HTTP_200_OK)
def remove_user_from_role(role_id: int, user_id: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """ユーザーをロールから削除する。"""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    # Delete from intermediate table
    db.execute(
        user_roles.delete().where(
            user_roles.c.user_id == user_id,
            user_roles.c.role_id == role_id
        )
    )
    db.commit()
    return {"status": "success", "message": "User removed from role"}
