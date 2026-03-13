const express = require('express');
const Lead = require('../models/Lead');
const OnboardingEntry = require('../models/OnboardingEntry');
const SocietyRegistration = require('../models/SocietyRegistration');
const Royalty = require('../models/Royalty');
const { auth } = require('../middleware/auth');

const router = express.Router();

const SOCIETY_KEYS = ['IPRS', 'PRS', 'ASCAP', 'PPL(INDIA)', 'PPL(UK)', 'SOUND EXCHANGE', 'ISAMRA', 'BMI', 'GEMA', 'MLC', 'IMRO', 'SOCAN'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SALES_IN_PROGRESS_STAGES = new Set(['New Enquiry', 'Meeting Set']);
const ONBOARDING_COMPLETED_STAGES = new Set(['Completed', 'Active Member']);

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const isOverdue = (deadline) => {
  if (!deadline) return false;
  const today = startOfDay(new Date());
  const dl = startOfDay(new Date(deadline));
  return dl < today;
};

const parseDateRange = (startDateValue, endDateValue) => {
  if (!startDateValue && !endDateValue) return null;

  const start = startDateValue ? startOfDay(new Date(startDateValue)) : null;
  const end = endDateValue ? endOfDay(new Date(endDateValue)) : null;

  if (start && Number.isNaN(start.getTime())) return null;
  if (end && Number.isNaN(end.getTime())) return null;

  if (start && end) {
    return start <= end ? { start, end } : { start: endOfDay(new Date(endDateValue)), end: endOfDay(new Date(startDateValue)) };
  }

  if (start) return { start, end: endOfDay(new Date()) };
  return { start: new Date(0), end };
};

const inRange = (date, range) => {
  if (!range) return true;
  if (!date) return false;
  const d = new Date(date);
  return d >= range.start && d <= range.end;
};

const getScopedRegistrations = (registrations, user) => {
  if (user.isFullAccess()) return registrations;
  return registrations.filter((reg) => {
    if (reg.assignees) {
      for (const [, assignee] of reg.assignees) {
        if (assignee && assignee.name === user.name) return true;
      }
    }
    if (reg.societies) {
      for (const [, entry] of reg.societies) {
        if (entry && entry.assignee && entry.assignee.name === user.name) return true;
      }
    }
    return false;
  });
};

const buildSocietyReport = (regs, selectedSociety) => {
  let societyCompleted = 0;
  let societyInProgress = 0;
  let societyOverdue = 0;

  regs.forEach((reg) => {
    const entry = reg.societies?.get(selectedSociety);
    if (!entry) return;

    if (entry.status === 'Registered') {
      societyCompleted += 1;
      return;
    }

    if (entry.status === 'In Progress') {
      if (isOverdue(entry.deadline)) societyOverdue += 1;
      else societyInProgress += 1;
    }
  });

  return {
    society: selectedSociety,
    total: societyCompleted + societyInProgress + societyOverdue,
    completed: societyCompleted,
    inProgress: societyInProgress,
    overdue: societyOverdue,
  };
};

// GET /api/analytics
router.get('/', auth, async (req, res) => {
  try {
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const selectedSociety = SOCIETY_KEYS.includes(req.query.society) ? req.query.society : SOCIETY_KEYS[0];
    const range = parseDateRange(startDate, endDate);

    const isFA = req.user.isFullAccess();
    const spocFilter = isFA ? {} : { spoc: req.user.name };

    const [leads, onboarding, registrations, royaltyClients] = await Promise.all([
      Lead.find(spocFilter),
      OnboardingEntry.find(spocFilter),
      SocietyRegistration.find(),
      Royalty.find(),
    ]);

    const filteredRegs = getScopedRegistrations(registrations, req.user);

    const leadsInRange = leads.filter((l) => inRange(l.createdAt, range));
    const onboardingInRange = onboarding.filter((o) => inRange(o.createdAt, range));
    const regsInRange = filteredRegs.filter((r) => inRange(r.createdAt, range));

    const salesCompleted = leadsInRange.filter((l) => l.stage === 'Qualified Lead').length;
    const salesOverdue = leadsInRange.filter((l) => SALES_IN_PROGRESS_STAGES.has(l.stage) && isOverdue(l.deadline)).length;
    const salesInProgress = leadsInRange.filter((l) => SALES_IN_PROGRESS_STAGES.has(l.stage) && !isOverdue(l.deadline)).length;

    const salesReport = {
      total: salesCompleted + salesInProgress + salesOverdue,
      completed: salesCompleted,
      inProgress: salesInProgress,
      overdue: salesOverdue,
    };

    const onboardingEligible = onboardingInRange.filter((o) => o.stage !== 'Not Qualified');
    const onboardingCompleted = onboardingEligible.filter((o) => ONBOARDING_COMPLETED_STAGES.has(o.stage)).length;
    const onboardingOverdue = onboardingEligible.filter((o) => !ONBOARDING_COMPLETED_STAGES.has(o.stage) && isOverdue(o.deadline)).length;
    const onboardingInProgress = onboardingEligible.filter((o) => !ONBOARDING_COMPLETED_STAGES.has(o.stage) && !isOverdue(o.deadline)).length;

    const onboardingReport = {
      total: onboardingCompleted + onboardingInProgress + onboardingOverdue,
      completed: onboardingCompleted,
      inProgress: onboardingInProgress,
      overdue: onboardingOverdue,
    };

    const societyReport = buildSocietyReport(regsInRange, selectedSociety);

    let totalSongs = 0;
    let totalBGMMovies = 0;
    let totalTVBGM = 0;
    let totalTVBGMEpisode = 0;

    royaltyClients.forEach((client) => {
      (client.years || []).forEach((yearEntry) => {
        if (!yearEntry || !yearEntry.months) return;

        MONTHS.forEach((monthName) => {
          if (range) {
            const monthIndex = MONTHS.indexOf(monthName);
            const monthDate = new Date(yearEntry.year, monthIndex, 1);
            if (!inRange(monthDate, range)) return;
          }
          const m = yearEntry.months.get(monthName);
          if (!m) return;
          totalSongs += Number(m.totalSongs || 0);
          totalBGMMovies += Number(m.totalBGMMovies || 0);
          totalTVBGM += Number(m.totalTVBGM || 0);
          totalTVBGMEpisode += Number(m.totalTVBGMEpisode || 0);
        });
      });
    });

    const musicWorkReport = {
      totalWorks: totalSongs + totalBGMMovies + totalTVBGM + totalTVBGMEpisode,
      totalSongs,
      totalBGMMovies,
      totalTVBGM,
      totalTVBGMEpisode,
    };

    res.json({
      filters: {
        startDate,
        endDate,
        selectedSociety,
        societyOptions: SOCIETY_KEYS,
      },
      salesReport,
      onboardingReport,
      societyReport,
      musicWorkReport,
    });
  } catch (err) {
    console.error('Analytics report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/analytics/society-report
router.get('/society-report', auth, async (req, res) => {
  try {
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const selectedSociety = SOCIETY_KEYS.includes(req.query.society) ? req.query.society : SOCIETY_KEYS[0];
    const range = parseDateRange(startDate, endDate);

    const registrations = await SocietyRegistration.find();
    const filteredRegs = getScopedRegistrations(registrations, req.user).filter((r) => inRange(r.createdAt, range));

    res.json({
      filters: {
        startDate,
        endDate,
        selectedSociety,
        societyOptions: SOCIETY_KEYS,
      },
      societyReport: buildSocietyReport(filteredRegs, selectedSociety),
    });
  } catch (err) {
    console.error('Society report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
