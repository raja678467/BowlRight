from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class UserBase(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    is_admin: bool = False

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserBase

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class BiometricLoginRequest(BaseModel):
    biometric_secret: str
