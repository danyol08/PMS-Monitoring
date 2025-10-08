from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_service_key: str   # ✅ match your code

    class Config:
        env_file = ".env"
        case_sensitive = False


from supabase import create_client
from .config import Settings  # or wherever your Settings class is

settings = Settings()

def init_supabase():
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )

from supabase import create_client
from .config import Settings  # or wherever your Settings is defined

settings = Settings()

_supabase = create_client(
    settings.supabase_url,
    settings.supabase_service_key
)

def get_supabase():
    return _supabase
