const { google } = require('googleapis');
const stream = require('stream');

/* ═══════════════════════════════════════════════
   BUSINESS DRIVE (Sales, Onboarding, Society)
   ═══════════════════════════════════════════════ */
const businessAuth = new google.auth.OAuth2(
  process.env.GDRIVE_CLIENT_ID,
  process.env.GDRIVE_CLIENT_SECRET
);
businessAuth.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
const businessDrive = google.drive({ version: 'v3', auth: businessAuth });
const BUSINESS_FOLDER_ID = process.env.GDRIVE_FOLDER_ID;

/* ═══════════════════════════════════════════════
   MUSIC DRIVE (separate Google Drive account)
   ═══════════════════════════════════════════════ */
const musicAuth = new google.auth.OAuth2(
  process.env.GDRIVE_MUSIC_CLIENT_ID,
  process.env.GDRIVE_MUSIC_CLIENT_SECRET
);
musicAuth.setCredentials({ refresh_token: process.env.GDRIVE_MUSIC_REFRESH_TOKEN });
const musicDrive = google.drive({ version: 'v3', auth: musicAuth });
const MUSIC_FOLDER_ID = process.env.GDRIVE_MUSIC_FOLDER_ID;

/* ═══════════════════════════════════════════════
   CROSS-DRIVE BACKUP TARGETS (each drive's files live in the OTHER account)
   ═══════════════════════════════════════════════ */
const BUSINESS_BACKUP_NAME = 'MRM_Backup_BusinessDrive'; // folder in the MUSIC account
const MUSIC_BACKUP_NAME = 'MRM_Backup_MusicDrive';       // folder in the BUSINESS account

/* ─── Cache for ensured sub-folder IDs ─── */
const folderCache = {};

