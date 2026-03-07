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
    onboardingId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingEntry' },
    documentsReceived: { type: Boolean, default: false },
    documentFileName: { type: String, default: '' },
    documentFileUrl: { type: String, default: '' },
    years: [yearDataSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Royalty', royaltySchema);
