// Resolve Member from (email + name) without clobbering when email is shared.
// Returns { _id, name } of matched Member, or null when match is ambiguous/absent.
// Priority:
//  1) unique name-alias match -> that Member
//  2) unique email match -> that Member
//  3) email matches many BUT exactly one of them has a name/alias equal to input -> that Member
//  4) otherwise -> null (caller must preserve existing data)
const resolveMember = async ({ email, name } = {}) => {
  const Member = require('../models/Member');

  const nm = name ? String(name).replace(/\s+/g, ' ').trim() : '';
  const em = email ? String(email).toLowerCase().trim() : '';

  if (nm) {
    const esc = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const rx = new RegExp(`^\\s*${esc}\\s*$`, 'i');
    const matches = await Member.find(
      { $or: [{ name: rx }, { previousNames: rx }] },
      { name: 1 }
    ).limit(2).lean();
    if (matches.length === 1 && matches[0].name) return { _id: matches[0]._id, name: matches[0].name };
  }

  if (em) {
    const matches = await Member.find({ email: em }, { name: 1, previousNames: 1 }).lean();
    if (matches.length === 1 && matches[0].name) return { _id: matches[0]._id, name: matches[0].name };
    if (matches.length > 1 && nm) {
      const target = nm.toLowerCase();
      const hits = matches.filter((m) => {
        const aliases = [m.name, ...(m.previousNames || [])].filter(Boolean);
        return aliases.some((a) => String(a).replace(/\s+/g, ' ').trim().toLowerCase() === target);
      });
      if (hits.length === 1) return { _id: hits[0]._id, name: hits[0].name };
    }
  }

  return null;
};

module.exports = resolveMember;