// Escape a value for use inside a single-quoted Drive query string. Without this,
// a name containing an apostrophe (e.g. "O'Brien") breaks the files.list query.
const escapeQ = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/* ─── Ensure a named sub-folder exists under a parent ─── */
async function ensureFolder(name, parentId, driveClient) {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  const res = await driveClient.files.list({
    q: `'${parentId}' in parents and name = '${escapeQ(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  let folder;
  if (res.data.files && res.data.files.length > 0) {
    folder = res.data.files[0];
  } else {
    const created = await driveClient.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name',
    });
    folder = created.data;
  }

  folderCache[cacheKey] = folder;
  return folder;
}

/* ─── Core upload helper ─── */
async function _upload(driveClient, fileBuffer, originalName, mimeType, driveName, folderId) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const fileName = driveName || originalName;

  const response = await driveClient.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: bufferStream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = response.data.id;

  await driveClient.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const file = await driveClient.files.get({
    fileId,
    fields: 'id, name, webViewLink, webContentLink',
  });

  return {
    fileId: file.data.id,
    fileName: fileName,
    webViewLink: file.data.webViewLink,
    webContentLink: file.data.webContentLink,
  };
}

/* ─── Live backup: immediately push the just-uploaded bytes to the backup folder
   in the OTHER Drive account. Best-effort — a failure here never breaks the
   user's upload; the scheduled sync is the safety net that catches any misses. ─── */
async function _liveBackup(destDrive, backupRootName, subFolder, fileBuffer, fileName, mimeType) {
  try {
    const root = await ensureRootFolder(destDrive, backupRootName);
    let targetId = root.id;
    if (subFolder) {
      const sub = await ensureFolder(subFolder, targetId, destDrive);
      targetId = sub.id;
    }
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);
    await destDrive.files.create({
      requestBody: { name: fileName, parents: [targetId] },
      media: { mimeType: mimeType || 'application/octet-stream', body: bufferStream },
      fields: 'id',
    });
    console.log(`[liveBackup] backed up "${fileName}" → ${backupRootName}${subFolder ? '/' + subFolder : ''}`);
  } catch (err) {
    console.error(`[liveBackup] failed for "${fileName}" (scheduled sync will retry):`, err.message);
  }
}

/* ─── Startup health-check: confirm the configured original folders are reachable.
   A stale/wrong folder id (e.g. an out-of-date .env on the server) is the root
   cause of "0 files" surprises — querying a bad parent returns empty, not an
   error. This surfaces the misconfig LOUDLY at boot instead of silently later. ─── */
async function verifyConfiguredFolders() {
  const checks = [
    { label: 'BUSINESS (GDRIVE_FOLDER_ID)', drive: businessDrive, id: BUSINESS_FOLDER_ID },
    { label: 'MUSIC (GDRIVE_MUSIC_FOLDER_ID)', drive: musicDrive, id: MUSIC_FOLDER_ID },
  ];
  for (const c of checks) {
    if (!c.id) {
      console.error(`[gdrive] ⚠️  ${c.label} is NOT set in env — uploads/backup for this drive will be skipped.`);
      continue;
    }
    try {
      const meta = await c.drive.files.get({ fileId: c.id, fields: 'id, name, trashed, mimeType' });
      if (meta.data.trashed) {
        console.error(`[gdrive] ⚠️  ${c.label} folder "${meta.data.name}" (${c.id}) is in TRASH — fix the folder id.`);
      } else if (meta.data.mimeType !== FOLDER_MIME) {
        console.error(`[gdrive] ⚠️  ${c.label} id ${c.id} is not a folder.`);
      } else {
        console.log(`[gdrive] ✓ ${c.label} → "${meta.data.name}" reachable.`);
      }
    } catch (err) {
      console.error(`[gdrive] ⚠️  ${c.label} folder id ${c.id} is UNREACHABLE (${err.code || err.message}). ` +
        `Likely a stale/incorrect .env — reports will show errors and uploads may fail until this is fixed.`);
    }
  }
}

/* ─── Upload to BUSINESS Drive (with optional sub-folder) ─── */
async function uploadFile(fileBuffer, originalName, mimeType, driveName, { subFolder } = {}) {
  let targetFolderId = BUSINESS_FOLDER_ID;
  if (subFolder) {
    const sub = await ensureFolder(subFolder, targetFolderId, businessDrive);
    targetFolderId = sub.id;
  }
  const result = await _upload(businessDrive, fileBuffer, originalName, mimeType, driveName, targetFolderId);
  // Business files are backed up into the MUSIC account, mirroring the sub-folder.
  await _liveBackup(musicDrive, BUSINESS_BACKUP_NAME, subFolder, fileBuffer, result.fileName, mimeType);
  return result;
}

/* ─── Upload to MUSIC Drive ─── */
async function uploadFileMusic(fileBuffer, originalName, mimeType, driveName) {
  const result = await _upload(musicDrive, fileBuffer, originalName, mimeType, driveName, MUSIC_FOLDER_ID);
  // Music files are backed up into the BUSINESS account.
  await _liveBackup(businessDrive, MUSIC_BACKUP_NAME, null, fileBuffer, result.fileName, mimeType);
  return result;
}

/* ─── Delete from BUSINESS Drive ─── */
async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    await businessDrive.files.delete({ fileId });
  } catch (err) {
    console.error('GDrive delete error:', err.message);
  }
}

/* ─── Delete from MUSIC Drive ─── */
async function deleteFileMusic(fileId) {
  if (!fileId) return;
  try {
    await musicDrive.files.delete({ fileId });
  } catch (err) {
    console.error('GDrive Music delete error:', err.message);
  }
}

/* ═══════════════════════════════════════════════
   BACKUP / MIRROR HELPERS
   These never modify or delete the source. They only
   read (files.list) and copy (files.copy) from it.
   ═══════════════════════════════════════════════ */

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/* ─── Find-or-create a top-level folder at the Drive root ─── */
async function ensureRootFolder(driveClient, name) {
  const res = await driveClient.files.list({
    q: `'root' in parents and name = '${escapeQ(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }

  const created = await driveClient.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: ['root'] },
    fields: 'id, name, webViewLink',
  });
  return created.data;
}

/* ─── List every child of a folder (one level), handling pagination ─── */
async function listChildren(driveClient, folderId) {
  const items = [];
  let pageToken;
  do {
    const res = await driveClient.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
      pageSize: 1000,
      pageToken,
    });
    if (res.data.files) items.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

/* ─── Recursively list all FILES under a folder (folders are traversed, not returned) ─── */
async function listAllFilesRecursive(driveClient, folderId, relPath = '') {
  const children = await listChildren(driveClient, folderId);
  const files = [];
  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      const sub = await listAllFilesRecursive(driveClient, child.id, `${relPath}${child.name}/`);
      files.push(...sub);
    } else {
      files.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
        size: child.size ? Number(child.size) : null,
        modifiedTime: child.modifiedTime,
        webViewLink: child.webViewLink,
        relPath: `${relPath}${child.name}`,
      });
    }
  }
  return files;
}

