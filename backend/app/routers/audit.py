from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from ..models import AuditTrail, AuditTrailCreate, AuditAction, AuditTrailOut
from ..database import get_supabase
from ..auth import get_current_user, require_admin
from ..services.audit_service import AuditService
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])

@router.post("/test")
async def test_audit_trail(current_user = Depends(require_admin)):
    """Test endpoint to create a sample audit trail entry"""
    try:
        AuditService.log_activity(
            entity_type="test",
            entity_id="test-123",
            action=AuditAction.CREATE,
            description="Test audit entry created via API",
            user_id=current_user.id,
            ip_address="127.0.0.1",
            user_agent="test-agent"
        )
        return {"message": "Test audit trail created successfully"}
    except Exception as e:
        logger.error(f"Error creating test audit trail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating test audit trail: {str(e)}"
        )

@router.get("/debug")
async def debug_audit_trail(current_user = Depends(require_admin)):
    """Debug audit trail table structure"""
    try:
        supabase = get_supabase()
        
        # Get a sample record to see the structure
        response = supabase.table("audit_trails").select("*").limit(1).execute()
        
        if response.data:
            sample_record = response.data[0]
            return {
                "message": "Audit trail table accessible",
                "sample_record": sample_record,
                "record_keys": list(sample_record.keys())
            }
        else:
            return {
                "message": "Audit trail table is empty",
                "sample_record": None,
                "record_keys": []
            }
    except Exception as e:
        logger.error(f"Error debugging audit trail: {e}")
        return {
            "error": str(e),
            "message": "Error accessing audit trail table"
        }

