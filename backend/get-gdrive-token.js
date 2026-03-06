/**
 * One-time script to get a Google Drive OAuth2 refresh token.
 * Run: node get-gdrive-token.js
 * Then open the URL in a browser, sign in — the token is captured automatically.
 */
require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');

const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET must be set in your .env file.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'consent',
});

// Start temp server to capture the redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No code found. Try again.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ Authorization successful!</h1><p>You can close this tab and go back to the terminal.</p>');

    console.log('\n=== SUCCESS ===');
    console.log('\nAdd these to your backend/.env file:\n');
    console.log(`GDRIVE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GDRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nDone! You can now upload files to Google Drive.\n');
  } catch (err) {
    res.writeHead(500);
    res.end('Error: ' + err.message);
    console.error('Error getting token:', err.message);
  }

  server.close();
});

server.listen(3333, () => {
  console.log('\n=== Google Drive Authorization ===');
  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');
});
