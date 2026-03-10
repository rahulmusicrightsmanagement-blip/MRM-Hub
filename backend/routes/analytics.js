const express = require('express');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics
router.get('/', auth, async (req, res) => {
  try {
    // RBAC scoping
    const isFA = req.user.isFullAccess();
    const spocFilter = isFA ? {} : { spoc: req.user.name };

    const [leads, registrations, onboarding] = await Promise.all([
      Lead.find(spocFilter),
      SocietyRegistration.find(),
      OnboardingEntry.find(spocFilter),
    ]);

    // For society regs, filter by assignee if not full access
    let filteredRegs = registrations;
    if (!isFA) {
      const userName = req.user.name;
      filteredRegs = registrations.filter((reg) => {
        if (reg.assignees) {
          for (const [, assignee] of reg.assignees) {
            if (assignee && assignee.name === userName) return true;
          }
        }
        if (reg.societies) {
          for (const [, entry] of reg.societies) {
            if (entry && entry.assignee && entry.assignee.name === userName) return true;
          }
        }
        return false;
      });
    }

    // Pipeline data
    const pipelineData = [
      { label: 'Enquiry', value: leads.filter((l) => l.stage === 'New Enquiry').length, color: '#3b82f6' },
      { label: 'Meeting', value: leads.filter((l) => l.stage === 'Meeting Set').length, color: '#3b82f6' },
      { label: 'Qualified', value: leads.filter((l) => l.stage === 'Qualified Lead').length, color: '#eab308' },
      { label: 'Not Qualified', value: leads.filter((l) => l.stage === 'Not Qualified').length, color: '#ef4444' },
    ];

    // Society registration counts
    const societyCounts = {};
    filteredRegs.forEach((reg) => {
      if (reg.societies) {
        for (const [key, entry] of reg.societies) {
          if (entry.status === 'Registered') {
            societyCounts[key] = (societyCounts[key] || 0) + 1;
          }
        }
      }
    });
    const societyColors = { IPRS: '#22c55e', PRS: '#22c55e', ASCAP: '#f59e0b', SOCAN: '#22c55e', GEMA: '#3b82f6', SACEM: '#f59e0b', BMI: '#22c55e', JASRAC: '#f59e0b', APRA: '#3b82f6', SAMRO: '#22c55e' };
    const societyData = Object.entries(societyCounts).map(([label, value]) => ({
      label,
      value,
      color: societyColors[label] || '#3b82f6',
    }));

    // Onboarding by month (last 6 months)
    const now = new Date();
    const onboardingData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      const count = onboarding.filter((e) => {
        const created = new Date(e.createdAt);
        return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
      }).length;
      onboardingData.push({ label: monthLabel, value: count });
    }

    res.json({
      pipelineData,
      societyData,
      onboardingData,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
