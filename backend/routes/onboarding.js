const express = require('express');
const multer = require('multer');
const OnboardingEntry = require('../models/OnboardingEntry');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const Task = require('../models/Task');
const SocietyRegistration = require('../models/SocietyRegistration');
const { auth } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadSanitizer');
const { uploadFile, deleteFile } = require('../utils/gdrive');
const notify = require('../utils/notify');

// Reconcile onboarding selectedSocieties against actual SocietyRegistration entries
const reconcileSelectedSocieties = async (entry) => {
  try {
    if (!entry || !Array.isArray(entry.selectedSocieties) || entry.selectedSocieties.length === 0) return entry;
    const reg = await SocietyRegistration.findOne({ name: entry.name });
    const validKeys = reg
      ? (reg.societies instanceof Map ? Array.from(reg.societies.keys()) : Object.keys(reg.societies || {}))
      : [];
    const filtered = entry.selectedSocieties.filter((k) => validKeys.includes(k));
    if (filtered.length !== entry.selectedSocieties.length) {
      await OnboardingEntry.updateOne({ _id: entry._id }, { $set: { selectedSocieties: filtered } });
      entry.selectedSocieties = filtered;
    }
    return entry;
  } catch (err) { console.error('reconcileSelectedSocieties error:', err); return entry; }
};

// Helper: sync KYC status from onboarding entry to linked Member
const syncKycToMember = async (entry) => {
  try {
    const member = await Member.findOne({ email: entry.email.toLowerCase() });
    if (!member) return;

    const STAGES_PAST_KYC = ['Contract Signing', 'Active Member', 'Contact Made', 'Completed'];
    const allDocsReceived = entry.documents.length > 0 && entry.documents.every(d => d.received);

    if (STAGES_PAST_KYC.includes(entry.stage) || allDocsReceived) {
      if (member.kycStatus !== 'Verified') {
        member.kycStatus = 'Verified';

        // Also sync individual doc verification flags
        const aadhaarDoc = entry.documents.find(d => d.docType === 'aadhaar');
        const panDoc = entry.documents.find(d => d.docType === 'pan');
        if (aadhaarDoc && aadhaarDoc.received) {
          member.aadhaarVerified = true;
          if (aadhaarDoc.docNumber && !member.aadhaar) member.aadhaar = aadhaarDoc.docNumber;
        }
        if (panDoc && panDoc.received) {
          member.panVerified = true;
          if (panDoc.docNumber && !member.panCard) member.panCard = panDoc.docNumber;
        }

        await member.save();
      }
    }
  } catch (err) {
    console.error('syncKycToMember error:', err);
  }
};

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* ─── Multer config (memory — buffer goes to Google Drive) ─── */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter }); // 10 MB

