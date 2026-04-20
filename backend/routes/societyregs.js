const express = require('express');
const multer = require('multer');
const SocietyRegistration = require('../models/SocietyRegistration');
const Task = require('../models/Task');
const OnboardingEntry = require('../models/OnboardingEntry');
const Member = require('../models/Member');
const { auth } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadSanitizer');
const { uploadFile } = require('../utils/gdrive');
const notify = require('../utils/notify');

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

/* ─── Sync helpers ─── */

// Build a regex that matches a society key at a word boundary (so "PRS" doesn't match "IPRS")
const societyTitleRegex = (society) => {
  const esc = society.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, 'i');
};

// Sync deadline/startDate from society entry → matching tracker task(s).
// task.date always follows startDate (the day work begins) so the Tracker
// stacks tasks on the day they were scheduled to start. deadline drives the
// colour/overdue badge separately.
const syncDeadlineToTracker = async (regId, society, deadline, startDate) => {
  try {
    const update = {};
    if (deadline !== undefined) update.deadline = deadline ? new Date(deadline) : null;
    if (startDate !== undefined && startDate) update.date = new Date(startDate);
    if (!Object.keys(update).length) return;
    await Task.updateMany(
      { sourceType: 'societyreg', sourceId: String(regId), title: societyTitleRegex(society) },
      { $set: update }
    );
  } catch (err) { console.error('syncDeadlineToTracker error:', err); }
};

// Mark tracker task(s) completed/pending based on society status
const syncTaskCompletion = async (regId, society, completed) => {
  try {
    await Task.updateMany(
      { sourceType: 'societyreg', sourceId: String(regId), title: societyTitleRegex(society) },
      { $set: { completed: !!completed } }
    );
  } catch (err) { console.error('syncTaskCompletion error:', err); }
};

// Add society to onboarding entry's selectedSocieties (if entry exists)
const syncSocietyToOnboarding = async (memberName, society) => {
  try {
    const entry = await OnboardingEntry.findOne({ name: memberName });
    if (entry && !entry.selectedSocieties.includes(society)) {
      entry.selectedSocieties.push(society);
      await entry.save();
    }
  } catch (err) { console.error('syncSocietyToOnboarding error:', err); }
};

// Remove society from onboarding entry's selectedSocieties (if entry exists)
const removeSocietyFromOnboarding = async (memberName, society) => {
  try {
    const entry = await OnboardingEntry.findOne({ name: memberName });
    if (entry && entry.selectedSocieties.includes(society)) {
      entry.selectedSocieties = entry.selectedSocieties.filter((s) => s !== society);
      await entry.save();
    }
  } catch (err) { console.error('removeSocietyFromOnboarding error:', err); }
};

// Clear all selectedSocieties on onboarding entry (used when whole reg is deleted)
const clearOnboardingSocieties = async (memberName) => {
  try {
    const entry = await OnboardingEntry.findOne({ name: memberName });
    if (entry && entry.selectedSocieties.length) {
      entry.selectedSocieties = [];
      await entry.save();
    }
  } catch (err) { console.error('clearOnboardingSocieties error:', err); }
};

// Sync society registration count to Member model
const syncRegistrationsToMember = async (memberName) => {
  try {
    const reg = await SocietyRegistration.findOne({ name: memberName });
    if (!reg) return;
    let count = 0;
    const entries = reg.societies instanceof Map ? reg.societies.values() : Object.values(reg.societies);
    for (const entry of entries) {
      if (entry.status && entry.status !== 'N/A') count++;
    }
    await Member.updateOne({ name: memberName }, { $set: { registrations: count } });
  } catch (err) { console.error('syncRegistrationsToMember error:', err); }
};

