from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    VIEWER = "viewer"

class ContractStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    PENDING = "pending"

class FrequencyType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    SEMI_ANNUAL = "semi-annual"

class ContractType(str, Enum):
    HARDWARE = "hardware"
    LABEL = "label"
    REPAIR = "repair"

# Base User Model
class UserBase(BaseModel):
    email: str
    full_name: str
    role: UserRole
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

# Hardware Contract Models
class HardwareContractBase(BaseModel):
    sq: str
    end_user: str
    model: str
    serial: str
    next_pms_schedule: datetime
    branch: str
    technical_specialist: str
    # Extended contract metadata
    date_of_contract: datetime
    end_of_contract: datetime
    status: ContractStatus
    po_number: str
    frequency: FrequencyType
    documentation: Optional[str] = None
    service_report: Optional[str] = None
    history: Optional[str] = None
    reports: Optional[str] = None

class HardwareContractCreate(HardwareContractBase):
    # Override required fields to be optional on create so backend can auto-generate
    sq: Optional[str] = None
    next_pms_schedule: Optional[datetime] = None
    frequency: Optional[FrequencyType] = None

class HardwareContractUpdate(BaseModel):
    sq: Optional[str] = None
    end_user: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    next_pms_schedule: Optional[datetime] = None
    branch: Optional[str] = None
    technical_specialist: Optional[str] = None
    # Extended/optional fields to support editing from UI
    date_of_contract: Optional[datetime] = None
    end_of_contract: Optional[datetime] = None
    status: Optional[ContractStatus] = None
    po_number: Optional[str] = None
    service_report: Optional[str] = None
    history: Optional[str] = None
    frequency: Optional[FrequencyType] = None
    reports: Optional[str] = None
    documentation: Optional[str] = None

class HardwareContract(HardwareContractBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# Label Contract Models
class LabelContractBase(BaseModel):
    sq: str
    end_user: str
    part_number: str
    serial: str
    next_pms_schedule: datetime
    branch: str
    technical_specialist: str
    # Extended contract metadata
    date_of_contract: datetime
    end_of_contract: datetime
    status: ContractStatus
    po_number: str
    frequency: FrequencyType
    documentation: Optional[str] = None
    service_report: Optional[str] = None
    history: Optional[str] = None
    reports: Optional[str] = None

class LabelContractCreate(LabelContractBase):
    # Override required fields to be optional on create so backend can auto-generate
    sq: Optional[str] = None
    next_pms_schedule: Optional[datetime] = None
    frequency: Optional[FrequencyType] = None

class LabelContractUpdate(BaseModel):
    sq: Optional[str] = None
    end_user: Optional[str] = None
    part_number: Optional[str] = None
    serial: Optional[str] = None
    next_pms_schedule: Optional[datetime] = None
    branch: Optional[str] = None
    technical_specialist: Optional[str] = None
    # Extended/optional fields to support editing from UI
    date_of_contract: Optional[datetime] = None
    end_of_contract: Optional[datetime] = None
    status: Optional[ContractStatus] = None
    po_number: Optional[str] = None
    frequency: Optional[FrequencyType] = None
    documentation: Optional[str] = None
    service_report: Optional[str] = None
    history: Optional[str] = None
    reports: Optional[str] = None

class LabelContract(LabelContractBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# Service History Models
class ServiceHistoryBase(BaseModel):
    contract_id: str
    contract_type: ContractType
    service_date: datetime
    service_type: str
    description: str
    technician: str
    status: str
    service_report: Optional[str] = None
    attachments: Optional[List[str]] = None
    # Additional fields for the new table format
    company: Optional[str] = None  # COMPANY | LOCATION
    location: Optional[str] = None  # Branch/location
    model: Optional[str] = None  # Equipment model
    serial: Optional[str] = None  # Serial number
    sales: Optional[str] = None  # PO number or sales info
    sr_number: Optional[str] = None  # Service Report number

class ServiceHistoryCreate(ServiceHistoryBase):
    pass

class ServiceHistory(ServiceHistoryBase):
    id: str
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# File Upload Models
class FileUpload(BaseModel):
    filename: str
    content_type: str
    size: int
    contract_id: Optional[str] = None
    contract_type: Optional[ContractType] = None

class FileInfo(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    url: str
    contract_id: Optional[str] = None
    contract_type: Optional[ContractType] = None
    uploaded_at: datetime
    uploaded_by: str

    class Config:
        from_attributes = True

# Notification Models
class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str
    contract_id: Optional[str] = None
    is_read: bool = False

class NotificationCreate(NotificationBase):
    user_id: str

class Notification(NotificationBase):
    id: str
    created_at: datetime
    user_id: str

    class Config:
        from_attributes = True

# Dashboard Models
class DashboardStats(BaseModel):
    total_contracts: int
    active_contracts: int
    expired_contracts: int
    upcoming_maintenance: int
    completed_maintenance: int
    pending_maintenance: int

class ContractSummary(BaseModel):
    id: str
    sq: str
    end_user: str
    serial: str
    next_pms_schedule: datetime
    status: ContractStatus
    contract_type: ContractType
    days_until_maintenance: int
    branch: Optional[str] = None

# Authentication Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole = UserRole.VIEWER

# Repair Management Models
class RepairStatus(str, Enum):
    RECEIVED = "received"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    PENDING_PARTS = "pending_parts"

class RepairBase(BaseModel):
    sq: str
    date_received: datetime
    company_name: str
    device_model: str
    part_number: str
    serial_number: str
    status: RepairStatus
    rma_case: Optional[str] = None
    repair_open: Optional[datetime] = None
    repair_closed: Optional[datetime] = None
    description: Optional[str] = None
    technician_notes: Optional[str] = None
    # Completion fields
    sales_person: Optional[str] = None
    action_taken: Optional[str] = None
    completion_notes: Optional[str] = None

class RepairCreate(RepairBase):
    # Allow backend to auto-generate SQ when not provided
    sq: Optional[str] = None
    pass

class RepairUpdate(BaseModel):
    sq: Optional[str] = None
    date_received: Optional[datetime] = None
    company_name: Optional[str] = None
    device_model: Optional[str] = None
    part_number: Optional[str] = None
    serial_number: Optional[str] = None
    status: Optional[RepairStatus] = None
    rma_case: Optional[str] = None
    repair_open: Optional[datetime] = None
    repair_closed: Optional[datetime] = None
    description: Optional[str] = None
    technician_notes: Optional[str] = None

class Repair(RepairBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# Repair History Model - completed repairs without cost information
class RepairHistory(BaseModel):
    id: str
    sq: str
    date_received: datetime
    repair_closed: datetime
    company_name: str
    device_model: str
    part_number: str
    serial_number: str
    rma_case: Optional[str] = None
    technician: str
    action_taken: str
    completion_notes: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# Audit Trail Models
class AuditAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    VIEW = "view"
    LOGIN = "login"
    LOGOUT = "logout"
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    ASSIGN = "assign"
    UNASSIGN = "unassign"

class AuditTrailBase(BaseModel):
    entity_type: str  # 'hardware_contract', 'label_contract', 'repair', 'user'
    entity_id: str
    action: AuditAction
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditTrailCreate(AuditTrailBase):
    pass

class AuditTrail(AuditTrailBase):
    id: str
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# API output model that includes a denormalized user_name for convenience
class AuditTrailOut(AuditTrail):
    user_name: Optional[str] = None

