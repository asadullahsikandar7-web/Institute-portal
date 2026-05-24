import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";

const auth = (role) => {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ error: "Missing token" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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