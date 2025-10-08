from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from app.database import get_supabase
from app.models import NotificationCreate
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    """Start the background scheduler"""
    if not scheduler.running:
        scheduler.start()
        
        # Schedule daily maintenance check at 9 AM
        scheduler.add_job(
            check_upcoming_maintenance,
            CronTrigger(hour=9, minute=0),
            id='daily_maintenance_check',
            replace_existing=True
        )
        
        # Schedule weekly report generation on Mondays at 8 AM
        scheduler.add_job(
            generate_weekly_reports,
            CronTrigger(day_of_week=0, hour=8, minute=0),
            id='weekly_reports',
            replace_existing=True
        )
        
        logger.info("Scheduler started successfully")

def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")

async def check_upcoming_maintenance():
    """Check for upcoming maintenance and send notifications"""
    try:
        supabase = get_supabase()
        
        # Check hardware contracts - exclude expired
        hw_response = supabase.table("hardware_contracts").select("*").neq("status", "expired").execute()
        hw_contracts = hw_response.data
        
        # Check label contracts - exclude expired
        label_response = supabase.table("label_contracts").select("*").neq("status", "expired").execute()
        label_contracts = label_response.data
        
        all_contracts = []
        
        # Process hardware contracts - exclude expired
        for contract in hw_contracts:
            if contract.get("status") != "expired":
                all_contracts.append({
                    **contract,
                    "contract_type": "hardware"
                })
        
        # Process label contracts - exclude expired
        for contract in label_contracts:
            if contract.get("status") != "expired":
                all_contracts.append({
                    **contract,
                    "contract_type": "label"
                })
        
        # Check for contracts needing maintenance in the next 7 days
        upcoming_date = datetime.utcnow() + timedelta(days=7)
        upcoming_contracts = []
        
        for contract in all_contracts:
            if contract.get("next_pms_schedule"):
                next_maintenance = datetime.fromisoformat(contract["next_pms_schedule"].replace('Z', '+00:00'))
                if next_maintenance <= upcoming_date:
                    upcoming_contracts.append(contract)
        
        # Send notifications for upcoming maintenance
        for contract in upcoming_contracts:
            await send_maintenance_notification(supabase, contract)
        
        logger.info(f"Checked {len(all_contracts)} contracts, found {len(upcoming_contracts)} needing maintenance")
        
    except Exception as e:
        logger.error(f"Error in maintenance check: {e}")

async def send_maintenance_notification(supabase, contract):
    """Send notification for upcoming maintenance"""
    try:
        # Get all technicians and admins
        users_response = supabase.table("users").select("*").in_("role", ["technician", "admin"]).execute()
        users = users_response.data
        
        for user in users:
            notification_data = {
                "user_id": user["id"],
                "title": f"Upcoming Maintenance - {contract['sq']}",
                "message": f"Maintenance is due for {contract['contract_type']} contract {contract['sq']} on {contract['next_pms_schedule'][:10]}",
                "notification_type": "maintenance_reminder",
                "contract_id": contract["id"],
                "is_read": False
            }
            
            supabase.table("notifications").insert(notification_data).execute()
        
        logger.info(f"Sent maintenance notifications for contract {contract['sq']}")
        
    except Exception as e:
        logger.error(f"Error sending maintenance notification: {e}")

async def generate_weekly_reports():
    """Generate weekly maintenance reports"""
    try:
        supabase = get_supabase()
        
        # Get contracts that had maintenance this week
        week_ago = datetime.utcnow() - timedelta(days=7)
        
        # Get service history for the past week
        history_response = supabase.table("service_history").select("*").gte("service_date", week_ago.isoformat()).execute()
        service_history = history_response.data
        
        # Get all users for notifications
        users_response = supabase.table("users").select("*").in_("role", ["admin", "technician"]).execute()
        users = users_response.data
        
        # Send weekly report notification
        for user in users:
            notification_data = {
                "user_id": user["id"],
                "title": "Weekly Maintenance Report",
                "message": f"Weekly report: {len(service_history)} maintenance tasks completed this week",
                "notification_type": "weekly_report",
                "is_read": False
            }
            
            supabase.table("notifications").insert(notification_data).execute()
        
        logger.info(f"Generated weekly report with {len(service_history)} maintenance tasks")
        
    except Exception as e:
        logger.error(f"Error generating weekly reports: {e}")

