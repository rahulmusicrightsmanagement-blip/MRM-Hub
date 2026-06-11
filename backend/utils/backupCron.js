const cron = require('node-cron');
const BackupConfig = require('../models/BackupConfig');
const { sendDriveReportEmail } = require('./mailer');
const {
  businessDrive,
  musicDrive,
  BUSINESS_FOLDER_ID,
  MUSIC_FOLDER_ID,
  // Cross-drive backup: each drive's files are stored in the OTHER account, so
  // losing an entire Google account never loses the data.
  //  • Business drive files  → "MRM_Backup_BusinessDrive" folder in the MUSIC account
  //  • Music drive files     → "MRM_Backup_MusicDrive"    folder in the BUSINESS account
  BUSINESS_BACKUP_NAME,
  MUSIC_BACKUP_NAME,
  ensureRootFolder,
  listAllFilesRecursive,
  mirrorCrossDrive,
} = require('./gdrive');

// Recipient for the daily Drive count report (07:00 IST).
const REPORT_EMAIL = 'rahul.musicrightsmanagement@gmail.com';

// In-process lock — prevents two overlapping syncs from racing and creating
// duplicate folders/files (concurrent ensureFolder has a check-then-create race).
let syncRunning = false;

/* ─── Mirror originals → backup folders (additive copy, never touches originals) ─── */
const runBackupSync = async () => {
  if (syncRunning) {
    console.warn('[backupCron] sync already running — skipping this invocation');
    return { skippedBecauseRunning: true };
  }
  syncRunning = true;

  const startedAt = new Date();
  console.log(`[backupCron] sync started at ${startedAt.toISOString()}`);

  try {
  const config = await BackupConfig.getSingleton();
  const stats = { businessCopied: 0, businessSkipped: 0, musicCopied: 0, musicSkipped: 0, errors: [] };

  // ── Business drive → backup folder in the MUSIC account ──
  if (BUSINESS_FOLDER_ID) {
    try {
      const backup = await ensureRootFolder(musicDrive, BUSINESS_BACKUP_NAME);
      // Persist folder identity up-front so the URL is in Mongo even if the copy is interrupted.
      config.business = { backupFolderId: backup.id, backupFolderUrl: backup.webViewLink || '' };
      await config.save();
      const res = await mirrorCrossDrive(businessDrive, BUSINESS_FOLDER_ID, musicDrive, backup.id, 'business→music');
      stats.businessCopied = res.copied;
      stats.businessSkipped = res.skipped;
      console.log(`[backupCron] business→music: copied ${res.copied}, skipped ${res.skipped} → ${backup.webViewLink}`);
    } catch (err) {
      console.error('[backupCron] business backup failed:', err.message);
      stats.errors.push(`business: ${err.message}`);
    }
  } else {
    console.warn('[backupCron] BUSINESS_FOLDER_ID (GDRIVE_FOLDER_ID) not set — skipping business backup');
  }

  // ── Music drive → backup folder in the BUSINESS account ──
  if (MUSIC_FOLDER_ID) {
    try {
      const backup = await ensureRootFolder(businessDrive, MUSIC_BACKUP_NAME);
      // Persist folder identity up-front so the URL is in Mongo even if the copy is interrupted.
      config.music = { backupFolderId: backup.id, backupFolderUrl: backup.webViewLink || '' };
      await config.save();
      const res = await mirrorCrossDrive(musicDrive, MUSIC_FOLDER_ID, businessDrive, backup.id, 'music→business');
      stats.musicCopied = res.copied;
      stats.musicSkipped = res.skipped;
      console.log(`[backupCron] music→business: copied ${res.copied}, skipped ${res.skipped} → ${backup.webViewLink}`);
    } catch (err) {
      console.error('[backupCron] music backup failed:', err.message);
      stats.errors.push(`music: ${err.message}`);
    }
  } else {
    console.warn('[backupCron] MUSIC_FOLDER_ID (GDRIVE_MUSIC_FOLDER_ID) not set — skipping music backup');
  }

  config.lastRunAt = new Date();
  config.lastRunStats = stats;
  await config.save();

  console.log(`[backupCron] sync finished in ${Date.now() - startedAt.getTime()}ms`, stats);
  return stats;
  } finally {
    syncRunning = false;
  }
};

/* ─── Email a count summary of all 4 folders (2 originals + 2 backups) ─── */
const summarizeFolder = async (label, drive, folderId) => {
  try {
    const files = await listAllFilesRecursive(drive, folderId);
    return { label, count: files.length, sizeBytes: files.reduce((s, f) => s + (f.size || 0), 0) };
  } catch (err) {
    console.error(`[backupCron] failed listing ${label}:`, err.message);
    return { label, count: null, sizeBytes: null, error: err.message };
  }
};

const runDriveReportEmail = async () => {
  console.log(`[backupCron] report email started at ${new Date().toISOString()}`);

  const folders = [];

  if (BUSINESS_FOLDER_ID) {
    folders.push(await summarizeFolder('Business Drive (original)', businessDrive, BUSINESS_FOLDER_ID));
    // Business backup lives in the MUSIC account.
    const bBak = await ensureRootFolder(musicDrive, BUSINESS_BACKUP_NAME);
    folders.push(await summarizeFolder('Business Backup → in Music account', musicDrive, bBak.id));
  }
  if (MUSIC_FOLDER_ID) {
    folders.push(await summarizeFolder('Music Drive (original)', musicDrive, MUSIC_FOLDER_ID));
    // Music backup lives in the BUSINESS account.
    const mBak = await ensureRootFolder(businessDrive, MUSIC_BACKUP_NAME);
    folders.push(await summarizeFolder('Music Backup → in Business account', businessDrive, mBak.id));
  }

  try {
    await sendDriveReportEmail({ to: REPORT_EMAIL, folders });
    console.log(`[backupCron] report email sent → ${REPORT_EMAIL}`, folders.map((f) => `${f.label}: ${f.count}`));
  } catch (err) {
    console.error('[backupCron] report email failed:', err.message);
  }

  return folders;
};

const startBackupCron = () => {
  // Backup sync 3× daily — 02:00, 10:00, 18:00 IST
  cron.schedule('0 2,10,18 * * *', () => {
    runBackupSync().catch((err) => console.error('[backupCron] sync error:', err));
  }, { timezone: 'Asia/Kolkata' });
  console.log('[backupCron] scheduled backup sync 02:00/10:00/18:00 Asia/Kolkata');

  // Document report email daily 07:00 IST
  cron.schedule('0 7 * * *', () => {
    runDriveReportEmail().catch((err) => console.error('[backupCron] report error:', err));
  }, { timezone: 'Asia/Kolkata' });
  console.log('[backupCron] scheduled document report email 07:00 Asia/Kolkata');
};

module.exports = { startBackupCron, runBackupSync, runDriveReportEmail };
