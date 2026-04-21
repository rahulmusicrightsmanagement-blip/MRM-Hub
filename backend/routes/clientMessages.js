const express = require('express');
const ClientMessage = require('../models/ClientMessage');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendTaskEmail } = require('../utils/mailer');
const { ADMIN_EMAILS, resolveSpocEmail } = require('../utils/taskEmailConfig');

const router = express.Router();

const VALID_STATUSES = ['New', 'In Progress', 'Completed', 'Not Completed'];

// GET /api/client-messages — list, optional ?status=
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }
    const messages = await ClientMessage.find(filter).lean();
    messages.sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    res.json({ messages });
  } catch (err) {
    console.error('Get client messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages — create
router.post('/', auth, async (req, res) => {
  try {
    const { clientName, clientId, message, receivedAt, deadline, status, assignedTo, assignedToId } = req.body;
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
    });
    await doc.save();
    res.status(201).json({ message: doc });
  } catch (err) {
    console.error('Create client message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/client-messages/:id — update
router.put('/:id', auth, async (req, res) => {
  try {
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });

    const fields = ['clientName', 'clientId', 'message', 'status', 'assignedTo', 'assignedToId'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    });
    if (req.body.receivedAt !== undefined) doc.receivedAt = new Date(req.body.receivedAt);
    if (req.body.deadline !== undefined) doc.deadline = req.body.deadline ? new Date(req.body.deadline) : null;

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await doc.save();
    res.json({ message: doc });
  } catch (err) {
    console.error('Update client message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/client-messages/:id/status — quick status update
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const doc = await ClientMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: doc });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages/:id/responses — add a response
router.post('/:id/responses', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Response text is required' });
    }
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });

    doc.responses.push({
      text: text.trim(),
      createdAt: new Date(),
      createdBy: req.user.name || '',
    });
    await doc.save();
    res.json({ message: doc });
  } catch (err) {
    console.error('Add response error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/client-messages/:id/responses/:rid — remove a response
router.delete('/:id/responses/:rid', auth, async (req, res) => {
  try {
    const doc = await ClientMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    doc.responses = doc.responses.filter((r) => r._id.toString() !== req.params.rid);
    await doc.save();
    res.json({ message: doc });
  } catch (err) {
    console.error('Delete response error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/client-messages/send-email — admin gets all, others get own tasks
router.post('/send-email', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await ClientMessage.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete client message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
