from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_supabase
from app.models import User, ServiceHistory, ServiceHistoryCreate, AuditAction, ContractType
from app.auth import get_current_user, require_technician_or_admin, require_admin
from app.services.audit_service import AuditService
from ..config import generate_excel_report, generate_pdf_report
from app.utils import generate_service_history_excel, generate_service_history_pdf
from app.data_import import import_hardware_contracts_from_excel, import_label_contracts_from_excel, import_contracts_from_csv, create_sample_data
from app.models import ContractType
import logging
import io

logger = logging.getLogger(__name__)

router = APIRouter()

# Service History Endpoints
@router.get("/service-history", response_model=List[ServiceHistory])
async def get_service_history(
    contract_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    skip: int = 0,
    limit: Optional[int] = None,  # No limit - get all records
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Get service history from PMS completions only
        query = supabase.table("service_history").select("*")
        
        if contract_id:
            query = query.eq("contract_id", contract_id)
        if contract_type:
            query = query.eq("contract_type", contract_type)
        
        # Apply pagination only if limit is specified
        if limit is not None:
            response = query.range(skip, skip + limit - 1).order("service_date", desc=True).order("created_at", desc=True).execute()
        else:
            # No limit - get all records
            response = query.order("service_date", desc=True).order("created_at", desc=True).execute()
        
        # Convert to ServiceHistory objects and sort again to ensure proper ordering
        service_histories = [ServiceHistory(**history) for history in response.data]
        
        # Sort by service_date (most recent first), then by created_at as fallback
        service_histories.sort(key=lambda x: (x.service_date, x.created_at), reverse=True)
        
        return service_histories
        
    except Exception as e:
        logger.error(f"Error fetching service history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching service history"
        )

@router.get("/service-history/combined")
async def get_combined_service_history(
    contract_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    month: Optional[str] = None,  # Format: YYYY-MM (e.g., "2024-10" for October 2024)
    skip: int = 0,
    limit: Optional[int] = None,  # No limit - get all records
    current_user: User = Depends(get_current_user)
):
    """Get combined service history including PMS and repairs"""
    supabase = get_supabase()
    
    try:
        combined_records = []
        
        # Get PMS service history
        if not contract_type or contract_type in ['hardware', 'label']:
            query = supabase.table("service_history").select("*")
            
            if contract_id:
                query = query.eq("contract_id", contract_id)
            if contract_type:
                query = query.eq("contract_type", contract_type)
            if month:
                # Filter by month (YYYY-MM format)
                start_date = f"{month}-01"
                # Calculate end date (last day of the month)
                from datetime import datetime, timedelta
                try:
                    year, month_num = month.split('-')
                    if int(month_num) == 12:
                        next_month = f"{int(year) + 1}-01-01"
                    else:
                        next_month = f"{year}-{int(month_num) + 1:02d}-01"
                    
                    query = query.gte("service_date", start_date).lt("service_date", next_month)
                except ValueError:
                    # Invalid month format, ignore filter
                    pass
            
            # Apply pagination only if limit is specified
            if limit is not None:
                response = query.range(skip, skip + limit - 1).order("service_date", desc=True).execute()
            else:
                # No limit - get all records
                response = query.order("service_date", desc=True).execute()
            
            for history in response.data:
                try:
                    combined_records.append({
                        "id": history["id"],
                        "contract_id": history["contract_id"],
                        "contract_type": history["contract_type"],
                        "service_date": history["service_date"],
                        "service_type": history["service_type"],
                        "description": history["description"],
                        "technician": history["technician"],
                        "status": history["status"],
                        "service_report": history.get("service_report", ""),
                        "company": history.get("company", ""),
                        "location": history.get("location", ""),
                        "model": history.get("model", ""),
                        "serial": history.get("serial", ""),
                        "sales": history.get("sales", ""),
                        "sr_number": history.get("sr_number", ""),
                        "created_by": history["created_by"],
                        "created_at": history["created_at"]
                    })
                except Exception as e:
                    logger.error(f"Error processing service history: {e}")
                    continue
        
        # Note: Repairs are handled separately in repairs history, not in service history
        # Service history is only for hardware and label contract maintenance
        
        # Sort all records by service date (most recent first), then by created_at as fallback
        combined_records.sort(key=lambda x: (x["service_date"], x.get("created_at", "")), reverse=True)
        
        # Return all records if no limit specified, otherwise apply limit
        if limit is not None:
            return combined_records[:limit]
        else:
            return combined_records
        
    except Exception as e:
        logger.error(f"Error fetching combined service history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching combined service history"
        )

@router.post("/service-history", response_model=ServiceHistory)
async def create_service_history(
    request: Request,
    history: ServiceHistoryCreate,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        history_data = history.dict()
        history_data["created_by"] = current_user.id
        history_data["created_at"] = datetime.utcnow().isoformat()
        
        response = supabase.table("service_history").insert(history_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create service history"
            )
        
        created_history = ServiceHistory(**response.data[0])
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="service_history",
            entity_id=created_history.id,
            action=AuditAction.CREATE,
            new_values={
                "contract_id": created_history.contract_id,
                "contract_type": created_history.contract_type,
                "service_date": created_history.service_date.isoformat() if created_history.service_date else None,
                "service_type": created_history.service_type,
                "technician": created_history.technician,
                "status": created_history.status
            },
            description=f"Service history created: {created_history.service_type} for {created_history.contract_type} contract",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return created_history
        
    except Exception as e:
        logger.error(f"Error creating service history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating service history"
        )

# Service History Export Endpoints
@router.get("/service-history/export/excel")
async def export_service_history_excel(
    contract_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    month: Optional[str] = None,  # Format: YYYY-MM
    current_user: User = Depends(get_current_user)
):
    """Export service history to Excel with the new table format"""
    supabase = get_supabase()
    
    try:
        query = supabase.table("service_history").select("*")
        
        if contract_id:
            query = query.eq("contract_id", contract_id)
        if contract_type:
            query = query.eq("contract_type", contract_type)
        if month:
            # Filter by month (YYYY-MM format)
            start_date = f"{month}-01"
            # Calculate end date (last day of the month)
            try:
                year, month_num = month.split('-')
                if int(month_num) == 12:
                    next_month = f"{int(year) + 1}-01-01"
                else:
                    next_month = f"{year}-{int(month_num) + 1:02d}-01"
                
                query = query.gte("service_date", start_date).lt("service_date", next_month)
            except ValueError:
                # Invalid month format, ignore filter
                pass
        
        response = query.order("service_date", desc=True).execute()
        service_history_data = response.data
        
        # Generate Excel file
        excel_data = generate_service_history_excel(service_history_data)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="service_history",
            entity_id="export",
            action=AuditAction.VIEW,
            description=f"Service history exported to Excel by {current_user.full_name}",
            user_id=current_user.id
        )
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=service_history.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting service history to Excel: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error exporting service history"
        )

