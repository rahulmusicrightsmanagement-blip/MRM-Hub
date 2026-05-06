const express = require('express');
const ClientMessage = require('../models/ClientMessage');
const User = require('../models/User');
const { auth, denyGuest } = require('../middleware/auth');
const { sendTaskEmail } = require('../utils/mailer');
const { ADMIN_EMAILS, resolveSpocEmail } = require('../utils/taskEmailConfig');

const router = express.Router();

const VALID_STATUSES = ['New', 'In Progress', 'Completed', 'Not Completed'];

const isCreator = (doc, user) => doc.createdBy && user && doc.createdBy.toString() === user._id.toString();
const isAssignee = (doc, user) => {
  if (!user) return false;
  if (doc.assignedToId && doc.assignedToId.toString() === user._id.toString()) return true;
  if (doc.assignedTo && user.name && doc.assignedTo.toLowerCase() === user.name.toLowerCase()) return true;
  return false;
};

const serializeMessage = async (doc) => {
  await doc.populate('createdBy', 'name');
  const obj = doc.toObject();
  obj.createdById = obj.createdBy?._id || null;
  obj.createdBy = obj.createdBy?.name || '';
  return obj;
};

// GET /api/client-messages — list, optional ?status=
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }
    const messages = await ClientMessage.find(filter)
      .populate('createdBy', 'name')
      .lean();
    const out = messages.map((m) => ({
      ...m,
      createdBy: m.createdBy?.name || '',
      createdById: m.createdBy?._id || null,
    }));
    out.sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    res.json({ messages: out });
  } catch (err) {
    console.error('Get client messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages — create
router.post('/', auth, denyGuest, async (req, res) => {
  try {
    const { clientName, clientId, message, receivedAt, deadline, status, assignedTo, assignedToId, taskType, priority } = req.body;
    if (!clientName || !message || !receivedAt) {
      return res.status(400).json({ message: 'Client name, message, and received date are required' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const doc = new ClientMessage({
      clientName: clientName.trim(),
      clientId: clientId || null,
      message: message.trim(),
      receivedAt: new Date(receivedAt),
      deadline: deadline ? new Date(deadline) : null,
      status: status || 'New',
      assignedTo: assignedTo || '',
      assignedToId: assignedToId || null,
      createdBy: req.user._id,
      taskType: taskType === 'spoc' ? 'spoc' : 'client',
      priority: priority || 'Medium',
    });
    await doc.save();
    res.status(201).json({ message: await serializeMessage(doc) });
  } catch (err) {
    console.error('Create client message error:', err.stack || err);
    res.status(500).json({ message: err.message || 'Server error', name: err.name, errors: err.errors });
  }
});

// PUT /api/client-messages/:id — update
router.put('/:id', auth, denyGuest, async (req, res) => {
  try {
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });

    if (!isCreator(doc, req.user)) {
      return res.status(403).json({ message: 'Only the task creator can edit this task' });
    }

    const allowed = ['clientName', 'clientId', 'message', 'status', 'assignedTo', 'assignedToId', 'taskType', 'priority'];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    });
    if (req.body.receivedAt !== undefined) doc.receivedAt = new Date(req.body.receivedAt);
    if (req.body.deadline !== undefined) doc.deadline = req.body.deadline ? new Date(req.body.deadline) : null;

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await doc.save();
    res.json({ message: await serializeMessage(doc) });
  } catch (err) {
    console.error('Update client message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/client-messages/:id/status — quick status update
router.patch('/:id/status', auth, denyGuest, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const existing = await ClientMessage.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Message not found' });
    if (!isCreator(existing, req.user) && !isAssignee(existing, req.user)) {
      return res.status(403).json({ message: 'Not authorized to change status' });
    }
    existing.status = status;
    await existing.save();
    res.json({ message: await serializeMessage(existing) });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages/:id/responses — add a response
router.post('/:id/responses', auth, denyGuest, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Response text is required' });
    }
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    if (!isAssignee(doc, req.user) && !isCreator(doc, req.user)) {
      return res.status(403).json({ message: 'Only the assignee or creator can add remarks' });
    }

    doc.responses.push({
      text: text.trim(),
      createdAt: new Date(),
      createdBy: req.user.name || '',
      createdById: req.user._id,
    });
    await doc.save();
    res.json({ message: await serializeMessage(doc) });
  } catch (err) {
    console.error('Add response error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/client-messages/:id/responses/:rid — remove a response
router.delete('/:id/responses/:rid', auth, denyGuest, async (req, res) => {
  try {
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    const remark = doc.responses.find((r) => r._id.toString() === req.params.rid);
    if (!remark) return res.status(404).json({ message: 'Remark not found' });
    const isOwner = remark.createdById && req.user && remark.createdById.toString() === req.user._id.toString();
    if (!isCreator(doc, req.user) && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this remark' });
    }
    doc.responses = doc.responses.filter((r) => r._id.toString() !== req.params.rid);
    await doc.save();
    res.json({ message: await serializeMessage(doc) });
  } catch (err) {
    console.error('Delete response error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages/send-email — admin gets all, others get own tasks
router.post('/send-email', auth, denyGuest, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = (user.roles || []).includes('admin') || (user.roles || []).includes('lead');

    if (isAdmin) {
      const tasks = await ClientMessage.find({}).lean();
      const sentTo = [];
      for (const adminEmail of ADMIN_EMAILS) {
        try {
          await sendTaskEmail({ to: adminEmail, recipientLabel: `Admin · ${user.name}`, tasks, mode: 'admin' });
          sentTo.push(adminEmail);
        } catch (e) {
          console.error(`admin email failed for ${adminEmail}:`, e.message);
        }
      }
      return res.json({ message: 'Email sent', to: sentTo, count: tasks.length, mode: 'admin' });
    }

    const nameRegex = new RegExp(`^${(user.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const tasks = await ClientMessage.find({
      $or: [
        { assignedToId: user._id },
        { assignedTo: nameRegex },
      ],
    }).lean();
    const to = resolveSpocEmail(user);
    if (!to) return res.status(400).json({ message: 'Recipient email not configured for this user' });

    await sendTaskEmail({ to, recipientLabel: user.name, tasks, mode: 'spoc' });
    res.json({ message: 'Email sent', to, count: tasks.length, mode: 'spoc' });
  } catch (err) {
    console.error('Send task email error:', err);
    res.status(500).json({ message: err.message || 'Failed to send email' });
  }
});

// DELETE /api/client-messages/:id
router.delete('/:id', auth, denyGuest, async (req, res) => {
  try {
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    if (!isCreator(doc, req.user)) {
      return res.status(403).json({ message: 'Only the task creator can delete this task' });
    }
    await doc.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete client message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
