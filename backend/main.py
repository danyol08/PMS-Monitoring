from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.database import init_supabase
from app.routers import auth, contracts, users, reports, uploads, notifications, repairs, audit, repairs_history, imports
from app.scheduler import start_scheduler, stop_scheduler

load_dotenv()

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()

app = FastAPI(
    title="Preventive Maintenance System (PMS)",
    description="A comprehensive PMS monitoring system with FastAPI and Supabase",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3000",
        "https://pms-monitoring.vercel.app",  # Vercel deployment
        "https://pms-monitoring.onrender.com"  # Backend URL (optional)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
init_supabase()

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["contracts"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(repairs.router, prefix="/api", tags=["repairs"])
app.include_router(repairs_history.router, prefix="/api", tags=["repairs-history"])
app.include_router(audit.router, prefix="/api", tags=["audit"])
app.include_router(imports.router, prefix="/api/import", tags=["imports"])

@app.get("/")
async def root():
    return {"message": "Preventive Maintenance System API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
