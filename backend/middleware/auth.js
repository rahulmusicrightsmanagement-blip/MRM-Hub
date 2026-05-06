const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!user.isActive) return res.status(401).json({ message: 'Account deactivated. Contact admin.' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Helper: check if user is guest-only
const isGuestUser = (user) => {
  const roles = user.roles || [];
  return roles.length === 1 && roles[0] === 'guest';
};

// Admin-only middleware (guests can read)
const adminOnly = (req, res, next) => {
  if (isGuestUser(req.user)) {
    if (req.method === 'GET') return next();
    return res.status(403).json({ message: 'Guest users have view-only access' });
  }
  if (!req.user.hasRole('admin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Full-access middleware (admin or lead; guests can read)
const fullAccessOnly = (req, res, next) => {
  if (isGuestUser(req.user)) {
    if (req.method === 'GET') return next();
    return res.status(403).json({ message: 'Guest users have view-only access' });
  }
  if (!req.user.isFullAccess()) {
    return res.status(403).json({ message: 'Admin or Lead access required' });
  }
  next();
};

// Check if user has any of the specified roles (or full access; guests can read)
const requireRole = (...roles) => (req, res, next) => {
  if (isGuestUser(req.user)) {
    if (req.method === 'GET') return next();
    return res.status(403).json({ message: 'Guest users have view-only access' });
  }
  if (req.user.isFullAccess()) return next();
  if (req.user.hasAnyRole(roles)) return next();
  return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}` });
};

// Block write operations for guest-only users (view-only access)
const denyGuest = (req, res, next) => {
  const roles = req.user.roles || [];
  if (roles.length === 1 && roles[0] === 'guest') {
    return res.status(403).json({ message: 'Guest users have view-only access' });
  }
  next();
};

module.exports = { auth, adminOnly, fullAccessOnly, requireRole, denyGuest, isGuestUser };
