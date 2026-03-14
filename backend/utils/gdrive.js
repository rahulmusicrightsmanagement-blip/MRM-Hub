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

/* ─── Cache for ensured sub-folder IDs ─── */
const folderCache = {};

/* ─── Ensure a named sub-folder exists under a parent ─── */
async function ensureFolder(name, parentId, driveClient) {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  const res = await driveClient.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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

/* ─── Upload to BUSINESS Drive (with optional sub-folder) ─── */
async function uploadFile(fileBuffer, originalName, mimeType, driveName, { subFolder } = {}) {
  let targetFolderId = BUSINESS_FOLDER_ID;
  if (subFolder) {
    const sub = await ensureFolder(subFolder, targetFolderId, businessDrive);
    targetFolderId = sub.id;
  }
  return _upload(businessDrive, fileBuffer, originalName, mimeType, driveName, targetFolderId);
}

/* ─── Upload to MUSIC Drive ─── */
async function uploadFileMusic(fileBuffer, originalName, mimeType, driveName) {
  return _upload(musicDrive, fileBuffer, originalName, mimeType, driveName, MUSIC_FOLDER_ID);
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

module.exports = { uploadFile, uploadFileMusic, deleteFile, deleteFileMusic };
