const express = require('express');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const notify = require('../utils/notify');

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// GET /api/leads
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    // RBAC: non-full-access users see only their assigned leads
    if (!req.user.isFullAccess()) {
      filter.spoc = req.user.name;
    }
    const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ leads });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/leads
router.post('/', auth, async (req, res) => {
  try {
    const { name, genre, email, phone, source, priority, spoc, notes, deadline } = req.body;
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
      assignedDate: spoc ? new Date() : null,
      deadline: deadline ? new Date(deadline) : null,
      notes: notes || '',
    });

    await lead.save();

    // Notify assigned SPOC
    if (lead.spoc) {
      notify({
        recipientName: lead.spoc,
        type: 'lead_assigned',
        title: 'New lead assigned to you',
        message: `Lead "${lead.name}" has been assigned to you.`,
        relatedType: 'lead',
        relatedId: lead._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    // Auto-create member if one doesn't already exist with this name/email
    try {
      const existingMember = await Member.findOne({
        $or: [
          { name: new RegExp(`^${lead.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { email: lead.email },
        ],
      });
      if (!existingMember) {
        const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
        const memberColor = colors[Math.floor(Math.random() * colors.length)];
        await Member.create({
          name: lead.name.trim(),
          email: lead.email,
          color: memberColor,
          phone: lead.phone || '',
          genre: lead.genre || '',
          spoc: lead.spoc || '',
          assignedDate: lead.spoc ? new Date() : null,
          deadline: lead.deadline || null,
          joinDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch (memberErr) {
      console.error('Auto-create member error:', memberErr);
    }

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
        assignedDate: lead.spoc ? new Date() : null,
        deadline: lead.deadline || null,
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

    // Auto-set assignedDate when spoc changes
    if (req.body.spoc !== undefined && req.body.spoc !== lead.spoc) {
      lead.assignedDate = req.body.spoc ? new Date() : null;

      // Notify new SPOC on reassignment
      if (req.body.spoc) {
        notify({
          recipientName: req.body.spoc,
          type: 'lead_assigned',
          title: 'Lead reassigned to you',
          message: `Lead "${lead.name}" has been assigned to you.`,
          relatedType: 'lead',
          relatedId: lead._id.toString(),
          triggeredBy: req.user.name,
          triggeredById: req.user._id,
        });
      }
    }

    const oldStage = lead.stage;

    // Identity fields (name / email / phone) are owned by Member and propagate from there.
    // They're intentionally excluded here so edits outside the Members page can't drift
    // the source of truth.
    const fields = ['genre', 'source', 'priority', 'stage', 'spoc', 'notes', 'deadline', 'callDone', 'inquiryNotes', 'meetingDate', 'meetingLink', 'meetingAssignedWith', 'meetingNotes', 'inquiryVerified', 'meetingVerified', 'movedToOnboarding', 'onboardingSpoc', 'onboardingContractType', 'onboardedAt', 'previousStage', 'notQualifiedReason'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) lead[f] = req.body[f];
    });
    if (req.body.deadline) lead.deadline = new Date(req.body.deadline);

    await lead.save();

    // Sync deadline / spoc changes → linked Tracker tasks
    try {
      const taskUpdate = {};
      if (req.body.deadline !== undefined) taskUpdate.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      if (req.body.spoc !== undefined) taskUpdate.spoc = req.body.spoc || '';
      if (Object.keys(taskUpdate).length) {
        await Task.updateMany({ sourceType: 'lead', sourceId: String(lead._id) }, { $set: taskUpdate });
      }
    } catch (syncErr) { console.error('Lead→Task sync error:', syncErr); }

    // Notify SPOC on stage change
    if (req.body.stage && req.body.stage !== oldStage && lead.spoc) {
      notify({
        recipientName: lead.spoc,
        type: 'stage_changed',
        title: `Lead "${lead.name}" moved to ${lead.stage}`,
        message: `Stage changed from ${oldStage} to ${lead.stage}.`,
        relatedType: 'lead',
        relatedId: lead._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

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
        assignedDate: (req.body.assignee || lead.spoc) ? new Date() : null,
        deadline: lead.deadline || null,
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