async def check_expired_contracts():
    """Check for contracts that have passed their end date and mark them as expired"""
    try:
        supabase = get_supabase()
        current_date = datetime.utcnow().date()
        
        # Check hardware contracts
        hw_response = supabase.table("hardware_contracts").select("*").neq("status", "expired").execute()
        hw_contracts = hw_response.data
        
        # Check label contracts
        label_response = supabase.table("label_contracts").select("*").neq("status", "expired").execute()
        label_contracts = label_response.data
        
        expired_hw_count = 0
        expired_label_count = 0
        
        # Process hardware contracts
        for contract in hw_contracts:
            if contract.get("end_of_contract"):
                try:
                    end_date = datetime.fromisoformat(contract["end_of_contract"].replace('Z', '+00:00')).date()
                    if end_date < current_date:
                        # Mark as expired
                        supabase.table("hardware_contracts").update({
                            "status": "expired",
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", contract["id"]).execute()
                        
                        expired_hw_count += 1
                        logger.info(f"Marked hardware contract {contract['id']} ({contract.get('end_user', 'Unknown')}) as expired")
                except Exception as e:
                    logger.error(f"Error processing hardware contract {contract['id']}: {e}")
        
        # Process label contracts
        for contract in label_contracts:
            if contract.get("end_of_contract"):
                try:
                    end_date = datetime.fromisoformat(contract["end_of_contract"].replace('Z', '+00:00')).date()
                    if end_date < current_date:
                        # Mark as expired
                        supabase.table("label_contracts").update({
                            "status": "expired",
                            "updated_at": datetime.utcnow().isoformat()
                        }).eq("id", contract["id"]).execute()
                        
                        expired_label_count += 1
                        logger.info(f"Marked label contract {contract['id']} ({contract.get('end_user', 'Unknown')}) as expired")
                except Exception as e:
                    logger.error(f"Error processing label contract {contract['id']}: {e}")
        
        total_expired = expired_hw_count + expired_label_count
        if total_expired > 0:
            logger.info(f"Expired contracts check completed: {expired_hw_count} hardware contracts and {expired_label_count} label contracts marked as expired")
        else:
            logger.info("Expired contracts check completed: No contracts found to expire")
        
    except Exception as e:
        logger.error(f"Error in expired contracts check: {e}")

async def update_maintenance_schedule(contract_id, contract_type, current_schedule=None):
    """Update maintenance schedule after service completion"""
    try:
        supabase = get_supabase()
        
        # Get current contract to find the contract date
        table_name = "hardware_contracts" if contract_type == "hardware" else "label_contracts"
        contract_response = supabase.table(table_name).select("date_of_contract, next_pms_schedule").eq("id", contract_id).execute()
        
        if not contract_response.data:
            logger.error(f"Contract {contract_id} not found")
            return
        
        contract_data = contract_response.data[0]
        contract_date = contract_data.get("date_of_contract")
        current_pms_schedule = current_schedule or contract_data.get("next_pms_schedule")
        
        # Calculate next maintenance date based on contract type
        next_date = calculate_next_pms_schedule(contract_date, contract_type, current_pms_schedule)
        
        if not next_date:
            logger.error(f"Could not calculate next maintenance date for contract {contract_id}")
            return
        
        # Update the contract
        supabase.table(table_name).update({
            "next_pms_schedule": next_date.isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", contract_id).execute()
        
        logger.info(f"Updated maintenance schedule for {contract_type} contract {contract_id} to {next_date.isoformat()}")
        
    except Exception as e:
        logger.error(f"Error updating maintenance schedule: {e}")

def calculate_next_maintenance(current_date, frequency):
    """Calculate next maintenance date based on frequency"""
    if frequency == "monthly":
        return current_date + timedelta(days=30)
    elif frequency == "quarterly":
        return current_date + timedelta(days=90)
    elif frequency == "semi-annual":
        return current_date + timedelta(days=180)
    elif frequency == "yearly":
        return current_date + timedelta(days=365)
    else:
        return current_date + timedelta(days=30)  # Default to monthly

def calculate_next_pms_from_contract_date(contract_date, contract_type):
    """Calculate next PMS schedule based on contract date and type"""
    if contract_type == "hardware":
        # Hardware contracts: every 3 months (90 days)
        return contract_date + timedelta(days=90)
    elif contract_type == "label":
        # Label contracts: every 1 month (30 days)
        return contract_date + timedelta(days=30)
    else:
        # Default to monthly
        return contract_date + timedelta(days=30)

def calculate_next_pms_schedule(contract_date, contract_type, current_schedule=None):
    """Calculate the next PMS schedule based on contract date and type"""
    if not contract_date:
        return None
    
    # Parse contract date if it's a string
    if isinstance(contract_date, str):
        try:
            contract_date = datetime.fromisoformat(contract_date.replace('Z', '+00:00'))
        except:
            return None
    
    # If no current schedule, calculate from contract date
    if not current_schedule:
        return calculate_next_pms_from_contract_date(contract_date, contract_type)
    
    # Parse current schedule if it's a string
    if isinstance(current_schedule, str):
        try:
            current_schedule = datetime.fromisoformat(current_schedule.replace('Z', '+00:00'))
        except:
            return calculate_next_pms_from_contract_date(contract_date, contract_type)
    
    # Calculate next schedule based on contract type
    if contract_type == "hardware":
        # Hardware: every 3 months (90 days)
        return current_schedule + timedelta(days=90)
    elif contract_type == "label":
        # Label: every 1 month (30 days)
        return current_schedule + timedelta(days=30)
    else:
        # Default to monthly
        return current_schedule + timedelta(days=30)

def generate_full_pms_schedule(contract_date, end_date, contract_type):
    """Generate all PMS schedules from contract start to end date"""
    if not contract_date or not end_date:
        return []
    
    # Parse dates if they're strings
    if isinstance(contract_date, str):
        try:
            contract_date = datetime.fromisoformat(contract_date.replace('Z', '+00:00'))
        except:
            return []
    
    if isinstance(end_date, str):
        try:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            return []
    
    pms_schedules = []
    current_date = contract_date
    
    # Determine interval based on contract type
    if contract_type == "hardware":
        interval_days = 90  # 3 months
    elif contract_type == "label":
        interval_days = 30  # 1 month
    else:
        interval_days = 30  # Default to monthly
    
    # Generate all PMS schedules until end of contract
    while current_date <= end_date:
        next_pms = current_date + timedelta(days=interval_days)
        if next_pms <= end_date:
            pms_schedules.append(next_pms.isoformat())
        current_date = next_pms
    
    return pms_schedules





