const express = require('express');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const { auth } = require('../middleware/auth');

const router = express.Router();

const SOCIETIES = [
  'IPRS', 'PRS', 'ASCAP', 'PPL(INDIA)', 'PPL(UK)',
  'SOUND EXCHANGE', 'ISAMRA', 'BMI', 'GEMA', 'MLC', 'IMRO', 'SOCAN',
];

// GET /api/dashboard/stats
router.get('/stats', auth, async (req, res) => {
  try {
    // RBAC scoping
    const isFA = req.user.isFullAccess();
    const spocFilter = isFA ? {} : { spoc: req.user.name };

    const [members, leads, onboarding, registrations] = await Promise.all([
      Member.find(spocFilter),
      Lead.find(spocFilter),
      OnboardingEntry.find(spocFilter),
      SocietyRegistration.find(),
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

    /* ─── Top-level stats ─── */
    const activeMembers = members.filter((m) => m.status === 'Active').length;
    const totalLeads = leads.length;
    const onboardingCount = onboarding.filter((e) => e.stage !== 'Active Member' && e.stage !== 'Completed').length;

    let registeredCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const societyCountsMap = new Map();
    SOCIETIES.forEach((society) => {
      societyCountsMap.set(society, {
        society,
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
      });
    });

    filteredRegs.forEach((reg) => {
      if (reg.societies) {
        for (const [society, entry] of reg.societies) {
          const societyCounter = societyCountsMap.get(society);
          if (entry.status === 'Registered') {
            registeredCount++;
            if (societyCounter) {
              societyCounter.completed++;
              societyCounter.total++;
            }
            continue;
          }
          if (entry.status === 'In Progress') {
            const deadline = entry.deadline ? new Date(entry.deadline) : null;
            if (deadline) deadline.setHours(0, 0, 0, 0);
            if (deadline && deadline < today) {
              overdueCount++;
              if (societyCounter) {
                societyCounter.overdue++;
                societyCounter.total++;
              }
            } else {
              inProgressCount++;
              if (societyCounter) {
                societyCounter.inProgress++;
                societyCounter.total++;
              }
            }
          }
        }
      }
    });
    const societyTotalCount = registeredCount + inProgressCount + overdueCount;
    const societyCounts = SOCIETIES.map((society) => societyCountsMap.get(society));

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
        overdueCount,
        societyTotalCount,
        totalMembers: members.length,
      },
      pipelineData,
      onboardingData,
      societyCounts,
      recentLeads,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
