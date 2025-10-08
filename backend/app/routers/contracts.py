from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from app.database import get_supabase
from app.models import (
    HardwareContract, HardwareContractCreate, HardwareContractUpdate,
    LabelContract, LabelContractCreate, LabelContractUpdate,
    ContractSummary, DashboardStats, User, AuditAction, ServiceHistoryCreate
)
from app.auth import get_current_user, require_technician_or_admin, require_admin
from app.services.audit_service import AuditService
from app.scheduler import calculate_next_pms_from_contract_date, generate_full_pms_schedule
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

def ensure_service_history_table_exists(supabase):
    """Ensure service_history table exists, create it if it doesn't"""
    try:
        # Try to query the table to see if it exists
        test_response = supabase.table("service_history").select("id").limit(1).execute()
        return True
    except Exception as e:
        if "relation \"service_history\" does not exist" in str(e).lower() or "table \"service_history\" does not exist" in str(e).lower():
            logger.info("service_history table does not exist, creating it...")
            
            # Create the table
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS service_history (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                contract_id UUID NOT NULL,
                contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('hardware', 'label')),
                service_date TIMESTAMP WITH TIME ZONE NOT NULL,
                service_type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                technician VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'pending', 'cancelled')),
                service_report TEXT,
                attachments TEXT[],
                -- Additional fields for the new table format
                company VARCHAR(255),
                location VARCHAR(255),
                model VARCHAR(255),
                serial VARCHAR(255),
                sales VARCHAR(255),
                sr_number VARCHAR(255),
                created_by UUID NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """
            
            try:
                # Execute the SQL using Supabase RPC
                supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
                logger.info("service_history table created successfully")
                return True
            except Exception as create_error:
                logger.error(f"Error creating service_history table: {create_error}")
                return False
        else:
            logger.error(f"Unexpected error checking service_history table: {e}")
            return False

# Helper: get next sequential SQ per table
def _get_next_sq(supabase, table_name: str, sq_field: str = "sq") -> str:
    try:
        resp = supabase.table(table_name).select(f"{sq_field}, created_at").order("created_at", desc=True).limit(1).execute()
        last = (resp.data or [])[:1]
        if last:
            raw = str(last[0].get(sq_field) or '').strip()
            try:
                return str(int(raw) + 1)
            except Exception:
                pass
        return "1"
    except Exception:
        return "1"

# Backfill helpers
def _backfill_sq_for_table(supabase, table_name: str):
    resp = supabase.table(table_name).select("id, sq, created_at").order("created_at", desc=False).execute()
    rows = resp.data or []

    used = set()
    for r in rows:
        s = str(r.get("sq") or "").strip()
        if s.isdigit():
            used.add(int(s))

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
            supabase.table(table_name).update({"sq": str(n)}).eq("id", r["id"]).execute()
            updates += 1
    return {"updated": updates, "total": len(rows)}

@router.post("/hardware/backfill-sq")
async def backfill_hardware_sq(current_user: User = Depends(require_admin)):
    supabase = get_supabase()
    try:
        return _backfill_sq_for_table(supabase, "hardware_contracts")
    except Exception as e:
        logger.error(f"Error backfilling hardware sq: {e}")
        raise HTTPException(status_code=500, detail="Failed to backfill SQ for hardware")

@router.post("/label/backfill-sq")
async def backfill_label_sq(current_user: User = Depends(require_admin)):
    supabase = get_supabase()
    try:
        return _backfill_sq_for_table(supabase, "label_contracts")
    except Exception as e:
        logger.error(f"Error backfilling label sq: {e}")
        raise HTTPException(status_code=500, detail="Failed to backfill SQ for label")

@router.post("/hardware/resequence-sq")
async def resequence_hardware_sq(current_user: User = Depends(require_admin)):
    supabase = get_supabase()
    try:
        resp = supabase.table("hardware_contracts").select("id, created_at").order("created_at", desc=False).execute()
        rows = resp.data or []
        for idx, r in enumerate(rows, start=1):
            supabase.table("hardware_contracts").update({"sq": str(idx)}).eq("id", r["id"]).execute()
        return {"updated": len(rows)}
    except Exception as e:
        logger.error(f"Error resequencing hardware sq: {e}")
        raise HTTPException(status_code=500, detail="Failed to resequence SQ for hardware")

@router.post("/label/resequence-sq")
async def resequence_label_sq(current_user: User = Depends(require_admin)):
    supabase = get_supabase()
    try:
        resp = supabase.table("label_contracts").select("id, created_at").order("created_at", desc=False).execute()
        rows = resp.data or []
        for idx, r in enumerate(rows, start=1):
            supabase.table("label_contracts").update({"sq": str(idx)}).eq("id", r["id"]).execute()
        return {"updated": len(rows)}
    except Exception as e:
        logger.error(f"Error resequencing label sq: {e}")
        raise HTTPException(status_code=500, detail="Failed to resequence SQ for label")

# Hardware Contract Endpoints
@router.get("/hardware", response_model=List[HardwareContract])
async def get_hardware_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    contract_status: Optional[str] = None,
    branch: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        query = supabase.table("hardware_contracts").select("*")
        
        if contract_status:
            query = query.eq("status", contract_status)
        if branch:
            query = query.eq("branch", branch)
        
        response = query.range(skip, skip + limit - 1).execute()
        sanitized = []
        for contract in response.data or []:
            item = dict(contract)
            # Handle None values for required fields
            if item.get("created_by") is None:
                item["created_by"] = ""
            if item.get("updated_at") is None:
                item["updated_at"] = item.get("created_at")
            
            # Handle None values for optional fields that might cause validation errors
            for field in ["branch", "technical_specialist", "po_number", "status", "frequency"]:
                if item.get(field) is None:
                    item[field] = None
            
            sanitized.append(HardwareContract(**item))
        
        # Sort by SQ number in ascending order (1, 2, 3, 4...)
        sanitized.sort(key=lambda x: int(x.sq) if x.sq.isdigit() else float('inf'))
        return sanitized
        
    except Exception as e:
        logger.error(f"Error fetching hardware contracts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching hardware contracts"
        )

@router.post("/hardware", response_model=HardwareContract)
async def create_hardware_contract(
    request: Request,
    contract: HardwareContractCreate,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()

    try:
        data = contract.dict()
        date_of_contract = data.get("date_of_contract") or datetime.utcnow()

        # Auto SQ when blank
        if not (data.get("sq") and str(data.get("sq")).strip()):
            data["sq"] = _get_next_sq(supabase, "hardware_contracts")

        # Calculate next PMS schedule based on contract date (hardware: every 3 months)
        next_pms_schedule = data.get("next_pms_schedule")
        if not next_pms_schedule and date_of_contract:
            next_pms_schedule = calculate_next_pms_from_contract_date(date_of_contract, "hardware")

        insert_data = {
            "sq": data.get("sq"),
            "end_user": data.get("end_user"),
            "model": data.get("model"),
            "serial": data.get("serial"),
            "next_pms_schedule": to_iso(next_pms_schedule),
            "branch": data.get("branch"),
            "technical_specialist": data.get("technical_specialist"),
            # Provide defaults for legacy NOT NULL columns in DB
            "date_of_contract": to_iso(date_of_contract),
            "end_of_contract": to_iso(data.get("end_of_contract") or datetime.utcnow()),
            "status": data.get("status") or "active",
            "po_number": data.get("po_number") or "",
            "frequency": data.get("frequency") or "monthly",
            "documentation": data.get("documentation") or "",
            "service_report": data.get("service_report") or "",
            "history": data.get("history") or "",
            "reports": data.get("reports") or "",

            "created_by": str(current_user.id),
            "created_at": to_iso(datetime.utcnow()),
            "updated_at": to_iso(datetime.utcnow()),
        }




        # 🔍 log each field and type
        logger.info("---- INSERT DATA DEBUG ----")
        for key, value in insert_data.items():
            logger.info(f"{key}: {value} ({type(value)})")
        logger.info("---- END DEBUG ----")

        response = supabase.table("hardware_contracts").insert(insert_data).execute()


        logger.info(f"Supabase response: {response}")
        logger.info(f"Supabase response data: {getattr(response, 'data', None)}")

        # Check for errors in the response
        if hasattr(response, 'error') and response.error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supabase insert error: {response.error}"
            )
        
        # Check if we have data
        response_data = getattr(response, 'data', None)
        if not response_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create hardware contract (no data returned)"
            )

        created_contract = HardwareContract(**response_data[0])
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=created_contract.id,
            contract_type="hardware_contract",
            action=AuditAction.CREATE,
            description=f"Hardware contract created by {current_user.full_name}: {created_contract.sq} - {created_contract.end_user}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return created_contract

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()  # full stack trace
        logger.error(f"Unexpected error creating hardware contract: {e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error creating hardware contract: {str(e)}"
        )



@router.get("/hardware/{contract_id}", response_model=HardwareContract)
async def get_hardware_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        response = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        return HardwareContract(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching hardware contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching hardware contract"
        )

from datetime import datetime
from enum import Enum

def to_iso(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)

def to_primitive(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value



@router.put("/hardware/{contract_id}", response_model=HardwareContract)
async def update_hardware_contract(
    request: Request,
    contract_id: str,
    contract_update: HardwareContractUpdate,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        # Check if contract exists
        existing = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        # Update contract
        # Normalize datetimes to ISO strings
        raw_update = {k: v for k, v in contract_update.dict().items() if v is not None}
        update_data = {k: to_iso(v) for k, v in raw_update.items()}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        response = supabase.table("hardware_contracts").update(update_data).eq("id", contract_id).execute()
        response_data = getattr(response, "data", None)
        if not response_data:
            # Fallback: fetch the updated row
            fetch = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
            if not fetch.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update hardware contract"
                )
            response_data = fetch.data
        
        updated_contract = HardwareContract(**response_data[0])
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="hardware_contract",
            action=AuditAction.UPDATE,
            description=f"Hardware contract updated by {current_user.full_name}: {updated_contract.end_user}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return updated_contract
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating hardware contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/hardware/{contract_id}")
async def delete_hardware_contract(
    request: Request,
    contract_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Get contract details before deletion for audit trail
        existing = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        contract_data = existing.data[0]
        
        response = supabase.table("hardware_contracts").delete().eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="hardware_contract",
            action=AuditAction.DELETE,
            description=f"Hardware contract deleted by {current_user.full_name}: {contract_data.get('sq')} - {contract_data.get('end_user')}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
            )
        
        return {"message": "Hardware contract deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting hardware contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting hardware contract"
        )

# Label Contract Endpoints (similar structure)
@router.get("/label", response_model=List[LabelContract])
async def get_label_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    contract_status: Optional[str] = None,
    branch: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        query = supabase.table("label_contracts").select("*")
        
        if contract_status:
            query = query.eq("status", contract_status)
        if branch:
            query = query.eq("branch", branch)
        
        response = query.range(skip, skip + limit - 1).execute()
        sanitized = []
        for contract in response.data or []:
            item = dict(contract)
            if item.get("created_by") is None:
                item["created_by"] = ""
            if item.get("updated_at") is None:
                item["updated_at"] = item.get("created_at")
            sanitized.append(LabelContract(**item))
        
        # Sort by SQ number in ascending order (1, 2, 3, 4...)
        sanitized.sort(key=lambda x: int(x.sq) if x.sq.isdigit() else float('inf'))
        return sanitized
        
    except Exception as e:
        logger.error(f"Error fetching label contracts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching label contracts"
        )

@router.get("/label/{contract_id}", response_model=LabelContract)
async def get_label_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        response = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        contract = LabelContract(**response.data[0])
        # Audit VIEW for single item
        AuditService.log_activity(
            entity_type="label_contract",
            entity_id=contract_id,
            action=AuditAction.VIEW,
            description=f"Viewed label contract: {contract.sq} - {contract.end_user}",
            user_id=current_user.id,
            ip_address=None
        )
        return contract
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching label contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching label contract"
        )

@router.post("/label", response_model=LabelContract)
async def create_label_contract(
    request: Request,
    contract: LabelContractCreate,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        data = contract.dict()
        date_of_contract = data.get("date_of_contract") or datetime.utcnow()

        # Auto SQ when blank
        if not (data.get("sq") and str(data.get("sq")).strip()):
            data["sq"] = _get_next_sq(supabase, "label_contracts")

        # Calculate next PMS schedule based on contract date (label: every 1 month)
        next_pms_schedule = data.get("next_pms_schedule")
        if not next_pms_schedule and date_of_contract:
            next_pms_schedule = calculate_next_pms_from_contract_date(date_of_contract, "label")

        insert_data = {
            "sq": data.get("sq"),
            "end_user": data.get("end_user"),
            "part_number": data.get("part_number"),
            "serial": data.get("serial"),
            "next_pms_schedule": to_iso(next_pms_schedule),
            "branch": data.get("branch"),
            "technical_specialist": data.get("technical_specialist"),
            # Defaults for legacy NOT NULL columns
            "date_of_contract": to_iso(date_of_contract),
            "end_of_contract": to_iso(data.get("end_of_contract") or datetime.utcnow()),
            "status": data.get("status") or "active",
            "po_number": data.get("po_number") or "",
            "frequency": data.get("frequency") or "monthly",
            "documentation": data.get("documentation") or "",
            "service_report": data.get("service_report") or "",
            "history": data.get("history") or "",
            "reports": data.get("reports") or "",
            
            "created_by": str(current_user.id),
            "created_at": to_iso(datetime.utcnow()),
            "updated_at": to_iso(datetime.utcnow()),
        }
        
        response = supabase.table("label_contracts").insert(insert_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create label contract"
            )
        
        created_contract = LabelContract(**response.data[0])
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=created_contract.id,
            contract_type="label_contract",
            action=AuditAction.CREATE,
            description=f"Label contract created by {current_user.full_name}: {created_contract.sq} - {created_contract.end_user}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return created_contract
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating label contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating label contract"
        )

@router.put("/label/{contract_id}", response_model=LabelContract)
async def update_label_contract(
    request: Request,
    contract_id: str,
    contract_update: LabelContractUpdate,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        # Check if contract exists
        existing = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        # Update contract
        # Normalize datetimes to ISO strings similar to hardware update
        raw_update = {k: v for k, v in contract_update.dict().items() if v is not None}
        update_data = {k: to_primitive(v) for k, v in raw_update.items()}
        logger.info("Label update payload: %s", update_data)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        response = supabase.table("label_contracts").update(update_data).eq("id", contract_id).execute()
        response_data = getattr(response, "data", None)
        if not response_data:
            # Fallback: fetch the updated row in case Supabase doesn't return it
            fetch = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
            if not fetch.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update label contract"
                )
            response_data = fetch.data

        # Ensure required fields exist for Pydantic (created_by may be NULL in legacy rows)
        # Use previous value from existing row when missing
        row = dict(response_data[0])
        if row.get("created_by") is None:
            prev_created_by = existing.data[0].get("created_by") if existing and existing.data else ""
            row["created_by"] = prev_created_by or ""

        updated_contract = LabelContract(**row)
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="label_contract",
            action=AuditAction.UPDATE,
            description=f"Label contract updated by {current_user.full_name}: {updated_contract.end_user}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return updated_contract
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating label contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating label contract"
        )

@router.delete("/label/{contract_id}")
async def delete_label_contract(
    request: Request,
    contract_id: str,
    current_user: User = Depends(require_admin)
):
    supabase = get_supabase()
    
    try:
        # Get contract details before deletion for audit trail
        existing = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        contract_data = existing.data[0]
        
        response = supabase.table("label_contracts").delete().eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="label_contract",
            action=AuditAction.DELETE,
            description=f"Label contract deleted by {current_user.full_name}: {contract_data.get('sq')} - {contract_data.get('end_user')}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
            )
        
        return {"message": "Label contract deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting label contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting label contract"
        )

# Dashboard and Analytics Endpoints
@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    supabase = get_supabase()
    
    try:
        # Get hardware contract stats
        hw_response = supabase.table("hardware_contracts").select("status").execute()
        hw_contracts = hw_response.data
        
        # Get label contract stats
        label_response = supabase.table("label_contracts").select("status").execute()
        label_contracts = label_response.data
        
        all_contracts = hw_contracts + label_contracts
        
        total_contracts = len(all_contracts)
        active_contracts = len([c for c in all_contracts if c["status"] == "active"])
        expired_contracts = len([c for c in all_contracts if c["status"] == "expired"])
        
        # Get upcoming maintenance (next 30 days) - exclude expired contracts
        upcoming_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        upcoming_hw = supabase.table("hardware_contracts").select("id").lte("next_pms_schedule", upcoming_date).neq("status", "expired").execute()
        upcoming_label = supabase.table("label_contracts").select("id").lte("next_pms_schedule", upcoming_date).neq("status", "expired").execute()
        upcoming_maintenance = len(upcoming_hw.data) + len(upcoming_label.data)
        
        # Get service history stats
        history_response = supabase.table("service_history").select("status").execute()
        service_history = history_response.data
        
        completed_maintenance = len([s for s in service_history if s["status"] == "completed"])
        pending_maintenance = len([s for s in service_history if s["status"] == "pending"])
        
        return DashboardStats(
            total_contracts=total_contracts,
            active_contracts=active_contracts,
            expired_contracts=expired_contracts,
            upcoming_maintenance=upcoming_maintenance,
            completed_maintenance=completed_maintenance,
            pending_maintenance=pending_maintenance
        )
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching dashboard stats"
        )

@router.get("/upcoming", response_model=List[ContractSummary])
async def get_upcoming_maintenance(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        upcoming_date = (now + timedelta(days=days)).isoformat()
        
        # Get upcoming hardware contracts (including overdue ones) - exclude expired
        hw_response = supabase.table("hardware_contracts").select("*").lte("next_pms_schedule", upcoming_date).neq("status", "expired").execute()
        hw_contracts = []
        
        for contract in hw_response.data:
            if contract.get("next_pms_schedule") and contract.get("status") != "expired":
                next_maintenance = datetime.fromisoformat(contract["next_pms_schedule"].replace('Z', '+00:00'))
                days_until = (next_maintenance - now).days
                
                # Include overdue contracts (negative days) and upcoming contracts
                hw_contracts.append(ContractSummary(
                    id=contract["id"],
                    sq=contract["sq"],
                    end_user=contract["end_user"],
                    serial=contract["serial"],
                    next_pms_schedule=contract["next_pms_schedule"],
                    status=contract["status"],
                    contract_type="hardware",
                    days_until_maintenance=days_until,
                    branch=contract.get("branch")
                ))
        
        # Get upcoming label contracts (including overdue ones) - exclude expired
        label_response = supabase.table("label_contracts").select("*").lte("next_pms_schedule", upcoming_date).neq("status", "expired").execute()
        label_contracts = []
        
        for contract in label_response.data:
            if contract.get("next_pms_schedule") and contract.get("status") != "expired":
                next_maintenance = datetime.fromisoformat(contract["next_pms_schedule"].replace('Z', '+00:00'))
                days_until = (next_maintenance - now).days
                
                # Include overdue contracts (negative days) and upcoming contracts
                label_contracts.append(ContractSummary(
                    id=contract["id"],
                    sq=contract["sq"],
                    end_user=contract["end_user"],
                    serial=contract["serial"],
                    next_pms_schedule=contract["next_pms_schedule"],
                    status=contract["status"],
                    contract_type="label",
                    days_until_maintenance=days_until,
                    branch=contract.get("branch")
                ))
        
        all_upcoming = hw_contracts + label_contracts
        # Sort by urgency: overdue first (negative days), then by days until maintenance
        all_upcoming.sort(key=lambda x: (x.days_until_maintenance, int(x.sq) if x.sq.isdigit() else float('inf')))
        
        return all_upcoming
        
    except Exception as e:
        logger.error(f"Error fetching upcoming maintenance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching upcoming maintenance"
        )

# Inventory endpoint - combined hardware and label contracts
@router.get("/inventory", response_model=List[ContractSummary])
async def get_inventory(
    branch: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Hardware
        hw_query = supabase.table("hardware_contracts").select("*")
        if branch:
            hw_query = hw_query.eq("branch", branch)
        if status_filter:
            hw_query = hw_query.eq("status", status_filter)
        hw_response = hw_query.execute()
        hardware_items = [
            ContractSummary(
                id=item["id"],
                sq=item.get("sq", ""),
                end_user=item.get("end_user", ""),
                serial=item.get("serial", ""),
                next_pms_schedule=item.get("next_pms_schedule"),
                status=item.get("status", ""),
                contract_type="hardware"
            )
            for item in (hw_response.data or [])
        ]
        
        # Label
        label_query = supabase.table("label_contracts").select("*")
        if branch:
            label_query = label_query.eq("branch", branch)
        if status_filter:
            label_query = label_query.eq("status", status_filter)
        label_response = label_query.execute()
        label_items = [
            ContractSummary(
                id=item["id"],
                sq=item.get("sq", ""),
                end_user=item.get("end_user", ""),
                serial=item.get("serial", ""),
                next_pms_schedule=item.get("next_pms_schedule"),
                status=item.get("status", ""),
                contract_type="label"
            )
            for item in (label_response.data or [])
        ]
        
        return hardware_items + label_items
    except Exception as e:
        logger.error(f"Error fetching inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching inventory"
        )

# Quarterly scheduling notifications (overdue + next 9 days)
@router.get("/notifications/quarterly", response_model=dict)
async def get_quarterly_notifications(
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    try:
        now_iso = datetime.utcnow().isoformat()
        end_iso = (datetime.utcnow() + timedelta(days=9)).isoformat()

        # Hardware due (including overdue contracts) - exclude expired
        hw = supabase.table("hardware_contracts").select("id,sq,end_user,serial,next_pms_schedule,status,branch").lte("next_pms_schedule", end_iso).neq("status", "expired").execute()
        # Label due (including overdue contracts) - exclude expired
        lb = supabase.table("label_contracts").select("id,sq,end_user,serial,next_pms_schedule,status,branch").lte("next_pms_schedule", end_iso).neq("status", "expired").execute()

        items = []
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        overdue_items = []
        upcoming_items = []
        
        for item in (hw.data or []):
            if item.get("next_pms_schedule") and item.get("status") != "expired":
                next_maintenance = datetime.fromisoformat(item["next_pms_schedule"].replace('Z', '+00:00'))
                days_until = (next_maintenance - now).days
                item_data = {
                    "contract_type": "hardware",
                    "days_until": days_until,
                    "is_overdue": days_until < 0,
                    **item
                }
                items.append(item_data)
                if days_until < 0:
                    overdue_items.append(item_data)
                else:
                    upcoming_items.append(item_data)
        
        for item in (lb.data or []):
            if item.get("next_pms_schedule") and item.get("status") != "expired":
                next_maintenance = datetime.fromisoformat(item["next_pms_schedule"].replace('Z', '+00:00'))
                days_until = (next_maintenance - now).days
                item_data = {
                    "contract_type": "label",
                    "days_until": days_until,
                    "is_overdue": days_until < 0,
                    **item
                }
                items.append(item_data)
                if days_until < 0:
                    overdue_items.append(item_data)
                else:
                    upcoming_items.append(item_data)

        # Group by urgency: Overdue first, then by YYYY-MM for upcoming
        grouped: dict = {}
        
        # Add overdue section if there are overdue items
        if overdue_items:
            grouped["Overdue"] = {
                "hardware": [item for item in overdue_items if item["contract_type"] == "hardware"],
                "label": [item for item in overdue_items if item["contract_type"] == "label"],
                "total": len(overdue_items)
            }
        
        # Group upcoming items by YYYY-MM
        for it in upcoming_items:
            dt = it.get("next_pms_schedule")
            try:
                month_key = datetime.fromisoformat(str(dt).replace('Z', '+00:00')).strftime("%Y-%m")
            except Exception:
                month_key = "unknown"
            grouped.setdefault(month_key, {"hardware": [], "label": []})
            grouped[month_key][it["contract_type"]].append(it)

        # Summary counts
        summary = {}
        total = 0
        for k, v in grouped.items():
            hw_count = len(v["hardware"]) 
            lb_count = len(v["label"]) 
            summary[k] = {"hardware": hw_count, "label": lb_count, "total": hw_count + lb_count}
            total += summary[k]["total"]

        return {"total_due": total, "by_month": summary, "items": items, "overdue_count": len(overdue_items)}
    except Exception as e:
        logger.error(f"Error fetching quarterly notifications: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error fetching quarterly notifications")

# Get full PMS schedule for a contract
@router.get("/hardware/{contract_id}/pms-schedule")
async def get_hardware_pms_schedule(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get full PMS schedule for a hardware contract"""
    supabase = get_supabase()
    
    try:
        # Get contract details
        response = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        contract = response.data[0]
        contract_date = contract.get("date_of_contract")
        end_date = contract.get("end_of_contract")
        
        # Generate full PMS schedule
        pms_schedules = generate_full_pms_schedule(contract_date, end_date, "hardware")
        
        return {
            "contract_id": contract_id,
            "contract_type": "hardware",
            "contract_date": contract_date,
            "end_date": end_date,
            "pms_schedules": pms_schedules,
            "total_schedules": len(pms_schedules)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching hardware PMS schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching hardware PMS schedule"
        )

