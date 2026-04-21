const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const SocietyRegistration = require('../models/SocietyRegistration');
const { auth } = require('../middleware/auth');
const notify = require('../utils/notify');

const router = express.Router();

// Reconcile society-linked tasks against current registration status.
// Ensures stale 'incomplete' tasks flip to completed once the society is Registered,
// and vice versa. Runs opportunistically on GET so existing data self-heals.
const reconcileSocietyTasks = async (tasks) => {
  try {
    const socTasks = tasks.filter((t) => t.sourceType === 'societyreg' && t.sourceId);
    if (!socTasks.length) return;
    const regIds = [...new Set(socTasks.map((t) => t.sourceId))];
    const regs = await SocietyRegistration.find({ _id: { $in: regIds } }).lean();
    const regMap = new Map(regs.map((r) => [String(r._id), r]));

    const sameDay = (a, b) => {
      if (!a || !b) return false;
      const d1 = new Date(a), d2 = new Date(b);
      return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    // Word-boundary matcher — avoids "PRS" accidentally matching "IPRS"
    const matchSocKey = (title, keys) => {
      if (!title) return null;
      const titleLower = title.toLowerCase();
      // Prefer trailing `— KEY` suffix (the canonical title format)
      const suffixHit = keys.find((k) => titleLower.endsWith(`— ${k.toLowerCase()}`) || titleLower.endsWith(`- ${k.toLowerCase()}`));
      if (suffixHit) return suffixHit;
      // Fallback: longest key that matches on word boundaries
      const sorted = [...keys].sort((a, b) => b.length - a.length);
      return sorted.find((k) => {
        const esc = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`).test(titleLower);
      }) || null;
    };

    const bulkOps = [];
    for (const t of socTasks) {
      const reg = regMap.get(String(t.sourceId));
      if (!reg) continue;
      const socs = reg.societies || {};
      const socKey = matchSocKey(t.title, Object.keys(socs));
      if (!socKey) continue;
      const entry = socs[socKey];
      const set = {};
      const shouldBeCompleted = entry?.status === 'Registered';
      if (!!t.completed !== shouldBeCompleted) { set.completed = shouldBeCompleted; t.completed = shouldBeCompleted; }

      // task.date follows startDate only — deadline drives colour, not placement
      if (entry?.startDate && !sameDay(t.date, entry.startDate)) {
        set.date = new Date(entry.startDate); t.date = new Date(entry.startDate);
      }
      if (entry?.deadline && (!t.deadline || !sameDay(t.deadline, entry.deadline))) {
        set.deadline = new Date(entry.deadline); t.deadline = new Date(entry.deadline);
      }

      if (Object.keys(set).length) bulkOps.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
    }
    if (bulkOps.length) await Task.bulkWrite(bulkOps);
  } catch (err) { console.error('reconcileSocietyTasks error:', err); }
};

// GET /api/tasks — list tasks with optional date range & filters
router.get('/', auth, async (req, res) => {
  try {
    const { start, end, category, spoc } = req.query;
    const filter = {};

    if (start && end) {
      filter.date = { $gte: new Date(start), $lte: new Date(end) };
    }
    if (category && category !== 'All Categories') {
      filter.category = category;
    }
    if (spoc && spoc !== 'All SPOCs') {
      filter.spoc = spoc;
    }

    // RBAC: non-full-access users see only their assigned tasks
    if (!req.user.isFullAccess()) {
      filter.spoc = req.user.name;
    }

    const tasks = await Task.find(filter).sort({ date: 1, startTime: 1 }).lean();
    await reconcileSocietyTasks(tasks);
    res.json({ tasks });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tasks/stats — weekly stats
router.get('/stats', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const filter = {};
    if (start && end) {
      filter.date = { $gte: new Date(start), $lte: new Date(end) };
    }

    // RBAC: non-full-access users see only their stats
    if (!req.user.isFullAccess()) {
      filter.spoc = req.user.name;
    }

    const tasks = await Task.find(filter).lean();
    await reconcileSocietyTasks(tasks);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisWeek = tasks.length;
    const todayCount = tasks.filter((t) => {
      const d = new Date(t.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    const highPriority = tasks.filter((t) => t.priority === 'High').length;
    const completed = tasks.filter((t) => t.completed).length;

    res.json({ thisWeek, today: todayCount, highPriority, completed });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tasks/:id — single task (used for notification deep-links)
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!req.user.isFullAccess() && task.spoc !== req.user.name) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json({ task });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tasks — create a new task
router.post('/', auth, async (req, res) => {
  try {
    const { title, date, startTime, duration, category, priority, spoc, spocColor, notes, sourceType, sourceId, deadline } = req.body;
    if (!title || !date || !startTime) {
      return res.status(400).json({ message: 'Title, date, and start time are required' });
    }

    const task = new Task({
      title: title.trim(),
      date: new Date(date),
      startTime,
      duration: duration || 60,
      category: category || 'Pipeline',
      priority: priority || 'Medium',
      spoc: spoc || '',
      spocColor: spocColor || '#6366f1',
      assignedDate: spoc ? new Date() : null,
      notes: notes || '',
      sourceType: sourceType || '',
      sourceId: sourceId || '',
      deadline: deadline ? new Date(deadline) : null,
      createdBy: req.user._id,
    });

    await task.save();

    // Notify assigned SPOC
    if (task.spoc) {
      notify({
        recipientName: task.spoc,
        type: 'task_assigned',
        title: 'New task assigned to you',
        message: `Task "${task.title}" has been assigned to you.`,
        relatedType: 'task',
        relatedId: task._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tasks/:id — update a task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Auto-set assignedDate when spoc changes
    if (req.body.spoc !== undefined && req.body.spoc !== task.spoc) {
      task.assignedDate = req.body.spoc ? new Date() : null;

      // Notify new SPOC on reassignment
      if (req.body.spoc) {
        notify({
          recipientName: req.body.spoc,
          type: 'task_assigned',
          title: 'Task reassigned to you',
          message: `Task "${task.title}" has been assigned to you.`,
          relatedType: 'task',
          relatedId: task._id.toString(),
          triggeredBy: req.user.name,
          triggeredById: req.user._id,
        });
      }
    }

    const wasCompleted = task.completed;

    const fields = ['title', 'date', 'startTime', 'duration', 'category', 'priority', 'spoc', 'spocColor', 'completed', 'notes', 'deadline'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });
    if (req.body.date) task.date = new Date(req.body.date);
    if (req.body.deadline) task.deadline = new Date(req.body.deadline);

    await task.save();

    // Notify when task is marked completed (and it wasn't before)
    if (task.completed && !wasCompleted && task.spoc) {
      notify({
        recipientName: task.spoc,
        type: 'task_completed',
        title: `Task "${task.title}" completed`,
        message: `Your task has been marked as completed.`,
        relatedType: 'task',
        relatedId: task._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    res.json({ task });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/tasks/:id/toggle — toggle completed
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    task.completed = !task.completed;
    await task.save();
    res.json({ task });
  } catch (err) {
    console.error('Toggle task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