@router.get("/service-history/export/pdf")
async def export_service_history_pdf(
    contract_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    month: Optional[str] = None,  # Format: YYYY-MM
    current_user: User = Depends(get_current_user)
):
    """Export service history to PDF with the new table format"""
    supabase = get_supabase()
    
    try:
        query = supabase.table("service_history").select("*")
        
        if contract_id:
            query = query.eq("contract_id", contract_id)
        if contract_type:
            query = query.eq("contract_type", contract_type)
        if month:
            # Filter by month (YYYY-MM format)
            start_date = f"{month}-01"
            # Calculate end date (last day of the month)
            try:
                year, month_num = month.split('-')
                if int(month_num) == 12:
                    next_month = f"{int(year) + 1}-01-01"
                else:
                    next_month = f"{year}-{int(month_num) + 1:02d}-01"
                
                query = query.gte("service_date", start_date).lt("service_date", next_month)
            except ValueError:
                # Invalid month format, ignore filter
                pass
        
        response = query.order("service_date", desc=True).execute()
        service_history_data = response.data
        
        # Generate PDF file
        pdf_data = generate_service_history_pdf(service_history_data)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="service_history",
            entity_id="export",
            action=AuditAction.VIEW,
            description=f"Service history exported to PDF by {current_user.full_name}",
            user_id=current_user.id
        )
        
        return StreamingResponse(
            io.BytesIO(pdf_data),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=service_history.pdf"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting service history to PDF: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error exporting service history"
        )