/* ─── GET all entries ─── */
router.get('/', auth, async (req, res) => {
  try {
    // Migrate legacy entries that don't have documents array
    await OnboardingEntry.updateMany(
      { $or: [{ documents: { $exists: false } }, { documents: { $size: 0 } }] },
      { $set: { documents: [
        { _id: new (require('mongoose').Types.ObjectId)(), docType: 'aadhaar', label: 'Aadhaar Card', requested: false, received: false, fileUrl: '', fileName: '' },
        { _id: new (require('mongoose').Types.ObjectId)(), docType: 'pan', label: 'PAN Card', requested: false, received: false, fileUrl: '', fileName: '' },
      ] } }
    );

    const filter = req.user.hasRole('admin') ? {} : { spoc: req.user.name };
    const filtered = await OnboardingEntry.find(filter).sort({ createdAt: -1 }).lean();

    // Sync KYC + reconcile selectedSocieties against SocietyRegistration in parallel
    await Promise.all(filtered.map(async (entry) => {
      await syncKycToMember(entry);
      await reconcileSelectedSocieties(entry);
    }));

    res.json({ entries: filtered });
  } catch (err) {
    console.error('GET onboarding error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─── POST create entry ─── */
router.post('/', auth, async (req, res) => {
  try {
    const { name, role, email, phone, contractType, spoc, notes, priority, deadline } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const entry = new OnboardingEntry({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      color,
      role: role || [],
      phone: phone || '',
      contractType: contractType || 'Retainer',
      spoc: spoc || '',
      assignedDate: spoc ? new Date() : null,
      deadline: deadline ? new Date(deadline) : null,
      notes: notes || '',
      priority: priority || 'medium',
    });

    await entry.save();

    // Notify assigned SPOC
    if (entry.spoc) {
      notify({
        recipientName: entry.spoc,
        type: 'onboarding_assigned',
        title: 'Onboarding entry assigned to you',
        message: `Onboarding for "${entry.name}" has been assigned to you.`,
        relatedType: 'onboarding',
        relatedId: entry._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    // Auto-create a Tracker task for the new onboarding entry
    try {
      await Task.create({
        title: `Onboarding — ${entry.name}`,
        date: new Date(),
        startTime: nowHHmm(),
        duration: 60,
        category: 'Onboarding',
        priority: (entry.priority || 'medium').charAt(0).toUpperCase() + (entry.priority || 'medium').slice(1),
        spoc: entry.spoc || '',
        assignedDate: entry.spoc ? new Date() : null,
        deadline: entry.deadline || null,
        sourceType: 'onboarding',
        sourceId: entry._id,
        createdBy: req.user?.id,
      });
    } catch (taskErr) {
      console.error('Auto-create tracker task (onboarding) error:', taskErr);
    }

    res.status(201).json({ entry });
  } catch (err) {
    console.error('Create onboarding error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ─── PUT update entry ─── */
router.put('/:id', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    // Auto-set assignedDate when spoc changes
    if (req.body.spoc !== undefined && req.body.spoc !== entry.spoc) {
      entry.assignedDate = req.body.spoc ? new Date() : null;

      // Notify new SPOC on reassignment
      if (req.body.spoc) {
        notify({
          recipientName: req.body.spoc,
          type: 'onboarding_assigned',
          title: 'Onboarding reassigned to you',
          message: `Onboarding for "${entry.name}" has been assigned to you.`,
          relatedType: 'onboarding',
          relatedId: entry._id.toString(),
          triggeredBy: req.user.name,
          triggeredById: req.user._id,
        });
      }
    }

    // Uniqueness check for MRM Membership ID
    if (req.body.clientNumber && req.body.clientNumber.trim()) {
      const duplicate = await OnboardingEntry.findOne({
        clientNumber: req.body.clientNumber.trim(),
        _id: { $ne: entry._id },
      });
      if (duplicate) {
        return res.status(409).json({ message: `MRM Membership ID "${req.body.clientNumber.trim()}" is already assigned to ${duplicate.name}` });
      }
      const dupMember = await Member.findOne({ clientNumber: req.body.clientNumber.trim() });
      if (dupMember && dupMember.email !== entry.email) {
        return res.status(409).json({ message: `MRM Membership ID "${req.body.clientNumber.trim()}" is already assigned to member ${dupMember.name}` });
      }
    }

    const oldStage = entry.stage;

    const fields = [
      'name', 'role', 'email', 'phone', 'contractType', 'stage', 'spoc', 'notes', 'priority', 'deadline',
      'contractSent', 'contractReceived', 'contractFileUrl', 'contractFileName', 'contractStartDate', 'contractRenewalDate', 'renewalType', 'renewalRemarks', 'selectedSocieties',
      'addedToWhatsApp', 'whatsAppGroupName', 'emailCreated', 'createdEmailAddress', 'createdEmailPassword', 'clientNumber',
      'previousStage',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) entry[f] = req.body[f];
    });
    if (req.body.deadline) entry.deadline = new Date(req.body.deadline);

    // Handle checklist updates (legacy)
    if (req.body.checklist) {
      Object.keys(req.body.checklist).forEach((key) => {
        entry.checklist[key] = req.body.checklist[key];
      });
      entry.markModified('checklist');
    }

    await entry.save();

    // Sync deadline / spoc changes → linked Tracker tasks
    try {
      const taskUpdate = {};
      if (req.body.deadline !== undefined) taskUpdate.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      if (req.body.spoc !== undefined) taskUpdate.spoc = req.body.spoc || '';
      if (Object.keys(taskUpdate).length) {
        await Task.updateMany({ sourceType: 'onboarding', sourceId: String(entry._id) }, { $set: taskUpdate });
      }
    } catch (syncErr) { console.error('Onboarding→Task sync error:', syncErr); }

    // Sync fields back to Lead and Member
    try {
      const syncToLead = {};
      const syncToMember = {};
      if (req.body.contractType) syncToLead.onboardingContractType = req.body.contractType;
      if (req.body.clientNumber !== undefined) syncToMember.clientNumber = req.body.clientNumber;

      if (Object.keys(syncToLead).length && entry.email) {
        await Lead.updateOne({ email: entry.email }, syncToLead);
      }

      if (Object.keys(syncToMember).length && entry.name) {
        // Match by name (case-insensitive exact) — more reliable than email when multiple members share an email
        const nameRegex = new RegExp(`^${entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        await Member.updateOne({ name: nameRegex }, syncToMember);
      }
    } catch (syncErr) {
      console.error('Sync to lead/member error:', syncErr);
    }

    // Notify SPOC on stage change
    if (req.body.stage && req.body.stage !== oldStage && entry.spoc) {
      notify({
        recipientName: entry.spoc,
        type: 'stage_changed',
        title: `"${entry.name}" moved to ${entry.stage}`,
        message: `Onboarding stage changed from ${oldStage} to ${entry.stage}.`,
        relatedType: 'onboarding',
        relatedId: entry._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    // Sync KYC status to Member when stage advances
    await syncKycToMember(entry);

    res.json({ entry });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.clientNumber) {
      return res.status(409).json({ message: 'This MRM Membership ID is already assigned to another member.' });
    }
    console.error('Update onboarding error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ─── DELETE entry ─── */
router.delete('/:id', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    // Remove linked Tracker tasks
    await Task.deleteMany({ sourceType: 'onboarding', sourceId: String(entry._id) });

    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─── NOT QUALIFIED — move linked lead to Sales NQ & delete onboarding entry ─── */
router.post('/:id/not-qualified', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const { reason } = req.body;

    // Find the lead by email match
    const lead = await Lead.findOne({ email: entry.email.toLowerCase() });
    if (lead) {
      lead.previousStage = lead.stage;
      lead.stage = 'Not Qualified';
      lead.notQualifiedReason = reason || '';
      await lead.save();
    }

    // Remove linked Tracker tasks
    await Task.deleteMany({ sourceType: 'onboarding', sourceId: String(entry._id) });

    // Delete the onboarding entry
    await OnboardingEntry.findByIdAndDelete(req.params.id);

    res.json({ message: 'Moved to Sales Not Qualified', lead: lead || null });
  } catch (err) {
    console.error('Not-qualified error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/onboarding/restart/:leadId — restart onboarding from Sales Not Qualified
router.post('/restart/:leadId', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#6366f1', '#14b8a6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const entry = new OnboardingEntry({
      name: lead.name,
      email: lead.email,
      color,
      phone: lead.phone || '',
      contractType: lead.onboardingContractType || 'Retainer',
      spoc: lead.onboardingSpoc || '',
      assignedDate: lead.onboardingSpoc ? new Date() : null,
      notes: lead.notes || '',
      priority: lead.priority || 'medium',
    });
    await entry.save();

    // Auto-create Tracker task
    const nowHHmm = () => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    await Task.create({
      title: `Onboarding — ${entry.name}`,
      date: new Date(),
      startTime: nowHHmm(),
      duration: 60,
      category: 'Onboarding',
      priority: (entry.priority || 'medium').charAt(0).toUpperCase() + (entry.priority || 'medium').slice(1),
      spoc: entry.spoc || '',
      assignedDate: entry.spoc ? new Date() : null,
      deadline: entry.deadline || null,
      sourceType: 'onboarding',
      sourceId: entry._id,
      createdBy: req.user?.id,
    });

    // Update lead: mark re-onboarded, reset not-qualified state
    lead.movedToOnboarding = true;
    lead.onboardedAt = new Date();
    lead.stage = lead.previousStage || 'Qualified Lead';
    lead.previousStage = '';
    lead.notQualifiedReason = '';
    await lead.save();

    res.json({ entry, lead });
  } catch (err) {
    console.error('Restart onboarding error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════
   DOCUMENTS (stages 1 & 2)
   ═══════════════════════════════════════════════ */

// POST /api/onboarding/:id/documents  — add a new document row
router.post('/:id/documents', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const { label } = req.body;
    if (!label) return res.status(400).json({ message: 'Document label is required' });

    const docType = label.toLowerCase().replace(/\s+/g, '_');
    entry.documents.push({ docType, label, requested: false, received: false });
    await entry.save();
    res.json({ entry });
  } catch (err) {
    console.error('Add document error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// PUT /api/onboarding/:id/documents/:docId  — update flags
router.put('/:id/documents/:docId', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const doc = entry.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (req.body.requested !== undefined) doc.requested = req.body.requested;
    if (req.body.received !== undefined) doc.received = req.body.received;
    if (req.body.docNumber !== undefined) doc.docNumber = req.body.docNumber;
    if (req.body.fileUrl !== undefined) doc.fileUrl = req.body.fileUrl;
    if (req.body.fileName !== undefined) doc.fileName = req.body.fileName;

    await entry.save();

    // Sync KYC status when documents are updated
    await syncKycToMember(entry);

    res.json({ entry });
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// DELETE /api/onboarding/:id/documents/:docId  — remove a custom doc
router.delete('/:id/documents/:docId', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const doc = entry.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.deleteOne();
    await entry.save();
    res.json({ entry });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// POST /api/onboarding/:id/documents/:docId/upload  — upload file for a document
router.post('/:id/documents/:docId/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const doc = entry.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Delete old file from Drive if replacing
    if (doc.gdriveFileId) await deleteFile(doc.gdriveFileId);

    // Build descriptive file name: "Member Name - Doc Label.ext"
    const ext = require('path').extname(req.file.originalname);
    const driveName = `${entry.name} - ${doc.label}${ext}`;
    const gfile = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, driveName, { subFolder: 'Onboarding' });
    doc.fileUrl = gfile.webViewLink;
    doc.fileName = gfile.fileName;
    doc.gdriveFileId = gfile.fileId;
    doc.received = true;
    await entry.save();

    // Notify SPOC about document upload
    if (entry.spoc) {
      notify({
        recipientName: entry.spoc,
        type: 'document_uploaded',
        title: `Document uploaded for "${entry.name}"`,
        message: `${doc.label} has been uploaded.`,
        relatedType: 'onboarding',
        relatedId: entry._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    // Sync KYC status when document is uploaded (marked received)
    await syncKycToMember(entry);

    res.json({ entry });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ═══════════════════════════════════════════════
   CONTRACT (stage 3)
   ═══════════════════════════════════════════════ */

// POST /api/onboarding/:id/contract/upload  — upload signed contract
router.post('/:id/contract/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Delete old contract from Drive if replacing
    if (entry.contractGdriveFileId) await deleteFile(entry.contractGdriveFileId);

    // Build descriptive file name: "Member Name - Contract.ext"
    const ext = require('path').extname(req.file.originalname);
    const driveName = `${entry.name} - Contract${ext}`;
    const gfile = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, driveName, { subFolder: 'Onboarding' });
    entry.contractFileUrl = gfile.webViewLink;
    entry.contractFileName = gfile.fileName;
    entry.contractGdriveFileId = gfile.fileId;
    entry.contractReceived = true;
    await entry.save();
    res.json({ entry });
  } catch (err) {
    console.error('Upload contract error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ═══════════════════════════════════════════════
   SUB-TASKS
   ═══════════════════════════════════════════════ */

router.post('/:id/subtasks', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    entry.subTasks.push({ text: req.body.text, assignee: req.body.assignee || '', done: false });
    await entry.save();

    // Auto-create a Tracker task for the subtask
    try {
      await Task.create({
        title: req.body.text,
        date: new Date(),
        startTime: nowHHmm(),
        duration: 30,
        category: 'Onboarding',
        priority: 'Medium',
        spoc: req.body.assignee || entry.spoc || '',
        assignedDate: (req.body.assignee || entry.spoc) ? new Date() : null,
        deadline: entry.deadline || null,
        sourceType: 'onboarding',
        sourceId: entry._id,
        createdBy: req.user?.id,
      });
    } catch (taskErr) {
      console.error('Auto-create tracker task (onboarding subtask) error:', taskErr);
    }

    res.json({ entry });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/subtasks/:taskId', auth, async (req, res) => {
  try {
    const entry = await OnboardingEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const task = entry.subTasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.body.done !== undefined) task.done = req.body.done;
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;

    await entry.save();
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
