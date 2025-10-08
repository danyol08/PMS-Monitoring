from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import List
from app.database import get_supabase
from app.models import User, UserUpdate, UserCreate, AuditAction
from app.auth import get_current_user, require_admin, get_password_hash
from app.services.audit_service import AuditService
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=User)
async def create_user(
    request: Request,
    user_data: UserCreate,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Check if user already exists
        existing_user = supabase.table("users").select("id").eq("email", user_data.email).execute()
        
        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Generate user ID
        user_id = str(uuid.uuid4())
        
        # Hash password
        password_hash = get_password_hash(user_data.password)
        
        # Create user record
        new_user_data = {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "role": user_data.role.value,
            "is_active": user_data.is_active,
            "password_hash": password_hash,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("users").insert(new_user_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user"
            )
        
        # Remove password hash from response
        user_response = response.data[0].copy()
        user_response.pop("password_hash", None)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.CREATE,
            description=f"User created by {current_user.full_name}: {user_data.full_name} ({user_data.email})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return User(**user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )

@router.get("/", response_model=List[User])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        response = supabase.table("users").select("*").range(skip, skip + limit - 1).execute()
        return [User(**user) for user in response.data]
        
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching users"
        )

@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return User(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching user"
        )

@router.put("/{user_id}", response_model=User)
async def update_user(
    request: Request,
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Check if user exists
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user
        update_data = {k: v for k, v in user_update.dict().items() if v is not None}
        if "role" in update_data:
            update_data["role"] = update_data["role"].value
        
        # Handle password update
        password_changed = False
        if "password" in update_data:
            password_hash = get_password_hash(update_data["password"])
            update_data["password_hash"] = password_hash
            password_changed = True
            del update_data["password"]
        
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update user"
            )
        
        # Log audit trail
        changes = []
        if password_changed:
            changes.append("password changed")
        if "full_name" in user_update.dict() and user_update.dict()["full_name"] is not None:
            changes.append("name changed")
        if "role" in user_update.dict() and user_update.dict()["role"] is not None:
            changes.append("role changed")
        if "is_active" in user_update.dict() and user_update.dict()["is_active"] is not None:
            changes.append("status changed")
        
        description = f"User account updated by {current_user.full_name}: {', '.join(changes)}" if changes else f"User account updated by {current_user.full_name}"
        
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.UPDATE,
            description=description,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return User(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating user"
        )

@router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Check if user exists
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = existing.data[0]
        
        # Don't allow deleting yourself
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )
        
        # Delete user
        response = supabase.table("users").delete().eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to delete user"
            )
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.DELETE,
            description=f"User deleted by {current_user.full_name}: {user_data.get('full_name')} ({user_data.get('email')})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting user"
        )

@router.post("/{user_id}/activate")
async def activate_user(
    request: Request,
    user_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Get user details before activation for audit trail
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = existing.data[0]
        
        response = supabase.table("users").update({"is_active": True}).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.ACTIVATE,
            description=f"User activated by {current_user.full_name}: {user_data.get('full_name')} ({user_data.get('email')})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "User activated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error activating user"
        )

@router.post("/{user_id}/deactivate")
async def deactivate_user(
    request: Request,
    user_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Don't allow deactivating yourself
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account"
            )
        
        # Get user details before deactivation for audit trail
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_data = existing.data[0]
        
        response = supabase.table("users").update({"is_active": False}).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.DELETE,  # Using DELETE action for deactivation
            description=f"User deactivated by {current_user.full_name}: {user_data.get('full_name')} ({user_data.get('email')})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "User deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deactivating user"
        )