# Report Generation Endpoints
@router.get("/export/excel")
async def export_excel_report(
    request: Request,
    contract_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Fetch data based on filters
        data = await fetch_report_data(supabase, contract_type, status, start_date, end_date)
        
        # Generate Excel report
        excel_buffer = generate_excel_report(data, contract_type)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="report",
            entity_id=f"excel_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.VIEW,
            new_values={
                "report_type": "excel",
                "contract_type": contract_type,
                "status": status,
                "start_date": start_date,
                "end_date": end_date
            },
            description=f"Excel report exported: {contract_type or 'all'} contracts",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return StreamingResponse(
            io.BytesIO(excel_buffer),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=pms_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"Error generating Excel report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating Excel report"
        )

@router.get("/export/pdf")
async def export_pdf_report(
    request: Request,
    contract_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        # Fetch data based on filters
        data = await fetch_report_data(supabase, contract_type, status, start_date, end_date)
        
        # Generate PDF report
        pdf_buffer = generate_pdf_report(data, contract_type)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="report",
            entity_id=f"pdf_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.VIEW,
            new_values={
                "report_type": "pdf",
                "contract_type": contract_type,
                "status": status,
                "start_date": start_date,
                "end_date": end_date
            },
            description=f"PDF report exported: {contract_type or 'all'} contracts",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return StreamingResponse(
            io.BytesIO(pdf_buffer),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=pms_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating PDF report"
        )


@router.get("/contracts/summary")
async def get_contracts_summary(
    contract_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        summary_data = {}
        
        if not contract_type or contract_type == "hardware":
            hw_response = supabase.table("hardware_contracts").select("status, branch, frequency").execute()
            summary_data["hardware"] = {
                "total": len(hw_response.data),
                "by_status": {},
                "by_branch": {},
                "by_frequency": {}
            }
            
            for contract in hw_response.data:
                status = contract["status"]
                branch = contract["branch"]
                frequency = contract["frequency"]
                
                summary_data["hardware"]["by_status"][status] = summary_data["hardware"]["by_status"].get(status, 0) + 1
                summary_data["hardware"]["by_branch"][branch] = summary_data["hardware"]["by_branch"].get(branch, 0) + 1
                summary_data["hardware"]["by_frequency"][frequency] = summary_data["hardware"]["by_frequency"].get(frequency, 0) + 1
        
        if not contract_type or contract_type == "label":
            label_response = supabase.table("label_contracts").select("status, branch, frequency").execute()
            summary_data["label"] = {
                "total": len(label_response.data),
                "by_status": {},
                "by_branch": {},
                "by_frequency": {}
            }
            
            for contract in label_response.data:
                status = contract["status"]
                branch = contract["branch"]
                frequency = contract["frequency"]
                
                summary_data["label"]["by_status"][status] = summary_data["label"]["by_status"].get(status, 0) + 1
                summary_data["label"]["by_branch"][branch] = summary_data["label"]["by_branch"].get(branch, 0) + 1
                summary_data["label"]["by_frequency"][frequency] = summary_data["label"]["by_frequency"].get(frequency, 0) + 1
        
        return summary_data
        
    except Exception as e:
        logger.error(f"Error generating contracts summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating contracts summary"
        )

# Data Import Endpoints
@router.post("/import/excel")
async def import_excel_data(
    request: Request,
    file: UploadFile = File(...),
    contract_type: str = Form(...),
    current_user: User = Depends(require_technician_or_admin)
):
    try:
        # Save uploaded file temporarily
        file_content = await file.read()
        
        if contract_type == "hardware":
            result = import_hardware_contracts_from_excel(file_content, current_user.id)
        elif contract_type == "label":
            result = import_label_contracts_from_excel(file_content, current_user.id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid contract type. Must be 'hardware' or 'label'"
            )
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="import",
            entity_id=f"excel_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.CREATE,
            new_values={
                "import_type": "excel",
                "contract_type": contract_type,
                "file_name": file.filename,
                "file_size": len(file_content),
                "records_imported": result.get("imported_count", 0),
                "records_failed": result.get("failed_count", 0)
            },
            description=f"Excel data imported: {contract_type} contracts from {file.filename}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error importing Excel data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error importing Excel data"
        )

@router.post("/import/csv")
async def import_csv_data(
    request: Request,
    file: UploadFile = File(...),
    contract_type: str = Form(...),
    current_user: User = Depends(require_technician_or_admin)
):
    try:
        # Save uploaded file temporarily
        file_content = await file.read()
        
        if contract_type not in ["hardware", "label"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid contract type. Must be 'hardware' or 'label'"
            )
        
        result = import_contracts_from_csv(file_content, ContractType(contract_type), current_user.id)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="import",
            entity_id=f"csv_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.CREATE,
            new_values={
                "import_type": "csv",
                "contract_type": contract_type,
                "file_name": file.filename,
                "file_size": len(file_content),
                "records_imported": result.get("imported_count", 0),
                "records_failed": result.get("failed_count", 0)
            },
            description=f"CSV data imported: {contract_type} contracts from {file.filename}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error importing CSV data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error importing CSV data"
        )

@router.post("/sample-data")
async def create_sample_data_endpoint(
    request: Request,
    current_user: User = Depends(require_admin)
):
    try:
        result = create_sample_data(current_user.id)
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="sample_data",
            entity_id=f"sample_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.CREATE,
            new_values={
                "hardware_contracts_created": result.get("hardware_contracts", 0),
                "label_contracts_created": result.get("label_contracts", 0),
                "repairs_created": result.get("repairs", 0)
            },
            description="Sample data created for testing purposes",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error creating sample data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating sample data"
        )

