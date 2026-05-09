# 👥 ADMIN MANAGEMENT SYSTEM - Complete Guide

## 🎯 What You Can Now Do

✅ Create multiple admins  
✅ Manage admin roles (Regular Admin vs Super Admin)  
✅ Change admin passwords  
✅ Delete admins  
✅ Prevent deletion of last super admin  

---

## 📋 CHANGES MADE

### 1. **Updated Admin Model** (`backend/src/models/adminModel.js`)
- Added `isSuperAdmin` field (boolean)
- Added `createdAt` and `updatedAt` timestamps
- Added password exclusion in JSON responses

### 2. **Created Admin Routes** (`backend/src/routes/adminRoute.js`)
- `POST /api/admin/admin-login` - Admin login
- `GET /api/admin/admins` - List all admins (Super Admin only)
- `POST /api/admin/admins` - Create new admin (Super Admin only)
- `PUT /api/admin/admins/:id` - Update admin (Super Admin only)
- `POST /api/admin/admins/:id/change-password` - Change password
- `DELETE /api/admin/admins/:id` - Delete admin (Super Admin only)

### 3. **Created CLI Management Script** (`backend/manageAdmins.js`)
- Command-line tool to manage admins without UI
- No need for API access

### 4. **Updated Backend Server** (`backend/server.js`)
- Added admin routes to Express

---

## 🚀 HOW TO USE - 3 METHODS

### **METHOD 1: CLI Script (Fastest & Easiest)**

#### **Step 1: Setup Initial Super Admin**
```bash
cd backend
node manageAdmins.js add admin@school.edu password123 --super
```

**Output:**
```
✅ Connected to MongoDB
✅ Admin created successfully
   Email: admin@school.edu
   Super Admin: YES
✅ Done
```

#### **Step 2: Add More Admins**
```bash
# Add regular admin
node manageAdmins.js add teacher@school.edu teacher123

# Add admin with super privileges
node manageAdmins.js add principal@school.edu principal123 --super
```

#### **Step 3: List All Admins**
```bash
node manageAdmins.js list
```

**Output:**
```
📋 All Admins:
────────────────────────────────────────────────────────
1. 👑 SUPER ADMIN
   Email: admin@school.edu
   Created: 5/9/2026

2. 👤 Admin
   Email: teacher@school.edu
   Created: 5/9/2026
```

#### **Step 4: Promote/Demote Admins**
```bash
# Make regular admin a super admin
node manageAdmins.js promote teacher@school.edu

# Remove super admin privileges
node manageAdmins.js demote teacher@school.edu
```

#### **Step 5: Delete Admin**
```bash
node manageAdmins.js delete teacher@school.edu
```

> ⚠️ **Cannot delete the last super admin** (safety feature)

---

### **METHOD 2: API Endpoints (For Dashboard Integration)**

#### **Login as Admin**
```bash
POST /api/auth/admin-login
Content-Type: application/json

{
  "email": "admin@school.edu",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "admin",
  "isSuperAdmin": true,
  "email": "admin@school.edu"
}
```

#### **List All Admins** (Super Admin Only)
```bash
GET /api/admin/admins
Authorization: Bearer <ADMIN_TOKEN>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "email": "admin@school.edu",
    "isSuperAdmin": true,
    "createdAt": "2026-05-09T10:00:00Z"
  },
  {
    "_id": "507f1f77bcf86cd799439012",
    "email": "teacher@school.edu",
    "isSuperAdmin": false,
    "createdAt": "2026-05-09T10:05:00Z"
  }
]
```

#### **Create New Admin** (Super Admin Only)
```bash
POST /api/admin/admins
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "email": "newadmin@school.edu",
  "password": "newpassword123",
  "isSuperAdmin": false
}
```

**Response:**
```json
{
  "message": "Admin created successfully",
  "admin": {
    "id": "507f1f77bcf86cd799439013",
    "email": "newadmin@school.edu",
    "isSuperAdmin": false
  }
}
```

