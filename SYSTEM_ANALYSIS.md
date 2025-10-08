# Preventive Maintenance System (PMS) - System Analysis

## Overview
The Preventive Maintenance System (PMS) is a comprehensive web application designed to manage preventive maintenance contracts and schedules. It's built with a modern tech stack using FastAPI (Python) for the backend, Next.js (React) for the frontend, and Supabase (PostgreSQL) for the database.

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React/Next.js │    │   FastAPI       │    │   Supabase      │
│   Frontend      │◄──►│   Backend       │◄──►│   Database      │
│                 │    │                 │    │   Auth          │
│   - Dashboard   │    │   - REST API    │    │   Storage       │
│   - Charts      │    │   - Scheduling  │    │                 │
│   - Forms       │    │   - Reports     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

#### Backend (FastAPI)
- **Framework**: FastAPI 0.104.1
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT with bcrypt password hashing
- **Scheduling**: APScheduler for automated maintenance checks
- **File Handling**: Python multipart for file uploads
- **Reports**: ReportLab for PDF generation, pandas for Excel
- **API Documentation**: Auto-generated Swagger/OpenAPI docs

#### Frontend (Next.js)
- **Framework**: Next.js 14.0.3 with App Router
- **UI Library**: React 18.2.0 with TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form
- **Icons**: Lucide React, Heroicons
- **Notifications**: React Hot Toast

#### Database (Supabase)
- **Type**: PostgreSQL
- **Features**: Row-level security, real-time subscriptions
- **Storage**: File uploads and document management
- **Authentication**: Local authentication with JWT

## Core Features

### 1. Contract Management
- **Hardware Contracts**: Equipment maintenance contracts
- **Label Contracts**: Label maintenance contracts
- **Repair Management**: Repair tracking and history
- **Contract Status**: Active, Inactive, Expired, Pending
- **Automated Scheduling**: Monthly, Quarterly, Yearly, Semi-annual

### 2. User Management & Authentication
- **Role-Based Access Control**:
  - **Admin**: Full system access, user management
  - **Technician**: Create/update contracts, log maintenance
  - **Viewer**: Read-only access
- **Local Authentication**: JWT tokens with bcrypt password hashing
- **Session Management**: Token refresh and logout

### 3. Maintenance Scheduling
- **Automated Notifications**: Daily checks for upcoming maintenance
- **Flexible Frequencies**: Configurable maintenance intervals
- **Schedule Calculation**: Automatic next maintenance date calculation
- **Quarterly Reports**: Weekly automated report generation

### 4. Service History & Tracking
- **Service Records**: Detailed maintenance logs
- **File Attachments**: Upload service reports and documentation
- **Audit Trail**: Complete activity logging
- **Status Tracking**: Track maintenance completion status

### 5. Reporting & Analytics
- **Dashboard**: Real-time statistics and charts
- **Excel Export**: Data export capabilities
- **PDF Reports**: Generated maintenance reports
- **Analytics**: Contract performance metrics

## Database Schema

### Core Tables
1. **users** - User accounts with role-based access
2. **hardware_contracts** - Hardware maintenance contracts
3. **label_contracts** - Label maintenance contracts
4. **service_history** - Maintenance service records
5. **repairs** - Repair management
6. **repairs_history** - Completed repair records
7. **files** - Uploaded documents and reports
8. **notifications** - System notifications
9. **audit_trail** - Activity logging

### Key Relationships
- Users can create multiple contracts
- Contracts have multiple service history records
- Files are linked to contracts and service records
- Audit trail tracks all user activities

## API Structure

### Authentication Endpoints (`/api/auth`)
- `POST /login` - User authentication
- `POST /signup` - User registration
- `POST /logout` - User logout
- `GET /me` - Get current user info
- `PUT /me` - Update user profile
- `POST /refresh` - Refresh JWT token

### Contract Endpoints (`/api/contracts`)
- Hardware and Label contract CRUD operations
- Dashboard statistics
- Upcoming maintenance queries
- Contract scheduling and notifications

### Additional Endpoints
- `/api/users` - User management
- `/api/reports` - Report generation
- `/api/uploads` - File management
- `/api/notifications` - Notification system
- `/api/repairs` - Repair management
- `/api/audit` - Audit trail access

## Frontend Structure

### Page Organization
- **Dashboard** (`/dashboard`) - Main overview with stats and charts
- **Contracts** (`/contracts/*`) - Contract management pages
- **Repairs** (`/repairs`) - Repair management
- **Reports** (`/reports`) - Reporting and analytics
- **Users** (`/users`) - User management
- **Settings** (`/settings`) - System configuration

### Key Components
- **DashboardLayout** - Main application layout
- **StatsCards** - Dashboard statistics display
- **UpcomingMaintenance** - Maintenance schedule widget
- **ContractsChart** - Data visualization
- **ResponsiveTable** - Data table component
- **Various Modals** - Form dialogs for CRUD operations

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Token refresh mechanism
- Session management

### Data Protection
- Row-level security (RLS) in Supabase
- Input validation with Pydantic models
- CORS configuration
- SQL injection prevention
- XSS protection

### Audit Trail
- Complete activity logging
- User action tracking
- IP address logging
- Change history for all entities

## Deployment & Infrastructure

### Docker Support
- Multi-stage Dockerfile
- Docker Compose for local development
- Production-ready containerization
- Environment variable configuration

### Environment Configuration
- Backend: `.env` with Supabase credentials
- Frontend: `.env.local` with API URLs
- Separate development and production configs

## Key Strengths

1. **Modern Tech Stack**: Uses current best practices and technologies
2. **Comprehensive Features**: Covers all aspects of maintenance management
3. **Role-Based Security**: Proper access control implementation
4. **Automated Scheduling**: Reduces manual maintenance tracking
5. **Audit Trail**: Complete activity logging for compliance
6. **Responsive Design**: Works on desktop and mobile devices
7. **Real-time Updates**: Live data synchronization
8. **File Management**: Document storage and retrieval
9. **Reporting**: Multiple export formats and analytics

## Areas for Enhancement

1. **Email Notifications**: Currently only in-app notifications
2. **Mobile App**: No native mobile application
3. **Multi-tenant Support**: Single-tenant architecture
4. **API Rate Limiting**: No rate limiting implemented
5. **Advanced Analytics**: Basic reporting capabilities
6. **External Integrations**: No third-party system integration
7. **Backup Strategy**: No automated backup system mentioned

## Development Workflow

### Backend Development
- FastAPI with automatic API documentation
- Pydantic models for data validation
- Async/await for better performance
- Structured logging and error handling

### Frontend Development
- Next.js App Router for modern React patterns
- TypeScript for type safety
- Component-based architecture
- Responsive design with Tailwind CSS

### Database Management
- Supabase for managed PostgreSQL
- Migration support through SQL scripts
- Real-time subscriptions
- Built-in authentication and storage

This system represents a well-architected, production-ready application for preventive maintenance management with modern development practices and comprehensive feature coverage.
