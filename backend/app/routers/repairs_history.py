from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from app.models import User
from app.auth import get_current_user
from app.database import get_supabase
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/repairs-history")
async def get_repairs_history(
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1),  # No limit by default
    company_name: Optional[str] = None,
    device_model: Optional[str] = None,
    technician: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get repairs history - completed repairs only"""
    supabase = get_supabase()
    
    try:
        # Get completed repairs only
        query = supabase.table("repairs").select("*")
        query = query.eq("status", "completed")
        
        # Apply filters
        if company_name:
            query = query.ilike("company_name", f"%{company_name}%")
        if device_model:
            query = query.ilike("device_model", f"%{device_model}%")
        if technician:
            query = query.ilike("technician_notes", f"%{technician}%")
        
        # Apply pagination only if limit is specified
        if limit is not None:
            response = query.order("repair_closed", desc=True).range(skip, skip + limit - 1).execute()
        else:
            # No limit - get all records
            response = query.order("repair_closed", desc=True).execute()
        
        # Format the data for repairs history
        repairs_history = []
        for repair in response.data:
            # Derive clean technician and action strings
            notes = repair.get("technician_notes", "") or ""
            tech_name = ""
            action_txt = repair.get("action_taken", "") or ""
            try:
                import re
                m = re.search(r"Completed by:\s*([^\.]+)\.", notes, re.IGNORECASE)
                if m:
                    tech_name = m.group(1).strip()
                if not action_txt:
                    ma = re.search(r"Action:\s*([^\.]+?)(?:\.|\s*Notes:|$)", notes, re.IGNORECASE)
                    if ma:
                        action_txt = ma.group(1).strip()
            except Exception:
                pass
            
            repairs_history.append({
                "id": repair["id"],
                "sq": repair["sq"],
                "date_received": repair["date_received"],
                "repair_closed": repair["repair_closed"],
                "company_name": repair["company_name"],
                "device_model": repair["device_model"],
                "serial_number": repair["serial_number"],
                "part_number": repair["part_number"],
                "rma_case": repair.get("rma_case", ""),
                "technician": tech_name or repair.get("technician", ""),
                "action_taken": action_txt,
                "completion_notes": repair.get("completion_notes", ""),
                "description": repair.get("description", ""),
                "created_at": repair["created_at"]
            })
        
        return repairs_history
        
    except Exception as e:
        logger.error(f"Error fetching repairs history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching repairs history"
        )

@router.get("/repairs-history/stats")
async def get_repairs_history_stats(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get repairs history statistics"""
    supabase = get_supabase()
    
    try:
        # Get completed repairs in the last N days
        from datetime import datetime, timedelta
        start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        response = supabase.table("repairs").select("*").eq("status", "completed").gte("repair_closed", start_date).execute()
        
        repairs = response.data or []
        
        # Calculate statistics
        total_repairs = len(repairs)
        
        # Group by company
        companies = {}
        for repair in repairs:
            company = repair.get("company_name", "Unknown")
            companies[company] = companies.get(company, 0) + 1
        
        # Group by device model
        models = {}
        for repair in repairs:
            model = repair.get("device_model", "Unknown")
            models[model] = models.get(model, 0) + 1
        
        return {
            "total_repairs": total_repairs,
            "top_companies": sorted(companies.items(), key=lambda x: x[1], reverse=True)[:5],
            "top_models": sorted(models.items(), key=lambda x: x[1], reverse=True)[:5],
            "period_days": days
        }
        
    except Exception as e:
        logger.error(f"Error fetching repairs history stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching repairs history statistics"
        )

@router.get("/repairs-history/export/excel")
async def export_repairs_history_excel(
    company_name: Optional[str] = None,
    device_model: Optional[str] = None,
    technician: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export repairs history to Excel"""
    from app.utils import generate_repairs_history_excel
    
    try:
        # Get all completed repairs
        supabase = get_supabase()
        query = supabase.table("repairs").select("*").eq("status", "completed")
        
        if company_name:
            query = query.ilike("company_name", f"%{company_name}%")
        if device_model:
            query = query.ilike("device_model", f"%{device_model}%")
        if technician:
            query = query.ilike("technician_notes", f"%{technician}%")
        
        response = query.order("repair_closed", desc=True).execute()
        
        # Generate Excel file
        excel_data = generate_repairs_history_excel(response.data)
        
        return {
            "filename": f"repairs_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
            "data": excel_data
        }
        
    except Exception as e:
        logger.error(f"Error exporting repairs history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error exporting repairs history"
        )
