import os
import uuid
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import asyncio

from database import engine, Base, get_db
from models import UserDB, AuditLog
from schemas import (
    UserBase, UserCreate, UserUpdate, Token, 
    ForgotPasswordRequest, ResetPasswordRequest, BiometricLoginRequest
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_admin, ACCESS_TOKEN_EXPIRE_MINUTES
)

# Create tables
Base.metadata.create_all(bind=engine)

from utils import manager, update_readable_dump
from admin import router as admin_router

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app = FastAPI(title="BowlRight Backend")

# --- Global Error Handling (Phase 4) ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats validation errors into human-readable strings to avoid [object Object] on frontend."""
    errors = exc.errors()
    error_messages = []
    for error in errors:
        loc = " -> ".join([str(l) for l in error.get("loc") if l != "body"])
        msg = error.get("msg")
        error_messages.append(f"{loc}: {msg}" if loc else msg)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation Error: " + ", ".join(error_messages)},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected server errors."""
    print(f"[ERROR] Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )

# Mount uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)

# Routes
@app.get("/")
async def root():
    return {"message": "BowlRight Backend is active."}

@app.post("/signup", response_model=Token)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if not any(char.isdigit() for char in user.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

    new_user = UserDB(
        id=str(uuid.uuid4()),
        email=user.email,
        full_name=user.full_name,
        profile_image=user.profile_image,
        hashed_password=get_password_hash(user.password),
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    update_readable_dump()
    
    access_token = create_access_token(data={"sub": new_user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.get("/me", response_model=UserBase)
async def read_users_me(current_user: UserDB = Depends(get_current_user)):
    return current_user

@app.patch("/me", response_model=UserBase)
async def update_user_me(user_update: UserUpdate, current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_update.full_name is not None: current_user.full_name = user_update.full_name
    if user_update.profile_image is not None: current_user.profile_image = user_update.profile_image
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    update_readable_dump()
    return current_user

@app.post("/biometrics/enable")
async def enable_biometrics(current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Generate a high-entropy secret
    # We use a combined UUID to ensure it's long enough and has high entropy
    secret = f"{uuid.uuid4()}-{uuid.uuid4()}"
    
    # Store the HASH of the secret, not the secret itself
    # This ensures that even if the DB is leaked, the biometric login remains secure
    current_user.biometric_secret = get_password_hash(secret)
    db.add(current_user)
    db.commit()
    update_readable_dump()
    
    # Return the secret to the client to be stored in SecureStore
    return {"biometric_secret": f"{current_user.id}:{secret}"}

@app.post("/biometrics/login", response_model=Token)
async def biometric_login(request: BiometricLoginRequest, db: Session = Depends(get_db)):
    if ":" not in request.biometric_secret:
        raise HTTPException(status_code=401, detail="Invalid biometric token format")
        
    user_id, secret = request.biometric_secret.split(":", 1)
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user or not user.biometric_secret or not verify_password(secret, user.biometric_secret):
        raise HTTPException(status_code=401, detail="Invalid biometric secret")
    
    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == request.email).first()
    if not user:
        # We return 200 even if user not found to prevent email enumeration
        return {"message": "If an account exists with that email, a reset link has been sent."}
    
    # In a real app, you'd generate a token and email it. 
    # For this demo, we'll return a mock token.
    reset_token = create_access_token(data={"sub": user.email, "type": "reset"}, expires_delta=timedelta(minutes=15))
    print(f"[DEBUG] Password reset token for {user.email}: {reset_token}")
    
    return {"message": "Reset link sent.", "debug_token": reset_token}

@app.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        from auth import SECRET_KEY, ALGORITHM
        from jose import jwt, JWTError
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if not email or token_type != "reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
            
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # 1. Update Password
        user.hashed_password = get_password_hash(request.new_password)
        
        # 2. IMPORTANT: Invalidate Biometrics
        # Security linkage: Biometrics must be re-enabled after a password change
        user.biometric_secret = None
        
        db.add(user)
        db.commit()
        update_readable_dump()
        
        # 3. Force logout from all active sessions
        await manager.send_logout_signal(user.id)
        
        return {"message": "Password updated successfully. Biometric access has been reset for security."}
    except JWTError:
        raise HTTPException(status_code=400, detail="Reset token expired or invalid")

@app.post("/upload-profile-image")
async def upload_profile_image(file: UploadFile = File(...), current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check file size (7MB limit)
    await file.seek(0, 2)
    file_size = file.file.tell()
    await file.seek(0)
    
    if file_size > 7 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 7MB limit."
        )

    # Validate file type
    allowed_extensions = {"jpg", "jpeg", "png", "webp"}
    allowed_content_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    
    file_extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_extension not in allowed_extensions or file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG, PNG, and WEBP images are allowed."
        )

    # 1. Cleanup old image if it exists (Optimization: Storage Management)
    if current_user.profile_image:
        # Extract relative path (e.g., "uploads/filename.png") from URL ("/uploads/filename.png")
        old_file_path = current_user.profile_image.lstrip("/")
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception as e:
                print(f"[CLEANUP ERROR] Could not delete old image {old_file_path}: {e}")

    # 2. Save new image
    file_name = f"{current_user.id}_{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    image_url = f"/uploads/{file_name}"
    current_user.profile_image = image_url
    db.add(current_user)
    db.commit()
    update_readable_dump()
    return {"image_url": image_url}

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, db: Session = Depends(get_db)):
    # 1. Preliminary Handshake with Subprotocol (Optimization: Privacy)
    # We check for the token in the subprotocols to avoid logging it in the URL
    subprotocols = websocket.headers.get("sec-websocket-protocol", "").replace(" ", "").split(",")
    token = websocket.query_params.get("token") # Fallback
    
    # If token is in subprotocol, it's usually the second element if following [access_token, TOKEN] pattern
    if not token and len(subprotocols) > 1:
        token = subprotocols[1]

    await websocket.accept(subprotocol=subprotocols[0] if subprotocols[0] else None)
    
    if not token:
        print(f"[WS] Connection rejected: No token provided for {user_id}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        from auth import SECRET_KEY, ALGORITHM
        from jose import jwt, JWTError
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user = db.query(UserDB).filter(UserDB.email == email).first()
        
        if not user or user.id != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    last_db_check = datetime.now(timezone.utc)
    
    try:
        while True:
            now = datetime.now(timezone.utc)
            
            # 2. Continuous Security Validation (Optimization: Fixed "Busy Bypass")
            # This now runs even if the client is sending constant data
            if (now - last_db_check).total_seconds() > 300:
                user_check = db.query(UserDB).filter(UserDB.id == user_id).first()
                if not user_check:
                    print(f"[WS] Forced logout: User {user_id} removed from DB")
                    await websocket.send_text("LOGOUT")
                    await websocket.close() # FORCED server-side closure
                    break
                last_db_check = now

            try:
                # Wait for data with a slightly shorter timeout for better responsiveness
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "PONG": continue
            except asyncio.TimeoutError:
                # Heartbeat Ping
                try:
                    await websocket.send_text("PING")
                    # Increased pong timeout to 15s for mobile stability
                    await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
                except:
                    break
                    
    except WebSocketDisconnect:
        pass 
    except Exception as e:
        print(f"[WS] Runtime error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id, websocket)

if __name__ == "__main__":
    import uvicorn
    update_readable_dump()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
