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

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (!req.user.hasRole('admin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Full-access middleware (admin or lead)
const fullAccessOnly = (req, res, next) => {
  if (!req.user.isFullAccess()) {
    return res.status(403).json({ message: 'Admin or Lead access required' });
  }
  next();
};

// Check if user has any of the specified roles (or full access)
const requireRole = (...roles) => (req, res, next) => {
  if (req.user.isFullAccess()) return next();
  if (req.user.hasAnyRole(roles)) return next();
  return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}` });
};

module.exports = { auth, adminOnly, fullAccessOnly, requireRole };
