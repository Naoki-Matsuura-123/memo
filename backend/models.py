from sqlalchemy import Column, Integer, String, Float
from backend.database import Base

class FolderModel(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, nullable=True) # Supports future nested subfolders

class MemoModel(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    folder_id = Column(Integer, nullable=True) # Link to FolderModel.id

class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)  # 'anonymous' default
    display_name = Column(String, nullable=False)

class RatingAxisModel(Base):
    __tablename__ = "rating_axes"
    id = Column(Integer, primary_key=True, index=True)
    memo_id = Column(Integer, nullable=False)  # FK to memos.id
    name = Column(String, nullable=False)  # e.g. '味', '見た目'
    method = Column(String, nullable=False, default='star')  # 'star' | 'tier' | 'numeric'
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False)

class MemoRatingModel(Base):
    __tablename__ = "memo_ratings"
    id = Column(Integer, primary_key=True, index=True)
    axis_id = Column(Integer, nullable=False)  # FK to rating_axes.id
    user_id = Column(Integer, nullable=False)  # FK to users.id
    score = Column(Float, nullable=True)  # Normalized score
    raw_value = Column(String, nullable=True)  # Original input: '4.5', 'S', '87'
    updated_at = Column(String, nullable=False)

class RatingVisibilityModel(Base):
    __tablename__ = "rating_visibility"
    id = Column(Integer, primary_key=True, index=True)
    viewer_user_id = Column(Integer, nullable=False)  # viewer
    target_user_id = Column(Integer, nullable=False)  # rated user
    axis_id = Column(Integer, nullable=False)  # rating axis
    visible = Column(Integer, nullable=False, default=1)  # 1=visible, 0=hidden
