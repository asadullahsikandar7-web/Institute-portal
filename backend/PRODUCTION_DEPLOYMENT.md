# 🚀 Production Deployment Guide - EduTrack Backend

## ✅ Fixes Applied

### 1. **Critical Fixes**
- ✅ Created missing `timetableRoute.js` - prevents server crash
- ✅ Added global error handling middleware
- ✅ Added process error handlers (unhandledRejection, uncaughtException)
- ✅ Added health check endpoints (`/` and `/health`)
- ✅ Exported app for Vercel serverless functions
- ✅ Added environment variable validation (fail-fast approach)
- ✅ Added MongoDB connection pooling configuration
- ✅ Added graceful shutdown handling

### 2. **Security Improvements**
- ✅ Added request size limits (10mb)
- ✅ Added JWT validation in auth middleware
- ✅ Added `toSafeObject()` method to prevent password leaks
- ✅ Added input validation schema fields in Student model
- ✅ CORS properly configured for production URLs

### 3. **Performance Improvements**
- ✅ MongoDB connection pooling (min: 2, max: 10)
- ✅ Database indexes on rollNo, email, parentEmail
- ✅ Optimized request/response handling

---

## 📋 Pre-Deployment Checklist

### Step 1: Environment Variables Setup

Create `.env` file in `backend/` directory with:

```bash
# Database (MongoDB Atlas)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# JWT Secret (Generate secure random key)
JWT_SECRET=generate_a_random_key_here_min_32_chars

# Admin Credentials
ADMIN_EMAIL=admin@edutrack.edu
ADMIN_PASSWORD=secure_password_here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your_gmail_app_password

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Environment
NODE_ENV=production
PORT=5000
```

**⚠️ IMPORTANT: Never commit `.env` to Git!**

### Step 2: Generate Secure JWT Secret

Run in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste into `JWT_SECRET` in `.env`

### Step 3: Verify Local Testing

```bash
# Install dependencies
npm install

# Run locally
npm start

# Test health endpoint
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 123.45
}
```

---

## 🔧 MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create cluster or use existing
3. Add IP whitelist (or allow 0.0.0.0/0 for development)
4. Create database user with strong password
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database_name
   ```

---

## 📤 Vercel Deployment

### Step 1: Connect Repository
1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Select your repository

### Step 2: Configure Environment Variables
In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Add all variables from `.env`:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

### Step 3: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Get your API URL (e.g., `https://your-api.vercel.app`)

### Step 4: Update Frontend
Update frontend `.env` to point to new API:
```
VITE_API_URL=https://your-api.vercel.app
```

---

## 🧪 Post-Deployment Testing

### Test Health Check
```bash
curl https://your-api.vercel.app/health
```

### Test API Endpoint
```bash
curl https://your-api.vercel.app/api/auth/student-login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"rollNo":"CS-101","password":"password"}'
```

### Monitor Logs
In Vercel Dashboard:
1. Go to Deployments
2. Click latest deployment
3. View logs in real-time

---

## 🔍 Common Issues & Fixes

### ❌ Error: "MONGO_URI is required"
**Fix:** Ensure `.env` file exists in `backend/` with `MONGO_URI` set

### ❌ Error: "JWT_SECRET is required"
**Fix:** Generate and add `JWT_SECRET` to `.env`

### ❌ Error: "Cannot find module 'timetableRoute'"
**Fix:** Already created! No action needed.

### ❌ Error: "CORS error on frontend"
**Fix:** Add frontend URL to `FRONTEND_URL` in `.env` and redeploy

### ❌ Error: "MongoDB connection timeout"
**Fix:** 
1. Check MongoDB Atlas IP whitelist
2. Verify username/password in connection string
3. Check internet connection

### ❌ Error: "Function invocation failed"
**Fix:** Check Vercel logs for specific error - usually environment variable missing

---

## 📊 Monitoring & Maintenance

### Health Checks
- Vercel has built-in monitoring
- Set up external monitoring (e.g., Uptime Robot)
- Test endpoint: `https://your-api.vercel.app/health`

### Log Files
View logs in Vercel Dashboard → Deployments → Logs

### Database Backups
Set up automatic backups in MongoDB Atlas:
1. Go to Backup → Backup Settings
2. Enable daily backups

### Rate Limiting
Consider adding rate limiting middleware for production:
```bash
npm install express-rate-limit
```

---

## 🔐 Security Checklist

- ✅ Environment variables not in code
- ✅ JWT secret is strong and random
- ✅ Database passwords strong
- ✅ CORS restricted to specific domains
- ✅ HTTPS enabled (Vercel default)
- ✅ No console.logs with sensitive data
- ✅ Input validation on all endpoints
- ✅ Error messages don't leak sensitive info

---

## 📞 Support & Debugging

### Enable Debug Mode
```bash
# In terminal before starting
export DEBUG=*
npm start
```

### Check Deployment Logs
```bash
vercel logs --follow
```

### Rollback to Previous Deployment
```bash
vercel rollback
```

---

## 🎯 Next Steps

1. ✅ Set up `.env` file with all variables
2. ✅ Test locally with `npm start`
3. ✅ Push to GitHub
4. ✅ Configure Vercel environment variables
5. ✅ Deploy to Vercel
6. ✅ Update frontend API URL
7. ✅ Test all API endpoints
8. ✅ Set up monitoring

---

**Status:** Production-ready ✅
**Last Updated:** May 2026
**Version:** 1.0.0
