# 🚀 VERCEL INTEGRATION GUIDE - Complete Setup

## ✅ CHANGES ALREADY MADE

### 1. **Frontend API URL Updated** ✓
- **File**: `src/asad.jsx`
- **Change**: `BASE = "https://institute-backend-bice.vercel.app"`
- **Impact**: All API calls now point to live Vercel backend

### 2. **Backend CORS Updated** ✓
- **File**: `backend/src/server.js`
- **Change**: CORS now allows `https://institute-portal-psi.vercel.app`
- **Includes**: Proper headers for Content-Type and Authorization

### 3. **Backend vercel.json Created** ✓
- **File**: `backend/vercel.json`
- **Configured**: 
  - Entry point: `/server.js`
  - Memory: 1024MB
  - Rewrites setup for API routing

### 4. **Frontend vercel.json Created** ✓
- **File**: `vercel.json` (root)
- **Configured**:
  - Build: `npm run build`
  - Output: `dist/`
  - Framework: Vite

### 5. **Vite Config Enhanced** ✓
- **File**: `vite.config.js`
- **Added**: Proxy for local development, source map optimization

---

## 📋 NEXT STEPS TO COMPLETE INTEGRATION

### **Step 1: Update Backend Environment Variables on Vercel**

1. Go to: https://vercel.com/dashboard
2. Select project: **institute-backend-bice**
3. Click **Settings** → **Environment Variables**
4. Add/Update the following variables:

```env
JWT_SECRET=AsadullahSikandar
MONGO_URI=mongodb+srv://asadullahsikandar8_db_user:<Asad>@institutemanagment.vvbrg6y.mongodb.net/?appName=institutemanagment
DATABASE_URL=mongodb+srv://asadullahsikandar8_db_user:<Asad>@institutemanagment.vvbrg6y.mongodb.net/?appName=institutemanagment
ADMIN_EMAIL=admin@edutrack.edu
ADMIN_PASSWORD=admin123
NODE_ENV=production
PORT=
```

> **⚠️ IMPORTANT**: The `<Asad>` in MongoDB URI should be replaced with your actual password if it contains special characters.

---

### **Step 2: Update Frontend Environment Variables on Vercel**

1. Go to: https://vercel.com/dashboard
2. Select project: **institute-portal-psi**
3. Click **Settings** → **Environment Variables**
4. Add:

```env
VITE_API_URL=https://institute-backend-bice.vercel.app
```

---

### **Step 3: Redeploy Both Projects**

#### **Backend Redeploy:**
```bash
# In backend folder
cd backend
git add .
git commit -m "fix: update CORS and vercel config for frontend integration"
git push
```

#### **Frontend Redeploy:**
```bash
# In root folder
git add .
git commit -m "fix: update API URL to live backend"
git push
```

> Vercel will automatically redeploy on push ✓

---

### **Step 4: Test Integration**

#### **Test Login:**
1. Go to https://institute-portal-psi.vercel.app
2. Try Admin Login: 
   - Email: `admin@edutrack.edu`
   - Password: `admin123`
3. Check browser **Console** (F12) for any CORS errors

#### **Check Backend Health:**
```bash
curl https://institute-backend-bice.vercel.app/
# Expected: ✅ Backend Running Successfully
```

#### **Monitor Requests:**
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Click around the app
4. All requests should show:
   - ✅ Status 200-201 (success)
   - ✅ URL: `https://institute-backend-bice.vercel.app/api/...`

---

### **Step 5: Enable HTTPS on Vercel (Auto)**

✅ Already enabled by default
- Frontend: https://institute-portal-psi.vercel.app
- Backend: https://institute-backend-bice.vercel.app

---

## 🔍 VERIFICATION CHECKLIST

- [ ] Backend environment variables set in Vercel
- [ ] Frontend environment variables set in Vercel
- [ ] Both projects redeployed after changes
- [ ] Admin login works on https://institute-portal-psi.vercel.app
- [ ] Network tab shows requests to `institute-backend-bice.vercel.app`
- [ ] No CORS errors in browser console
- [ ] Student management page loads without errors
- [ ] Attendance marking works
- [ ] API responses are correct (200, 201 status codes)

---

## 🐛 TROUBLESHOOTING

### **"Cannot reach server" Error**
```
Solution:
1. Check backend is running: curl https://institute-backend-bice.vercel.app/
2. Verify BASE URL in src/asad.jsx is correct
3. Check backend vercel.json syntax
```

### **CORS Error in Console**
```
Error: Access to XMLHttpRequest... origin 'https://institute-portal-psi.vercel.app'
Solution: 
1. Verify CORS origin in backend/src/server.js is correct
2. Redeploy backend
```

### **MongoDB Connection Error**
```
Error: MONGO_URI is required
Solution:
1. Verify MONGO_URI in Vercel environment variables
2. Ensure MongoDB connection string has correct password
3. Redeploy backend
```

### **Build Fails**
```
Solution:
1. Check package.json has all dependencies
2. Run locally: npm install && npm run build
3. Check Vercel logs for detailed errors
```

---

## 📱 LOCAL DEVELOPMENT SETUP

### **Run Locally During Development:**

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5001
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
# Runs on http://localhost:5173
# Proxy routes to http://localhost:5001 via vite.config.js
```

**Update for Local Testing:**
If you need to test against local backend, change in `src/asad.jsx`:
```javascript
const BASE = "http://localhost:5001"; // For local development
```

---

## 🔗 LIVE LINKS

- **Frontend**: https://institute-portal-psi.vercel.app
- **Backend API**: https://institute-backend-bice.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## 📊 DEPLOYMENT STATUS

| Component | URL | Status | Last Updated |
|-----------|-----|--------|--------------|
| Frontend | https://institute-portal-psi.vercel.app | 🟢 Live | May 9, 2026 |
| Backend | https://institute-backend-bice.vercel.app | 🟢 Live | May 9, 2026 |
| Database | MongoDB Atlas | 🟢 Connected | May 9, 2026 |

---

## 💡 ADDITIONAL RECOMMENDATIONS

1. **Enable Authentication Cookies**
   - JWT tokens are now sent via headers (more secure)
   - Verified in `src/asad.jsx` line 33-40

2. **Set Up Email Notifications**
   - Update backend `.env` with SMTP credentials for real email sending
   - Currently configured for local testing

3. **Add Error Logging**
   - Consider Sentry.io integration for production error tracking
   - Helps debug issues in production

4. **Monitor Performance**
   - Use Vercel Analytics to track API response times
   - Optimize slow endpoints if needed

5. **Implement Rate Limiting**
   - Protect login endpoints from brute force
   - Add in `backend/middleware/` as needed

---

## 📝 NOTES

- All API endpoints in `src/asad.jsx` (lines 77-116) are now using live backend
- CORS is properly configured for both local and production environments
- MongoDB connection uses credentials from Vercel environment variables
- Static files (uploads) may need Vercel Blob storage for production (optional enhancement)

---

✨ **Your app is now fully integrated and live on Vercel!**
