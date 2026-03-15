from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import string
import resend
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration
resend.api_key = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@updates.isadev.icu')

# JWT configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret_key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', 5))

# Create the main app
app = FastAPI()

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["auth"])

# Security - auto_error=False para devolver 401 en lugar de 403
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class VerifyCode(BaseModel):
    email: EmailStr
    code: str

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    is_verified: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MessageResponse(BaseModel):
    message: str
    success: bool = True

# ==================== HELPERS ====================

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    """Create JWT token with 5-day expiration"""
    expiration = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def send_verification_email(email: str, code: str, email_type: str = "verification"):
    """Send verification code via Resend"""
    if email_type == "verification":
        subject = "Verifica tu cuenta"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #09090B; color: #FAFAFA;">
            <h2 style="color: #6366f1; margin-bottom: 20px;">Verificación de cuenta</h2>
            <p style="margin-bottom: 20px;">Tu código de verificación es:</p>
            <div style="background-color: #18181B; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">{code}</span>
            </div>
            <p style="color: #A1A1AA; font-size: 14px;">Este código expira en 15 minutos.</p>
            <p style="color: #A1A1AA; font-size: 14px;">Si no solicitaste este código, ignora este correo.</p>
        </div>
        """
    else:
        subject = "Recupera tu contraseña"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #09090B; color: #FAFAFA;">
            <h2 style="color: #6366f1; margin-bottom: 20px;">Recuperación de contraseña</h2>
            <p style="margin-bottom: 20px;">Tu código para restablecer la contraseña es:</p>
            <div style="background-color: #18181B; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">{code}</span>
            </div>
            <p style="color: #A1A1AA; font-size: 14px;">Este código expira en 15 minutos.</p>
            <p style="color: #A1A1AA; font-size: 14px;">Si no solicitaste este código, ignora este correo.</p>
        </div>
        """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {email}, ID: {email_response.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

# ==================== AUTH ROUTES ====================

@auth_router.post("/register", response_model=MessageResponse)
async def register(user_data: UserCreate):
    """Register a new user and send verification code"""
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        if existing_user.get("is_verified"):
            raise HTTPException(status_code=400, detail="Email already registered")
        else:
            # User exists but not verified, update and resend code
            code = generate_verification_code()
            expiration = datetime.now(timezone.utc) + timedelta(minutes=15)
            await db.users.update_one(
                {"email": user_data.email},
                {"$set": {
                    "verification_code": code,
                    "code_expiration": expiration.isoformat(),
                    "password_hash": hash_password(user_data.password),
                    "name": user_data.name
                }}
            )
            await send_verification_email(user_data.email, code, "verification")
            return MessageResponse(message="Verification code sent to your email")
    
    # Create new user
    user_id = str(uuid.uuid4())
    code = generate_verification_code()
    expiration = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "is_verified": False,
        "verification_code": code,
        "code_expiration": expiration.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await send_verification_email(user_data.email, code, "verification")
    
    return MessageResponse(message="Verification code sent to your email")

@auth_router.post("/verify", response_model=TokenResponse)
async def verify_email(data: VerifyCode):
    """Verify email with code"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Check code
    if user.get("verification_code") != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Check expiration
    expiration = datetime.fromisoformat(user.get("code_expiration"))
    if datetime.now(timezone.utc) > expiration:
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    # Update user as verified
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"is_verified": True}, "$unset": {"verification_code": "", "code_expiration": ""}}
    )
    
    # Create token
    token = create_token(user["user_id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            is_verified=True,
            created_at=user["created_at"]
        )
    )

@auth_router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login user"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_verified"):
        # Send new verification code
        code = generate_verification_code()
        expiration = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.users.update_one(
            {"email": data.email},
            {"$set": {"verification_code": code, "code_expiration": expiration.isoformat()}}
        )
        await send_verification_email(data.email, code, "verification")
        raise HTTPException(status_code=403, detail="Email not verified. New code sent.")
    
    # Create token
    token = create_token(user["user_id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            is_verified=user["is_verified"],
            created_at=user["created_at"]
        )
    )

@auth_router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(data: ForgotPassword):
    """Send password reset code"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        # Don't reveal if email exists
        return MessageResponse(message="If the email exists, a reset code has been sent")
    
    code = generate_verification_code()
    expiration = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"reset_code": code, "reset_code_expiration": expiration.isoformat()}}
    )
    
    await send_verification_email(data.email, code, "reset")
    
    return MessageResponse(message="If the email exists, a reset code has been sent")

@auth_router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: ResetPassword):
    """Reset password with code"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check code
    if user.get("reset_code") != data.code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check expiration
    expiration = datetime.fromisoformat(user.get("reset_code_expiration", datetime.now(timezone.utc).isoformat()))
    if datetime.now(timezone.utc) > expiration:
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    # Update password
    await db.users.update_one(
        {"email": data.email},
        {
            "$set": {"password_hash": hash_password(data.new_password)},
            "$unset": {"reset_code": "", "reset_code_expiration": ""}
        }
    )
    
    return MessageResponse(message="Password reset successfully")

@auth_router.post("/resend-code", response_model=MessageResponse)
async def resend_code(data: ForgotPassword):
    """Resend verification code"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    code = generate_verification_code()
    expiration = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"verification_code": code, "code_expiration": expiration.isoformat()}}
    )
    
    await send_verification_email(data.email, code, "verification")
    
    return MessageResponse(message="Verification code sent")

@auth_router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        name=current_user["name"],
        is_verified=current_user["is_verified"],
        created_at=current_user["created_at"]
    )

# ==================== BASE ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Auth Template API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include routers
api_router.include_router(auth_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
