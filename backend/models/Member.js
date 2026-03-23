const mongoose = require('mongoose');

const subTaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  assignee: { type: String, default: '' },
  done: { type: Boolean, default: false },
});

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    initials: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    role: { type: [String], default: [] },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    genre: { type: String, default: '' },
    languages: { type: String, default: '' },
    bio: { type: String, default: '' },
    status: { type: String, default: 'Onboarding', enum: ['Active', 'Onboarding', 'Inactive'] },
    kycStatus: { type: String, default: 'Pending', enum: ['Verified', 'Pending', 'Rejected'] },
    panCard: { type: String, default: '' },
    panVerified: { type: Boolean, default: false },
    aadhaar: { type: String, default: '' },
    aadhaarVerified: { type: Boolean, default: false },
    ipiNumber: { type: String, default: '' },
    isni: { type: String, default: '' },
    territories: { type: String, default: '' },
    leadSource: { type: String, default: '' },
    priority: { type: String, default: 'medium', enum: ['high', 'medium', 'low'] },
    registrations: { type: Number, default: 0 },
    joinDate: { type: String, default: '' },
    dateOfFirstContact: { type: String, default: '' },
    spoc: { type: String, default: '' },
    assignedDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    subTasks: [subTaskSchema],
  },
  { timestamps: true, collection: 'members' }
);

// Auto-generate initials from name
memberSchema.pre('save', function () {
  if (this.isModified('name') && this.name) {
    this.initials = this.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
});

memberSchema.index({ spoc: 1 });
memberSchema.index({ email: 1 });
memberSchema.index({ name: 1 });
memberSchema.index({ status: 1 });

module.exports = mongoose.model('Member', memberSchema);
