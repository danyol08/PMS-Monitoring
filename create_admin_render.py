#!/usr/bin/env python3
"""
Script to create admin user for Render deployment
Run this after your backend is deployed to Render
"""

import requests
import json
import sys

def create_admin_user(backend_url, email, password, full_name):
    """Create admin user via API"""
    
    # Remove trailing slash from URL
    backend_url = backend_url.rstrip('/')
    
    # Signup endpoint
    signup_url = f"{backend_url}/api/auth/signup"
    
    # Admin user data
    user_data = {
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "admin"
    }
    
    try:
        print(f"Creating admin user: {email}")
        print(f"Backend URL: {backend_url}")
        
        response = requests.post(signup_url, json=user_data)
        
        if response.status_code == 200:
            print("✅ Admin user created successfully!")
            print(f"Email: {email}")
            print(f"Password: {password}")
            print(f"Role: admin")
            print("\nYou can now login to your PMS application.")
        else:
            print(f"❌ Error creating admin user: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        print("Make sure your backend is deployed and running.")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python create_admin_render.py <backend_url> <email> <password> <full_name>")
        print("Example: python create_admin_render.py https://pms-backend.onrender.com admin@company.com admin123 'Admin User'")
        sys.exit(1)
    
    backend_url = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    full_name = sys.argv[4]
    
    create_admin_user(backend_url, email, password, full_name)
