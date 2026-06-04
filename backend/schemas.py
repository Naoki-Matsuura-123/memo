from typing import List, Optional
from pydantic import BaseModel, Field

# Folder Schemas
class FolderBase(BaseModel):
    name: str = Field(..., example="Project Drafts")
    parent_id: Optional[int] = Field(None, example=None)

class FolderCreate(FolderBase):
    pass

class FolderUpdate(BaseModel):
    name: str = Field(..., example="Project Finished")
    parent_id: Optional[int] = Field(None, example=None)

class Folder(FolderBase):
    id: int

    class Config:
        from_attributes = True

# Tag Schemas
class TagBase(BaseModel):
    name: str = Field(..., example="仕事")

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True

class TagWithCount(Tag):
    memo_count: int


# Memo Schemas
class MemoBase(BaseModel):
    title: str = Field(..., example="My Memo")
    content: str = Field(..., example="Detailed content here...")
    folder_id: Optional[int] = Field(None, example=1)

class MemoCreate(MemoBase):
    tags: Optional[List[str]] = Field(default=[], example=["仕事", "開発"])

class MemoUpdate(MemoBase):
    tags: Optional[List[str]] = Field(default=[], example=["仕事", "開発"])

class Memo(MemoBase):
    id: int
    created_at: str
    updated_at: str
    tags: List[Tag] = []
    average_rating: Optional[float] = None
    permission: Optional[str] = None # 'owner' | 'write' | 'read'

    class Config:
        from_attributes = True

# User Schemas
class User(BaseModel):
    id: int
    username: str
    display_name: str
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, example="john_doe")
    display_name: str = Field(..., min_length=1, max_length=30, example="John Doe")
    password: str = Field(..., min_length=4, max_length=50, example="password123")

class LoginRequest(BaseModel):
    username: str = Field(..., example="john_doe")
    password: str = Field(..., example="password123")

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Rating Axis Schemas
class RatingAxisCreate(BaseModel):
    name: str = Field(..., example="味")
    method: str = Field('star', example="star")  # 'star' | 'tier' | 'numeric'

class RatingAxisUpdate(BaseModel):
    name: Optional[str] = None
    method: Optional[str] = None

class RatingAxis(BaseModel):
    id: int
    memo_id: int
    name: str
    method: str
    sort_order: int
    created_at: str
    class Config:
        from_attributes = True

# Rating Schemas
class RateRequest(BaseModel):
    raw_value: str = Field(..., example="4")  # The user's input

class MemoRating(BaseModel):
    id: int
    axis_id: int
    user_id: int
    score: Optional[float]
    raw_value: Optional[str]
    updated_at: str
    class Config:
        from_attributes = True

# Visibility Schemas
class VisibilityToggle(BaseModel):
    target_user_id: int
    axis_id: int
    visible: bool

class VisibilityBulk(BaseModel):
    mode: str  # 'all_on' | 'all_off' | 'user_on' | 'user_off' | 'axis_on' | 'axis_off'
    target_user_id: Optional[int] = None
    axis_id: Optional[int] = None

# Role Schemas
class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=30, example="developer")
    description: Optional[str] = Field(None, example="Developer team members")

class RoleCreate(RoleBase):
    pass

class Role(RoleBase):
    id: int
    class Config:
        from_attributes = True

class UserRoleAdd(BaseModel):
    username: str = Field(..., example="john_doe")
