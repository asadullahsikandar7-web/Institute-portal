import mongoose from "mongoose";
import Admin from "./src/models/adminModel.js";
import bcrypt from "bcrypt";

const MONGO_URI = "mongodb://localhost:27017/attendance"; // Update with your MongoDB URI

const seedAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    const admins = [
      { email: "admin1@uni.edu", password: await bcrypt.hash("admin123", 10) },
      { email: "admin2@uni.edu", password: await bcrypt.hash("admin456", 10) },
    ];

    await Admin.deleteMany(); // Clear existing admins
    await Admin.insertMany(admins);

    console.log("Admin users seeded successfully");
    mongoose.disconnect();
  } catch (err) {
    console.error("Error seeding admins:", err);
    mongoose.disconnect();
  }
};

seedAdmins();