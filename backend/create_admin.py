#!/usr/bin/env python3
"""
Script to create the first admin user for the PMS system.
Run this after setting up the database to create an initial admin account.
"""

import os
import sys
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import init_supabase
from app.auth import get_password_hash

def create_admin_user():
    load_dotenv()
    
    # Initialize Supabase
    supabase = init_supabase()
    
    print("Creating admin user for PMS system...")
    print("=" * 50)
    
    # Get admin details
    email = input("Enter admin email: ").strip()
    if not email:
        print("Email is required!")
        return
    
    full_name = input("Enter admin full name: ").strip()
    if not full_name:
        print("Full name is required!")
        return
    
    password = input("Enter admin password: ").strip()
    if not password:
        print("Password is required!")
        return
    
    if len(password) < 6:
        print("Password must be at least 6 characters long!")
        return
    
    # Check if user already exists
    existing_user = supabase.table("users").select("id").eq("email", email).execute()
    if existing_user.data:
        print(f"User with email {email} already exists!")
        return
    
    # Generate user ID
    user_id = str(uuid.uuid4())
    
    # Hash password
    password_hash = get_password_hash(password)
    
    # Create admin user
    user_data = {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "password_hash": password_hash,
        "role": "admin",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    try:
        response = supabase.table("users").insert(user_data).execute()
        
        if response.data:
            print("✅ Admin user created successfully!")
            print(f"Email: {email}")
            print(f"Name: {full_name}")
            print(f"Role: admin")
            print(f"User ID: {user_id}")
            print("\nYou can now log in to the system with these credentials.")
        else:
            print("❌ Failed to create admin user!")
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")

if __name__ == "__main__":
    create_admin_user()




