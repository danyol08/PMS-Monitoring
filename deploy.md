# PMS Deployment Guide

## Quick Deploy Commands

### 1. Deploy Backend (Railway)
```bash
cd backend
railway login
railway init
railway up
```

### 2. Deploy Frontend (Netlify)
```bash
cd frontend
npm run build
netlify deploy --prod --dir=out
```

### 3. Environment Variables to Set in Netlify:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Update CORS in backend/main.py:
Replace `your-pms-app.netlify.app` with your actual Netlify URL

## Deployment Checklist:
- [ ] Backend deployed and running
- [ ] Frontend built successfully
- [ ] Environment variables set
- [ ] CORS updated
- [ ] Database connected
- [ ] Test login functionality