@router.get("/maintenance/schedule")
async def get_maintenance_schedule(
    days_ahead: int = 30,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        end_date = (datetime.utcnow() + timedelta(days=days_ahead)).isoformat()
        
        # Get upcoming hardware maintenance - exclude expired contracts
        hw_response = supabase.table("hardware_contracts").select("*").lte("next_pms_schedule", end_date).neq("status", "expired").execute()
        
        # Get upcoming label maintenance - exclude expired contracts
        label_response = supabase.table("label_contracts").select("*").lte("next_pms_schedule", end_date).neq("status", "expired").execute()
        
        schedule_data = {
            "hardware": hw_response.data,
            "label": label_response.data,
            "total_upcoming": len(hw_response.data) + len(label_response.data)
        }
        
        return schedule_data
        
    except Exception as e:
        logger.error(f"Error fetching maintenance schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching maintenance schedule"
        )

async def fetch_report_data(supabase, contract_type=None, status=None, start_date=None, end_date=None):
    """Helper function to fetch data for reports"""
    data = {}
    
    if not contract_type or contract_type == "hardware":
        query = supabase.table("hardware_contracts").select("*")
        if status:
            query = query.eq("status", status)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        hw_response = query.execute()
        data["hardware"] = hw_response.data
    
    if not contract_type or contract_type == "label":
        query = supabase.table("label_contracts").select("*")
        if status:
            query = query.eq("status", status)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        label_response = query.execute()
        data["label"] = label_response.data
    
    return data

from fastapi import Body, HTTPException

@router.put("/service-history/{id}")
async def update_service_history(id: str, data: dict = Body(...)):
    supabase = get_supabase()
    try:
        result = supabase.table("service_history").update(data).eq("id", id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Record not found")

        return {"message": "Service updated", "data": result.data[0]}

    except Exception as e:
        print("Error updating:", e)
        raise HTTPException(status_code=500, detail=f"Failed to update service: {str(e)}")
