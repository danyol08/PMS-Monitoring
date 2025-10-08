from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.database import get_supabase
from app.auth import get_current_user
from app.models import User
import pandas as pd
import io
from datetime import datetime
from typing import Dict, Any, List
import uuid

router = APIRouter()

def validate_excel_file(file: UploadFile) -> pd.DataFrame:
    """Validate and read Excel file"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    allowed_extensions = ['.xlsx', '.xls', '.csv']
    file_extension = '.' + file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file format. Allowed formats: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content
        content = file.file.read()
        
        # Parse based on file type
        if file_extension == '.csv':
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        
        return df
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and prepare dataframe for import"""
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    # Normalize column names: lowercase, replace any non-alphanumeric with underscore, collapse repeats
    df.columns = (
        df.columns
        .str.lower()
        .str.replace(r"[^a-z0-9]+", "_", regex=True)
        .str.strip("_")
    )
    
    # Common alias normalization for service history headers
    alias_map = {
        'sr_no': 'sr_number',
        'sr': 'sr_number',
        'srnum': 'sr_number',
        'sr_number_#': 'sr_number',
        'sr__': 'sr_number',
        'service_report_number': 'sr_number',
    }
    for old, new in alias_map.items():
        if old in df.columns and new not in df.columns:
            df.rename(columns={old: new}, inplace=True)

    # Fill NaN values with empty strings for string columns
    df = df.fillna('')
    
    return df

