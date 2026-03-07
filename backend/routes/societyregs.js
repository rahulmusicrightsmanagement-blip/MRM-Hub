const express = require('express');
const multer = require('multer');
const SocietyRegistration = require('../models/SocietyRegistration');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const { uploadFile } = require('../utils/gdrive');

const router = express.Router();

// Helper: current time in HH:mm (IST)
const nowHHmm = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/societyregs
router.get('/', auth, async (req, res) => {
  try {
    const registrations = await SocietyRegistration.find().sort({ createdAt: -1 });
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

    reg.societies.set(society, { status: 'In Progress', assignee: {}, steps: {}, remarks: [] });

    if (spoc) {
      reg.assignees.set(society, {
        name: spoc,
        initials: spoc.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
        color: '#6366f1',
      });
    }

    await reg.save();

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

    const { society, status, assignee } = req.body;
    if (society && status) {
      const existing = reg.societies.get(society);
      const existingObj = existing ? existing.toObject() : {};
      reg.societies.set(society, {
        status,
        assignee: existingObj.assignee || {},
        steps: existingObj.steps || {},
        remarks: existingObj.remarks || [],
      });
    }
    if (society && assignee) {
      reg.assignees.set(society, assignee);
    }

    await reg.save();
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

    // Upload to Google Drive
    const driveResult = await uploadFile(req.file, `SocietyReg_${reg.name}_${society}`);
    const entryObj = entry.toObject();
    const steps = entryObj.steps || {};
    steps.applicationSentFileUrl = driveResult.webViewLink || '';
    steps.applicationSentFileName = req.file.originalname;
    steps.applicationSentGdriveFileId = driveResult.id || '';

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
