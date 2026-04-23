// Given an email and/or name, return the canonical Member.name.
// Safe against duplicate emails: never rewrites when match is ambiguous.
// Priority:
//  1) name-alias match returns exactly ONE Member -> that name
//  2) email match returns exactly ONE Member -> that name
//  3) email match returns multiple BUT one of them has a name/alias matching
//     the current record name -> that Member's canonical name (same row)
//  4) otherwise -> return the input name unchanged (preserve data)
const resolveMemberName = async ({ email, name } = {}) => {
  const Member = require('../models/Member');

  const nm = name ? String(name).replace(/\s+/g, ' ').trim() : '';
  const em = email ? String(email).toLowerCase().trim() : '';

  // (1) Unique name-alias match
  if (nm) {
    const esc = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const rx = new RegExp(`^\\s*${esc}\\s*$`, 'i');
    const matches = await Member.find(
      { $or: [{ name: rx }, { previousNames: rx }] },
      { name: 1 }
    ).limit(2).lean();
    if (matches.length === 1 && matches[0].name) return matches[0].name;
  }

  // (2) (3) Email-based match
  if (em) {
    const matches = await Member.find({ email: em }, { name: 1, previousNames: 1 }).lean();
    if (matches.length === 1 && matches[0].name) return matches[0].name;
    if (matches.length > 1 && nm) {
      const target = nm.toLowerCase();
      const hit = matches.find((m) => {
        const aliases = [m.name, ...(m.previousNames || [])].filter(Boolean);
        return aliases.some((a) => String(a).replace(/\s+/g, ' ').trim().toLowerCase() === target);
      });
      if (hit) return hit.name;
    }
  }

  return name;
};

module.exports = resolveMemberName;