@router.post("/setup-table")
async def setup_audit_trail_table(current_user = Depends(require_admin)):
    """Create audit trail table if it doesn't exist"""
    supabase = get_supabase()
    
    try:
        # Create audit_trails table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS audit_trails (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(255) NOT NULL,
            action VARCHAR(50) NOT NULL,
            description TEXT,
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_audit_trails_entity_type ON audit_trails(entity_type);
        CREATE INDEX IF NOT EXISTS idx_audit_trails_entity_id ON audit_trails(entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_trails_action ON audit_trails(action);
        CREATE INDEX IF NOT EXISTS idx_audit_trails_created_by ON audit_trails(created_by);
        CREATE INDEX IF NOT EXISTS idx_audit_trails_created_at ON audit_trails(created_at);
        """
        
        # Try to create the table by inserting a test record and catching the error
        try:
            # Test if table exists by trying to insert a test record
            test_data = {
                "id": str(uuid.uuid4()),
                "entity_type": "test",
                "entity_id": "test-123",
                "action": "test",
                "description": "Test record to check table existence",
                "created_by": current_user.id,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Try to insert test record
            supabase.table("audit_trails").insert(test_data).execute()
            
            # If successful, delete the test record
            supabase.table("audit_trails").delete().eq("id", test_data["id"]).execute()
            
            return {
                "status": "success",
                "message": "Audit trail table already exists and is accessible"
            }
            
        except Exception as insert_error:
            # Table doesn't exist, try to create it manually
            logger.info(f"Table doesn't exist, creating it. Error: {insert_error}")
            
            # For now, return instructions for manual creation
            return {
                "status": "error",
                "message": "Audit trail table doesn't exist. Please create it manually in Supabase dashboard.",
                "sql_instructions": create_table_sql,
                "error": str(insert_error)
            }
        
    except Exception as e:
        logger.error(f"Error creating audit trail table: {e}")
        return {
            "status": "error",
            "message": f"Error creating audit trail table: {str(e)}"
        }

@router.get("/trails", response_model=List[AuditTrailOut])
async def get_audit_trails(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[AuditAction] = None,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user = Depends(require_admin)
):
    """Get audit trails - Admin only"""
    supabase = get_supabase()
    
    try:
        query = supabase.table("audit_trails").select("*")
        
        # Apply filters
        if entity_type:
            query = query.eq("entity_type", entity_type)
        if entity_id:
            query = query.eq("entity_id", entity_id)
        if action:
            query = query.eq("action", action.value)
        if user_id:
            query = query.eq("created_by", user_id)
        if start_date:
            query = query.gte("created_at", start_date.isoformat())
        if end_date:
            query = query.lte("created_at", end_date.isoformat())
        
        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        data = getattr(response, "data", None) or []
        
        # If no data, return empty list
        if not data:
            return []
        
        # Get user names for all unique user IDs
        user_ids = list({row.get("created_by") for row in data if row.get("created_by")})
        users_map = {}
        if user_ids:
            try:
                users_resp = supabase.table("users").select("id,full_name,email").in_("id", user_ids).execute()
                for u in (getattr(users_resp, 'data', None) or []):
                    users_map[u["id"]] = u.get("full_name") or u.get("email")
            except Exception as user_error:
                logger.error(f"Error fetching user names: {user_error}")
        
        # Process each row
        result = []
        for row in data:
            try:
                row_copy = dict(row)
                uid = row_copy.get("created_by")
                row_copy["user_name"] = users_map.get(uid, "Unknown User")
                
                # Ensure all required fields are present with defaults
                if not row_copy.get("id"):
                    row_copy["id"] = str(uuid.uuid4())
                if not row_copy.get("created_at"):
                    row_copy["created_at"] = datetime.utcnow().isoformat()
                if not row_copy.get("created_by"):
                    row_copy["created_by"] = ""
                if not row_copy.get("entity_type"):
                    row_copy["entity_type"] = "unknown"
                if not row_copy.get("entity_id"):
                    row_copy["entity_id"] = ""
                if not row_copy.get("action"):
                    row_copy["action"] = "unknown"
                
                result.append(AuditTrailOut(**row_copy))
            except Exception as row_error:
                logger.error(f"Error processing audit trail row: {row_error}")
                logger.error(f"Row data: {row}")
                # Create a minimal valid record
                try:
                    minimal_row = {
                        "id": str(uuid.uuid4()),
                        "entity_type": "error",
                        "entity_id": "error",
                        "action": "error",
                        "description": f"Error processing record: {str(row_error)}",
                        "created_at": datetime.utcnow().isoformat(),
                        "created_by": "",
                        "user_name": "System Error"
                    }
                    result.append(AuditTrailOut(**minimal_row))
                except:
                    continue
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching audit trails: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching audit trails"
        )

@router.get("/trails/{entity_type}/{entity_id}", response_model=List[AuditTrailOut])
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: str,
    current_user = Depends(require_admin)
):
    """Get audit trail for a specific entity - Admin only"""
    supabase = get_supabase()
    
    try:
        response = supabase.table("audit_trails")\
            .select("*")\
            .eq("entity_type", entity_type)\
            .eq("entity_id", entity_id)\
            .order("created_at", desc=True)\
            .execute()
        data = getattr(response, "data", None) or []
        user_ids = list({row.get("created_by") for row in data if row.get("created_by")})
        users_map = {}
        if user_ids:
            users_resp = supabase.table("users").select("id,full_name,email").in_("id", user_ids).execute()
            for u in (getattr(users_resp, 'data', None) or []):
                users_map[u["id"]] = u.get("full_name") or u.get("email")
        result = []
        for row in data:
            row_copy = dict(row)
            uid = row_copy.get("created_by")
            row_copy["user_name"] = users_map.get(uid)
            result.append(AuditTrailOut(**row_copy))
        return result
        
    except Exception as e:
        logger.error(f"Error fetching entity audit trail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching entity audit trail"
        )

@router.get("/stats", response_model=dict)
async def get_audit_stats(
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(require_admin)
):
    """Get audit statistics - Admin only"""
    supabase = get_supabase()
    
    try:
        # Get date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get total activities
        total_response = supabase.table("audit_trails")\
            .select("id", count="exact")\
            .gte("created_at", start_date.isoformat())\
            .lte("created_at", end_date.isoformat())\
            .execute()
        
        # Get activities by type
        by_type_response = supabase.table("audit_trails")\
            .select("entity_type")\
            .gte("created_at", start_date.isoformat())\
            .lte("created_at", end_date.isoformat())\
            .execute()
        
        # Get activities by action
        by_action_response = supabase.table("audit_trails")\
            .select("action")\
            .gte("created_at", start_date.isoformat())\
            .lte("created_at", end_date.isoformat())\
            .execute()
        
        # Process data
        entity_types = {}
        for trail in by_type_response.data:
            entity_type = trail["entity_type"]
            entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
        
        actions = {}
        for trail in by_action_response.data:
            action = trail["action"]
            actions[action] = actions.get(action, 0) + 1
        
        return {
            "total_activities": total_response.count,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days
            },
            "by_entity_type": entity_types,
            "by_action": actions
        }
        
    except Exception as e:
        logger.error(f"Error fetching audit stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching audit statistics"
        )
