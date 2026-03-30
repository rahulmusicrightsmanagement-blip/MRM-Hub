const mongoose = require('mongoose');

const picklistSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },       // e.g. 'lead_stage'
    categoryLabel: { type: String, required: true, trim: true },  // e.g. 'Lead Stage'
    value: { type: String, required: true, trim: true },          // stored value
    label: { type: String, required: true, trim: true },          // display label
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'picklists' }
);

picklistSchema.index({ category: 1, order: 1 });
picklistSchema.index({ category: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Picklist', picklistSchema);
