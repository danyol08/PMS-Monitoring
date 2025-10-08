from pydantic_settings import BaseSettings
from typing import Optional

def generate_excel_report(data):
    # implement your Excel export logic here
    pass

def generate_pdf_report(data):
    # implement your PDF export logic here
    pass

class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    supabase_service_key: str
    
    # JWT Configuration
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # File Upload Configuration
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    allowed_file_types: str = ".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
    
    @property
    def allowed_file_types_list(self) -> list:
        return [ext.strip() for ext in self.allowed_file_types.split(",")]
    
    # Email Configuration (for notifications)
    smtp_server: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    
    class Config:
        env_file = ".env"

    
settings = Settings()
