import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const SECRET = "super_secret_key";

/* =========================
   AUTH MIDDLEWARE
========================= */

const auth = (requiredRole = null) => {
  return (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = header.split(" ")[1];

    try {
      const decoded = jwt.verify(token, SECRET);
      req.user = decoded;

      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: "Access denied" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};

/* =========================
   ADMIN LOGIN
========================= */

router.post("/admin-login", async (req, res) => {
  const { email, password } = req.body;

  const ADMIN_EMAIL = "admin@uni.edu";
  const ADMIN_PASSWORD = "admin123";

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign(
    { role: "admin" },
    SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, role: "admin" });
});

export { auth };        // ✅ NAMED EXPORT
export default router;  // ✅ DEFAULT EXPORT