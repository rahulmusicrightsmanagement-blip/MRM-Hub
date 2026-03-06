const express = require('express');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// GET /api/leads
router.get('/', auth, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json({ leads });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/leads
router.post('/', auth, async (req, res) => {
  try {
    const { name, genre, email, phone, source, priority, spoc, notes } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const lead = new Lead({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      color,
      genre: genre || '',
      phone: phone || '',
      source: source || '',
      priority: priority || 'medium',
      stage: 'New Enquiry',
      spoc: spoc || '',
      notes: notes || '',
    });

    await lead.save();

    // Auto-create a Tracker task for the new lead
    try {
      await Task.create({
        title: `New lead — ${lead.name}`,
        date: new Date(),
        startTime: nowHHmm(),
        duration: 60,
        category: 'Pipeline',
        priority: (lead.priority || 'medium').charAt(0).toUpperCase() + (lead.priority || 'medium').slice(1),
        spoc: lead.spoc || '',
        sourceType: 'lead',
        sourceId: lead._id,
        createdBy: req.user?.id,
      });
    } catch (taskErr) {
      console.error('Auto-create tracker task (lead) error:', taskErr);
    }

    res.status(201).json({ lead });
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/leads/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const fields = ['name', 'genre', 'email', 'phone', 'source', 'priority', 'stage', 'spoc', 'notes', 'callDone', 'inquiryNotes', 'meetingDate', 'meetingLink', 'meetingAssignedWith', 'meetingNotes', 'inquiryVerified', 'meetingVerified', 'movedToOnboarding', 'onboardingSpoc', 'onboardingContractType', 'onboardedAt', 'previousStage'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) lead[f] = req.body[f];
    });

    await lead.save();
    res.json({ lead });
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Remove linked Tracker tasks
    await Task.deleteMany({ sourceType: 'lead', sourceId: String(lead._id) });

    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/leads/:id/subtasks
router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.subTasks.push({ text: req.body.text, assignee: req.body.assignee || '', done: false });
    await lead.save();

    // Auto-create a Tracker task for the subtask
    try {
      await Task.create({
        title: req.body.text,
        date: new Date(),
        startTime: nowHHmm(),
        duration: 30,
        category: 'Pipeline',
        priority: 'Medium',
        spoc: req.body.assignee || lead.spoc || '',
        sourceType: 'lead',
        sourceId: lead._id,
        createdBy: req.user?.id,
      });
    } catch (taskErr) {
      console.error('Auto-create tracker task (lead subtask) error:', taskErr);
    }

    res.json({ lead });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/leads/:id/subtasks/:taskId
router.put('/:id/subtasks/:taskId', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const task = lead.subTasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.body.done !== undefined) task.done = req.body.done;
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;

    await lead.save();
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
