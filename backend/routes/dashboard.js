const express = require('express');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const { auth } = require('../middleware/auth');

const router = express.Router();

/* ─── 12 Collecting Societies (must match SocietyReg page) ─── */
const SOCIETIES = [
  { key: 'IPRS', flag: '🇮🇳' }, { key: 'PRS', flag: '🇬🇧' }, { key: 'ASCAP', flag: '🇺🇸' },
  { key: 'PPL(INDIA)', flag: '🇮🇳' }, { key: 'PPL(UK)', flag: '🇬🇧' }, { key: 'SOUND EXCHANGE', flag: '🇺🇸' },
  { key: 'ISAMRA', flag: '🇮🇳' }, { key: 'BMI', flag: '🇺🇸' }, { key: 'GEMA', flag: '🇩🇪' },
  { key: 'MLC', flag: '🇺🇸' }, { key: 'IMRO', flag: '🇮🇪' }, { key: 'SOCAN', flag: '🇨🇦' },
];

// GET /api/dashboard/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const [members, leads, onboarding, registrations] = await Promise.all([
      Member.find(),
      Lead.find(),
      OnboardingEntry.find(),
      SocietyRegistration.find(),
    ]);

    /* ─── Top-level stats ─── */
    const activeMembers = members.filter((m) => m.status === 'Active').length;
    const totalLeads = leads.length;
    const onboardingCount = onboarding.filter((e) => e.stage !== 'Active Member' && e.stage !== 'Completed').length;

    let registeredCount = 0;
    let inProgressCount = 0;
    registrations.forEach((reg) => {
      if (reg.societies) {
        for (const [, entry] of reg.societies) {
          if (entry.status === 'Registered') registeredCount++;
          if (entry.status === 'In Progress') inProgressCount++;
        }
      }
    });

    /* ─── Sales Pipeline breakdown ─── */
    const pipelineStages = [
      { stage: 'New Enquiry', color: '#3b82f6' },
      { stage: 'Meeting Set', color: '#6366f1' },
      { stage: 'Qualified Lead', color: '#10b981' },
      { stage: 'Not Qualified', color: '#ef4444' },
    ];
    const pipelineData = pipelineStages.map((s) => ({
      ...s,
      count: leads.filter((l) => l.stage === s.stage).length,
    }));

    /* ─── Onboarding breakdown ─── */
    const onboardingStages = [
      { stage: 'Contact Made', color: '#60a5fa' },
      { stage: 'Document Submission', color: '#f59e0b' },
      { stage: 'KYC Verification', color: '#f97316' },
      { stage: 'Contract Signing', color: '#a78bfa' },
      { stage: 'Active Member', color: '#10b981' },
      { stage: 'Completed', color: '#22c55e' },
    ];
    const onboardingData = onboardingStages.map((s) => ({
      ...s,
      count: onboarding.filter((e) => e.stage === s.stage).length,
    }));

    /* ─── Society registration table (all 12 societies) ─── */
    const societyFlags = {};
    SOCIETIES.forEach((s) => { societyFlags[s.key] = s.flag; });

    const societyData = registrations.slice(0, 8).map((reg) => {
      const societies = {};
      for (const s of SOCIETIES) {
        const entry = reg.societies?.get(s.key);
        societies[s.key] = entry
          ? (entry.status === 'Registered' ? 'done' : entry.status === 'In Progress' ? 'pending' : 'not-started')
          : null;
      }
      return { member: reg.name, societies };
    });

    /* ─── Recent leads (last 5) ─── */
    const recentLeads = leads
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map((l) => ({ name: l.name, stage: l.stage, email: l.email, createdAt: l.createdAt }));

    res.json({
      stats: {
        activeMembers,
        totalLeads,
        onboardingCount,
        registeredCount,
        inProgressCount,
        totalMembers: members.length,
      },
      pipelineData,
      onboardingData,
      societyData,
      societyFlags,
      recentLeads,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
