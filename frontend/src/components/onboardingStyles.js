/**
 * Inline-style constants shared by the onboarding stage views.
 *
 * These panels now render inside a Studio `Card`, so they are aligned to the
 * shared tokens and deliberately *recede*: an inset background rather than a
 * raised one, so a nested panel reads as part of its card instead of competing
 * with it as another box.
 *
 * Plain .js with no components, so editing never breaks fast refresh.
 * New work should prefer ../theme and the kit in ./studio.
 */
import { T } from '../theme';

/**
 * The stages a client actually walks through.
 *
 * The `onboarding_stage` picklist carries 'Not Qualified' as a seventh entry,
 * but nothing ever sits there: rejecting a client DELETES the onboarding entry
 * and marks the *lead* Not Qualified instead. Left in, it put a locked
 * "Not Qualified" tile on the end of the journey rail, made the banner read
 * "Step 1 of 7", and — worse — broke the rule that advancing stops one short
 * of "Completed", because that rule is written as `length - 2`.
 *
 * Kept here, in the one plain .js module both onboarding pages already import,
 * so exporting it cannot trip `react-refresh/only-export-components`.
 */
export const EXIT_STAGES = ['Not Qualified'];
export const journeyStages = (stages) => stages.filter((s) => !EXIT_STAGES.includes(s));

export const fmtDateISO = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// interactive, so it keeps a border — the app-wide rule is that a border means
// you can type in it
export const inputStyle = {
  width: '100%', padding: '10px 13px', borderRadius: '9px',
  border: `1px solid ${T.border}`, backgroundColor: T.bg,
  color: T.heading, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

export const labelStyle = {
  fontSize: '11px', fontWeight: 700, color: T.faint, letterSpacing: '0.6px',
  textTransform: 'uppercase', marginBottom: '6px', display: 'block',
};

export const cardBg = T.bg;
export const cardBorder = `1px solid ${T.border}`;

export const sectionStyle = {
  backgroundColor: cardBg, border: cardBorder,
  borderRadius: '10px', padding: '16px', marginBottom: '16px',
};

export const toggleBtnBase = {
  padding: '6px 14px', borderRadius: '7px', fontSize: '12px',
  fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
};
