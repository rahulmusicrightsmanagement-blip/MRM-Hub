/**
 * Bulk Import Script
 * Reads a CSV file and inserts rows into:
 *   1. leads (stage: Qualified Lead, call done, meeting NA, both verified, movedToOnboarding)
 *   2. onboarding_entries (stage: Document Submission)
 *   3. members (status: Onboarding)
 *
 * Usage: node scripts/bulkImport.js <path-to-csv>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const Member = require('../models/Member');

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Usage: node scripts/bulkImport.js <path-to-csv>');
  process.exit(1);
}

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  // Clean BOM and non-breaking spaces from headers
  const headers = lines[0].split(',').map((h) => h.replace(/\uFEFF/g, '').replace(/\u00C2/g, '').replace(/\u00A0/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    if (row.Name && row.Email) rows.push(row);
  }
  return rows;
}

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows from CSV\n`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = row.Email.toLowerCase().trim();
    const name = row.Name.trim();
    const phone = row.Phone || 'NA';
    const genre = row.Genre || 'NA';
    const languages = row.Languages || 'NA';
    const bio = row.Bio || 'NA';
    const leadSource = row.LeadSource || 'NA';
    const priority = (row.Priority || 'medium').toLowerCase();
    const spoc = row.SPOC || '';
    const isReferred = (row.IsReferred || '').toLowerCase() === 'yes';
    const referredBy = row.ReferredBy || '';
    const referralCommission = row.ReferralCommission || '';
    const color = COLORS[created % COLORS.length];
    const init = initials(name);
    const now = new Date();

    // Check for duplicates
    const existingLead = await Lead.findOne({ email });
    const existingMember = await Member.findOne({ email });
    const existingOnboarding = await OnboardingEntry.findOne({ email });

    if (existingLead || existingMember || existingOnboarding) {
      console.log(`SKIP: ${name} (${email}) — already exists`);
      skipped++;
      continue;
    }

    // 1. Create Lead — fully qualified, moved to onboarding
    await Lead.create({
      name,
      initials: init,
      color,
      genre,
      email,
      phone,
      source: leadSource,
      priority,
      stage: 'Qualified Lead',
      spoc,
      assignedDate: now,
      notes: bio,
      callDone: true,
      inquiryNotes: 'NA',
      meetingDate: 'NA',
      meetingLink: 'NA',
      meetingAssignedWith: 'NA',
      meetingNotes: 'NA',
      inquiryVerified: true,
      meetingVerified: true,
      movedToOnboarding: true,
      onboardingSpoc: spoc,
      onboardingContractType: 'Retailer',
      onboardedAt: now,
    });

    // 2. Create Onboarding Entry — Document Submission stage
    await OnboardingEntry.create({
      name,
      initials: init,
      color,
      email,
      phone,
      contractType: 'Retailer',
      stage: 'Document Submission',
      documents: [
        { docType: 'aadhaar', label: 'Aadhaar Card', requested: false, received: false },
        { docType: 'pan', label: 'PAN Card', requested: false, received: false },
      ],
      spoc,
      assignedDate: now,
      notes: bio,
      priority,
    });

    // 3. Create Member — Onboarding status
    await Member.create({
      name,
      initials: init,
      color,
      role: genre ? genre.split(',').map((g) => g.trim()) : [],
      email,
      phone,
      genre,
      languages,
      bio,
      status: 'Onboarding',
      kycStatus: 'Pending',
      leadSource,
      priority,
      spoc,
      assignedDate: now,
      dateOfFirstContact: now.toISOString().split('T')[0],
      isReferred,
      referredBy,
      referralCommission,
    });

    console.log(`OK: ${name} (${email}) — Lead + Onboarding + Member created`);
    created++;
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
