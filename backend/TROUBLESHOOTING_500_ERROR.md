# 🔧 TROUBLESHOOTING: Vercel 500 Error - FUNCTION_INVOCATION_FAILED

## What You Saw:
```
500 INTERNAL_SERVER_ERROR
Code: FUNCTION_INVOCATION_FAILED
ID: [error ID]
```

---

## 🎯 Root Causes & Solutions

### Issue #1: Missing Environment Variables ⭐ (MOST COMMON)

**Symptoms:**
- Server starts but immediately crashes
- Logs show "MONGO_URI is required" or "JWT_SECRET is required"

**Fix:**
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all these variables:
   ```
   MONGO_URI = mongodb+srv://...
   JWT_SECRET = (generated random 32+ char string)
   ADMIN_EMAIL = admin@edutrack.edu
   ADMIN_PASSWORD = your_password
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = your@gmail.com
   SMTP_PASS = gmail_app_password
   FRONTEND_URL = https://your-frontend.vercel.app
   NODE_ENV = production
   ```
5. Redeploy: `vercel --prod`

---

### Issue #2: MongoDB Connection Failed

**Symptoms:**
- Logs show "MongoDB Connection Failed"
- "getaddrinfo ENOTFOUND" or timeout errors

**Fix:**
1. Check MongoDB Atlas connection string in MONGO_URI
2. Verify IP whitelist in MongoDB Atlas:
   - Go to Network Access
   - Allow IP 0.0.0.0/0 (for development - restrict in production)
3. Verify username/password in connection string
4. Test connection locally first: `npm start`

---

### Issue #3: Missing timetableRoute.js ⭐ (FIXED)

**Symptoms:**
- "Cannot find module './src/routes/timetableRoute.js'"
- Server crashes on startup

**Fix:**
- ✅ Already done! File is created at `backend/src/routes/timetableRoute.js`

---

### Issue #4: App Not Exported

**Symptoms:**
- Vercel tries to run function but can't find handler
- "Cannot find export 'default'"

**Fix:**
- ✅ Already done! Added `module.exports = app;` at end of server.js

---

### Issue #5: Node.js Version Incompatibility

**Symptoms:**
- "Unsupported Node.js version"
- Syntax errors

**Fix:**
1. Update `backend/package.json`:
   ```json
   "engines": {
     "node": "18.x"
   }
   ```
2. Vercel will use Node 18 automatically

---

## 🔍 Debug Process

### Step 1: Check Vercel Logs
```bash
vercel logs yourdomain.vercel.app --follow
```

### Step 2: Look for Specific Error
- "MONGO_URI is required" → Add environment variable
- "Cannot find module" → Check file paths
- "Connection refused" → Check MongoDB Atlas

### Step 3: Check Local First
```bash
cd backend
npm install
npm start
# If it works locally, it's an environment variable issue
```

### Step 4: Redeploy
```bash
vercel --prod
# Or push to GitHub and Vercel auto-deploys
```

---

## 📋 Verification After Each Fix

### Test Health Endpoint
```bash
curl https://your-backend.vercel.app/health

# Should return (not error):
# {
#   "status": "healthy",
#   "database": "connected",
#   "uptime": 123.45
# }
```

---

## 🚨 Emergency Rollback

If current deployment broken:
```bash
vercel rollback
# Go to previous working version
```

---

## 📝 Common Commands

```bash
# View live logs
vercel logs --follow

# Deploy with no cache
vercel --prod --no-cache

# Show environment variables (verify they're set)
vercel env list

# Local testing
npm start

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ Complete Setup Checklist

- [ ] Create `.env` file in `backend/`
- [ ] Run `npm install` in `backend/`
- [ ] Test locally: `npm start`
- [ ] Verify health: `curl http://localhost:5000/health`
- [ ] Push to GitHub
- [ ] Add Vercel environment variables (all fields)
- [ ] Redeploy: `vercel --prod`
- [ ] Test production health endpoint
- [ ] Check logs: `vercel logs --follow`
- [ ] Test API: `curl https://your-api.vercel.app/api/auth/student-login ...`

---

## 📞 If Still Not Working

1. **Check Vercel Logs First:**
   ```bash
   vercel logs yourdomain.vercel.app --tail
   ```

2. **Common Error Messages & Fixes:**

   | Error | Cause | Fix |
   |-------|-------|-----|
   | `ENOTFOUND` | DNS/MongoDB issue | Check connection string |
   | `ECONNREFUSED` | MongoDB not accessible | Check IP whitelist |
   | `Cannot find module` | File not found | Check file path |
   | `JWT_SECRET is required` | Env var not set | Add to Vercel settings |
   | `CORS error` | Wrong frontend URL | Update FRONTEND_URL |

3. **Last Resort - Full Reset:**
   ```bash
   # Delete and recreate deployment
   vercel remove
   vercel --prod
   ```

---

**Last Updated:** May 2026
**Status:** Ready for Production ✅
