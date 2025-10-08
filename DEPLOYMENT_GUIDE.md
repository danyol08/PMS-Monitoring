# 🚀 PMS Deployment Guide - Render + Vercel (FREE)

## 📋 Prerequisites
- GitHub account
- Supabase account (free tier)
- Render account (free tier)
- Vercel account (free tier)

## 🗄️ Step 1: Supabase Database Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new project
4. Choose a name: `pms-database`
5. Set password (save this!)
6. Choose region closest to you
7. Wait for setup to complete

### 1.2 Get Supabase Credentials
1. Go to Project Settings → API
2. Copy these values:
   - **Project URL** (SUPABASE_URL)
   - **anon public** key (SUPABASE_KEY)
   - **service_role** key (SUPABASE_SERVICE_KEY)

### 1.3 Setup Database Schema
1. Go to SQL Editor in Supabase
2. Create a new query
3. Run the database schema from your `backend/database_schema.sql` file

## 🔧 Step 2: Backend Deployment (Render)

### 2.1 Prepare Repository
1. Push your code to GitHub
2. Make sure all files are committed

### 2.2 Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure settings:
   - **Name**: `pms-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

### 2.3 Set Environment Variables in Render
Go to Environment tab and add:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET_KEY=your_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

### 2.4 Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Copy the deployed URL (e.g., `https://pms-backend.onrender.com`)

## 🎨 Step 3: Frontend Deployment (Vercel)

### 3.1 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your repository
5. Configure settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 3.2 Set Environment Variables in Vercel
Go to Settings → Environment Variables and add:
```
NEXT_PUBLIC_API_URL=https://your-render-backend-url.onrender.com
```

### 3.3 Deploy
1. Click "Deploy"
2. Wait for deployment (2-5 minutes)
3. Copy the deployed URL (e.g., `https://pms-frontend.vercel.app`)

## 🔗 Step 4: Connect Frontend to Backend

### 4.1 Update CORS in Backend
In your `backend/main.py`, update CORS origins:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-vercel-frontend-url.vercel.app"  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4.2 Redeploy Backend
1. Push changes to GitHub
2. Render will auto-deploy

## 🧪 Step 5: Test Deployment

### 5.1 Test Backend
1. Visit your Render URL + `/docs`
2. Should see FastAPI documentation
3. Test health endpoint: `your-render-url/health`

### 5.2 Test Frontend
1. Visit your Vercel URL
2. Try to login (create admin user first)
3. Test all features

### 5.3 Create Admin User
1. Go to your backend URL + `/docs`
2. Find the create admin endpoint
3. Create your first admin user

## 🆓 Free Tier Limits

### Render (Backend)
- ✅ 750 hours/month free
- ✅ Auto-sleep after 15 minutes of inactivity
- ✅ 512MB RAM
- ✅ Custom domains

### Vercel (Frontend)
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Custom domains
- ✅ Automatic HTTPS

### Supabase (Database)
- ✅ 500MB database
- ✅ 50,000 monthly active users
- ✅ 2GB bandwidth
- ✅ Real-time subscriptions

## 🔧 Troubleshooting

### Common Issues:
1. **CORS errors**: Update CORS origins in backend
2. **Database connection**: Check Supabase credentials
3. **Build failures**: Check requirements.txt and package.json
4. **Environment variables**: Make sure all are set correctly

### Useful Commands:
```bash
# Check backend logs
# Go to Render dashboard → Logs

# Check frontend logs  
# Go to Vercel dashboard → Functions → View Function Logs

# Test locally
cd backend && uvicorn main:app --reload
cd frontend && npm run dev
```

## 🎉 Success!
Your PMS should now be live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.onrender.com`
- **API Docs**: `https://your-app.onrender.com/docs`

All FREE! 🎊
