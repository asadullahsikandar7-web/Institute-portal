import mongoose from "mongoose";
import Admin from "./src/models/adminModel.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/attendance";

const seedAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Hash the password once
    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admins = [
      { email: "admin1@uni.edu", password: hashedPassword, isSuperAdmin: true },
      { email: "admin2@uni.edu", password: hashedPassword, isSuperAdmin: false },
    ];

    await Admin.deleteMany(); // Clear existing admins
    const result = await Admin.insertMany(admins);

    console.log("✅ Admin users seeded successfully:");
    result.forEach(admin => console.log(`   - ${admin.email}`));
    console.log("✅ Password for both: admin123");
    
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding admins:", err.message);
    mongoose.disconnect();
  }
};

seedAdmins();