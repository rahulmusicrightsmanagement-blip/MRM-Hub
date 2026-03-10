const mongoose = require('mongoose');

/* ─── 12 Collecting Societies ─── */
const SOCIETIES = [
  'IPRS', 'PRS', 'ASCAP', 'PPL(INDIA)', 'PPL(UK)',
  'SOUND EXCHANGE', 'ISAMRA', 'BMI', 'GEMA', 'MLC', 'IMRO', 'SOCAN',
];

/* ─── Step tracking for each society ─── */
const stepsSchema = new mongoose.Schema({
  territoryWithdrawal:       { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  nocReceived:               { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  applicationFiled:          { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  paymentDone:               { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  applicationSigned:         { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  applicationSentToSociety:  { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  applicationSentFileUrl:    { type: String, default: '' },
  applicationSentFileName:   { type: String, default: '' },
  applicationSentGdriveFileId: { type: String, default: '' },
  membershipConfirmation:    { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  loginDetails:              { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  loginId:                   { type: String, default: '' },
  loginPassword:             { type: String, default: '' },
  caeNumber:                 { type: String, default: '' },
  commissionRate:            { type: String, default: '' },
  thirdPartyAuthorization:   { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
  bankMandateUpdate:         { type: String, default: 'NA', enum: ['Yes', 'No', 'NA'] },
}, { _id: false });

const remarkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const societyEntrySchema = new mongoose.Schema({
  status: { type: String, default: 'N/A', enum: ['Registered', 'In Progress', 'Not Started', 'N/A'] },
  assignee: {
    name: { type: String, default: '' },
    initials: { type: String, default: '' },
    color: { type: String, default: '' },
  },
  steps: { type: stepsSchema, default: () => ({}) },
  remarks: { type: [remarkSchema], default: [] },
});

const societyRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    societies: {
      type: Map,
      of: societyEntrySchema,
      default: {},
    },
    assignees: {
      type: Map,
      of: {
        name: { type: String, default: '' },
        initials: { type: String, default: '' },
        color: { type: String, default: '' },
      },
      default: {},
    },
  },
  { timestamps: true, collection: 'society_registrations' }
);

module.exports = mongoose.model('SocietyRegistration', societyRegistrationSchema);
