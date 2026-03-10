const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create a notification for a user.
 * Resolves recipientName → User._id. Silently skips if user not found or self-notification.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName  - name of user to notify (matched case-insensitive)
 * @param {string} [opts.recipientId]  - OR pass the user _id directly
 * @param {string} opts.type           - notification type enum
 * @param {string} opts.title          - notification title
 * @param {string} [opts.message]      - optional body
 * @param {string} [opts.relatedType]  - e.g. 'lead', 'task'
 * @param {string} [opts.relatedId]    - id of the related document
 * @param {string} [opts.triggeredBy]  - name of the person who triggered
 * @param {string} [opts.triggeredById] - _id of person who triggered (skip self)
 */
const notify = async (opts) => {
  try {
    let recipientId = opts.recipientId;

    if (!recipientId && opts.recipientName) {
      const nameRegex = new RegExp(`^${opts.recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const user = await User.findOne({ name: nameRegex });
      if (!user) return; // no user with that name
      recipientId = user._id;
    }

    if (!recipientId) return;

    // Skip self-notification
    if (opts.triggeredById && recipientId.toString() === opts.triggeredById.toString()) return;

    await Notification.create({
      recipient: recipientId,
      type: opts.type || 'general',
      title: opts.title,
      message: opts.message || '',
      relatedType: opts.relatedType || '',
      relatedId: opts.relatedId || '',
      triggeredBy: opts.triggeredBy || '',
    });
  } catch (err) {
    console.error('Notification error (non-blocking):', err.message);
  }
};

module.exports = notify;
