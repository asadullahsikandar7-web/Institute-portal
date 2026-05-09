# 🚀 ADMIN MANAGEMENT - QUICK START GUIDE

## What's New?
You now have a complete admin management system! 🎉

---

## ⚡ QUICK START (5 MINUTES)

### Step 1: Create Your First Super Admin
```bash
cd backend
node manageAdmins.js add admin@school.edu password123 --super
```

### Step 2: Verify It Worked
```bash
node manageAdmins.js list
```

You should see your admin in the list.

### Step 3: Try Login
- Go to: https://institute-portal-psi.vercel.app
- Email: `admin@school.edu`
- Password: `password123`
- Click **Admin Login**

---

## 📋 COMMON COMMANDS

### Add Regular Admin
```bash
node manageAdmins.js add teacher@school.edu teacher123
```

### Add Super Admin
```bash
node manageAdmins.js add principal@school.edu principal123 --super
```

### List All Admins
```bash
node manageAdmins.js list
```

### Promote to Super Admin
```bash
node manageAdmins.js promote teacher@school.edu
```

### Demote from Super Admin
```bash
node manageAdmins.js demote teacher@school.edu
```

### Delete Admin
```bash
node manageAdmins.js delete teacher@school.edu
```

### Help
```bash
node manageAdmins.js
```

---

## 🔑 Key Features

✅ **Multiple Admins** - Add as many admins as you need  
✅ **Super Admin Role** - Only super admins can manage other admins  
✅ **Secure** - Passwords are hashed with bcrypt  
✅ **Easy CLI** - No need to write API calls manually  
✅ **API Ready** - All features available via REST API too  

---

## 🎓 ADMIN LEVELS

### 👑 **Super Admin**
- Create/delete other admins
- Promote other admins to super admin
- Change any admin's role
- Manage all resources

### 👤 **Regular Admin**
- Mark attendance
- Manage students
- Post announcements
- Manage classes & exams
- Cannot manage admins

---

## 📞 Need More Details?

Check **ADMIN_MANAGEMENT_GUIDE.md** for:
- Complete API reference
- Dashboard integration guide
- Security features
- Troubleshooting

---

## 🎯 What To Do Next

**Option 1 (Immediate):**
1. Run `node manageAdmins.js add <email> <password> --super` for each admin
2. Done! Admins can now login and use the system immediately

**Option 2 (Enhanced UI later):**
1. Start with Option 1
2. Later, add "Admin Management" page to the dashboard
3. Use the API endpoints provided in ADMIN_MANAGEMENT_GUIDE.md

---

## ✅ DEPLOYMENT NOTE

**For Vercel:**
- CLI script works locally only
- Use API endpoints on live server to manage admins
- Recommended: Create initial admins locally, push to production

**Example workflow:**
1. Add admins locally: `node manageAdmins.js add ...`
2. Push to GitHub
3. Admins now available in production

---

**Questions?** Refer to ADMIN_MANAGEMENT_GUIDE.md for complete documentation.

Status: ✅ Admin management system is ready to use!
