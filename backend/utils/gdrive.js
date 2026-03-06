const { google } = require('googleapis');
const stream = require('stream');

/* ─── OAuth2 Auth ─── */
const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

/* ─── Upload a file buffer to Google Drive ─── */
async function uploadFile(fileBuffer, originalName, mimeType, driveName) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  // Use descriptive name if provided, otherwise fall back to original
  const fileName = driveName || originalName;

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: bufferStream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = response.data.id;

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Get the updated file info with sharing links
  const file = await drive.files.get({
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

/* ─── Delete a file from Google Drive ─── */
async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error('GDrive delete error:', err.message);
  }
}

module.exports = { uploadFile, deleteFile };
