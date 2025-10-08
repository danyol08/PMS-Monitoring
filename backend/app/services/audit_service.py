"""
Audit Service for logging system activities
"""
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from ..database import get_supabase
from ..models import AuditAction
import logging

logger = logging.getLogger(__name__)

class AuditService:
    @staticmethod
    def log_activity(
        entity_type: str,
        entity_id: str,
        action: AuditAction,
        description: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log a simple audit trail entry"""
        try:
            supabase = get_supabase()
            
            audit_data = {
                "id": str(uuid.uuid4()),
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action.value,
                "description": description,
                "ip_address": ip_address,
                "created_by": user_id,
                "created_at": datetime.utcnow().isoformat()
            }
            
            response = supabase.table("audit_trails").insert(audit_data).execute()
            logger.info(f"Audit trail logged: {description}")
                
        except Exception as e:
            logger.error(f"Error logging audit trail: {e}")

    @staticmethod
    def log_user_activity(
        user_id: str,
        action: AuditAction,
        description: str,
        ip_address: Optional[str] = None
    ):
        """Log user-specific activity"""
        AuditService.log_activity(
            entity_type="user",
            entity_id=user_id,
            action=action,
            description=description,
            user_id=user_id,
            ip_address=ip_address
        )

    @staticmethod
    def log_contract_activity(
        contract_id: str,
        contract_type: str,
        action: AuditAction,
        description: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log contract-related activity"""
        AuditService.log_activity(
            entity_type=contract_type,
            entity_id=contract_id,
            action=action,
            description=description,
            user_id=user_id,
            ip_address=ip_address
        )

    @staticmethod
    def log_repair_activity(
        repair_id: str,
        action: AuditAction,
        description: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log repair-related activity"""
        AuditService.log_activity(
            entity_type="repair",
            entity_id=repair_id,
            action=action,
            description=description,
            user_id=user_id,
            ip_address=ip_address
        )
