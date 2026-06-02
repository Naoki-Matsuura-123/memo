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

class Folder(FolderBase):
    id: int

    class Config:
        from_attributes = True

# Memo Schemas
class MemoBase(BaseModel):
    title: str = Field(..., example="My Memo")
    content: str = Field(..., example="Detailed content here...")
    folder_id: Optional[int] = Field(None, example=1)

class MemoCreate(MemoBase):
    pass

class MemoUpdate(MemoBase):
    pass

class Memo(MemoBase):
    id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

# User Schemas
class User(BaseModel):
    id: int
    username: str
    display_name: str
    class Config:
        from_attributes = True

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