@router.post("/hardware")
async def import_hardware_contracts(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Import hardware contracts from Excel file"""
    
    # Validate user permissions
    if current_user.role not in ['admin', 'technician']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate and read file
    df = validate_excel_file(file)
    df = clean_dataframe(df)
    
    # Expected columns for hardware contracts
    required_columns = ['sq', 'end_user', 'model', 'serial']
    optional_columns = [
        'next_pms_schedule', 'branch', 'technical_specialist', 
        'date_of_contract', 'end_of_contract', 'status', 'po_number',
        'service_report', 'history', 'frequency', 'reports', 'documentation'
    ]
    
    # Check for required columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )
    
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Prepare contract data
            contract_data = {
                'id': str(uuid.uuid4()),
                'sq': str(row['sq']).strip(),
                'end_user': str(row['end_user']).strip(),
                'model': str(row['model']).strip(),
                'serial': str(row['serial']).strip(),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Add optional fields if present
            for col in optional_columns:
                if col in df.columns and pd.notna(row[col]) and str(row[col]).strip():
                    value = str(row[col]).strip()
                    
                    # Handle date fields
                    if col in ['next_pms_schedule', 'date_of_contract', 'end_of_contract']:
                        try:
                            # Try to parse date
                            if value and value.lower() not in ['', 'nan', 'none']:
                                parsed_date = pd.to_datetime(value)
                                contract_data[col] = parsed_date.strftime('%Y-%m-%d')
                        except:
                            # If date parsing fails, skip this field
                            pass
                    else:
                        contract_data[col] = value
            
            # Insert into Supabase
            result = supabase.table('hardware_contracts').insert(contract_data).execute()
            
            if result.data:
                imported_count += 1
            else:
                errors.append(f"Row {index + 2}: Failed to insert contract")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "message": f"Import completed. {imported_count} contracts imported successfully.",
        "imported_count": imported_count,
        "errors": errors[:10] if errors else []  # Limit errors to first 10
    }

@router.post("/label")
async def import_label_contracts(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Import label contracts from Excel file"""
    
    # Validate user permissions
    if current_user.role not in ['admin', 'technician']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate and read file
    df = validate_excel_file(file)
    df = clean_dataframe(df)
    
    # Expected columns for label contracts
    required_columns = ['sq', 'end_user', 'model', 'serial']
    optional_columns = [
        'next_pms_schedule', 'branch', 'technical_specialist',
        'date_of_contract', 'end_of_contract', 'status', 'po_number',
        'service_report', 'history', 'frequency', 'reports', 'documentation'
    ]
    
    # Check for required columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )
    
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Prepare contract data
            contract_data = {
                'id': str(uuid.uuid4()),
                'sq': str(row['sq']).strip(),
                'end_user': str(row['end_user']).strip(),
                'model': str(row['model']).strip(),
                'serial': str(row['serial']).strip(),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Add optional fields if present
            for col in optional_columns:
                if col in df.columns and pd.notna(row[col]) and str(row[col]).strip():
                    value = str(row[col]).strip()
                    
                    # Handle date fields
                    if col in ['next_pms_schedule', 'date_of_contract', 'end_of_contract']:
                        try:
                            # Try to parse date
                            if value and value.lower() not in ['', 'nan', 'none']:
                                parsed_date = pd.to_datetime(value)
                                contract_data[col] = parsed_date.strftime('%Y-%m-%d')
                        except:
                            # If date parsing fails, skip this field
                            pass
                    else:
                        contract_data[col] = value
            
            # Insert into Supabase
            result = supabase.table('label_contracts').insert(contract_data).execute()
            
            if result.data:
                imported_count += 1
            else:
                errors.append(f"Row {index + 2}: Failed to insert contract")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "message": f"Import completed. {imported_count} label contracts imported successfully.",
        "imported_count": imported_count,
        "errors": errors[:10] if errors else []  # Limit errors to first 10
    }

@router.post("/repairs")
async def import_repairs(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Import repairs from Excel file"""
    
    # Validate user permissions
    if current_user.role not in ['admin', 'technician']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate and read file
    df = validate_excel_file(file)
    df = clean_dataframe(df)
    
    # Expected columns for repairs
    required_columns = ['sq', 'company_name', 'device_model', 'serial_number', 'issue_description']
    optional_columns = [
        'priority', 'status', 'assigned_technician', 'estimated_completion',
        'actual_completion', 'resolution_notes', 'parts_used', 'labor_hours',
        'total_cost', 'customer_satisfaction'
    ]
    
    # Check for required columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )
    
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Prepare repair data
            repair_data = {
                'id': str(uuid.uuid4()),
                'sq': str(row['sq']).strip(),
                'company_name': str(row['company_name']).strip(),
                'device_model': str(row['device_model']).strip(),
                'serial_number': str(row['serial_number']).strip(),
                'issue_description': str(row['issue_description']).strip(),
                'status': 'pending',  # Default status
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Add optional fields if present
            for col in optional_columns:
                if col in df.columns and pd.notna(row[col]) and str(row[col]).strip():
                    value = str(row[col]).strip()
                    
                    # Handle date fields
                    if col in ['estimated_completion', 'actual_completion']:
                        try:
                            # Try to parse date
                            if value and value.lower() not in ['', 'nan', 'none']:
                                parsed_date = pd.to_datetime(value)
                                repair_data[col] = parsed_date.strftime('%Y-%m-%d')
                        except:
                            # If date parsing fails, skip this field
                            pass
                    # Handle numeric fields
                    elif col in ['labor_hours', 'total_cost', 'customer_satisfaction']:
                        try:
                            repair_data[col] = float(value)
                        except:
                            # If numeric parsing fails, skip this field
                            pass
                    else:
                        repair_data[col] = value
            
            # Insert into Supabase
            result = supabase.table('repairs').insert(repair_data).execute()
            
            if result.data:
                imported_count += 1
            else:
                errors.append(f"Row {index + 2}: Failed to insert repair")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "message": f"Import completed. {imported_count} repairs imported successfully.",
        "imported_count": imported_count,
        "errors": errors[:10] if errors else []  # Limit errors to first 10
    }

@router.post("/service-history")
async def import_service_history(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Import service history from Excel file"""
    
    # Validate user permissions
    if current_user.role not in ['admin', 'technician']:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate and read file
    df = validate_excel_file(file)
    df = clean_dataframe(df)
    
    # Expected columns for service history
    # Allow import even when contract_id is missing; require core fields only
    required_columns = ['service_date', 'service_type', 'description', 'technician']
    optional_columns = [
        'contract_id', 'contract_type', 'status', 'service_report', 'company', 'location',
        'model', 'serial', 'sales', 'sr_number'
    ]
    
    # Check for required columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )
    
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Prepare service history data
            # Base payload with defaults
            service_data = {
                'id': str(uuid.uuid4()),
                'service_type': str(row['service_type']).strip(),
                'description': str(row['description']).strip(),
                'technician': str(row['technician']).strip(),
                'status': 'completed',  # Default status
                'contract_type': 'hardware',  # Default type
                'created_at': datetime.utcnow().isoformat(),
                'created_by': str(current_user.id)
            }

            # Contract handling: use provided contract_id or generate one
            if 'contract_id' in df.columns and pd.notna(row.get('contract_id')) and str(row.get('contract_id')).strip():
                service_data['contract_id'] = str(row.get('contract_id')).strip()
            else:
                service_data['contract_id'] = str(uuid.uuid4())
            
            # Handle service_date
            try:
                # pd.to_datetime handles strings and Excel serials
                service_date = pd.to_datetime(row['service_date'], errors='raise')
                # Store full ISO timestamp for DB TIMESTAMPTZ
                service_data['service_date'] = service_date.to_pydatetime().isoformat()
            except Exception:
                raise ValueError("Invalid service_date format")
            
            # Add optional fields if present
            for col in optional_columns:
                if col in df.columns and pd.notna(row.get(col)) and str(row.get(col)).strip():
                    value = str(row.get(col)).strip()
                    # contract_type normalization
                    if col == 'contract_type':
                        value = value.lower()
                        if value not in ['hardware', 'label']:
                            value = 'hardware'
                    # status normalization
                    if col == 'status':
                        value = value.lower()
                        if value not in ['completed', 'pending', 'cancelled']:
                            value = 'completed'
                    service_data[col] = value
            
            # Insert into Supabase
            result = supabase.table('service_history').insert(service_data).execute()
            
            if result.data:
                imported_count += 1
            else:
                errors.append(f"Row {index + 2}: Failed to insert service history")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "message": f"Import completed. {imported_count} service history records imported successfully.",
        "imported_count": imported_count,
        "errors": errors[:10] if errors else []  # Limit errors to first 10
    }
