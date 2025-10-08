import pandas as pd
from typing import List, Dict, Any
from datetime import datetime, timedelta
from app.database import get_supabase
from app.models import HardwareContractCreate, LabelContractCreate, ContractType
import logging
import io

logger = logging.getLogger(__name__)

def calculate_next_pms_from_contract_date(contract_date, contract_type):
    """Calculate next PMS schedule based on contract date and type"""
    if not contract_date:
        return None
    
    # Parse contract date if it's a string
    if isinstance(contract_date, str):
        try:
            contract_date = datetime.fromisoformat(contract_date.replace('Z', '+00:00'))
        except:
            return None
    
    if contract_type == "hardware":
        # Hardware contracts: every 3 months (90 days)
        return contract_date + timedelta(days=90)
    elif contract_type == "label":
        # Label contracts: every 1 month (30 days)
        return contract_date + timedelta(days=30)
    else:
        # Default to monthly
        return contract_date + timedelta(days=30)

def get_next_sq_number(supabase, table_name: str) -> str:
    """Get the next SQ number based on the last SQ in the database"""
    try:
        # Get the last SQ number from the database
        response = supabase.table(table_name).select("sq").order("sq", desc=True).limit(1).execute()
        
        if response.data and response.data[0].get("sq"):
            last_sq = response.data[0]["sq"]
            # Extract numeric part and increment
            if last_sq.isdigit():
                next_number = int(last_sq) + 1
                return str(next_number)
            else:
                # If SQ contains non-numeric characters, try to extract number
                import re
                numbers = re.findall(r'\d+', last_sq)
                if numbers:
                    next_number = int(numbers[-1]) + 1
                    return str(next_number)
        
        # If no data or can't parse, start from 1
        return "1"
    except Exception as e:
        logger.error(f"Error getting next SQ number: {e}")
        return "1"

