const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: '' },
  },
  { _id: true }
);

const clientMessageSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    message: { type: String, required: true, trim: true },
    receivedAt: { type: Date, required: true },
    deadline: { type: Date, default: null },
    status: {
      type: String,
      default: 'New',
      enum: ['New', 'In Progress', 'Completed', 'Not Completed'],
    },
    assignedTo: { type: String, default: '' },
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    responses: { type: [responseSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'client_messages' }
);

clientMessageSchema.index({ receivedAt: -1 });
clientMessageSchema.index({ status: 1 });
clientMessageSchema.index({ clientId: 1 });

module.exports = mongoose.model('ClientMessage', clientMessageSchema);