/* ─── Additively mirror src folder → dest folder (copy-only, never deletes) ─── */
async function mirrorFolder(driveClient, srcFolderId, destFolderId, driveLabel = '') {
  let copied = 0;
  let skipped = 0;

  const srcChildren = await listChildren(driveClient, srcFolderId);
  const destChildren = await listChildren(driveClient, destFolderId);

  // Index existing dest entries by name so we don't duplicate.
  const destFolderByName = new Map();
  const destFileNames = new Set();
  for (const d of destChildren) {
    if (d.mimeType === FOLDER_MIME) destFolderByName.set(d.name, d);
    else destFileNames.add(d.name);
  }

  for (const child of srcChildren) {
    if (child.mimeType === FOLDER_MIME) {
      // Find-or-create the matching sub-folder in dest, then recurse.
      let destSub = destFolderByName.get(child.name);
      if (!destSub) {
        destSub = await ensureFolder(child.name, destFolderId, driveClient);
        destFolderByName.set(child.name, destSub);
      }
      const sub = await mirrorFolder(driveClient, child.id, destSub.id, driveLabel);
      copied += sub.copied;
      skipped += sub.skipped;
    } else if (destFileNames.has(child.name)) {
      skipped += 1;
    } else {
      try {
        await driveClient.files.copy({
          fileId: child.id,
          requestBody: { name: child.name, parents: [destFolderId] },
          fields: 'id',
        });
        destFileNames.add(child.name);
        copied += 1;
      } catch (err) {
        console.error(`[backup${driveLabel ? ':' + driveLabel : ''}] copy failed for "${child.name}":`, err.message);
      }
    }
  }

  return { copied, skipped };
}

/* ─── Additively mirror src folder (one Drive account) → dest folder (a DIFFERENT
   Drive account). Server-side files.copy can't cross accounts, so each file is
   downloaded from the source and re-uploaded to the destination. Source is
   read-only; never deletes from either side. ─── */
const CROSS_DRIVE_CONCURRENCY = 8;

/* Download one file from the source account and re-upload it to the destination. */
async function copyOneCrossDrive(srcDrive, destDrive, destFolderId, file, label) {
  const dl = await srcDrive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(dl.data));
  await destDrive.files.create({
    requestBody: { name: file.name, parents: [destFolderId] },
    media: { mimeType: file.mimeType || 'application/octet-stream', body: bufferStream },
    fields: 'id',
  });
}

/* Run async tasks with a bounded concurrency pool. */
async function runPool(items, limit, worker) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

// A backup file matches a source file only when BOTH name and size are equal.
// Matching on name alone would drop distinct files that happen to share a name
// in the same folder (common in the Society folder); matching on name+size keeps
// every distinct file while still collapsing true re-uploads so re-runs stay idempotent.
const fileKey = (f) => `${f.name} ${f.size || '0'}`;

async function mirrorCrossDrive(srcDrive, srcFolderId, destDrive, destFolderId, label = '') {
  let copied = 0;
  let skipped = 0;

  const srcChildren = await listChildren(srcDrive, srcFolderId);
  const destChildren = await listChildren(destDrive, destFolderId);

  const destFolderByName = new Map();
  const destKeys = new Set();
  for (const d of destChildren) {
    if (d.mimeType === FOLDER_MIME) destFolderByName.set(d.name, d);
    else destKeys.add(fileKey(d));
  }

  const toCopy = new Map(); // key → file (dedupes identical name+size within this run)
  for (const child of srcChildren) {
    if (child.mimeType === FOLDER_MIME) {
      // Sub-folders are created sequentially to avoid a check-then-create race,
      // then their contents are mirrored.
      let destSub = destFolderByName.get(child.name);
      if (!destSub) {
        destSub = await ensureFolder(child.name, destFolderId, destDrive);
        destFolderByName.set(child.name, destSub);
      }
      const sub = await mirrorCrossDrive(srcDrive, child.id, destDrive, destSub.id, label);
      copied += sub.copied;
      skipped += sub.skipped;
    } else if (child.mimeType && child.mimeType.startsWith('application/vnd.google-apps')) {
      // Native Google docs/sheets can't be downloaded with alt=media; skip (our
      // uploads are binary files, so this should not occur in practice).
      console.warn(`[backup${label ? ':' + label : ''}] skipping native Google file "${child.name}" (${child.mimeType})`);
      skipped += 1;
    } else if (destKeys.has(fileKey(child)) || toCopy.has(fileKey(child))) {
      skipped += 1;
    } else {
      toCopy.set(fileKey(child), child);
    }
  }
  const filesToCopy = Array.from(toCopy.values());

  // Files within this folder are copied in parallel (download+upload is I/O bound).
  await runPool(filesToCopy, CROSS_DRIVE_CONCURRENCY, async (file) => {
    try {
      await copyOneCrossDrive(srcDrive, destDrive, destFolderId, file, label);
      copied += 1;
    } catch (err) {
      console.error(`[backup${label ? ':' + label : ''}] cross-drive copy failed for "${file.name}":`, err.message);
    }
  });

  return { copied, skipped };
}

module.exports = {
  uploadFile,
  uploadFileMusic,
  deleteFile,
  deleteFileMusic,
  mirrorCrossDrive,
  // backup helpers + clients/ids
  businessDrive,
  musicDrive,
  BUSINESS_FOLDER_ID,
  MUSIC_FOLDER_ID,
  BUSINESS_BACKUP_NAME,
  MUSIC_BACKUP_NAME,
  ensureRootFolder,
  listAllFilesRecursive,
  mirrorFolder,
  verifyConfiguredFolders,
};
