// Application-level uniqueness check for Member.name / Member.email / Member.clientNumber.
// Does NOT create a DB-level unique index — that would fail to build if existing data has
// duplicates. Instead, we block NEW conflicts going forward while leaving historical
// duplicates intact. Callers should only pass the fields they intend to change, so editing
// an unrelated field on a row that happens to share an email with a sibling still succeeds.

const Member = require('../models/Member');

// Collapse all whitespace and lowercase — so "P ADeepak" and "P A Deepak" collide.
// Used only for the uniqueness check; the stored value is left as-typed.
const nameKey = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const idKey = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

/**
 * @param {{ name?: string, email?: string, clientNumber?: string }} fields
 * @param {import('mongoose').Types.ObjectId | string | null} excludeId
 * @returns {Promise<string[]>} list of conflicting fields ('name' | 'email' | 'clientNumber')
 */
const checkMemberUnique = async (fields, excludeId = null) => {
  const conflicts = [];
  const baseFilter = excludeId ? { _id: { $ne: excludeId } } : {};

  const wantsName = typeof fields.name === 'string' && fields.name.trim();
  const wantsMrm = fields.clientNumber !== undefined && fields.clientNumber !== null && String(fields.clientNumber).trim();

  // Single broad read — Member collection is small, and this lets us compare on the
  // whitespace-stripped, case-folded keys (so "P ADeepak" vs "P A Deepak" matches).
  if (wantsName || wantsMrm) {
    const rows = await Member.find(baseFilter).select('_id name clientNumber').lean();

    if (wantsName) {
      const key = nameKey(fields.name);
      if (rows.some((m) => nameKey(m.name) === key)) conflicts.push('name');
    }

    if (wantsMrm) {
      const key = idKey(fields.clientNumber);
      if (rows.some((m) => idKey(m.clientNumber) === key)) conflicts.push('clientNumber');
    }
  }

  if (fields.email) {
    const lc = String(fields.email).toLowerCase().trim();
    if (lc) {
      const dup = await Member.findOne({ ...baseFilter, email: lc }).select('_id').lean();
      if (dup) conflicts.push('email');
    }
  }

  return conflicts;
};

const conflictMessage = (conflicts) => {
  const labels = { name: 'name', email: 'email', clientNumber: 'MRM Membership ID' };
  const parts = conflicts.map((c) => labels[c] || c);
  return `Another member already uses this ${parts.join(' and ')}.`;
};

module.exports = { checkMemberUnique, conflictMessage };
