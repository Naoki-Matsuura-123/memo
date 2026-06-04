from sqlalchemy import Column, Integer, String, Float, Table, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base

# Association table for Many-to-Many relation between Memos and Tags
memo_tags = Table(
    "memo_tags",
    Base.metadata,
    Column("memo_id", Integer, ForeignKey("memos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class FolderModel(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True) # Supports nested subfolders
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True) # Folder owner

class TagModel(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)

    memos = relationship("MemoModel", secondary=memo_tags, back_populates="tags")

class MemoModel(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True) # Link to FolderModel.id
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True) # Memo owner

    tags = relationship("TagModel", secondary=memo_tags, back_populates="memos")

# Association table for Many-to-Many relation between Users and Roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
)

class RoleModel(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)

class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)  # 'anonymous' default
    display_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True) # Password hash for credential login

class MemoShareModel(Base):
    __tablename__ = "memo_shares"
    id = Column(Integer, primary_key=True, index=True)
    memo_id = Column(Integer, ForeignKey("memos.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=True, index=True)
    permission = Column(String, nullable=False)  # 'read' | 'write'

class RatingAxisModel(Base):
    __tablename__ = "rating_axes"
    id = Column(Integer, primary_key=True, index=True)
    memo_id = Column(Integer, ForeignKey("memos.id", ondelete="CASCADE"), nullable=False, index=True)  # FK to memos.id
    name = Column(String, nullable=False)  # e.g. '味', '見た目'
    method = Column(String, nullable=False, default='star')  # 'star' | 'tier' | 'numeric'
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False)

class MemoRatingModel(Base):
    __tablename__ = "memo_ratings"
    id = Column(Integer, primary_key=True, index=True)
    axis_id = Column(Integer, ForeignKey("rating_axes.id", ondelete="CASCADE"), nullable=False, index=True)  # FK to rating_axes.id
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # FK to users.id
    score = Column(Float, nullable=True)  # Normalized score
    raw_value = Column(String, nullable=True)  # Original input: '4.5', 'S', '87'
    updated_at = Column(String, nullable=False)

class RatingVisibilityModel(Base):
    __tablename__ = "rating_visibility"
    id = Column(Integer, primary_key=True, index=True)
    viewer_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # viewer
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # rated user
    axis_id = Column(Integer, ForeignKey("rating_axes.id", ondelete="CASCADE"), nullable=False, index=True)  # rating axis
    visible = Column(Integer, nullable=False, default=1)  # 1=visible, 0=hidden
