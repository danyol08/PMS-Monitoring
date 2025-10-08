from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from app.database import get_supabase
from app.models import User, Notification
from app.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[Notification])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        query = supabase.table("notifications").select("*").eq("user_id", current_user.id)
        
        if unread_only:
            query = query.eq("is_read", False)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return [Notification(**notification) for notification in response.data]
        
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching notifications"
        )

@router.get("/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    supabase = get_supabase()
    
    try:
        response = supabase.table("notifications").select("id", count="exact").eq("user_id", current_user.id).eq("is_read", False).execute()
        return {"unread_count": response.count}
        
    except Exception as e:
        logger.error(f"Error fetching unread count: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching unread count"
        )

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Check if notification exists and belongs to user
        existing = supabase.table("notifications").select("*").eq("id", notification_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Mark as read
        response = supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to mark notification as read"
            )
        
        return {"message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error marking notification as read"
        )

@router.put("/mark-all-read")
async def mark_all_as_read(current_user: User = Depends(get_current_user)):
    supabase = get_supabase()
    
    try:
        response = supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user.id).eq("is_read", False).execute()
        
        return {"message": f"Marked {len(response.data)} notifications as read"}
        
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error marking all notifications as read"
        )

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Check if notification exists and belongs to user
        existing = supabase.table("notifications").select("*").eq("id", notification_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Delete notification
        response = supabase.table("notifications").delete().eq("id", notification_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to delete notification"
            )
        
        return {"message": "Notification deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting notification"
        )





