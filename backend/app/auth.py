from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from app.config import settings
from app.database import get_supabase
from app.models import User, UserRole
import logging
import uuid

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    return user_id

async def get_current_user(user_id: str = Depends(verify_token)) -> User:
    supabase = get_supabase()
    
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = response.data[0]
        # Remove password hash from response
        user_data.pop("password_hash", None)
        return User(**user_data)
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching user"
        )

async def authenticate_user(email: str, password: str) -> User:
    """Authenticate user with email and password"""
    supabase = get_supabase()
    
    try:
        # First check if user exists (regardless of active status)
        user_check = supabase.table("users").select("id, is_active").eq("email", email).execute()
        
        if not user_check.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email address not found"
            )
        
        user_data = user_check.data[0]
        
        # Check if user is active
        if not user_data.get("is_active", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated. Please contact administrator."
            )
        
        # Get full user data
        response = supabase.table("users").select("*").eq("email", email).eq("is_active", True).execute()
        user_data = response.data[0]
        
        # Verify password
        if not verify_password(password, user_data["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password"
            )
        
        # Update last login
        supabase.table("users").update({
            "last_login": datetime.utcnow().isoformat()
        }).eq("id", user_data["id"]).execute()
        
        # Remove password hash from response
        user_data.pop("password_hash", None)
        return User(**user_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

def require_role(required_role: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_technician_or_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.TECHNICIAN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Technician or Admin access required"
        )
    return current_user
