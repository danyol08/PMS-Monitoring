from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from app.database import get_supabase
from app.models import User, Token, LoginRequest, SignupRequest, UserCreate, AuditAction
from app.auth import create_access_token, get_current_user, authenticate_user, get_password_hash
from app.services.audit_service import AuditService
from app.config import settings
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, request: Request):
    try:
        # Authenticate user with email and password
        user = await authenticate_user(login_data.email, login_data.password)
        
        # Create JWT token
        access_token_expires = timedelta(hours=settings.jwt_expiration_hours)
        access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        
        # Log login activity
        AuditService.log_user_activity(
            user_id=user.id,
            action=AuditAction.LOGIN,
            description=f"User logged in: {user.full_name} ({user.email})",
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login service error"
        )

@router.post("/signup", response_model=Token)
async def signup(signup_data: SignupRequest):
    supabase = get_supabase()
    
    try:
        # Check if user already exists
        existing_user = supabase.table("users").select("id").eq("email", signup_data.email).execute()
        
        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Generate user ID
        user_id = str(uuid.uuid4())
        
        # Hash password
        password_hash = get_password_hash(signup_data.password)
        
        # Create user record in our users table
        user_data = {
            "id": user_id,
            "email": signup_data.email,
            "full_name": signup_data.full_name,
            "role": signup_data.role.value,
            "is_active": True,
            "password_hash": password_hash,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        user_response = supabase.table("users").insert(user_data).execute()
        
        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user record"
            )
        
        # Remove password hash from response
        user_data.pop("password_hash", None)
        user = User(**user_data)
        
        # Create JWT token
        access_token_expires = timedelta(hours=settings.jwt_expiration_hours)
        access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create user"
        )

@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    try:
        # Log logout activity
        AuditService.log_user_activity(
            user_id=current_user.id,
            action=AuditAction.LOGOUT,
            description=f"User logged out: {current_user.full_name} ({current_user.email})",
            ip_address=request.client.host if request.client else None
        )
        
        # For local auth, logout is handled client-side by removing the token
        return {"message": "Successfully logged out"}
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    access_token_expires = timedelta(hours=settings.jwt_expiration_hours)
    access_token = create_access_token(
        data={"sub": current_user.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": current_user
    }

# Allow the current user to update their own profile (limited fields)
@router.put("/me", response_model=User)
async def update_me(update_data: dict, request: Request, current_user: User = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        allowed_fields = {"full_name", "email"}
        payload = {k: v for k, v in update_data.items() if k in allowed_fields and v is not None}
        if not payload:
            return current_user

        payload["updated_at"] = datetime.utcnow().isoformat()
        response = supabase.table("users").update(payload).eq("id", current_user.id).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update profile")

        user_row = response.data[0]
        user_row.pop("password_hash", None)

        AuditService.log_user_activity(
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            description=f"Profile updated: {', '.join(payload.keys())}",
            ip_address=request.client.host if request.client else None,
        )

        return User(**user_row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update me error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error updating profile")


# Change password for the current user
@router.post("/change-password")
async def change_password(data: dict, request: Request, current_user: User = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        current_password = data.get("current_password")
        new_password = data.get("new_password")
        if not current_password or not new_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing password fields")

        user = await authenticate_user(current_user.email, current_password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

        password_hash = get_password_hash(new_password)
        response = supabase.table("users").update({
            "password_hash": password_hash,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", current_user.id).execute()

        if not response.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to change password")

        AuditService.log_user_activity(
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            description="Password changed",
            ip_address=request.client.host if request.client else None,
        )

        return {"message": "Password updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error changing password")
