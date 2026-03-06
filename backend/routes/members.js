const express = require('express');
const Member = require('../models/Member');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/members
router.get('/', auth, async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.json({ members });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members
router.post('/', auth, async (req, res) => {
  try {
    const { name, role, email, phone, genre, languages, bio, spoc, panCard, aadhaar, dateOfFirstContact } = req.body;
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
      panCard: panCard || '',
      aadhaar: aadhaar || '',
      dateOfFirstContact: dateOfFirstContact || '',
      joinDate: new Date().toISOString().split('T')[0],
    });

    await member.save();
    res.status(201).json({ member });
  } catch (err) {
    console.error('Create member error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// PUT /api/members/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const fields = ['name', 'role', 'email', 'phone', 'genre', 'languages', 'bio', 'status', 'kycStatus', 'panCard', 'panVerified', 'aadhaar', 'aadhaarVerified', 'ipiNumber', 'isni', 'territories', 'works', 'registrations', 'joinDate', 'dateOfFirstContact', 'spoc'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) member[f] = req.body[f];
    });

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