// GET /api/societyregs
router.get('/', auth, async (req, res) => {
  try {
    const registrations = await SocietyRegistration.find().sort({ createdAt: -1 }).lean();

    // View access: all authenticated users can see all registrations.
    // Edit access is controlled on write endpoints (steps/remarks/upload, etc.).
    res.json({ registrations });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/societyregs — start a new registration for a member+society
router.post('/', auth, async (req, res) => {
  try {
    const { member, society, ipi, spoc, notes, deadline, startDate } = req.body;
    if (!member || !society) return res.status(400).json({ message: 'Member and society are required' });

    let reg = await SocietyRegistration.findOne({ name: member });
    if (!reg) {
      reg = new SocietyRegistration({ name: member, societies: new Map(), assignees: new Map() });
    }

    const assigneeObj = spoc ? {
      name: spoc,
      initials: spoc.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      color: '#6366f1',
    } : {};

    reg.societies.set(society, {
      status: 'In Progress',
      assignee: assigneeObj,
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      steps: {},
      remarks: [],
    });

    if (spoc) {
      reg.assignees.set(society, assigneeObj);
    }

    await reg.save();

    // Notify assigned SPOC
    if (spoc) {
      notify({
        recipientName: spoc,
        type: 'society_assigned',
        title: 'Society registration assigned',
        message: `Society "${society}" for member "${member}" has been assigned to you.`,
        relatedType: 'societyreg',
        relatedId: reg._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    // Auto-create a Tracker task for the new registration.
    // task.date = startDate (preferred) or creation date — deadline drives colour only, not placement.
    try {
      await Task.create({
        title: `Society Reg — ${member} — ${society}`,
        date: startDate ? new Date(startDate) : new Date(),
        startTime: nowHHmm(),
        duration: 45,
        category: 'Registration',
        priority: 'Medium',
        spoc: spoc || '',
        assignedDate: spoc ? new Date() : null,
        deadline: deadline ? new Date(deadline) : null,
        sourceType: 'societyreg',
        sourceId: reg._id,
        createdBy: req.user?.id,
      });
    } catch (taskErr) {
      console.error('Auto-create tracker task (society reg) error:', taskErr);
    }

    // Sync society → onboarding selectedSocieties
    syncSocietyToOnboarding(member, society);

    // Sync registration count → Member
    syncRegistrationsToMember(member);

    res.status(201).json({ registration: reg });
  } catch (err) {
    console.error('Create registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/societyregs/:id — update a society's status or assignee
router.put('/:id', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society, status, assignee, deadline, startDate } = req.body;

    if (society && status) {
      const existing = reg.societies.get(society);
      const existingObj = existing ? existing.toObject() : {};
      reg.societies.set(society, {
        status,
        assignee: assignee || existingObj.assignee || {},
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existingObj.startDate || null,
        deadline: deadline ? new Date(deadline) : existingObj.deadline || null,
        steps: existingObj.steps || {},
        remarks: existingObj.remarks || [],
      });
    } else {
      // Update deadline / startDate / assignee without changing status
      if (society && (deadline !== undefined || startDate !== undefined)) {
        const existing = reg.societies.get(society);
        if (existing) {
          const existingObj = existing.toObject();
          reg.societies.set(society, {
            ...existingObj,
            ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
            ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
          });
        }
      }
    }
    if (society && assignee) {
      reg.assignees.set(society, assignee);
    }

    await reg.save();

    // Sync deadline/startDate changes → tracker task(s) (also repositions task.date)
    if (society && (deadline !== undefined || startDate !== undefined)) {
      const entry = reg.societies.get(society);
      const entryObj = entry ? (entry.toObject ? entry.toObject() : entry) : {};
      const dl = deadline !== undefined ? (deadline || null) : (entryObj.deadline || null);
      const sd = startDate !== undefined ? (startDate || null) : (entryObj.startDate || null);
      syncDeadlineToTracker(reg._id, society, dl, sd);
    }

    // Sync status → tracker task completion (Registered = done, others = pending)
    if (society && status) {
      syncTaskCompletion(reg._id, society, status === 'Registered');
    }

    // Sync new society → onboarding selectedSocieties
    if (society && status === 'In Progress') {
      syncSocietyToOnboarding(reg.name, society);
    }

    // Sync registration count → Member
    if (society && status) {
      syncRegistrationsToMember(reg.name);
    }

    // Notify on status change (Registered, Not Started, etc.)
    if (society && status) {
      const entryAssignee = reg.societies.get(society)?.assignee?.name;
      if (entryAssignee) {
        notify({
          recipientName: entryAssignee,
          type: 'status_changed',
          title: `${society} status → ${status}`,
          message: `Society "${society}" for "${reg.name}" is now ${status}.`,
          relatedType: 'societyreg',
          relatedId: reg._id.toString(),
          triggeredBy: req.user.name,
          triggeredById: req.user._id,
        });
      }
    }

    // Auto-create a Tracker task when assigning (status = 'In Progress' + assignee)
    if (society && status === 'In Progress' && assignee && assignee.name) {
      // Notify assignee
      notify({
        recipientName: assignee.name,
        type: 'society_assigned',
        title: 'Society registration assigned',
        message: `Society "${society}" for member "${reg.name}" has been assigned to you.`,
        relatedType: 'societyreg',
        relatedId: reg._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });

      try {
        const entrySnap = reg.societies.get(society);
        const effStart = startDate !== undefined ? startDate : (entrySnap?.startDate || null);
        await Task.create({
          title: `Society Reg — ${reg.name} — ${society}`,
          date: effStart ? new Date(effStart) : new Date(),
          startTime: nowHHmm(),
          duration: 45,
          category: 'Registration',
          priority: 'Medium',
          spoc: assignee.name,
          assignedDate: new Date(),
          deadline: deadline ? new Date(deadline) : null,
          sourceType: 'societyreg',
          sourceId: reg._id,
          createdBy: req.user?.id,
        });
      } catch (taskErr) {
        console.error('Auto-create tracker task (society assign) error:', taskErr);
      }
    }

    res.json({ registration: reg });
  } catch (err) {
    console.error('Update registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/societyregs/:id/steps — update steps for a society
router.put('/:id/steps', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society, steps } = req.body;
    if (!society || !steps) return res.status(400).json({ message: 'Society and steps are required' });

    const entry = reg.societies.get(society);
    if (!entry) return res.status(404).json({ message: 'Society entry not found' });

    // RBAC: only the assigned SPOC or an admin can edit steps
    if (!req.user.hasRole('admin')) {
      const assigneeName = entry.assignee?.name || '';
      if (!assigneeName || assigneeName !== req.user.name) {
        return res.status(403).json({ message: 'You are not assigned to this task' });
      }
    }

    const entryObj = entry.toObject();
    const currentSteps = entryObj.steps || {};
    const updatedSteps = { ...currentSteps, ...steps };

    reg.societies.set(society, {
      ...entryObj,
      steps: updatedSteps,
    });

    await reg.save();
    res.json({ registration: reg });
  } catch (err) {
    console.error('Update steps error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/societyregs/:id/remarks — add a remark to a society
router.post('/:id/remarks', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society, text } = req.body;
    if (!society || !text) return res.status(400).json({ message: 'Society and text are required' });

    const entry = reg.societies.get(society);
    if (!entry) return res.status(404).json({ message: 'Society entry not found' });

    // RBAC: only the assigned SPOC or an admin can add remarks
    if (!req.user.hasRole('admin')) {
      const assigneeName = entry.assignee?.name || '';
      if (!assigneeName || assigneeName !== req.user.name) {
        return res.status(403).json({ message: 'You are not assigned to this task' });
      }
    }

    const entryObj = entry.toObject();
    const remarks = entryObj.remarks || [];
    remarks.push({ text, createdAt: new Date() });

    reg.societies.set(society, { ...entryObj, remarks });

    await reg.save();

    // Notify the assignee about the new remark
    const assigneeName = entryObj.assignee?.name;
    if (assigneeName) {
      notify({
        recipientName: assigneeName,
        type: 'remark_added',
        title: `New remark on ${society} — ${reg.name}`,
        message: text.length > 80 ? text.slice(0, 80) + '...' : text,
        relatedType: 'societyreg',
        relatedId: reg._id.toString(),
        triggeredBy: req.user.name,
        triggeredById: req.user._id,
      });
    }

    res.json({ registration: reg });
  } catch (err) {
    console.error('Add remark error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/societyregs/:id/remarks — delete a remark
router.delete('/:id/remarks', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society, remarkId } = req.body;
    if (!society || !remarkId) return res.status(400).json({ message: 'Society and remarkId are required' });

    const entry = reg.societies.get(society);
    if (!entry) return res.status(404).json({ message: 'Society entry not found' });

    // RBAC: only the assigned SPOC or an admin can delete remarks
    if (!req.user.hasRole('admin')) {
      const assigneeName = entry.assignee?.name || '';
      if (!assigneeName || assigneeName !== req.user.name) {
        return res.status(403).json({ message: 'You are not assigned to this task' });
      }
    }

    const entryObj = entry.toObject();
    entryObj.remarks = (entryObj.remarks || []).filter((r) => r._id.toString() !== remarkId);
    reg.societies.set(society, entryObj);

    await reg.save();
    res.json({ registration: reg });
  } catch (err) {
    console.error('Delete remark error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mapping from step key to file field prefix
const STEP_FILE_PREFIXES = {
  nocReceived: 'nocReceived',
  applicationSentToSociety: 'applicationSent',
  thirdPartyAuthorization: 'thirdPartyAuth',
  bankMandateUpdate: 'bankMandate',
};

// Readable names for each step (used in uploaded file names)
const STEP_DISPLAY_NAMES = {
  nocReceived: 'NOC',
  applicationSentToSociety: 'Application_Sent_To_Society',
  thirdPartyAuthorization: 'Third_Party_Authorization',
  bankMandateUpdate: 'Bank_Mandate_Update',
};

// POST /api/societyregs/:id/upload — upload file for a step
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society, stepKey } = req.body;
    if (!society) return res.status(400).json({ message: 'Society is required' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const prefix = STEP_FILE_PREFIXES[stepKey] || STEP_FILE_PREFIXES.applicationSentToSociety;

    const entry = reg.societies.get(society);
    if (!entry) return res.status(404).json({ message: 'Society entry not found' });

    // RBAC: only the assigned SPOC or an admin can upload documents
    if (!req.user.hasRole('admin')) {
      const assigneeName = entry.assignee?.name || '';
      if (!assigneeName || assigneeName !== req.user.name) {
        return res.status(403).json({ message: 'You are not assigned to this task' });
      }
    }

    // Upload to Google Drive → Society sub-folder
    const stepLabel = STEP_DISPLAY_NAMES[stepKey] || stepKey;
    const ext = require('path').extname(req.file.originalname);
    const driveName = `Society_Registration_${stepLabel}_${reg.name}${ext}`;
    const driveResult = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, driveName, { subFolder: 'Society' });
    const entryObj = entry.toObject();
    const steps = entryObj.steps || {};
    steps[`${prefix}FileUrl`] = driveResult.webViewLink || '';
    steps[`${prefix}FileName`] = req.file.originalname;
    steps[`${prefix}GdriveFileId`] = driveResult.fileId || '';

    reg.societies.set(society, { ...entryObj, steps });

    await reg.save();
    res.json({ registration: reg });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// PUT /api/societyregs/:id/rename — rename a member registration
router.put('/:id/rename', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

    reg.name = name.trim();
    await reg.save();
    res.json({ registration: reg });
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/societyregs/:id/society — remove a single society from a member's registration
router.delete('/:id/society', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society } = req.body;
    if (!society) return res.status(400).json({ message: 'Society is required' });

    if (!reg.societies.has(society)) return res.status(404).json({ message: 'Society entry not found' });

    reg.societies.delete(society);
    reg.assignees.delete(society);
    await reg.save();

    // Remove linked Tracker tasks for this society (word-boundary match to avoid PRS/IPRS collision)
    await Task.deleteMany({ sourceType: 'societyreg', sourceId: String(reg._id), title: societyTitleRegex(society) });

    // Sync registration count → Member
    syncRegistrationsToMember(reg.name);

    // Sync removal → onboarding selectedSocieties
    removeSocietyFromOnboarding(reg.name, society);

    res.json({ registration: reg });
  } catch (err) {
    console.error('Delete society error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/societyregs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    // Remove linked Tracker tasks
    await Task.deleteMany({ sourceType: 'societyreg', sourceId: String(reg._id) });

    // Clear onboarding selectedSocieties for this member
    clearOnboardingSocieties(reg.name);

    // Sync registration count → Member
    syncRegistrationsToMember(reg.name);

    res.json({ message: 'Registration deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
