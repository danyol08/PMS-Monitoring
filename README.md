# Preventive Maintenance System (PMS)

A comprehensive web application for managing preventive maintenance contracts and schedules, built with FastAPI, Supabase, and Next.js.

## Features

### Core Functionality
- **Dual Contract Management**: Support for both Hardware and Label contracts
- **Role-based Access Control**: Admin, Technician, and Viewer roles with appropriate permissions
- **Automated Scheduling**: Configurable maintenance frequencies (Monthly, Quarterly, Yearly)
- **Real-time Notifications**: Automated alerts for upcoming maintenance
- **File Management**: Upload and store service reports and documentation
- **Comprehensive Reporting**: Generate Excel and PDF reports
- **Data Import**: Import existing data from Excel/CSV files

### Technical Features
- **FastAPI Backend**: High-performance Python API with automatic documentation
- **Supabase Integration**: PostgreSQL database, authentication, and file storage
- **React Frontend**: Modern Next.js application with responsive design
- **Real-time Updates**: Live data synchronization
- **Docker Support**: Containerized deployment
- **Security**: JWT authentication and row-level security

## Architecture

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

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (optional)
- Supabase account

### 1. Database Setup

1. Create a new Supabase project (PostgreSQL database)
2. Run the SQL schema from `backend/database_schema.sql`
3. Note your project URL and API keys
4. Create your first admin user: `python backend/create_admin.py`

### 2. Backend Setup

```bash
cd backend
cp env.example .env
# Edit .env with your Supabase credentials

pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
cp env.local.example .env.local
# Edit .env.local with your API URL

npm install
npm run dev
```

### 4. Docker Setup (Alternative)

```bash
# Copy environment files
cp backend/env.example .env
cp frontend/env.local.example .env.local

# Edit both files with your database credentials

# Run with Docker Compose
docker-compose up --build
```

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Database Schema

### Core Tables
- `users` - User accounts with local authentication (password hashing)
- `hardware_contracts` - Hardware maintenance contracts
- `label_contracts` - Label maintenance contracts
- `service_history` - Maintenance service records
- `files` - Uploaded documents and reports
- `notifications` - System notifications

### Key Features
- Local authentication with bcrypt password hashing
- Row-level security (RLS) for data protection
- Automatic timestamp updates
- Foreign key relationships
- Optimized indexes for performance

## User Roles

### Admin
- Full system access
- User management
- All CRUD operations
- System configuration

### Technician
- Create and update contracts
- Log maintenance activities
- Upload service reports
- View all data

### Viewer
- Read-only access
- View contracts and reports
- No modification permissions

## Data Import

The system supports importing existing data:

### Excel Format
```csv
SQ,End User,Model/Part Number,Serial,Next PMS Schedule,Branch,Technical Specialist,Date of Contract,End of Contract,Status,PO Number,Frequency,Documentation
```

### Supported File Types
- Excel (.xlsx, .xls)
- CSV files
- PDF documents
- Images (.jpg, .png)

## Deployment

### Production Deployment

1. **Backend (Railway/Vercel)**
   ```bash
   # Set environment variables
   # Deploy with your preferred platform
   ```

2. **Frontend (Vercel)**
   ```bash
   # Connect GitHub repository
   # Set environment variables
   # Deploy automatically
   ```

3. **Database (Supabase)**
   - Use Supabase's managed PostgreSQL
   - Configure RLS policies
   - Set up storage buckets

### Environment Variables

#### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET_KEY=your_jwt_secret
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=your_backend_url
```

## Development

### Project Structure
```
PMS/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpoints
│   │   ├── models.py       # Data models
│   │   ├── auth.py         # Authentication
│   │   └── utils.py        # Utilities
│   ├── main.py            # FastAPI app
│   └── requirements.txt   # Python dependencies
├── frontend/               # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # Utilities and config
│   └── package.json      # Node dependencies
├── docker/               # Docker configuration
├── docker-compose.yml    # Multi-service setup
└── README.md            # This file
```

### Adding New Features

1. **Backend**: Add new endpoints in `app/routers/`
2. **Frontend**: Create components in `components/`
3. **Database**: Update schema and run migrations
4. **Testing**: Add tests for new functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the database schema

## Roadmap

- [ ] Mobile app support
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Advanced reporting features
- [ ] Integration with external systems
