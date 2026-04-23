const express = require('express');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const Royalty = require('../models/Royalty');
const ClientMessage = require('../models/ClientMessage');
const { auth } = require('../middleware/auth');
const { checkMemberUnique, conflictMessage } = require('../utils/memberUnique');

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
    const { name, role, email, phone, genre, languages, bio, spoc, panCard, aadhaar, dateOfFirstContact, deadline, leadSource, priority, isReferred, referredBy, referralCommission, clientNumber } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const conflicts = await checkMemberUnique({ name, email, clientNumber });
    if (conflicts.length) return res.status(409).json({ message: conflictMessage(conflicts), conflicts });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const member = new Member({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      clientNumber: clientNumber ? String(clientNumber).trim() : '',
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

    // Primary join = memberId. Fallback to (email + name alias) ONLY for legacy rows
    // that haven't been backfilled yet — prevents pulling in records of sibling Members
    // that happen to share the same email.
    const sharesEmail = member.email
      ? (await Member.countDocuments({ email: member.email })) > 1
      : false;
    const legacyEmailClause = sharesEmail
      ? { email: member.email, name: nameRegex }
      : { email: member.email };
    const legacyRoyaltyEmailClause = sharesEmail
      ? { clientEmail: member.email, clientName: nameRegex }
      : { clientEmail: member.email };

    const leadFilter = { $or: [{ memberId: member._id }, { $and: [{ memberId: { $in: [null, undefined] } }, legacyEmailClause] }] };
    const onbFilter = { $or: [{ memberId: member._id }, { $and: [{ memberId: { $in: [null, undefined] } }, legacyEmailClause] }] };
    const royaltyFilter = { $or: [{ memberId: member._id }, { $and: [{ memberId: { $in: [null, undefined] } }, legacyRoyaltyEmailClause] }] };

    const [leads, onboarding, societyRegs, royalties] = await Promise.all([
      Lead.find(leadFilter).sort({ createdAt: -1 }).lean(),
      OnboardingEntry.find(onbFilter).sort({ createdAt: -1 }).lean(),
      SocietyRegistration.find({ name: nameRegex }).sort({ createdAt: -1 }).lean(),
      Royalty.find(royaltyFilter).sort({ createdAt: -1 }).lean(),
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
    const oldEmail = (member.email || '').toLowerCase();
    const oldPhone = member.phone || '';
    const newName = typeof req.body.name === 'string' ? req.body.name.trim() : oldName;
    const nameChanged = newName && newName !== oldName;

    // Uniqueness check — only for fields the caller is actually changing to a new value.
    // Historical duplicates stay intact; users can keep editing other fields even on rows
    // that happen to collide with a sibling today.
    const toCheck = {};
    if (nameChanged) toCheck.name = newName;
    if (typeof req.body.email === 'string') {
      const emailLc = req.body.email.toLowerCase().trim();
      if (emailLc && emailLc !== oldEmail) toCheck.email = emailLc;
    }
    if (typeof req.body.clientNumber === 'string') {
      const cn = req.body.clientNumber.trim();
      if (cn && cn !== (member.clientNumber || '')) toCheck.clientNumber = cn;
    }
    if (Object.keys(toCheck).length) {
      const conflicts = await checkMemberUnique(toCheck, member._id);
      if (conflicts.length) return res.status(409).json({ message: conflictMessage(conflicts), conflicts });
    }

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

    // Propagate name change to related records. PRIMARY key = memberId (safe even when
    // the email is shared by multiple Members). Email-based fallback is only applied
    // to legacy rows (memberId still null) AND only when this Member does NOT share
    // its email with any sibling — otherwise we'd clobber siblings' names.
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

      const sharesEmail = emailLc
        ? (await Member.countDocuments({ email: emailLc, _id: { $ne: member._id } })) > 0
        : false;

      // Legacy fallback clause: hit rows with null memberId that match email (safe)
      // or matching alias name. When email is shared, require BOTH email AND alias-name
      // so we don't touch sibling rows.
      const legacyLeadClause = emailLc
        ? (sharesEmail && nameRx ? { memberId: null, email: emailLc, name: nameRx } : { memberId: null, email: emailLc })
        : (nameRx ? { memberId: null, name: nameRx } : null);
      const legacyRoyaltyClause = emailLc
        ? (sharesEmail && nameRx ? { memberId: null, clientEmail: emailLc, clientName: nameRx } : { memberId: null, clientEmail: emailLc })
        : (nameRx ? { memberId: null, clientName: nameRx } : null);

      const leadFilter = legacyLeadClause
        ? { $or: [{ memberId: member._id }, legacyLeadClause] }
        : { memberId: member._id };
      const onbFilter = legacyLeadClause
        ? { $or: [{ memberId: member._id }, legacyLeadClause] }
        : { memberId: member._id };
      const royaltyFilter = legacyRoyaltyClause
        ? { $or: [{ memberId: member._id }, legacyRoyaltyClause] }
        : { memberId: member._id };

      const ops = [
        Lead.updateMany(leadFilter, { $set: { name: newName, memberId: member._id } }),
        OnboardingEntry.updateMany(onbFilter, { $set: { name: newName, memberId: member._id } }),
        Royalty.updateMany(royaltyFilter, { $set: { clientName: newName, memberId: member._id } }),
      ];

      // SocietyRegistration has no email/memberId — still name-keyed via alias match.
      // ClientMessage has clientId (memberId ref). Prefer that; fall back to alias match.
      const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const aliasSet = new Set(uniqueAliases.map(normName).filter(Boolean));

      const regDocs = await SocietyRegistration.find({}, { _id: 1, name: 1 }).lean();
      const regIds = regDocs.filter((r) => aliasSet.has(normName(r.name))).map((r) => r._id);
      if (regIds.length) ops.push(SocietyRegistration.updateMany({ _id: { $in: regIds } }, { $set: { name: newName } }));

      ops.push(ClientMessage.updateMany({ clientId: member._id }, { $set: { clientName: newName } }));

      // Email / phone propagation — memberId-linked rows only. Never touch orphan rows
      // matched by the OLD email; those stay as-is until someone interacts with them
      // and the pre-save hook re-resolves the Member.
      const newEmailLc = (member.email || '').toLowerCase();
      const emailChanged = newEmailLc !== oldEmail;
      const newPhone = member.phone || '';
      const phoneChanged = newPhone !== oldPhone;

      if (emailChanged) {
        ops.push(Lead.updateMany({ memberId: member._id }, { $set: { email: newEmailLc } }));
        ops.push(OnboardingEntry.updateMany({ memberId: member._id }, { $set: { email: newEmailLc } }));
        ops.push(Royalty.updateMany({ memberId: member._id }, { $set: { clientEmail: newEmailLc } }));
      }
      if (phoneChanged) {
        ops.push(Lead.updateMany({ memberId: member._id }, { $set: { phone: newPhone } }));
        ops.push(OnboardingEntry.updateMany({ memberId: member._id }, { $set: { phone: newPhone } }));
      }

      const results = await Promise.all(ops);
      if (results.some((r) => r && r.modifiedCount > 0) || regIds.length) {
        console.log(`Member sync → "${newName}" memberId=${member._id} sharesEmail=${sharesEmail} societyMatches=${regIds.length} emailChanged=${emailChanged} phoneChanged=${phoneChanged}`);
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
    const escapedAliases = uniqueAliases.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    );
    const nameRx = escapedAliases.length ? new RegExp(`^\\s*(${escapedAliases.join('|')})\\s*$`, 'i') : null;
    const emailLc = (member.email || '').toLowerCase();

    const sharesEmail = emailLc
      ? (await Member.countDocuments({ email: emailLc, _id: { $ne: member._id } })) > 0
      : false;

    const legacyLeadClause = emailLc
      ? (sharesEmail && nameRx ? { memberId: null, email: emailLc, name: nameRx } : { memberId: null, email: emailLc })
      : (nameRx ? { memberId: null, name: nameRx } : null);
    const legacyRoyaltyClause = emailLc
      ? (sharesEmail && nameRx ? { memberId: null, clientEmail: emailLc, clientName: nameRx } : { memberId: null, clientEmail: emailLc })
      : (nameRx ? { memberId: null, clientName: nameRx } : null);

    const leadFilter = legacyLeadClause
      ? { $or: [{ memberId: member._id }, legacyLeadClause] }
      : { memberId: member._id };
    const onboardFilter = legacyLeadClause
      ? { $or: [{ memberId: member._id }, legacyLeadClause] }
      : { memberId: member._id };
    const royaltyFilter = legacyRoyaltyClause
      ? { $or: [{ memberId: member._id }, legacyRoyaltyClause] }
      : { memberId: member._id };

    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const aliasSet = new Set(uniqueAliases.map(norm).filter(Boolean));

    const allRegs = await SocietyRegistration.find({}, { _id: 1, name: 1 }).lean();
    const matchedRegIds = allRegs.filter((r) => aliasSet.has(norm(r.name))).map((r) => r._id);
    const societyRes = matchedRegIds.length
      ? await SocietyRegistration.updateMany({ _id: { $in: matchedRegIds } }, { $set: { name: newName } })
      : { modifiedCount: 0 };

    const msgRes = await ClientMessage.updateMany({ clientId: member._id }, { $set: { clientName: newName } });

    const [leadsRes, onbRes, royRes] = await Promise.all([
      Lead.updateMany(leadFilter, { $set: { name: newName, memberId: member._id } }),
      OnboardingEntry.updateMany(onboardFilter, { $set: { name: newName, memberId: member._id } }),
      Royalty.updateMany(royaltyFilter, { $set: { clientName: newName, memberId: member._id } }),
    ]);

    console.log(`Sync name → "${newName}" memberId=${member._id} sharesEmail=${sharesEmail} societyMatches=${matchedRegIds.length}`);
    res.json({
      member,
      synced: {
        leads: leadsRes.modifiedCount ?? 0,
        onboarding: onbRes.modifiedCount ?? 0,
        societyRegs: societyRes.modifiedCount ?? 0,
        royalties: royRes.modifiedCount ?? 0,
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
