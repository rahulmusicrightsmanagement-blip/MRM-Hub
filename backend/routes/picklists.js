const express = require('express');
const router = express.Router();
const Picklist = require('../models/Picklist');
const { auth, adminOnly } = require('../middleware/auth');

const SUPER_ADMIN_EMAIL = 'rahuljadhav0417@gmail.com';

// Default picklist data used for seeding
const DEFAULTS = {
  lead_stage: {
    label: 'Lead Stage',
    values: ['New Enquiry', 'Meeting Set', 'Qualified Lead', 'Not Qualified'],
  },
  lead_source: {
    label: 'Lead Source',
    values: ['Website Form', 'LinkedIn Outreach', 'Instagram DM', 'Industry Event', 'Referral', 'Direct Outreach'],
  },
  member_roles: {
    label: 'Member Roles',
    values: ['Singer-Songwriter', 'Playback Singer', 'Composer', 'Lyricist', 'Music Producer', 'Instrumentalist'],
  },
  onboarding_stage: {
    label: 'Onboarding Stage',
    values: ['Document Submission', 'KYC Verification', 'Contract Signing', 'Active Member', 'Contact Made', 'Completed', 'Not Qualified'],
  },
  onboarding_roles: {
    label: 'Onboarding Roles',
    values: ['Singer-Songwriter', 'Music Composer', 'Lyricist', 'Producer', 'Publisher', 'Artist Manager'],
  },
  contract_type: {
    label: 'Contract Type',
    values: ['Retainer', 'Royalty', 'Work-Based', 'Inhouse'],
  },
  renewal_type: {
    label: 'Renewal Type',
    values: ['Auto Renewal', 'Mutual Renewal', 'No Renewal'],
  },
  task_category: {
    label: 'Task Category',
    values: ['Pipeline', 'Onboarding', 'Registration', 'Internal', 'Members'],
  },
  document_types: {
    label: 'Document Types',
    values: ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving License', 'Bank Statement', 'Cancelled Cheque', 'Photograph'],
  },
  societies: {
    label: 'Societies',
    items: [
      { value: 'IPRS',          label: 'Indian Performing Right Society',              metadata: { flag: '🇮🇳' } },
      { value: 'PRS',           label: 'PRS for Music',                                metadata: { flag: '🇬🇧' } },
      { value: 'ASCAP',         label: 'American Society of Composers',                metadata: { flag: '🇺🇸' } },
      { value: 'PPL(INDIA)',    label: 'Phonographic Performance Ltd (India)',          metadata: { flag: '🇮🇳' } },
      { value: 'PPL(UK)',       label: 'Phonographic Performance Ltd (UK)',             metadata: { flag: '🇬🇧' } },
      { value: 'SOUND EXCHANGE',label: 'SoundExchange',                                metadata: { flag: '🇺🇸' } },
      { value: 'ISAMRA',        label: 'Indian Singers & Musicians Rights Association', metadata: { flag: '🇮🇳' } },
      { value: 'BMI',           label: 'Broadcast Music Inc.',                         metadata: { flag: '🇺🇸' } },
      { value: 'GEMA',          label: 'Gesellschaft für musikalische Aufführungs',    metadata: { flag: '🇩🇪' } },
      { value: 'MLC',           label: 'The Mechanical Licensing Collective',          metadata: { flag: '🇺🇸' } },
      { value: 'IMRO',          label: 'Irish Music Rights Organisation',              metadata: { flag: '🇮🇪' } },
      { value: 'SOCAN',         label: 'Society of Composers, Authors',               metadata: { flag: '🇨🇦' } },
    ],
  },
};

// GET /api/picklists — get all active picklist items grouped by category
router.get('/', auth, async (req, res) => {
  try {
    const items = await Picklist.find({ isActive: true }).sort({ category: 1, order: 1, createdAt: 1 });

    // Group by category
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = {
          category: item.category,
          categoryLabel: item.categoryLabel,
          items: [],
        };
      }
      grouped[item.category].items.push({ _id: item._id, value: item.value, label: item.label, order: item.order, metadata: item.metadata || {} });
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/picklists/:category — get items for a specific category
router.get('/:category', auth, async (req, res) => {
  try {
    const items = await Picklist.find({ category: req.params.category, isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(items.map((i) => ({ _id: i._id, value: i.value, label: i.label, order: i.order, metadata: i.metadata || {} })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/picklists — add a new picklist item (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { category, categoryLabel, value, label, order, metadata } = req.body;
    if (!category || !value) return res.status(400).json({ message: 'category and value are required' });

    // Use existing categoryLabel if not provided (for consistency)
    const existingCat = await Picklist.findOne({ category });
    const resolvedCategoryLabel = categoryLabel || existingCat?.categoryLabel || category;

    const item = new Picklist({
      category,
      categoryLabel: resolvedCategoryLabel,
      value: value.trim(),
      label: (label || value).trim(),
      order: order ?? 0,
      metadata: metadata || {},
      createdBy: req.user._id,
    });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This value already exists in the category' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/picklists/:id — update a picklist item (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { value, label, order, isActive } = req.body;
    const item = await Picklist.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (value !== undefined) item.value = value.trim();
    if (label !== undefined) item.label = label.trim();
    if (order !== undefined) item.order = order;
    if (isActive !== undefined) item.isActive = isActive;
    item.updatedBy = req.user._id;

    await item.save();
    res.json(item);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This value already exists in the category' });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/picklists/:id — only rahuljadhav0417@gmail.com can delete
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.user.email !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only the super admin can delete picklist items' });
    }
    const item = await Picklist.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/picklists/seed-defaults — seed default values for all categories (admin only)
router.post('/seed-defaults', auth, adminOnly, async (req, res) => {
  try {
    const { category } = req.body; // optional: seed only one category

    const categoriesToSeed = category ? { [category]: DEFAULTS[category] } : DEFAULTS;
    if (category && !DEFAULTS[category]) {
      return res.status(400).json({ message: 'Unknown category' });
    }

    let inserted = 0;
    let skipped = 0;

    for (const [cat, catDef] of Object.entries(categoriesToSeed)) {
      const catLabel = catDef.label;
      // Support both simple `values` array and rich `items` array (with metadata)
      const itemList = catDef.items
        ? catDef.items
        : (catDef.values || []).map((v) => ({ value: v, label: v, metadata: {} }));

      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];
        const exists = await Picklist.findOne({ category: cat, value: item.value });
        if (exists) { skipped++; continue; }
        await Picklist.create({
          category: cat,
          categoryLabel: catLabel,
          value: item.value,
          label: item.label,
          metadata: item.metadata || {},
          order: i,
        });
        inserted++;
      }
    }

    res.json({ message: `Seeded ${inserted} items, skipped ${skipped} duplicates` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
