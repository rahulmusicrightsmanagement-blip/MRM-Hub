const express = require('express');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const Royalty = require('../models/Royalty');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/members
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    // RBAC: non-full-access users see only their assigned members
    if (!req.user.isFullAccess()) {
      filter.spoc = req.user.name;
    }
    const [members, allRegs] = await Promise.all([
      Member.find(filter).sort({ createdAt: -1 }).lean(),
      SocietyRegistration.find().lean(),
    ]);

    // Build a lookup: lowercase name → registration count (single pass, no N+1)
    const regCountByName = new Map();
    for (const doc of allRegs) {
      if (!doc.societies) continue;
      const key = doc.name.toLowerCase();
      const entries = doc.societies instanceof Map ? doc.societies.values() : Object.values(doc.societies);
      let count = 0;
      for (const entry of entries) {
        if (entry && entry.status === 'Registered') count++;
      }
      regCountByName.set(key, (regCountByName.get(key) || 0) + count);
    }

    const enriched = members.map((m) => ({
      ...m,
      registrations: regCountByName.get(m.name.toLowerCase()) || 0,
    }));

    res.json({ members: enriched });
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members
router.post('/', auth, async (req, res) => {
  try {
    const { name, role, email, phone, genre, languages, bio, spoc, panCard, aadhaar, dateOfFirstContact, deadline, leadSource, priority, isReferred, referredBy, referralCommission } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const member = new Member({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      color,
      role: Array.isArray(role) ? role : (role ? [role] : []),
      phone: phone || '',
      genre: genre || '',
      languages: languages || '',
      bio: bio || '',
      spoc: spoc || '',
      assignedDate: spoc ? new Date() : null,
      deadline: deadline ? new Date(deadline) : null,
      panCard: panCard || '',
      aadhaar: aadhaar || '',
      dateOfFirstContact: dateOfFirstContact || '',
      leadSource: leadSource || '',
      priority: priority || 'medium',
      isReferred: isReferred || false,
      referredBy: referredBy || '',
      referralCommission: referralCommission || '',
      joinDate: new Date().toISOString().split('T')[0],
    });

    await member.save();
    res.status(201).json({ member });
  } catch (err) {
    console.error('Create member error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// GET /api/members/:id/profile  — aggregated member profile
router.get('/:id/profile', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const nameRegex = new RegExp(`^${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const [leads, onboarding, societyRegs, royalties] = await Promise.all([
      Lead.find({ $or: [{ name: nameRegex }, { email: member.email }] }).sort({ createdAt: -1 }).lean(),
      OnboardingEntry.find({ $or: [{ name: nameRegex }, { email: member.email }] }).sort({ createdAt: -1 }).lean(),
      SocietyRegistration.find({ name: nameRegex }).sort({ createdAt: -1 }).lean(),
      Royalty.find({ $or: [{ clientName: nameRegex }, { clientEmail: member.email }] }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({ member, leads, onboarding, societyRegs, royalties });
  } catch (err) {
    console.error('Member profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/members/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    // Auto-set assignedDate when spoc changes
    if (req.body.spoc !== undefined && req.body.spoc !== member.spoc) {
      member.assignedDate = req.body.spoc ? new Date() : null;
    }

    const fields = ['name', 'role', 'email', 'phone', 'genre', 'languages', 'bio', 'status', 'kycStatus', 'panCard', 'panVerified', 'aadhaar', 'aadhaarVerified', 'ipiNumber', 'isni', 'territories', 'leadSource', 'priority', 'registrations', 'joinDate', 'dateOfFirstContact', 'spoc', 'deadline', 'isReferred', 'referredBy', 'referralCommission'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) member[f] = req.body[f];
    });
    if (req.body.deadline) member.deadline = new Date(req.body.deadline);

    await member.save();
    res.json({ member });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/members/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members/:id/subtasks
router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    member.subTasks.push({ text: req.body.text, assignee: req.body.assignee || '', done: false });
    await member.save();
    res.json({ member });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/members/:id/subtasks/:taskId
router.put('/:id/subtasks/:taskId', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const task = member.subTasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.body.done !== undefined) task.done = req.body.done;
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;

    await member.save();
    res.json({ member });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
