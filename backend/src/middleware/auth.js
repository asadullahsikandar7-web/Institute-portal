import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Admin from "../models/adminModel.js";

// See the matching comment in ../routes/auth.js — dotenv.config() here
// guarantees this module sees the real .env JWT_SECRET regardless of
// where it lands in server.js's import order.
dotenv.config();

const SECRET = process.env.JWT_SECRET || "super_secret_key";

const auth = (role) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ error: "Missing token" });
      }

      const decoded = jwt.verify(token, SECRET);
      req.user = decoded;

      if (role && decoded.role !== role) {
        return res.status(403).json({ error: "Forbidden" });
      }

      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };
};

const authMiddleware = auth("admin");
const adminOnly = auth("admin");
export {auth, authMiddleware, adminOnly};