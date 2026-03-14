const express = require('express');
const multer = require('multer');
const SocietyRegistration = require('../models/SocietyRegistration');
const Task = require('../models/Task');
const OnboardingEntry = require('../models/OnboardingEntry');
const Member = require('../models/Member');
const { auth } = require('../middleware/auth');
const { uploadFile } = require('../utils/gdrive');
const notify = require('../utils/notify');

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/* ─── Sync helpers ─── */

// Sync deadline from society entry → matching tracker task(s)
const syncDeadlineToTracker = async (regId, society, deadline) => {
  try {
    const escapedSociety = society.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await Task.updateMany(
      { sourceType: 'societyreg', sourceId: regId, title: { $regex: escapedSociety, $options: 'i' } },
      { $set: { deadline: deadline ? new Date(deadline) : null } }
    );
  } catch (err) { console.error('syncDeadlineToTracker error:', err); }
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

// Sync society registration count to Member model
const syncRegistrationsToMember = async (memberName) => {
  try {
    const reg = await SocietyRegistration.findOne({ name: memberName });
    if (!reg) return;
    let count = 0;
    for (const [, entry] of reg.societies) {
      if (entry.status && entry.status !== 'N/A') count++;
    }
    await Member.updateOne({ name: memberName }, { $set: { registrations: count } });
  } catch (err) { console.error('syncRegistrationsToMember error:', err); }
};

// GET /api/societyregs
router.get('/', auth, async (req, res) => {
  try {
    const registrations = await SocietyRegistration.find().sort({ createdAt: -1 });

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
    const { member, society, ipi, spoc, notes, deadline } = req.body;
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

    // Auto-create a Tracker task for the new registration
    try {
      await Task.create({
        title: `Society registration — ${member} — ${society}`,
        date: new Date(),
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

    const { society, status, assignee, deadline } = req.body;

    if (society && status) {
      const existing = reg.societies.get(society);
      const existingObj = existing ? existing.toObject() : {};
      reg.societies.set(society, {
        status,
        assignee: assignee || existingObj.assignee || {},
        deadline: deadline ? new Date(deadline) : existingObj.deadline || null,
        steps: existingObj.steps || {},
        remarks: existingObj.remarks || [],
      });
    } else {
      // Update deadline or assignee without changing status
      if (society && deadline !== undefined) {
        const existing = reg.societies.get(society);
        if (existing) {
          const existingObj = existing.toObject();
          reg.societies.set(society, { ...existingObj, deadline: deadline ? new Date(deadline) : null });
        }
      }
    }
    if (society && assignee) {
      reg.assignees.set(society, assignee);
    }

    await reg.save();

    // Sync deadline changes → tracker task(s)
    if (society && deadline !== undefined) {
      const entry = reg.societies.get(society);
      const dl = entry ? (entry.toObject ? entry.toObject() : entry).deadline : (deadline || null);
      syncDeadlineToTracker(reg._id, society, dl);
    }

    // Sync new society → onboarding selectedSocieties
    if (society && status === 'In Progress') {
      syncSocietyToOnboarding(reg.name, society);
    }

    // Sync registration count → Member
    if (society && status) {
      syncRegistrationsToMember(reg.name);
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
        await Task.create({
          title: `Society Reg — ${reg.name} — ${society}`,
          date: new Date(),
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

// POST /api/societyregs/:id/upload — upload file for "Application Sent to Society" step
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const reg = await SocietyRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    const { society } = req.body;
    if (!society) return res.status(400).json({ message: 'Society is required' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

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
    const driveName = `SocietyReg_${reg.name}_${society}`;
    const driveResult = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, driveName, { subFolder: 'Society' });
    const entryObj = entry.toObject();
    const steps = entryObj.steps || {};
    steps.applicationSentFileUrl = driveResult.webViewLink || '';
    steps.applicationSentFileName = req.file.originalname;
    steps.applicationSentGdriveFileId = driveResult.fileId || '';

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

// DELETE /api/societyregs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const reg = await SocietyRegistration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    // Remove linked Tracker tasks
    await Task.deleteMany({ sourceType: 'societyreg', sourceId: String(reg._id) });

    res.json({ message: 'Registration deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
