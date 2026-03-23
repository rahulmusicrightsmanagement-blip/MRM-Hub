const express = require('express');
const multer = require('multer');
const Royalty = require('../models/Royalty');
const { auth } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadSanitizer');
const { uploadFileMusic } = require('../utils/gdrive');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GET /api/royalty
router.get('/', auth, async (req, res) => {
  try {
    const clients = await Royalty.find().sort({ createdAt: -1 }).lean();
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/royalty — create a new royalty client (from completed onboarding)
router.post('/', auth, async (req, res) => {
  try {
    const { clientName, clientEmail, onboardingId } = req.body;
    if (!clientName) return res.status(400).json({ message: 'Client name is required' });

    // Check if client already exists
    const existing = await Royalty.findOne({ clientName: clientName.trim() });
    if (existing) return res.status(400).json({ message: 'Client already exists in Music Works' });

    const currentYear = new Date().getFullYear();
    const client = new Royalty({
      clientName: clientName.trim(),
      clientEmail: clientEmail || '',
      onboardingId: onboardingId || null,
      years: [{ year: currentYear, months: new Map() }],
    });

    // Initialize all months for the default year
    MONTHS.forEach((mon) => {
      client.years[0].months.set(mon, {});
    });

    await client.save();
    res.status(201).json({ client });
  } catch (err) {
    console.error('Create royalty client error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/royalty/:id — update client fields (documentsReceived, etc.)
router.put('/:id', auth, async (req, res) => {
  try {
    const client = await Royalty.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    if (req.body.documentsReceived !== undefined) client.documentsReceived = req.body.documentsReceived;

    await client.save();
    res.json({ client });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/royalty/:id/years — add a year (above or below)
router.post('/:id/years', auth, async (req, res) => {
  try {
    const client = await Royalty.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const { year } = req.body;
    if (!year) return res.status(400).json({ message: 'Year is required' });

    // Check if year already exists
    if (client.years.some((y) => y.year === year)) {
      return res.status(400).json({ message: `Year ${year} already exists` });
    }

    const monthsMap = new Map();
    MONTHS.forEach((mon) => monthsMap.set(mon, {}));

    client.years.push({ year, months: monthsMap });
    // Sort years ascending
    client.years.sort((a, b) => a.year - b.year);

    await client.save();
    res.json({ client });
  } catch (err) {
    console.error('Add year error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/royalty/:id/months — update month data for a specific year+month
router.put('/:id/months', auth, async (req, res) => {
  try {
    const client = await Royalty.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const { year, month, data } = req.body;
    if (!year || !month || !data) return res.status(400).json({ message: 'year, month, and data are required' });

    const yearEntry = client.years.find((y) => y.year === year);
    if (!yearEntry) return res.status(404).json({ message: `Year ${year} not found` });

    const existing = yearEntry.months.get(month);
    const existingObj = existing ? existing.toObject() : {};
    yearEntry.months.set(month, { ...existingObj, ...data });
    client.markModified('years');

    await client.save();
    res.json({ client });
  } catch (err) {
    console.error('Update month data error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/royalty/:id/upload — upload file for a specific year+month
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const client = await Royalty.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ message: 'year and month are required' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const yearEntry = client.years.find((y) => y.year === Number(year));
    if (!yearEntry) return res.status(404).json({ message: `Year ${year} not found` });

    // Upload to Music Drive (separate GDrive account)
    const driveResult = await uploadFileMusic(req.file.buffer, req.file.originalname, req.file.mimetype, `Royalty_${client.clientName}_${year}_${month}`);

    const existing = yearEntry.months.get(month);
    const existingObj = existing ? existing.toObject() : {};
    yearEntry.months.set(month, {
      ...existingObj,
      fileUrl: driveResult.webViewLink || '',
      fileName: req.file.originalname,
    });
    client.markModified('years');
    await client.save();
    const saved = await Royalty.findById(req.params.id);
    res.json({ client: saved });
  } catch (err) {
    console.error('Upload royalty file error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// POST /api/royalty/:id/upload-document — upload client-level document to GDrive
router.post('/:id/upload-document', auth, upload.single('file'), async (req, res) => {
  try {
    const client = await Royalty.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const driveResult = await uploadFileMusic(req.file.buffer, req.file.originalname, req.file.mimetype, `Documents_${client.clientName}`);

    client.documentFileName = req.file.originalname;
    client.documentFileUrl = driveResult.webViewLink || '';

    await client.save();
    res.json({ client });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// DELETE /api/royalty/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Royalty.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
