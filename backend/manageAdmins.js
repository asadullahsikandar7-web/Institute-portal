#!/usr/bin/env node
/**
 * Admin Management CLI Script
 * Usage: node manageAdmins.js <command> [options]
 * 
 * Commands:
 *   add <email> <password> [--super]     - Create new admin
 *   list                                 - List all admins
 *   delete <email>                       - Delete admin
 *   promote <email>                      - Make admin a super admin
 *   demote <email>                       - Remove super admin privileges
 */

const mongoose = require ("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require ("dotenv");
const Admin = require ( "./src/models/adminModel.js");

dotenv.config();

const args = process.argv.slice(2);
const command = args[0];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

async function addAdmin(email, password, isSuper = false) {
  try {
    const exists = await Admin.findOne({ email });
    if (exists) {
      console.error(`❌ Admin with email "${email}" already exists`);
      return;
    }

    const admin = new Admin({ email, password, isSuperAdmin: isSuper });
    await admin.save();
    console.log(`✅ Admin created successfully`);
    console.log(`   Email: ${email}`);
    console.log(`   Super Admin: ${isSuper ? "YES" : "NO"}`);
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
  }
}

async function listAdmins() {
  try {
    const admins = await Admin.find({}, "email isSuperAdmin createdAt");
    if (admins.length === 0) {
      console.log("❌ No admins found");
      return;
    }
    console.log("\n📋 All Admins:");
    console.log("─".repeat(60));
    admins.forEach((admin, idx) => {
      const badge = admin.isSuperAdmin ? "👑 SUPER ADMIN" : "👤 Admin";
      console.log(`${idx + 1}. ${badge}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Created: ${new Date(admin.createdAt).toLocaleDateString()}`);
      console.log("");
    });
  } catch (err) {
    console.error("❌ Error listing admins:", err.message);
  }
}

async function deleteAdmin(email) {
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.error(`❌ Admin with email "${email}" not found`);
      return;
    }

    // Prevent deleting last super admin
    if (admin.isSuperAdmin) {
      const superAdminCount = await Admin.countDocuments({ isSuperAdmin: true });
      if (superAdminCount <= 1) {
        console.error("❌ Cannot delete the last super admin");
        return;
      }
    }

    await Admin.findByIdAndDelete(admin._id);
    console.log(`✅ Admin "${email}" deleted successfully`);
  } catch (err) {
    console.error("❌ Error deleting admin:", err.message);
  }
}

async function promoteAdmin(email) {
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.error(`❌ Admin with email "${email}" not found`);
      return;
    }

    if (admin.isSuperAdmin) {
      console.log(`ℹ️  "${email}" is already a super admin`);
      return;
    }

    admin.isSuperAdmin = true;
    await admin.save();
    console.log(`✅ Admin "${email}" promoted to SUPER ADMIN`);
  } catch (err) {
    console.error("❌ Error promoting admin:", err.message);
  }
}

async function demoteAdmin(email) {
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.error(`❌ Admin with email "${email}" not found`);
      return;
    }

    if (!admin.isSuperAdmin) {
      console.log(`ℹ️  "${email}" is not a super admin`);
      return;
    }

    // Prevent demoting last super admin
    const superAdminCount = await Admin.countDocuments({ isSuperAdmin: true });
    if (superAdminCount <= 1) {
      console.error("❌ Cannot demote the last super admin");
      return;
    }

    admin.isSuperAdmin = false;
    await admin.save();
    console.log(`✅ Admin "${email}" demoted to regular admin`);
  } catch (err) {
    console.error("❌ Error demoting admin:", err.message);
  }
}

async function main() {
  await connectDB();

  if (!command) {
    console.log(`
📚 Admin Management CLI

Usage: node manageAdmins.js <command> [options]

Commands:
  add <email> <password> [--super]  - Create new admin
  list                              - List all admins
  delete <email>                    - Delete admin
  promote <email>                   - Make admin a super admin
  demote <email>                    - Remove super admin privileges

Examples:
  node manageAdmins.js add admin1@school.edu password123
  node manageAdmins.js add admin2@school.edu password456 --super
  node manageAdmins.js list
  node manageAdmins.js promote admin1@school.edu
  node manageAdmins.js delete admin1@school.edu
    `);
    process.exit(0);
  }

  switch (command) {
    case "add":
      if (!args[1] || !args[2]) {
        console.error("❌ Usage: node manageAdmins.js add <email> <password> [--super]");
        process.exit(1);
      }
      await addAdmin(args[1], args[2], args[3] === "--super");
      break;

    case "list":
      await listAdmins();
      break;

    case "delete":
      if (!args[1]) {
        console.error("❌ Usage: node manageAdmins.js delete <email>");
        process.exit(1);
      }
      await deleteAdmin(args[1]);
      break;

    case "promote":
      if (!args[1]) {
        console.error("❌ Usage: node manageAdmins.js promote <email>");
        process.exit(1);
      }
      await promoteAdmin(args[1]);
      break;

    case "demote":
      if (!args[1]) {
        console.error("❌ Usage: node manageAdmins.js demote <email>");
        process.exit(1);
      }
      await demoteAdmin(args[1]);
      break;

    default:
      console.error(`❌ Unknown command: "${command}"`);
      console.log("Run 'node manageAdmins.js' for help");
      process.exit(1);
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
