const mongoose = require('mongoose');

const driveBackupSchema = new mongoose.Schema(
  {
    backupFolderId: { type: String, default: '' },
    backupFolderUrl: { type: String, default: '' },
  },
  { _id: false }
);

const backupConfigSchema = new mongoose.Schema(
  {
    // Fixed key so we always read/write the same singleton document.
    key: { type: String, default: 'singleton', unique: true },
    business: { type: driveBackupSchema, default: () => ({}) },
    music: { type: driveBackupSchema, default: () => ({}) },
    lastRunAt: { type: Date },
    lastRunStats: { type: mongoose.Schema.Types.Mixed, default: {} }, // { businessCopied, businessSkipped, musicCopied, musicSkipped, errors }
  },
  { timestamps: true, collection: 'backupconfigs' }
);

// Convenience accessor that always resolves the one config document.
backupConfigSchema.statics.getSingleton = async function () {
  return this.findOneAndUpdate(
    { key: 'singleton' },
    { $setOnInsert: { key: 'singleton' } },
    { new: true, upsert: true }
  );
};

module.exports = mongoose.model('BackupConfig', backupConfigSchema);
