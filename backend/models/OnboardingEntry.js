const mongoose = require('mongoose');

/* ─── Document sub-schema (Aadhaar, PAN, custom docs) ─── */
const documentSchema = new mongoose.Schema({
  docType: { type: String, required: true },   // 'aadhaar', 'pan', or custom slug
  label: { type: String, required: true },     // display name
  requested: { type: Boolean, default: false },
  received: { type: Boolean, default: false },
  docNumber: { type: String, default: '' },    // e.g. Aadhaar number, PAN number
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  gdriveFileId: { type: String, default: '' },
});

const subTaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  assignee: { type: String, default: '' },
  done: { type: Boolean, default: false },
});

const STAGES = [
  'Document Submission',
  'KYC Verification',
  'Contract Signing',
  'Active Member',
  'Contact Made',
  'Completed',
  'Not Qualified',
  'Under Review', // kept for backward-compat with existing data
];

const onboardingEntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    initials: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    role: { type: [String], default: [] },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    contractType: { type: String, default: 'Retailer' },
    stage: { type: String, default: 'Document Submission', enum: STAGES },

    /* ─── Documents (stages 1 & 2) ─── */
    documents: {
      type: [documentSchema],
      default: [
        { docType: 'aadhaar', label: 'Aadhaar Card', requested: false, received: false },
        { docType: 'pan', label: 'PAN Card', requested: false, received: false },
      ],
    },

    /* ─── Contract Signing (stage 3) ─── */
    contractSent: { type: Boolean, default: false },
    contractReceived: { type: Boolean, default: false },
    contractFileUrl: { type: String, default: '' },
    contractFileName: { type: String, default: '' },
    contractGdriveFileId: { type: String, default: '' },
    contractStartDate: { type: Date, default: null },
    contractRenewalDate: { type: Date, default: null },
    selectedSocieties: { type: [String], default: [] },

    /* ─── Contact Made (stage 5) ─── */
    addedToWhatsApp: { type: Boolean, default: false },
    whatsAppGroupName: { type: String, default: '' },
    emailCreated: { type: Boolean, default: false },
    createdEmailAddress: { type: String, default: '' },
    createdEmailPassword: { type: String, default: '' },

    /* ─── Legacy checklist (backward compat) ─── */
    checklist: {
      docs_submitted: { type: Boolean, default: false },
      kyc_verified: { type: Boolean, default: false },
      contract_signed: { type: Boolean, default: false },
      review_complete: { type: Boolean, default: false },
      member_activated: { type: Boolean, default: false },
    },

    spoc: { type: String, default: '' },
    assignedDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    previousStage: { type: String, default: '' },
    notes: { type: String, default: '' },
    priority: { type: String, default: 'medium', enum: ['high', 'medium', 'low'] },
    subTasks: [subTaskSchema],
  },
  { timestamps: true, collection: 'onboarding_entries' }
);

onboardingEntrySchema.pre('save', function () {
  if (this.isModified('name') && this.name) {
    this.initials = this.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
});

onboardingEntrySchema.index({ spoc: 1 });
onboardingEntrySchema.index({ email: 1 });
onboardingEntrySchema.index({ stage: 1 });
onboardingEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model('OnboardingEntry', onboardingEntrySchema);
