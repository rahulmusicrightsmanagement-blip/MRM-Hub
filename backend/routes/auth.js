const express = require('express');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Step 1: email + password → if TOTP enabled, returns { requireOtp: true }
// Step 2: email + password + otp → returns token
router.post('/login', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated. Contact admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // If user has TOTP enabled, require OTP
    if (user.totpSecret) {
      if (!otp) {
        return res.status(200).json({ requireOtp: true });
      }

      const isValid = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: otp.toString().trim(),
        window: 2, // allow 60s drift
      });

      if (!isValid) {
        return res.status(401).json({ message: 'Invalid OTP. Please check your authenticator app.' });
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me  — get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
