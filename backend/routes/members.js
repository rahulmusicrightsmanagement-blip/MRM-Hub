const express = require('express');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const Royalty = require('../models/Royalty');
const ClientMessage = require('../models/ClientMessage');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/members
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    // RBAC: non-full-access users see only their assigned members
    if (!req.user.isFullAccess()) {
      filter.spoc = req.user.name;
    }
    const [members, allRegs] = await Promise.all([
      Member.find(filter).sort({ createdAt: -1 }).lean(),
      SocietyRegistration.find().lean(),
    ]);

    // Build a lookup: lowercase name → registration count (single pass, no N+1)
    const regCountByName = new Map();
    for (const doc of allRegs) {
      if (!doc.societies) continue;
      const key = doc.name.toLowerCase();
      const entries = doc.societies instanceof Map ? doc.societies.values() : Object.values(doc.societies);
      let count = 0;
      for (const entry of entries) {
        if (entry && entry.status === 'Registered') count++;
      }
      regCountByName.set(key, (regCountByName.get(key) || 0) + count);
    }

    const enriched = members.map((m) => ({
      ...m,
      registrations: regCountByName.get(m.name.toLowerCase()) || 0,
    }));

    res.json({ members: enriched });
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members
router.post('/', auth, async (req, res) => {
  try {
    const { name, role, email, phone, genre, languages, bio, spoc, panCard, aadhaar, dateOfFirstContact, deadline, leadSource, priority, isReferred, referredBy, referralCommission } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const member = new Member({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      color,
      role: Array.isArray(role) ? role : (role ? [role] : []),
      phone: phone || '',
      genre: genre || '',
      languages: languages || '',
      bio: bio || '',
      spoc: spoc || '',
      assignedDate: spoc ? new Date() : null,
      deadline: deadline ? new Date(deadline) : null,
      panCard: panCard || '',
      aadhaar: aadhaar || '',
      dateOfFirstContact: dateOfFirstContact || '',
      leadSource: leadSource || '',
      priority: priority || 'medium',
      isReferred: isReferred || false,
      referredBy: referredBy || '',
      referralCommission: referralCommission || '',
      joinDate: new Date().toISOString().split('T')[0],
    });

    await member.save();
    res.status(201).json({ member });
  } catch (err) {
    console.error('Create member error:', err.message, err.stack);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// GET /api/members/:id/profile  — aggregated member profile
router.get('/:id/profile', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const aliases = [member.name, ...(member.previousNames || [])].filter(Boolean);
    const escapedAliases = [...new Set(aliases.map((n) => n.trim()))].filter(Boolean).map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    );
    const nameRegex = escapedAliases.length
      ? new RegExp(`^\\s*(${escapedAliases.join('|')})\\s*$`, 'i')
      : new RegExp(`^${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const [leads, onboarding, societyRegs, royalties] = await Promise.all([
      Lead.find({ $or: [{ name: nameRegex }, { email: member.email }] }).sort({ createdAt: -1 }).lean(),
      OnboardingEntry.find({ name: nameRegex }).sort({ createdAt: -1 }).lean(),
      SocietyRegistration.find({ name: nameRegex }).sort({ createdAt: -1 }).lean(),
      Royalty.find({ $or: [{ clientName: nameRegex }, { clientEmail: member.email }] }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({ member, leads, onboarding, societyRegs, royalties });
  } catch (err) {
    console.error('Member profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/members/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const oldName = member.name;
    const newName = typeof req.body.name === 'string' ? req.body.name.trim() : oldName;
    const nameChanged = newName && newName !== oldName;

    // Auto-set assignedDate when spoc changes
    if (req.body.spoc !== undefined && req.body.spoc !== member.spoc) {
      member.assignedDate = req.body.spoc ? new Date() : null;
    }

    const fields = ['name', 'role', 'email', 'phone', 'genre', 'languages', 'bio', 'status', 'kycStatus', 'panCard', 'panVerified', 'aadhaar', 'aadhaarVerified', 'ipiNumber', 'isni', 'territories', 'leadSource', 'priority', 'registrations', 'joinDate', 'dateOfFirstContact', 'spoc', 'deadline', 'isReferred', 'referredBy', 'referralCommission', 'clientNumber'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) member[f] = req.body[f];
    });
    if (req.body.name) member.name = newName;
    if (req.body.deadline) member.deadline = new Date(req.body.deadline);

    // Track historical names so prior renames can also be synced retroactively
    if (nameChanged) {
      if (!Array.isArray(member.previousNames)) member.previousNames = [];
      if (oldName && !member.previousNames.includes(oldName)) {
        member.previousNames.push(oldName);
      }
    }

    await member.save();

    // Always propagate current member name to related records. Match against:
    //   • email (primary key for Lead/Onboarding/Royalty)
    //   • current name + any historical previousNames (for SocietyReg/ClientMessage that lack email)
    try {
      const aliases = [newName, oldName, ...(member.previousNames || [])].filter(Boolean);
      const uniqueAliases = [...new Set(aliases.map((n) => n.trim()))].filter(Boolean);
      const escapedAliases = uniqueAliases.map((n) =>
        n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      );
      const nameRx = escapedAliases.length
        ? new RegExp(`^\\s*(${escapedAliases.join('|')})\\s*$`, 'i')
        : null;
      const emailLc = (member.email || '').toLowerCase();

      const orClauses = (nameField) => {
        const clauses = [];
        if (nameRx) clauses.push({ [nameField]: nameRx });
        return clauses;
      };

      const leadFilter = emailLc
        ? { $or: [{ email: emailLc }, ...orClauses('name')] }
        : { $or: orClauses('name') };
      const onboardFilter = emailLc
        ? { $or: [{ email: emailLc }, ...orClauses('name')] }
        : { $or: orClauses('name') };
      const royaltyFilter = emailLc
        ? { $or: [{ clientEmail: emailLc }, ...orClauses('clientName')] }
        : { $or: orClauses('clientName') };
      const societyFilter = nameRx ? { name: nameRx } : null;
      const messageFilter = nameRx ? { clientName: nameRx } : null;

      const ops = [];
      if (leadFilter.$or && leadFilter.$or.length) ops.push(Lead.updateMany(leadFilter, { $set: { name: newName } }));
      if (onboardFilter.$or && onboardFilter.$or.length) ops.push(OnboardingEntry.updateMany(onboardFilter, { $set: { name: newName } }));
      if (royaltyFilter.$or && royaltyFilter.$or.length) ops.push(Royalty.updateMany(royaltyFilter, { $set: { clientName: newName } }));

      // Normalized in-memory match for name-linked collections (bulletproofs against
      // whitespace/casing drift that can defeat regex matching).
      const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const aliasSet = new Set(uniqueAliases.map(normName).filter(Boolean));

      const regDocs = await SocietyRegistration.find({}, { _id: 1, name: 1 }).lean();
      const regIds = regDocs.filter((r) => aliasSet.has(normName(r.name))).map((r) => r._id);
      if (regIds.length) ops.push(SocietyRegistration.updateMany({ _id: { $in: regIds } }, { $set: { name: newName } }));

      const msgDocs = await ClientMessage.find({}, { _id: 1, clientName: 1 }).lean();
      const msgIds = msgDocs.filter((m) => aliasSet.has(normName(m.clientName))).map((m) => m._id);
      if (msgIds.length) ops.push(ClientMessage.updateMany({ _id: { $in: msgIds } }, { $set: { clientName: newName } }));

      const results = await Promise.all(ops);
      if (results.some((r) => r && r.modifiedCount > 0) || regIds.length || msgIds.length) {
        console.log(`Member name sync → "${newName}" aliases=[${uniqueAliases.join('|')}] societyMatches=${regIds.length} msgMatches=${msgIds.length}`);
      }
    } catch (propErr) {
      console.error('Name propagation error:', propErr);
    }

    res.json({ member });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members/:id/sync-name — one-shot backfill for related records
// Body: { previousName? } — optional alias to add before syncing
router.post('/:id/sync-name', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    if (req.body.previousName && typeof req.body.previousName === 'string') {
      const alias = req.body.previousName.trim();
      if (!Array.isArray(member.previousNames)) member.previousNames = [];
      if (alias && alias !== member.name && !member.previousNames.includes(alias)) {
        member.previousNames.push(alias);
        await member.save();
      }
    }

    const newName = member.name;
    const aliases = [newName, ...(member.previousNames || [])].filter(Boolean);
    const uniqueAliases = [...new Set(aliases.map((n) => n.trim()))].filter(Boolean);
    // Escape regex metacharacters, then replace runs of whitespace with \s+ so
    // "Rahul Jadhav" matches "Rahul  Jadhav" / "Rahul\tJadhav" / etc.
    const escapedAliases = uniqueAliases.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    );
    const nameRx = escapedAliases.length ? new RegExp(`^\\s*(${escapedAliases.join('|')})\\s*$`, 'i') : null;
    const emailLc = (member.email || '').toLowerCase();

    const orClauses = (nameField) => (nameRx ? [{ [nameField]: nameRx }] : []);
    const leadFilter = emailLc ? { $or: [{ email: emailLc }, ...orClauses('name')] } : { $or: orClauses('name') };
    const onboardFilter = emailLc ? { $or: [{ email: emailLc }, ...orClauses('name')] } : { $or: orClauses('name') };
    const royaltyFilter = emailLc ? { $or: [{ clientEmail: emailLc }, ...orClauses('clientName')] } : { $or: orClauses('clientName') };

    // Normalize helper — collapse whitespace, lowercase, trim. Bulletproofs against
    // stray spaces, tabs, casing differences that could defeat regex matching.
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const aliasSet = new Set(uniqueAliases.map(norm).filter(Boolean));

    // Society Reg: fetch all + in-memory compare. Avoids any regex edge case.
    const allRegs = await SocietyRegistration.find({}, { _id: 1, name: 1 }).lean();
    const matchedRegIds = allRegs.filter((r) => aliasSet.has(norm(r.name))).map((r) => r._id);
    const societyRes = matchedRegIds.length
      ? await SocietyRegistration.updateMany({ _id: { $in: matchedRegIds } }, { $set: { name: newName } })
      : { modifiedCount: 0 };

    // Client Messages: same belt-and-suspenders approach
    const allMsgs = await ClientMessage.find({}, { _id: 1, clientName: 1 }).lean();
    const matchedMsgIds = allMsgs.filter((m) => aliasSet.has(norm(m.clientName))).map((m) => m._id);
    const msgRes = matchedMsgIds.length
      ? await ClientMessage.updateMany({ _id: { $in: matchedMsgIds } }, { $set: { clientName: newName } })
      : { modifiedCount: 0 };

    const ops = [];
    if (leadFilter.$or && leadFilter.$or.length) ops.push(Lead.updateMany(leadFilter, { $set: { name: newName } }));
    if (onboardFilter.$or && onboardFilter.$or.length) ops.push(OnboardingEntry.updateMany(onboardFilter, { $set: { name: newName } }));
    if (royaltyFilter.$or && royaltyFilter.$or.length) ops.push(Royalty.updateMany(royaltyFilter, { $set: { clientName: newName } }));

    const results = await Promise.all(ops);
    console.log(`Sync name → "${newName}" aliases=[${uniqueAliases.join('|')}] societyMatches=${matchedRegIds.length} msgMatches=${matchedMsgIds.length}`);
    res.json({
      member,
      synced: {
        leads: results[0]?.modifiedCount ?? 0,
        onboarding: results[1]?.modifiedCount ?? 0,
        societyRegs: societyRes.modifiedCount ?? 0,
        royalties: results[2]?.modifiedCount ?? 0,
        clientMessages: msgRes.modifiedCount ?? 0,
      },
    });
  } catch (err) {
    console.error('Sync name error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/members/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/members/:id/subtasks
router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    member.subTasks.push({ text: req.body.text, assignee: req.body.assignee || '', done: false });
    await member.save();
    res.json({ member });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/members/:id/subtasks/:taskId
router.put('/:id/subtasks/:taskId', auth, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const task = member.subTasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.body.done !== undefined) task.done = req.body.done;
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;

    await member.save();
    res.json({ member });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
