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
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated. Contact admin.' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role.toLowerCase() !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Admin or Manager middleware
const adminOrManager = (req, res, next) => {
  const role = req.user.role.toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ message: 'Admin or Manager access required' });
  }
  next();
};

module.exports = { auth, adminOnly, adminOrManager };
