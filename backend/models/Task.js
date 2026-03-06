const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },       // e.g. "09:00"
    duration: { type: Number, default: 60 },            // minutes
    category: {
      type: String,
      default: 'Pipeline',
      enum: ['Pipeline', 'Onboarding', 'Registration', 'Works', 'Internal', 'Members'],
    },
    priority: {
      type: String,
      default: 'Medium',
      enum: ['High', 'Medium', 'Low'],
    },
    spoc: { type: String, default: '' },
    spocColor: { type: String, default: '#6366f1' },
    completed: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    // Optional link to source entity
    sourceType: { type: String, default: '' },          // e.g. 'lead', 'onboarding', 'member'
    sourceId: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'tasks' }
);

// Index for efficient date-range queries
taskSchema.index({ date: 1 });
taskSchema.index({ spoc: 1, date: 1 });

module.exports = mongoose.model('Task', taskSchema);
