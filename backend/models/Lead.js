const mongoose = require('mongoose');

const subTaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  assignee: { type: String, default: '' },
  done: { type: Boolean, default: false },
});

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    initials: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    genre: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    source: { type: String, default: '' },
    priority: { type: String, default: 'medium', enum: ['high', 'medium', 'low'] },
    stage: { type: String, default: 'New Enquiry', enum: ['New Enquiry', 'Meeting Set', 'Qualified Lead', 'Not Qualified'] },
    spoc: { type: String, default: '' },
    notes: { type: String, default: '' },
    subTasks: [subTaskSchema],
    // Stage 1: New Enquiry fields
    callDone: { type: Boolean, default: false },
    inquiryNotes: { type: String, default: '' },
    // Stage 2: Meeting Set fields
    meetingDate: { type: String, default: '' },
    meetingLink: { type: String, default: '' },
    meetingAssignedWith: { type: String, default: '' },
    meetingNotes: { type: String, default: '' },
    // Stage 3: Qualified Lead fields
    inquiryVerified: { type: Boolean, default: false },
    meetingVerified: { type: Boolean, default: false },
    // Onboarding tracking
    movedToOnboarding: { type: Boolean, default: false },
    onboardingSpoc: { type: String, default: '' },
    onboardingContractType: { type: String, default: '' },
    onboardedAt: { type: Date },
    // Not Qualified tracking
    previousStage: { type: String, default: '' },
  },
  { timestamps: true, collection: 'leads' }
);

leadSchema.pre('save', function () {
  if (this.isModified('name') && this.name) {
    this.initials = this.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
});

module.exports = mongoose.model('Lead', leadSchema);
