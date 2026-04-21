// --- Daily Client-Task email recipients ---
// Edit this file to change who gets the daily task emails.
// No server restart of env required — just restart the backend after editing.

// Admin recipients → receive the full task list (all SPOCs combined).
const ADMIN_EMAILS = [
  'rahul.musicrightsmanagement@gmail.com',
  'devi@musicrightsmanagementindia.com',
  'sherley@musicrightsmanagementindia.com',
];

// SPOC overrides → map of lower-cased User.name → email to use
// instead of the User.email stored in DB. Useful when a SPOC's DB
// email is a login address but they want the task mail elsewhere.
const SPOC_EMAIL_OVERRIDES = {
  'rahul jadhav': 'rahuljadhav0417@gmail.com',
};

const resolveSpocEmail = (user) => {
  if (!user) return null;
  const key = (user.name || '').trim().toLowerCase();
  return SPOC_EMAIL_OVERRIDES[key] || user.email || null;
};

module.exports = { ADMIN_EMAILS, SPOC_EMAIL_OVERRIDES, resolveSpocEmail };