def import_hardware_contracts_from_excel(file_content: bytes, created_by: str) -> Dict[str, Any]:
    """Import hardware contracts from Excel file"""
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        supabase = get_supabase()
        
        imported_count = 0
        errors = []
        
        # Get starting SQ number
        current_sq = get_next_sq_number(supabase, "hardware_contracts")
        
        for index, row in df.iterrows():
            try:
                # Map Excel columns to contract fields (using template column names)
                date_of_contract = parse_date(row.get("date_of_contract"))
                
                # Validate required fields first (SQ is now auto-generated)
                end_user = str(row.get("end_user", "")).strip()
                model = str(row.get("model", "")).strip()
                serial = str(row.get("serial", "")).strip()
                
                if not end_user or not model or not serial:
                    errors.append(f"Row {index + 2}: Missing required fields (end_user, model, or serial)")
                    continue
                
                contract_data = {
                    "sq": current_sq,
                    "end_user": end_user,
                    "model": model,
                    "serial": serial,
                    "next_pms_schedule": parse_date(row.get("next_pms_schedule")) or (calculate_next_pms_from_contract_date(date_of_contract, "hardware").isoformat() if date_of_contract else None),
                    "branch": str(row.get("branch", "")).strip() or None,
                    "technical_specialist": str(row.get("technical_specialist", "")).strip() or None,
                    "date_of_contract": date_of_contract,
                    "end_of_contract": parse_date(row.get("end_of_contract")),
                    "status": str(row.get("status", "active")).strip().lower() or "active",
                    "po_number": str(row.get("po_number", "")).strip() or None,
                    "frequency": str(row.get("frequency", "monthly")).strip().lower() or "monthly",
                    "documentation": str(row.get("documentation", "")).strip() if pd.notna(row.get("documentation")) and str(row.get("documentation", "")).strip() else None,
                    "service_report": str(row.get("service_report", "")).strip() if pd.notna(row.get("service_report")) and str(row.get("service_report", "")).strip() else None,
                    "history": str(row.get("history", "")).strip() if pd.notna(row.get("history")) and str(row.get("history", "")).strip() else None,
                    "reports": str(row.get("reports", "")).strip() if pd.notna(row.get("reports")) and str(row.get("reports", "")).strip() else None,
                    "created_by": created_by,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Insert into database
                response = supabase.table("hardware_contracts").insert(contract_data).execute()
                
                if response.data:
                    imported_count += 1
                    # Increment SQ for next record
                    current_sq = str(int(current_sq) + 1)
                else:
                    errors.append(f"Row {index + 2}: Failed to insert into database")
                    
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        return {
            "imported_count": imported_count,
            "total_rows": len(df),
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error importing hardware contracts: {e}")
        return {
            "imported_count": 0,
            "total_rows": 0,
            "errors": [f"Import failed: {str(e)}"]
        }

def import_label_contracts_from_excel(file_content: bytes, created_by: str) -> Dict[str, Any]:
    """Import label contracts from Excel file"""
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        supabase = get_supabase()
        
        imported_count = 0
        errors = []
        
        # Get starting SQ number
        current_sq = get_next_sq_number(supabase, "label_contracts")
        
        for index, row in df.iterrows():
            try:
                # Map Excel columns to contract fields (using template column names)
                date_of_contract = parse_date(row.get("date_of_contract"))
                
                # Validate required fields first (SQ is now auto-generated)
                end_user = str(row.get("end_user", "")).strip()
                part_number = str(row.get("part_number", "")).strip()
                serial = str(row.get("serial", "")).strip()
                
                if not end_user or not part_number or not serial:
                    errors.append(f"Row {index + 2}: Missing required fields (end_user, part_number, or serial)")
                    continue
                
                contract_data = {
                    "sq": current_sq,
                    "end_user": end_user,
                    "part_number": part_number,
                    "serial": serial,
                    "next_pms_schedule": parse_date(row.get("next_pms_schedule")) or (calculate_next_pms_from_contract_date(date_of_contract, "label").isoformat() if date_of_contract else None),
                    "branch": str(row.get("branch", "")).strip() or None,
                    "technical_specialist": str(row.get("technical_specialist", "")).strip() or None,
                    "date_of_contract": date_of_contract,
                    "end_of_contract": parse_date(row.get("end_of_contract")),
                    "status": str(row.get("status", "active")).strip().lower() or "active",
                    "po_number": str(row.get("po_number", "")).strip() or None,
                    "frequency": str(row.get("frequency", "monthly")).strip().lower() or "monthly",
                    "documentation": str(row.get("documentation", "")).strip() if pd.notna(row.get("documentation")) and str(row.get("documentation", "")).strip() else None,
                    "service_report": str(row.get("service_report", "")).strip() if pd.notna(row.get("service_report")) and str(row.get("service_report", "")).strip() else None,
                    "history": str(row.get("history", "")).strip() if pd.notna(row.get("history")) and str(row.get("history", "")).strip() else None,
                    "reports": str(row.get("reports", "")).strip() if pd.notna(row.get("reports")) and str(row.get("reports", "")).strip() else None,
                    "created_by": created_by,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Insert into database
                response = supabase.table("label_contracts").insert(contract_data).execute()
                
                if response.data:
                    imported_count += 1
                    # Increment SQ for next record
                    current_sq = str(int(current_sq) + 1)
                else:
                    errors.append(f"Row {index + 2}: Failed to insert into database")
                    
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        return {
            "imported_count": imported_count,
            "total_rows": len(df),
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error importing label contracts: {e}")
        return {
            "imported_count": 0,
            "total_rows": 0,
            "errors": [f"Import failed: {str(e)}"]
        }

def import_contracts_from_csv(file_content: bytes, contract_type: ContractType, created_by: str) -> Dict[str, Any]:
    """Import contracts from CSV file"""
    try:
        df = pd.read_csv(io.StringIO(file_content.decode('utf-8')))
        
        if contract_type == ContractType.HARDWARE:
            return import_hardware_contracts_from_dataframe(df, created_by)
        else:
            return import_label_contracts_from_dataframe(df, created_by)
            
    except Exception as e:
        logger.error(f"Error importing contracts from CSV: {e}")
        return {
            "imported_count": 0,
            "total_rows": 0,
            "errors": [f"Import failed: {str(e)}"]
        }

def import_hardware_contracts_from_dataframe(df: pd.DataFrame, created_by: str) -> Dict[str, Any]:
    """Import hardware contracts from DataFrame"""
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    # Get starting SQ number
    current_sq = get_next_sq_number(supabase, "hardware_contracts")
    
    for index, row in df.iterrows():
        try:
            date_of_contract = parse_date(row.get("date_of_contract"))
            
            # Validate required fields first (SQ is now auto-generated)
            end_user = str(row.get("end_user", "")).strip()
            model = str(row.get("model", "")).strip()
            serial = str(row.get("serial", "")).strip()
            
            if not end_user or not model or not serial:
                errors.append(f"Row {index + 2}: Missing required fields (end_user, model, or serial)")
                continue
            
            contract_data = {
                "sq": current_sq,
                "end_user": end_user,
                "model": model,
                "serial": serial,
                "next_pms_schedule": parse_date(row.get("next_pms_schedule")) or (calculate_next_pms_from_contract_date(date_of_contract, "hardware").isoformat() if date_of_contract else None),
                "branch": str(row.get("branch", "")).strip() or None,
                "technical_specialist": str(row.get("technical_specialist", "")).strip() or None,
                "date_of_contract": date_of_contract,
                "end_of_contract": parse_date(row.get("end_of_contract")),
                "status": str(row.get("status", "active")).strip().lower() or "active",
                "po_number": str(row.get("po_number", "")).strip() or None,
                "frequency": str(row.get("frequency", "monthly")).strip().lower() or "monthly",
                "documentation": str(row.get("documentation", "")).strip() if pd.notna(row.get("documentation")) and str(row.get("documentation", "")).strip() else None,
                "service_report": str(row.get("service_report", "")).strip() if pd.notna(row.get("service_report")) and str(row.get("service_report", "")).strip() else None,
                "history": str(row.get("history", "")).strip() if pd.notna(row.get("history")) and str(row.get("history", "")).strip() else None,
                "reports": str(row.get("reports", "")).strip() if pd.notna(row.get("reports")) and str(row.get("reports", "")).strip() else None,
                "created_by": created_by,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            response = supabase.table("hardware_contracts").insert(contract_data).execute()
            
            if response.data:
                imported_count += 1
                # Increment SQ for next record
                current_sq = str(int(current_sq) + 1)
            else:
                errors.append(f"Row {index + 2}: Failed to insert")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "imported_count": imported_count,
        "total_rows": len(df),
        "errors": errors
    }

def import_label_contracts_from_dataframe(df: pd.DataFrame, created_by: str) -> Dict[str, Any]:
    """Import label contracts from DataFrame"""
    supabase = get_supabase()
    imported_count = 0
    errors = []
    
    # Get starting SQ number
    current_sq = get_next_sq_number(supabase, "label_contracts")
    
    for index, row in df.iterrows():
        try:
            date_of_contract = parse_date(row.get("date_of_contract"))
            
            # Validate required fields first (SQ is now auto-generated)
            end_user = str(row.get("end_user", "")).strip()
            part_number = str(row.get("part_number", "")).strip()
            serial = str(row.get("serial", "")).strip()
            
            if not end_user or not part_number or not serial:
                errors.append(f"Row {index + 2}: Missing required fields (end_user, part_number, or serial)")
                continue
            
            contract_data = {
                "sq": current_sq,
                "end_user": end_user,
                "part_number": part_number,
                "serial": serial,
                "next_pms_schedule": parse_date(row.get("next_pms_schedule")) or (calculate_next_pms_from_contract_date(date_of_contract, "label").isoformat() if date_of_contract else None),
                "branch": str(row.get("branch", "")).strip() or None,
                "technical_specialist": str(row.get("technical_specialist", "")).strip() or None,
                "date_of_contract": date_of_contract,
                "end_of_contract": parse_date(row.get("end_of_contract")),
                "status": str(row.get("status", "active")).strip().lower() or "active",
                "po_number": str(row.get("po_number", "")).strip() or None,
                "frequency": str(row.get("frequency", "monthly")).strip().lower() or "monthly",
                "documentation": str(row.get("documentation", "")).strip() if pd.notna(row.get("documentation")) and str(row.get("documentation", "")).strip() else None,
                "service_report": str(row.get("service_report", "")).strip() if pd.notna(row.get("service_report")) and str(row.get("service_report", "")).strip() else None,
                "history": str(row.get("history", "")).strip() if pd.notna(row.get("history")) and str(row.get("history", "")).strip() else None,
                "reports": str(row.get("reports", "")).strip() if pd.notna(row.get("reports")) and str(row.get("reports", "")).strip() else None,
                "created_by": created_by,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            response = supabase.table("label_contracts").insert(contract_data).execute()
            
            if response.data:
                imported_count += 1
                # Increment SQ for next record
                current_sq = str(int(current_sq) + 1)
            else:
                errors.append(f"Row {index + 2}: Failed to insert")
                
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")
    
    return {
        "imported_count": imported_count,
        "total_rows": len(df),
        "errors": errors
    }

def parse_date(date_value):
    """Parse date value from Excel/CSV to ISO format string or None"""
    if pd.isna(date_value) or date_value is None:
        return None
    
    if isinstance(date_value, str):
        date_str = date_value.strip()
        if not date_str or date_str.lower() in ['', 'nan', 'none', 'null']:
            return None
        
        try:
            # Try to parse common date formats
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y', '%m-%d-%Y']:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    return parsed_date.isoformat()
                except ValueError:
                    continue
        except:
            pass
    
    if hasattr(date_value, 'isoformat'):
        return date_value.isoformat()
    
    # If it's a pandas timestamp
    if hasattr(date_value, 'to_pydatetime'):
        return date_value.to_pydatetime().isoformat()
    
    # Default to None if parsing fails
    return None

def create_sample_data(created_by: str) -> Dict[str, Any]:
    """Create sample data for testing"""
    try:
        supabase = get_supabase()
        
        # Sample hardware contracts
        hw_contract_date_1 = datetime.utcnow() - timedelta(days=365)
        hw_contract_date_2 = datetime.utcnow() - timedelta(days=180)
        
        sample_hardware = [
            {
                "sq": "HW001",
                "end_user": "ABC Company",
                "model": "Printer Pro X1",
                "serial": "PRT001234",
                "next_pms_schedule": calculate_next_pms_from_contract_date(hw_contract_date_1, "hardware").isoformat(),
                "branch": "Main Office",
                "technical_specialist": "John Doe",
                "date_of_contract": hw_contract_date_1.isoformat(),
                "end_of_contract": (datetime.utcnow() + timedelta(days=365)).isoformat(),
                "status": "active",
                "po_number": "PO-HW-001",
                "frequency": "quarterly",
                "documentation": "Standard maintenance procedures",
                "created_by": created_by,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            },
            {
                "sq": "HW002",
                "end_user": "XYZ Corp",
                "model": "Scanner Elite S2",
                "serial": "SCN002345",
                "next_pms_schedule": calculate_next_pms_from_contract_date(hw_contract_date_2, "hardware").isoformat(),
                "branch": "Branch Office",
                "technical_specialist": "Jane Smith",
                "date_of_contract": hw_contract_date_2.isoformat(),
                "end_of_contract": (datetime.utcnow() + timedelta(days=180)).isoformat(),
                "status": "active",
                "po_number": "PO-HW-002",
                "frequency": "quarterly",
                "documentation": "Quarterly maintenance schedule",
                "created_by": created_by,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
        ]
        
        # Sample label contracts
        label_contract_date = datetime.utcnow() - timedelta(days=90)
        
        sample_label = [
            {
                "sq": "LB001",
                "end_user": "DEF Industries",
                "part_number": "LABEL-001",
                "serial": "LBL001234",
                "next_pms_schedule": calculate_next_pms_from_contract_date(label_contract_date, "label").isoformat(),
                "branch": "Factory Floor",
                "technical_specialist": "Mike Johnson",
                "date_of_contract": label_contract_date.isoformat(),
                "end_of_contract": (datetime.utcnow() + timedelta(days=270)).isoformat(),
                "status": "active",
                "po_number": "PO-LB-001",
                "frequency": "monthly",
                "documentation": "Label maintenance guidelines",
                "created_by": created_by,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
        ]
        
        # Insert sample data
        hw_response = supabase.table("hardware_contracts").insert(sample_hardware).execute()
        label_response = supabase.table("label_contracts").insert(sample_label).execute()
        
        return {
            "hardware_imported": len(hw_response.data) if hw_response.data else 0,
            "label_imported": len(label_response.data) if label_response.data else 0,
            "total_imported": (len(hw_response.data) if hw_response.data else 0) + (len(label_response.data) if label_response.data else 0)
        }
        
    except Exception as e:
        logger.error(f"Error creating sample data: {e}")
        return {
            "hardware_imported": 0,
            "label_imported": 0,
            "total_imported": 0,
            "error": str(e)
        }