#### **Change Password** (Any Admin)
```bash
POST /api/admin/admins/:id/change-password
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

#### **Update Admin** (Super Admin Only)
```bash
PUT /api/admin/admins/:id
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "email": "updated@school.edu",
  "isSuperAdmin": true
}
```

#### **Delete Admin** (Super Admin Only)
```bash
DELETE /api/admin/admins/:id
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```

---

### **METHOD 3: Add to Dashboard UI (Next Step)**

You can add an "Admin Management" page in your React app that calls these API endpoints.

**Example component:**
```jsx
// Add to src/asad.jsx in the admin API factory
adminManagement: {
  listAdmins: () => req("GET", "/api/admin/admins"),
  createAdmin: (body) => req("POST", "/api/admin/admins", body),
  updateAdmin: (id, body) => req("PUT", `/api/admin/admins/${id}`, body),
  deleteAdmin: (id) => req("DELETE", `/api/admin/admins/${id}`),
  changePassword: (id, body) => req("POST", `/api/admin/admins/${id}/change-password`, body)
}
```

Then create a React component with a form to manage admins!

---

## 🔐 SECURITY FEATURES

✅ **Password Hashing** - All passwords hashed with bcrypt  
✅ **JWT Authentication** - Secure token-based access  
✅ **Super Admin Only Access** - Only super admins can create/delete admins  
✅ **Prevent Last Super Admin Deletion** - Can't delete the only super admin  
✅ **Own Password Change** - Admins can only change their own password (except Super Admins)  
✅ **Password Never Returned** - Passwords never sent in API responses  

---

## 📊 ADMIN HIERARCHY

```
┌─────────────────────────────┐
│   SUPER ADMIN (👑)          │
│ - Create/Delete admins      │
│ - Promote/Demote admins     │
│ - Manage all resources      │
│ - Cannot be deleted         │
└─────────────────────────────┘
         ↑
         │ (can promote to)
         │
┌─────────────────────────────┐
│   REGULAR ADMIN (👤)        │
│ - View students             │
│ - Mark attendance           │
│ - Post announcements        │
│ - Manage classes            │
│ - Cannot manage admins      │
└─────────────────────────────┘
         ↑
         │
┌─────────────────────────────┐
│   STUDENT (👨‍🎓)             │
│ - View own attendance       │
│ - View own grades           │
│ - View announcements        │
└─────────────────────────────┘
```

---

## 🎯 QUICK START CHECKLIST

- [ ] Run: `node manageAdmins.js add admin@school.edu password123 --super`
- [ ] Run: `node manageAdmins.js list` (verify it worked)
- [ ] Try login in app with email: `admin@school.edu`
- [ ] Add more admins as needed
- [ ] Ready to add admin dashboard UI (optional)

---

## 📝 API REFERENCE SUMMARY

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/admin-login` | None | Admin login |
| GET | `/api/admin/admins` | Super Admin | List all admins |
| POST | `/api/admin/admins` | Super Admin | Create admin |
| PUT | `/api/admin/admins/:id` | Super Admin | Update admin |
| POST | `/api/admin/admins/:id/change-password` | Admin | Change password |
| DELETE | `/api/admin/admins/:id` | Super Admin | Delete admin |

---

## ⚡ NEXT STEPS

### Option A: Use CLI Script (Recommended for Now)
1. Add all admins using `node manageAdmins.js add ...`
2. Done! Admins can now login and use the system

### Option B: Build Admin Dashboard UI
1. Create a new page in admin panel for admin management
2. Use API endpoints in "METHOD 2" above
3. Add form to create/edit/delete admins
4. Add list view showing all admins

### Option C: Seed Database with Default Admins
```bash
# Create seedAdmins.js and run it once on deployment
node seedAdmins.js
```

---

## 🐛 TROUBLESHOOTING

**Error: "Super Admin access required"**
- You're not logged in as a super admin
- Use a super admin account to manage other admins

**Error: "Cannot delete the last super admin"**
- Promote another admin to super admin first
- Then delete the one you wanted to remove

**Error: "Admin already exists"**
- That email is already in the database
- Use a different email address

**MongoDB Error**
- Make sure MongoDB is running
- Check MONGO_URI in .env file

---

## 💡 FEATURES SUMMARY

| Feature | Super Admin | Regular Admin | Student |
|---------|:-----------:|:-------------:|:-------:|
| Login | ✅ | ✅ | ✅ |
| View Admins | ✅ | ❌ | ❌ |
| Create Admin | ✅ | ❌ | ❌ |
| Delete Admin | ✅ | ❌ | ❌ |
| Promote Admin | ✅ | ❌ | ❌ |
| Change Own Password | ✅ | ✅ | ✅ |
| Manage Students | ✅ | ✅ | ❌ |
| Mark Attendance | ✅ | ✅ | ❌ |
| View Attendance | ✅ | ✅ | ✅ |

---

Great! Your admin system is now ready! 🎉

Any questions? Check the API reference or use `node manageAdmins.js` for help.
