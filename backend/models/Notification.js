const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['task_assigned', 'lead_assigned', 'onboarding_assigned', 'society_assigned', 'general'],
      default: 'general',
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    read: { type: Boolean, default: false },
    relatedType: { type: String, default: '' },   // 'lead', 'onboarding', 'task', 'societyreg'
    relatedId: { type: String, default: '' },
    triggeredBy: { type: String, default: '' },    // name of person who triggered
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
