const mongoose = require('mongoose');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthDataSchema = new mongoose.Schema({
  fileReceived: { type: Boolean, default: false },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  totalSongs: { type: Number, default: 0 },
  totalBGMMovies: { type: Number, default: 0 },
  totalTVBGM: { type: Number, default: 0 },
  totalTVBGMEpisode: { type: Number, default: 0 },
}, { _id: false });

const yearDataSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  months: {
    type: Map,
    of: monthDataSchema,
    default: () => {
      const m = new Map();
      MONTHS.forEach((mon) => m.set(mon, {}));
      return m;
    },
  },
}, { _id: false });

const royaltySchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    clientEmail: { type: String, default: '' },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    onboardingId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingEntry' },
    documentsReceived: { type: Boolean, default: false },
    documentFileName: { type: String, default: '' },
    documentFileUrl: { type: String, default: '' },
    years: [yearDataSchema],
  },
  { timestamps: true }
);

// Force canonical Member.name + memberId link on save. Preserves data on ambiguous matches.
// Prefer onboardingId -> OnboardingEntry.memberId chain (exact) over email/name match.
royaltySchema.pre('save', async function () {
  if (this.isNew || this.isModified('clientName') || this.isModified('clientEmail') || this.isModified('onboardingId') || !this.memberId) {
    if (!this.memberId && this.onboardingId) {
      try {
        const OnboardingEntry = require('./OnboardingEntry');
        const onb = await OnboardingEntry.findById(this.onboardingId, { memberId: 1 }).lean();
        if (onb && onb.memberId) this.memberId = onb.memberId;
      } catch (_) { /* noop */ }
    }
    if (!this.memberId) {
      const resolveMember = require('../utils/resolveMember');
      const hit = await resolveMember({ email: this.clientEmail, name: this.clientName });
      if (hit) {
        this.memberId = hit._id;
        if (hit.name && hit.name !== this.clientName) this.clientName = hit.name;
      }
    } else {
      try {
        const Member = require('./Member');
        const m = await Member.findById(this.memberId, { name: 1 }).lean();
        if (m && m.name && m.name !== this.clientName) this.clientName = m.name;
      } catch (_) { /* noop */ }
    }
  }
});

royaltySchema.index({ clientName: 1 });
royaltySchema.index({ clientEmail: 1 });
royaltySchema.index({ memberId: 1 });

module.exports = mongoose.model('Royalty', royaltySchema);
