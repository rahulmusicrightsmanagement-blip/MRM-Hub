const express = require('express');
const User = require('../models/User');
const { VALID_ROLES } = require('../models/User');
const { auth, adminOnly, fullAccessOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/roles — list valid roles
router.get('/roles', auth, (req, res) => {
  res.json({ roles: VALID_ROLES });
});

// GET /api/users — list all SPOCs (admin & lead only)
router.get('/', auth, fullAccessOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users — create a new SPOC (admin & lead only)
router.post('/', auth, fullAccessOnly, async (req, res) => {
  try {
    const { name, email, password, roles, phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Validate roles
    const roleArray = Array.isArray(roles) ? roles : ['lead'];
    const invalidRoles = roleArray.filter((r) => !VALID_ROLES.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}` });
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      roles: roleArray,
      phone: phone || '',
      department: department || '',
      isActive: true,
    });

    await user.save();
    res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:id — update a SPOC (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, role, phone, department, password, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deactivating yourself
    if (req.user._id.toString() === req.params.id && isActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate yourself' });
    }

    if (name) user.name = name.trim();
    if (email) {
      const dup = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase().trim();
    }
    if (req.body.roles) {
      const roleArray = Array.isArray(req.body.roles) ? req.body.roles : [req.body.roles];
      const invalidRoles = roleArray.filter((r) => !VALID_ROLES.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}` });
      }
      user.roles = roleArray;
    }
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (password) user.password = password; // pre-save hook will hash it
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/users/:id — delete a SPOC (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
