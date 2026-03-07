const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

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

    const tasks = await Task.find(filter).sort({ date: 1, startTime: 1 });
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

    const tasks = await Task.find(filter);

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
    }

    const fields = ['title', 'date', 'startTime', 'duration', 'category', 'priority', 'spoc', 'spocColor', 'completed', 'notes', 'deadline'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });
    if (req.body.date) task.date = new Date(req.body.date);
    if (req.body.deadline) task.deadline = new Date(req.body.deadline);

    await task.save();
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