@router.get("/label/{contract_id}/pms-schedule")
async def get_label_pms_schedule(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get full PMS schedule for a label contract"""
    supabase = get_supabase()
    
    try:
        # Get contract details
        response = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        contract = response.data[0]
        contract_date = contract.get("date_of_contract")
        end_date = contract.get("end_of_contract")
        
        # Generate full PMS schedule
        pms_schedules = generate_full_pms_schedule(contract_date, end_date, "label")
        
        return {
            "contract_id": contract_id,
            "contract_type": "label",
            "contract_date": contract_date,
            "end_date": end_date,
            "pms_schedules": pms_schedules,
            "total_schedules": len(pms_schedules)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching label PMS schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching label PMS schedule"
        )

# Mark PMS as completed and move to service history
@router.post("/hardware/{contract_id}/complete-pms")
async def complete_hardware_pms(
    request: Request,
    contract_id: str,
    technician: Optional[str] = Query(None, description="Technical specialist who performed the service"),
    service_report: Optional[str] = Query(None, description="Service report details"),
    sr_number: Optional[str] = Query(None, description="Service report number"),
    sales_name: Optional[str] = Query(None, description="Sales person name"),
    location: Optional[str] = Query(None, description="Company location"),
    completion_date: Optional[str] = Query(None, description="Date when PMS was completed (YYYY-MM-DD format)"),
    current_user: User = Depends(require_technician_or_admin)
):
    """Mark hardware contract PMS as completed and move to service history"""
    supabase = get_supabase()
    
    try:
        # Get contract details
        contract_response = supabase.table("hardware_contracts").select("*").eq("id", contract_id).execute()
        
        if not contract_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hardware contract not found"
            )
        
        contract = contract_response.data[0]
        
        # Parse completion date or use current date
        from datetime import datetime
        if completion_date:
            try:
                completion_datetime = datetime.fromisoformat(completion_date)
            except:
                completion_datetime = datetime.utcnow()
        else:
            completion_datetime = datetime.utcnow()
        
        # Use provided SR number or generate one if not provided
        if not sr_number:
            sr_number = f"SR-{completion_datetime.strftime('%Y%m%d')}-{contract_id[:8].upper()}"
        
        # Use provided sales name or fallback to PO number
        sales_info = sales_name if sales_name else contract['po_number']
        
        # Use provided location or fallback to contract branch
        company_location = location if location else contract['branch']
        
        # Use provided technician or fallback to current user or contract technical specialist
        technician_name = technician if technician else (current_user.full_name if current_user.full_name else contract.get('technical_specialist', 'System User'))
        
        # Create service history entry with all contract details
        service_history_data = {
            "contract_id": contract_id,
            "contract_type": "hardware",
            "service_date": completion_datetime.isoformat(),
            "service_type": "PMS",
            "description": f"PMS completed for {contract['sq']} - {contract['end_user']}",
            "technician": technician_name,
            "status": "completed",
            "service_report": service_report or f"PMS service completed by {technician_name}",
            # Additional fields for the new table format
            "company": contract['end_user'],
            "location": company_location,
            "model": contract['model'],
            "serial": contract['serial'],
            "sales": sales_info,
            "sr_number": sr_number,
            "created_by": str(current_user.id),
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Ensure service_history table exists
        if not ensure_service_history_table_exists(supabase):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or access service_history table. Please contact administrator."
            )
        
        # Insert into service history
        try:
            history_response = supabase.table("service_history").insert(service_history_data).execute()
            
            if not history_response.data:
                logger.error(f"Failed to insert service history: {history_response}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create service history entry"
                )
        except Exception as e:
            logger.error(f"Error inserting service history: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        
        # Update next PMS schedule - use completion date as base for next schedule
        next_pms = completion_datetime + timedelta(days=90)  # 3 months for hardware
        
        # Update contract with new PMS schedule
        supabase.table("hardware_contracts").update({
            "next_pms_schedule": next_pms.isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", contract_id).execute()
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="hardware_contract",
            action=AuditAction.UPDATE,
            description=f"PMS completed by {technician_name} for {contract['end_user']}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "message": "PMS completed successfully",
            "service_history_id": history_response.data[0]["id"],
            "next_pms_schedule": next_pms.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing hardware PMS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error completing hardware PMS"
        )

@router.post("/label/{contract_id}/complete-pms")
async def complete_label_pms(
    request: Request,
    contract_id: str,
    technician: Optional[str] = Query(None, description="Technical specialist who performed the service"),
    service_report: Optional[str] = Query(None, description="Service report details"),
    sr_number: Optional[str] = Query(None, description="Service report number"),
    sales_name: Optional[str] = Query(None, description="Sales person name"),
    location: Optional[str] = Query(None, description="Company location"),
    completion_date: Optional[str] = Query(None, description="Date when PMS was completed (YYYY-MM-DD format)"),
    current_user: User = Depends(require_technician_or_admin)
):
    """Mark label contract PMS as completed and move to service history"""
    supabase = get_supabase()
    
    try:
        # Get contract details
        contract_response = supabase.table("label_contracts").select("*").eq("id", contract_id).execute()
        
        if not contract_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label contract not found"
            )
        
        contract = contract_response.data[0]
        
        # Parse completion date or use current date
        from datetime import datetime
        if completion_date:
            try:
                completion_datetime = datetime.fromisoformat(completion_date)
            except:
                completion_datetime = datetime.utcnow()
        else:
            completion_datetime = datetime.utcnow()
        
        # Use provided SR number or generate one if not provided
        if not sr_number:
            sr_number = f"SR-{completion_datetime.strftime('%Y%m%d')}-{contract_id[:8].upper()}"
        
        # Use provided sales name or fallback to PO number
        sales_info = sales_name if sales_name else contract['po_number']
        
        # Use provided location or fallback to contract branch
        company_location = location if location else contract['branch']
        
        # Use provided technician or fallback to current user or contract technical specialist
        technician_name = technician if technician else (current_user.full_name if current_user.full_name else contract.get('technical_specialist', 'System User'))
        
        # Create service history entry with all contract details
        service_history_data = {
            "contract_id": contract_id,
            "contract_type": "label",
            "service_date": completion_datetime.isoformat(),
            "service_type": "PMS",
            "description": f"PMS completed for {contract['sq']} - {contract['end_user']}",
            "technician": technician_name,
            "status": "completed",
            "service_report": service_report or f"PMS service completed by {technician_name}",
            # Additional fields for the new table format
            "company": contract['end_user'],
            "location": company_location,
            "model": contract['part_number'],  # For label contracts, use part_number as model
            "serial": contract['serial'],
            "sales": sales_info,
            "sr_number": sr_number,
            "created_by": str(current_user.id),
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Ensure service_history table exists
        if not ensure_service_history_table_exists(supabase):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or access service_history table. Please contact administrator."
            )
        
        # Insert into service history
        try:
            history_response = supabase.table("service_history").insert(service_history_data).execute()
            
            if not history_response.data:
                logger.error(f"Failed to insert service history: {history_response}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create service history entry"
                )
        except Exception as e:
            logger.error(f"Error inserting service history: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        
        # Update next PMS schedule - use completion date as base for next schedule
        next_pms = completion_datetime + timedelta(days=30)  # 1 month for label
        
        # Update contract with new PMS schedule
        supabase.table("label_contracts").update({
            "next_pms_schedule": next_pms.isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", contract_id).execute()
        
        # Log audit trail
        AuditService.log_contract_activity(
            contract_id=contract_id,
            contract_type="label_contract",
            action=AuditAction.UPDATE,
            description=f"PMS completed by {technician_name} for {contract['end_user']}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "message": "PMS completed successfully",
            "service_history_id": history_response.data[0]["id"],
            "next_pms_schedule": next_pms.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing label PMS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error completing label PMS"
        )

# Test endpoint to check service_history table
@router.get("/test-service-history")
async def test_service_history(current_user: User = Depends(get_current_user)):
    """Test endpoint to check service_history table structure"""
    supabase = get_supabase()
    
    try:
        # Try to select from service_history table
        response = supabase.table("service_history").select("*").limit(1).execute()
        
        return {
            "status": "success",
            "table_exists": True,
            "sample_data": response.data,
            "message": "Service history table is accessible"
        }
    except Exception as e:
        logger.error(f"Service history table error: {e}")
        return {
            "status": "error",
            "table_exists": False,
            "error": str(e),
            "message": "Service history table may not exist or has issues"
        }

# Create service_history table if it doesn't exist
@router.post("/create-service-history-table")
async def create_service_history_table(current_user: User = Depends(require_admin)):
    """Create service_history table if it doesn't exist"""
    supabase = get_supabase()
    
    try:
        # SQL to create the table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS service_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            contract_id UUID NOT NULL,
            contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('hardware', 'label')),
            service_date TIMESTAMP WITH TIME ZONE NOT NULL,
            service_type VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            technician VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'pending', 'cancelled')),
            service_report TEXT,
            attachments TEXT[],
            -- Additional fields for the new table format
            company VARCHAR(255),
            location VARCHAR(255),
            model VARCHAR(255),
            serial VARCHAR(255),
            sales VARCHAR(255),
            sr_number VARCHAR(255),
            created_by UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
        
        # Execute the SQL
        result = supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
        
        return {
            "status": "success",
            "message": "Service history table created successfully",
            "result": result.data
        }
    except Exception as e:
        logger.error(f"Error creating service_history table: {e}")
        return {
            "status": "error",
            "error": str(e),
            "message": "Failed to create service_history table"
        }






