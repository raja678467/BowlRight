import os
import uuid
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Database Setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Model
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    biometric_secret = Column(String, nullable=True, unique=True)

# Create tables
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app = FastAPI(title="Expo App Backend")

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserBase

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.get("/")
async def root():
    return {"message": "Expo App Backend is Running"}

@app.post("/signup", response_model=Token)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    new_user = UserDB(
        id=str(uuid.uuid4()),
        email=user.email,
        full_name=user.full_name,
        profile_image=user.profile_image,
        hashed_password=get_password_hash(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "email": new_user.email, 
            "full_name": new_user.full_name,
            "profile_image": new_user.profile_image
        }
    }

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "email": user.email, 
            "full_name": user.full_name,
            "profile_image": user.profile_image
        }
    }

@app.get("/me", response_model=UserBase)
async def read_users_me(current_user: UserDB = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "profile_image": current_user.profile_image
    }

@app.patch("/me", response_model=UserBase)
async def update_user_me(
    user_update: UserUpdate, 
    current_user: UserDB = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.profile_image is not None:
        current_user.profile_image = user_update.profile_image
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/biometrics/enable")
async def enable_biometrics(current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Generate a unique secret for this user's biometric login
    secret = str(uuid.uuid4()) + str(uuid.uuid4())
    # Hash the secret before storing it for security
    current_user.biometric_secret = get_password_hash(secret)
    db.add(current_user)
    db.commit()
    # Return a composite token so we can find the user without requiring their email
    return {"biometric_secret": f"{current_user.id}:{secret}"}

class BiometricLoginRequest(BaseModel):
    biometric_secret: str

@app.post("/biometrics/login", response_model=Token)
async def biometric_login(request: BiometricLoginRequest, db: Session = Depends(get_db)):
    # Split the composite token into user_id and secret
    if ":" not in request.biometric_secret:
        raise HTTPException(status_code=401, detail="Invalid biometric token format")
        
    user_id, secret = request.biometric_secret.split(":", 1)
    
    # Find user by ID and verify the secret hash
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user or not user.biometric_secret or not verify_password(secret, user.biometric_secret):
        raise HTTPException(status_code=401, detail="Invalid biometric secret")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "email": user.email, 
            "full_name": user.full_name,
            "profile_image": user.profile_image
        }
    }

@app.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...), 
    current_user: UserDB = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    file_extension = file.filename.split(".")[-1]
    file_name = f"{current_user.id}_{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    image_url = f"/uploads/{file_name}"
    current_user.profile_image = image_url
    db.add(current_user)
    db.commit()
    
    return {"image_url": image_url}

if __name__ == "__main__":
    import uvicorn
    # Use reload=False in script mode to avoid signal handling issues in some environments
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
