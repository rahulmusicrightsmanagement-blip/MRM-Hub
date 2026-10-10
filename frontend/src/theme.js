/**
 * Design tokens for MRM Hub — the Music Rights Management brand palette.
 * ─────────────────────────────────────────────────────────────
 * The brand ramp, given as four colours:
 *
 *   #E8F5E9  pale mint      the page, and anything that should recede
 *   #A5D6A7  light green    lines, borders, dividers
 *   #66BB6A  mid green      live accents: markers, progress, "done"
 *   #1B5E20  forest green   ink, primary buttons, the app's voice
 *
 * They are Material greens 50 / 200 / 400 / 900, so the steps the ramp does
 * not carry are borrowed from the same scale rather than invented: 100
 * (#C8E6C9) for chips, 800 (#2E7D32) for body-weight accents. Everything
 * else in this file is derived from those, and every text colour below was
 * checked against the surface it sits on at 4.5:1 or better.
 *
 * MRM Hub was a dark app; this is a full inversion. Token *roles* are
 * unchanged, which is why every name is the same as before:
 *
 *   bg       the page, and anything that should RECEDE from a card
 *            (inputs, nested panels). Tinted, so a white card still reads as
 *            raised — the dark theme's relationship, inverted.
 *   surface  a card. White.
 *   raised   a subtle tint for chips and loading placeholders.
 *
 * Kept in a plain .js module (no components) so editing them never breaks
 * fast refresh, and so pages can pull colours without importing the UI kit.
 */

export const T = {
  /**
   * THE SURFACE LADDER — this is what makes the app read as designed rather
   * than as one flat wash of mint. Three levels, each with one job:
   *
   *   page     the canvas everything floats on. Near-white, so a white card
   *            reads as raised and a mint control reads as inset.
   *   surface  content you read: cards, and the rows inside a list.
   *   bg       a surface you ACT on, or one that deliberately recedes:
   *            inputs, toggle tracks, table headers, reference panels.
   *
   * The old palette used one colour (#E8F5E9) for the page AND for nested
   * panels AND for input backgrounds, so nothing could recede from anything
   * — a Yes/No button sat invisibly on a panel of its own colour. Splitting
   * `page` off is the whole fix; `bg` keeps its name and its value, so no
   * call site had to change.
   */
  page: '#F1F8F2',
  bg: '#E8F5E9',
  surface: '#FFFFFF',
  raised: '#C8E6C9',
  border: '#CFE5D1',
  borderHi: '#A5D6A7',
  heading: '#1B5E20',
  body: '#2F4A36',
  muted: '#4A6851',
  faint: '#5B7362',
  accent: '#1B5E20',
  accentGradient: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
  /**
   * Destructive. Material red 700 → 900, which is a shade darker than the
   * gradient four call sites used to paste in by hand: white clears 4.5:1 at
   * BOTH ends of this one (4.98 and 6.57) where the old light end sat at 3.99.
   * `#B71C1C` is already the red tone's foreground, so this stays inside the
   * palette rather than introducing a second red.
   */
  dangerGradient: 'linear-gradient(135deg, #D32F2F, #B71C1C)',
};

/**
 * Tinted colour triples. Every pill, stat card and icon chip picks one.
 *
 * `indigo` and `purple` are the brand-green accent family — they keep their
 * old names because they are named at hundreds of call sites, and renaming
 * them would be a rename, not a re-theme. `green` is success, and it earns a
 * vivid #66BB6A border so "done" never reads the same as "this is our accent
 * colour". The non-green tones keep their hues: in a green-branded app they
 * are the only way blue, amber and red can still mean something.
 */
export const TONES = {
  indigo: { fg: '#256B29', bg: '#E9F5EA', bd: '#C6E3C8' },
  purple: { fg: '#1B5E20', bg: '#C8E6C9', bd: '#A5D6A7' },
  green: { fg: '#27702B', bg: '#E1F3E4', bd: '#66BB6A' },
  blue: { fg: '#0D47A1', bg: '#E3F2FD', bd: '#BBDEFB' },
  teal: { fg: '#004D40', bg: '#E0F2F1', bd: '#B2DFDB' },
  amber: { fg: '#7A4400', bg: '#FFF8E1', bd: '#FFE082' },
  red: { fg: '#B71C1C', bg: '#FFEBEE', bd: '#FFCDD2' },
  grey: { fg: '#48604C', bg: '#F0F5F0', bd: '#DCE8DC' },
};

/**
 * The lift under a card. A near-white page needs it — without a shadow a
 * white card on a near-white canvas is defined only by a hairline, which is
 * what made every surface read as the same weight.
 */
export const LIFT = '0 1px 2px rgba(27, 94, 32, 0.05), 0 10px 26px -16px rgba(27, 94, 32, 0.22)';

export const toneOf = (name) => TONES[name] || TONES.grey;

/**
 * THE SPACING SCALE.
 *
 * The kit had grown 40-odd distinct spacing values with clusters of
 * near-duplicates — 5/6/7px, 9/10/11px, 13/14px, 16/18px — and the page layout
 * alone stacked cards 18px apart, columns 20px apart and rail items 16px
 * apart. Three different gaps in one view is what "uneven" looks like.
 *
 * Everything structural now comes from here. Four numbers do almost all of it:
 *
 *   TIGHT (8)   icon-to-label, chips in a row — things that belong together
 *   SNUG (12)   a caption to the thing it captions
 *   BASE (16)   fields in a grid, rows in a list
 *   BLOCK (20)  the gap between any two blocks: cards, panels, banners,
 *               columns, rail items. ONE value, so the page has one rhythm.
 *   SECTION(24) a new titled section inside a card (a SubHead's top margin)
 *
 * Anything smaller than TIGHT is decoration inside a single control (a pill's
 * dot, a 4px nudge) and is deliberately not on the scale.
 */
export const SP = {
  tight: '8px',
  snug: '12px',
  base: '16px',
  block: '20px',
  section: '24px',
};

/** The padding every card, panel and rail shares. */
export const PAD = '20px';

/** The padding every row inside a ListPanel shares. */
export const ROW_PAD = '14px 16px';

/** The tiny uppercase caption used above every value in the Studio look. */
export const LABEL = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px',
  textTransform: 'uppercase', color: T.muted,
};

/** Standard table cell padding, shared by every data table. */
export const TD = {
  padding: '14px 16px', fontSize: '14px', color: T.body,
  borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle',
};
