const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = process.env;

// Middleware to validate JWT token and attach user role to the request
const authMiddleware = (req, res, next) => {
  const parts = req.headers.authorization?.split(' ') || [];
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user ID and role to the request
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to restrict access to admins only
// authMiddleware.js
const adminAuth = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Bootstrap path: allows the very first registration unauthenticated and
// forces it to admin (otherwise a fresh install could never log in).
// Once any user exists, falls through to the normal admin-only check.
const firstUserOrAdmin = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n === 0) {
      req.isBootstrap = true; // handler re-checks under an advisory lock
      req.body.role = 'admin';
      return next();
    }
    authMiddleware(req, res, () => adminAuth(req, res, next));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { authMiddleware, adminAuth, firstUserOrAdmin };