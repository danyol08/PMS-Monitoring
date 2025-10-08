from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from typing import List, Optional
from datetime import datetime
from app.database import get_supabase
from app.models import User, FileInfo, ContractType, AuditAction
from app.auth import get_current_user, require_technician_or_admin
from app.services.audit_service import AuditService
from app.config import settings
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/file", response_model=FileInfo)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    contract_id: Optional[str] = Form(None),
    contract_type: Optional[str] = Form(None),
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file size
        file_content = await file.read()
        if len(file_content) > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {settings.max_file_size} bytes"
            )
        
        # Check file type
        file_extension = "." + file.filename.split(".")[-1].lower()
        if file_extension not in settings.allowed_file_types_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {settings.allowed_file_types}"
            )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = "." + file.filename.split(".")[-1].lower()
        unique_filename = f"{file_id}{file_extension}"
        
        # Upload to Supabase Storage
        storage_path = f"contracts/{contract_id or 'general'}/{unique_filename}"
        upload_response = supabase.storage.from_("pms-files").upload(
            storage_path,
            file_content,
            file_options={"content-type": file.content_type}
        )
        
        if upload_response.get("error"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage"
            )
        
        # Get public URL
        url_response = supabase.storage.from_("pms-files").get_public_url(storage_path)
        
        # Save file metadata to database
        file_data = {
            "id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(file_content),
            "url": url_response,
            "contract_id": contract_id,
            "contract_type": contract_type,
            "uploaded_at": datetime.utcnow().isoformat(),
            "uploaded_by": current_user.id
        }
        
        db_response = supabase.table("files").insert(file_data).execute()
        
        if not db_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save file metadata"
            )
        
        uploaded_file = FileInfo(**db_response.data[0])
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="file",
            entity_id=file_id,
            action=AuditAction.CREATE,
            new_values={
                "filename": file.filename,
                "content_type": file.content_type,
                "size": len(file_content),
                "contract_id": contract_id,
                "contract_type": contract_type
            },
            description=f"File uploaded: {file.filename} ({len(file_content)} bytes)",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return uploaded_file
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error uploading file"
        )

@router.get("/files", response_model=List[FileInfo])
async def get_files(
    contract_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        query = supabase.table("files").select("*")
        
        if contract_id:
            query = query.eq("contract_id", contract_id)
        if contract_type:
            query = query.eq("contract_type", contract_type)
        
        response = query.order("uploaded_at", desc=True).execute()
        return [FileInfo(**file) for file in response.data]
        
    except Exception as e:
        logger.error(f"Error fetching files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching files"
        )

@router.get("/files/{file_id}", response_model=FileInfo)
async def get_file(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    supabase = get_supabase()
    
    try:
        response = supabase.table("files").select("*").eq("id", file_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        return FileInfo(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching file"
        )

@router.delete("/files/{file_id}")
async def delete_file(
    request: Request,
    file_id: str,
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        # Get file info
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()
        
        if not file_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        file_info = file_response.data[0]
        
        # Delete from storage
        storage_path = f"contracts/{file_info.get('contract_id', 'general')}/{file_id}.{file_info['filename'].split('.')[-1]}"
        storage_response = supabase.storage.from_("pms-files").remove([storage_path])
        
        if storage_response.get("error"):
            logger.warning(f"Failed to delete file from storage: {storage_response['error']}")
        
        # Delete from database
        db_response = supabase.table("files").delete().eq("id", file_id).execute()
        
        if not db_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete file metadata"
            )
        
        # Log audit trail
        AuditService.log_activity(
            entity_type="file",
            entity_id=file_id,
            action=AuditAction.DELETE,
            old_values={
                "filename": file_info.get("filename"),
                "content_type": file_info.get("content_type"),
                "size": file_info.get("size"),
                "contract_id": file_info.get("contract_id"),
                "contract_type": file_info.get("contract_type")
            },
            description=f"File deleted: {file_info.get('filename')}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting file"
        )

@router.post("/bulk-upload")
async def bulk_upload_files(
    request: Request,
    files: List[UploadFile] = File(...),
    contract_id: Optional[str] = Form(None),
    contract_type: Optional[str] = Form(None),
    current_user: User = Depends(require_technician_or_admin)
):
    supabase = get_supabase()
    
    try:
        uploaded_files = []
        errors = []
        
        for file in files:
            try:
                # Validate file
                if not file.filename:
                    errors.append(f"File {file.filename or 'unknown'}: No filename provided")
                    continue
                
                # Check file size
                file_content = await file.read()
                if len(file_content) > settings.max_file_size:
                    errors.append(f"File {file.filename}: File too large")
                    continue
                
                # Check file type
                file_extension = "." + file.filename.split(".")[-1].lower()
                if file_extension not in settings.allowed_file_types_list:
                    errors.append(f"File {file.filename}: File type not allowed")
                    continue
                
                # Generate unique filename
                file_id = str(uuid.uuid4())
                unique_filename = f"{file_id}{file_extension}"
                
                # Upload to Supabase Storage
                storage_path = f"contracts/{contract_id or 'general'}/{unique_filename}"
                upload_response = supabase.storage.from_("pms-files").upload(
                    storage_path,
                    file_content,
                    file_options={"content-type": file.content_type}
                )
                
                if upload_response.get("error"):
                    errors.append(f"File {file.filename}: Upload failed")
                    continue
                
                # Get public URL
                url_response = supabase.storage.from_("pms-files").get_public_url(storage_path)
                
                # Save file metadata to database
                file_data = {
                    "id": file_id,
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(file_content),
                    "url": url_response,
                    "contract_id": contract_id,
                    "contract_type": contract_type,
                    "uploaded_at": datetime.utcnow().isoformat(),
                    "uploaded_by": current_user.id
                }
                
                db_response = supabase.table("files").insert(file_data).execute()
                
                if db_response.data:
                    uploaded_files.append(FileInfo(**db_response.data[0]))
                else:
                    errors.append(f"File {file.filename}: Failed to save metadata")
                
            except Exception as e:
                errors.append(f"File {file.filename}: {str(e)}")
        
        result = {
            "uploaded_files": uploaded_files,
            "errors": errors,
            "success_count": len(uploaded_files),
            "error_count": len(errors)
        }
        
        # Log audit trail for bulk upload
        AuditService.log_activity(
            entity_type="bulk_upload",
            entity_id=f"bulk_upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            action=AuditAction.CREATE,
            new_values={
                "total_files": len(files),
                "success_count": len(uploaded_files),
                "error_count": len(errors),
                "contract_id": contract_id,
                "contract_type": contract_type
            },
            description=f"Bulk file upload: {len(uploaded_files)}/{len(files)} files uploaded successfully",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in bulk upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error in bulk upload"
        )
