from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import List, Optional
from datetime import datetime, timedelta
from ..models import Repair, RepairCreate, RepairUpdate, RepairStatus, AuditAction, ContractType
from enum import Enum
from ..database import get_supabase
from ..auth import get_current_user
from ..services.audit_service import AuditService
from ..auth import require_admin
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repairs", tags=["repairs"])

def to_primitive(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value

@router.get("/", response_model=List[Repair])
async def get_repairs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[RepairStatus] = None,
    company_name: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get all repairs with optional filtering"""
    supabase = get_supabase()
    
    query = supabase.table("repairs").select("*")
    
    # Apply filters
    if status:
        query = query.eq("status", status.value)
    if company_name:
        query = query.ilike("company_name", f"%{company_name}%")
    
    # Apply pagination and ordering
    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
    
    result = query.execute()
    
    if result.data is None:
        return []
    
    sanitized = []
    for item in result.data:
        row = dict(item)
        if row.get("created_by") is None:
            row["created_by"] = ""
        sanitized.append(Repair(**row))
    repairs = sanitized
    return repairs

@router.get("/{repair_id}", response_model=Repair)
async def get_repair(repair_id: str, current_user = Depends(get_current_user)):
    """Get a specific repair by ID"""
    supabase = get_supabase()
    
    result = supabase.table("repairs").select("*").eq("id", repair_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Repair not found")
    
    row = dict(result.data[0])
    if row.get("created_by") is None:
        row["created_by"] = ""
    repair = Repair(**row)
    # Audit VIEW for single item
    AuditService.log_activity(
        entity_type="repair",
        entity_id=repair_id,
        action=AuditAction.VIEW,
        description=f"Viewed repair: {repair.company_name} - {repair.device_model}",
        user_id=current_user.id,
        ip_address=None
    )
    return repair

@router.post("/", response_model=Repair)
async def create_repair(request: Request, repair: RepairCreate, current_user = Depends(get_current_user)):
    """Create a new repair record"""
    supabase = get_supabase()
    
    # Generate unique ID
    repair_id = str(uuid.uuid4())
    
    # Prepare repair data
    repair_data = repair.dict()
    repair_data["id"] = repair_id

    # Auto-increment SQ if blank
    try:
        if not (repair_data.get("sq") and str(repair_data.get("sq")).strip().isdigit()):
            # Prefer numeric sequence based on count to avoid non-numeric last SQ
            count_resp = supabase.table("repairs").select("id", count="exact").execute()
            next_sq = (getattr(count_resp, 'count', 0) or 0) + 1
            repair_data["sq"] = str(next_sq)
    except Exception:
        repair_data["sq"] = repair_data.get("sq") or "1"
    
    # Creator
    repair_data["created_by"] = str(getattr(current_user, "id", ""))
    repair_data["created_at"] = datetime.utcnow().isoformat()
    repair_data["updated_at"] = datetime.utcnow().isoformat()
    
    # Convert datetime objects to ISO strings
    if repair_data.get("date_received"):
        repair_data["date_received"] = repair_data["date_received"].isoformat()
    if repair_data.get("repair_open"):
        repair_data["repair_open"] = repair_data["repair_open"].isoformat()
    if repair_data.get("repair_closed"):
        repair_data["repair_closed"] = repair_data["repair_closed"].isoformat()
    
    result = supabase.table("repairs").insert(repair_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create repair")
    
    created_repair = Repair(**result.data[0])
    
    # Log audit trail
    AuditService.log_repair_activity(
        repair_id=repair_id,
        action=AuditAction.CREATE,
        description=f"Repair created by {current_user.full_name}: {created_repair.company_name} - {created_repair.device_model}",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    
    return created_repair

@router.put("/{repair_id}", response_model=Repair)
async def update_repair(
    request: Request,
    repair_id: str, 
    repair_update: RepairUpdate, 
    current_user = Depends(get_current_user)
):
    """Update an existing repair record"""
    supabase = get_supabase()
    
    # Check if repair exists
    existing = supabase.table("repairs").select("*").eq("id", repair_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Repair not found")
    
    # Prepare update data
    update_data = repair_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    # Convert datetime objects to ISO strings
    if update_data.get("date_received"):
        update_data["date_received"] = to_primitive(update_data["date_received"])
    if update_data.get("repair_open"):
        update_data["repair_open"] = to_primitive(update_data["repair_open"])
    if update_data.get("repair_closed"):
        update_data["repair_closed"] = to_primitive(update_data["repair_closed"])
    if update_data.get("status") is not None:
        update_data["status"] = to_primitive(update_data["status"])
    
    result = supabase.table("repairs").update(update_data).eq("id", repair_id).execute()
    response_data = getattr(result, "data", None)
    if not response_data:
        # Fallback: fetch updated row
        fetch = supabase.table("repairs").select("*").eq("id", repair_id).execute()
        if not fetch.data:
            raise HTTPException(status_code=400, detail="Failed to update repair")
        response_data = fetch.data
    # Ensure created_by not null for Pydantic
    row = dict(response_data[0])
    if row.get("created_by") is None:
        prev_created_by = existing.data[0].get("created_by") if existing and existing.data else ""
        row["created_by"] = prev_created_by or ""
    updated_repair = Repair(**row)
    
    # Log audit trail
    AuditService.log_repair_activity(
        repair_id=repair_id,
        action=AuditAction.UPDATE,
        description=f"Repair updated by {current_user.full_name}: {repair_id}",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    
    return updated_repair

@router.post("/backfill-sq")
async def backfill_sq(current_user = Depends(require_admin)):
    """Backfill missing/non-numeric SQ values sequentially.
    Admin only.
    """
    supabase = get_supabase()
    try:
        resp = supabase.table("repairs").select("id, sq, created_at").order("created_at", desc=False).execute()
        rows = resp.data or []

        # Collect used numeric SQs
        used = set()
        for r in rows:
            try:
                s = str(r.get("sq") or "").strip()
                if s.isdigit():
                    used.add(int(s))
            except Exception:
                continue

        def next_available(start: int = 1) -> int:
            n = start
            while n in used:
                n += 1
            used.add(n)
            return n

        updates = 0
        next_n = 1
        for r in rows:
            s = str(r.get("sq") or "").strip()
            if not s.isdigit():
                n = next_available(next_n)
                next_n = n + 1
                supabase.table("repairs").update({"sq": str(n)}).eq("id", r["id"]).execute()
                updates += 1

        return {"updated": updates, "total": len(rows)}
    except Exception as e:
        logger.error(f"Error backfilling SQ: {e}")
        raise HTTPException(status_code=500, detail="Failed to backfill SQ")

@router.post("/resequence-sq")
async def resequence_sq(current_user = Depends(require_admin)):
    """Rewrite ALL SQ values as 1..N based on created_at ascending."""
    supabase = get_supabase()
    try:
        resp = supabase.table("repairs").select("id, created_at").order("created_at", desc=False).execute()
        rows = resp.data or []
        updates = 0
        for idx, r in enumerate(rows, start=1):
            supabase.table("repairs").update({"sq": str(idx)}).eq("id", r["id"]).execute()
            updates += 1
        return {"updated": updates}
    except Exception as e:
        logger.error(f"Error resequencing SQ: {e}")
        raise HTTPException(status_code=500, detail="Failed to resequence SQ")

@router.post("/{repair_id}/complete")
async def complete_repair(
    request: Request,
    repair_id: str,
    technician: str = Query(..., description="Technician who performed the repair"),
    action_taken: str = Query(..., description="Action taken to complete the repair"),
    completion_notes: Optional[str] = Query(None, description="Additional completion notes"),
    repair_closed: Optional[str] = Query(None, description="Date completed in ISO or YYYY-MM-DD"),
    current_user = Depends(get_current_user)
):
    """Mark repair as completed and add to service history"""
    supabase = get_supabase()
    
    try:
        logger.info(f"Completing repair {repair_id} by technician {technician}")
        
        # Check if repair exists
        existing = supabase.table("repairs").select("*").eq("id", repair_id).execute()
        if not existing.data:
            logger.error(f"Repair {repair_id} not found")
            raise HTTPException(status_code=404, detail="Repair not found")
        
        repair = existing.data[0]
        logger.info(f"Found repair: {repair.get('sq', 'N/A')} - {repair.get('company_name', 'N/A')}")
        
        # Determine closed timestamp
        closed_ts = None
        if repair_closed:
            try:
                # Accept YYYY-MM-DD or ISO strings
                if len(repair_closed) == 10:
                    closed_ts = datetime.fromisoformat(repair_closed).isoformat()
                else:
                    closed_ts = datetime.fromisoformat(repair_closed.replace('Z', '+00:00')).isoformat()
            except Exception:
                # Fallback to now if parsing fails
                closed_ts = datetime.utcnow().isoformat()
        else:
            closed_ts = datetime.utcnow().isoformat()
        
        # Update repair with completion details
        update_data = {
            "status": "completed",
            "repair_closed": closed_ts,
            "technician_notes": f"Completed by: {technician}. Action: {action_taken}. {completion_notes or ''}",
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Update repair record
        logger.info("Updating repair record...")
        update_response = supabase.table("repairs").update(update_data).eq("id", repair_id).execute()
        if update_response.data is None:
            logger.error("Failed to update repair record")
            raise HTTPException(status_code=500, detail="Failed to update repair record")
        
        logger.info("Repair record updated successfully")
        
        # Log audit trail (optional - don't fail if this doesn't work)
        try:
            AuditService.log_repair_activity(
                repair_id=repair_id,
                action=AuditAction.UPDATE,
                description=f"Repair completed by {technician}. Action: {action_taken}",
                user_id=current_user.id,
                ip_address=request.client.host if request.client else None
            )
            logger.info("Audit trail logged successfully")
        except Exception as audit_error:
            logger.warning(f"Audit trail logging failed: {audit_error} - continuing without it")
            # Don't fail the operation if audit logging fails
        
        logger.info(f"Repair {repair_id} completed successfully")
        return {
            "message": "Repair completed successfully",
            "repair_id": repair_id,
            "repair_status": "completed",
            "repair_closed": closed_ts
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing repair: {e}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error details: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing repair: {str(e)}"
        )

@router.delete("/{repair_id}")
async def delete_repair(request: Request, repair_id: str, current_user = Depends(get_current_user)):
    """Delete a repair record"""
    supabase = get_supabase()
    
    # Check if repair exists
    existing = supabase.table("repairs").select("*").eq("id", repair_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Repair not found")
    
    repair_data = existing.data[0]
    
    result = supabase.table("repairs").delete().eq("id", repair_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to delete repair")
    
    # Log audit trail
    AuditService.log_repair_activity(
        repair_id=repair_id,
        action=AuditAction.DELETE,
        description=f"Repair deleted by {current_user.full_name}: {repair_data.get('company_name')} - {repair_data.get('device_model')}",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Repair deleted successfully"}

@router.get("/stats/summary")
async def get_repair_stats(current_user = Depends(get_current_user)):
    """Get repair statistics summary"""
    supabase = get_supabase()
    
    # Get total repairs
    total_result = supabase.table("repairs").select("id", count="exact").execute()
    total_repairs = total_result.count or 0
    
    # Get repairs by status
    status_stats = {}
    for status in RepairStatus:
        result = supabase.table("repairs").select("id", count="exact").eq("status", status.value).execute()
        status_stats[status.value] = result.count or 0
    
    # Get recent repairs (last 30 days)
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    recent_result = supabase.table("repairs").select("id", count="exact").gte("created_at", thirty_days_ago).execute()
    recent_repairs = recent_result.count or 0
    
    return {
        "total_repairs": total_repairs,
        "status_breakdown": status_stats,
        "recent_repairs": recent_repairs
    }
