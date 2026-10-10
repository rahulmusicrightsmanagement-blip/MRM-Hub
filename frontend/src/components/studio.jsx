/**
 * Studio UI kit
 * ─────────────────────────────────────────────────────────────
 * The shared visual language for MRM Hub, modelled on the Goongoonalo
 * Admin Studio: breadcrumb + page header, a row of stat cards, segmented
 * pill filters, icon-led section cards, small labelled field boxes and
 * status pills.
 *
 * Import these instead of hand-rolling inline styles so every page ends up
 * looking like one product.
 */
import { Fragment, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronDown, Check, Minus, Copy, ArrowRight, Lock, X } from 'lucide-react';
import { T, TONES, LABEL, TD, LIFT, SP, PAD, ROW_PAD, toneOf as tone } from '../theme';

/* ──────── breadcrumb ──────── */
export const Breadcrumb = ({ items = [] }) => (
  <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
    {items.map((item, i) => {
      const last = i === items.length - 1;
      const label = (
        <span style={{ fontSize: '13px', color: last ? T.body : T.muted, fontWeight: last ? 600 : 400 }}>
          {item.label}
        </span>
      );
      return (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {item.to && !last
            ? <Link to={item.to} style={{ textDecoration: 'none' }}>{label}</Link>
            : label}
          {!last && <ChevronRight style={{ width: '13px', height: '13px', color: T.faint }} />}
        </span>
      );
    })}
  </nav>
);

/* ──────── buttons ──────── */
const BUTTON_BASE = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: '9px', fontSize: '14px',
  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  transition: 'filter 0.15s, border-color 0.15s',
};

const BUTTON_SKINS = {
  primary: { background: T.accentGradient, border: 'none', color: '#fff' },
  ghost: { background: T.surface, border: `1px solid ${T.border}`, color: T.body },
  // Destructive, defined once. Four call sites across the two detail pages used
  // to paste the same red gradient in as a raw hex literal.
  danger: { background: T.dangerGradient, border: 'none', color: '#fff' },
};

export const Button = ({ variant = 'primary', icon: Icon, children, style, disabled, ...rest }) => {
  const skin = BUTTON_SKINS[variant] || BUTTON_SKINS.ghost;
  // a disabled button that looks enabled is a button people keep pressing;
  // every call site used to hand-roll this, and most of them forgot
  const off = disabled ? { opacity: 0.45, cursor: 'not-allowed', filter: 'saturate(0.6)' } : null;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      style={{ ...BUTTON_BASE, ...skin, ...off, ...style }}
      {...rest}
    >
      {Icon && <Icon style={{ width: '16px', height: '16px' }} />}
      {children}
    </button>
  );
};

export const IconButton = ({ icon: Icon, title, tone: t = 'grey', ...rest }) => {
  const c = tone(t);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '32px', height: '32px', borderRadius: '8px',
        background: T.surface, border: `1px solid ${T.border}`,
        color: c.fg, cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.bd; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
      {...rest}
    >
      {Icon && <Icon style={{ width: '15px', height: '15px' }} />}
    </button>
  );
};

/* ──────── page header ──────── */
export const PageHeader = ({ breadcrumb, title, subtitle, actions }) => (
  <div style={{ marginBottom: SP.block }}>
    {breadcrumb && <Breadcrumb items={breadcrumb} />}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: '25px', fontWeight: 700, color: T.heading, marginBottom: subtitle ? '4px' : 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '14px', color: T.muted }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  </div>
);

/* ──────── stat cards ──────── */
export const StatGrid = ({ children, columns = 4 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
    gap: '12px', marginBottom: '20px',
    // keep the intended column count as an upper bound on wide screens
    maxWidth: columns >= 5 ? 'none' : undefined,
  }}>
    {children}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, caption, tone: t = 'indigo', onClick, active }) => {
  const c = tone(t);
  const clickable = typeof onClick === 'function';
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
        background: T.surface, border: `1px solid ${active ? c.bd : T.border}`,
        borderRadius: '14px', padding: '18px 18px 16px',
        cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.15s',
      }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.borderColor = c.bd; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.borderColor = active ? c.bd : T.border; } : undefined}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ ...LABEL, marginBottom: '10px' }}>{label}</div>
        <div style={{ fontSize: '27px', fontWeight: 700, color: T.heading, lineHeight: 1.1 }}>{value}</div>
        {caption && <div style={{ fontSize: '12px', color: T.faint, marginTop: '6px' }}>{caption}</div>}
      </div>
      {Icon && (
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: c.bg, border: `1px solid ${c.bd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.fg,
        }}>
          <Icon style={{ width: '17px', height: '17px' }} />
        </div>
      )}
    </div>
  );
};

/* ──────── distribution bar ──────── */
/**
 * One stacked bar showing how records split across a set of buckets, with a
 * clickable legend underneath — the Studio "Split Allocation" pattern.
 *
 * It replaces a row of stat cards *and* a row of filter chips: the proportions
 * are information the counts alone never gave you, and each segment is the
 * filter for its bucket.
 */
export const DistributionBar = ({ segments, active, onSelect, emptyLabel = 'Nothing to show yet' }) => {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);

  return (
    <div>
      <div style={{
        display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden',
        background: T.bg, border: `1px solid ${T.border}`, marginBottom: '12px',
      }}>
        {total === 0
          ? <div style={{ flex: 1 }} title={emptyLabel} />
          : segments.filter((seg) => seg.value > 0).map((seg) => {
            const c = tone(seg.tone);
            const pct = (seg.value / total) * 100;
            return (
              <div
                key={seg.id}
                title={`${seg.label}: ${seg.value} (${pct.toFixed(pct < 10 ? 1 : 0)}%)`}
                style={{
                  width: `${pct}%`, background: c.fg,
                  opacity: !active || active === 'all' || active === seg.id ? 1 : 0.28,
                  transition: 'opacity 0.15s',
                }}
              />
            );
          })}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {segments.map((seg) => {
          const on = active === seg.id;
          const c = tone(seg.tone);
          const pct = total ? Math.round((seg.value / total) * 100) : 0;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => onSelect(on ? 'all' : seg.id)}
              title={`${pct}% of the total`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '9999px',
                background: on ? c.bg : 'transparent',
                border: `1px solid ${on ? c.bd : T.border}`,
                color: on ? c.fg : T.muted,
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                opacity: seg.value === 0 ? 0.55 : 1,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
              {seg.label}
              <span style={{ color: on ? c.fg : T.faint, fontWeight: 700 }}>{seg.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ──────── segmented pill filter ──────── */
export const Segmented = ({ options, value, onChange, tone: t = 'purple' }) => {
  const c = tone(t);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const on = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '9999px',
              background: on ? c.bg : T.surface,
              border: `1px solid ${on ? c.bd : T.border}`,
              color: on ? c.fg : T.muted,
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {Icon && <Icon style={{ width: '14px', height: '14px' }} />}
            {opt.label}
            {opt.count !== undefined && (
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px',
                background: on ? 'rgba(0,0,0,0.06)' : T.raised,
                color: on ? c.fg : T.body,
              }}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ──────── banner ──────── */
/**
 * The wide status strip that sits under a page header: an icon, a sentence,
 * and whatever belongs on the right (qualifying pills, the next action).
 *
 * It carries a *pointer*, never a report — counts live on the filter controls,
 * so a banner says "some are overdue, here they are", not "3 are overdue".
 */
export const Banner = ({ tone: t = 'grey', icon: Icon, children, action }) => {
  const c = tone(t);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '14px 16px', borderRadius: '11px', marginBottom: SP.block,
      background: c.bg, border: `1px solid ${c.bd}`,
    }}>
      {Icon && <Icon style={{ width: '17px', height: '17px', flexShrink: 0, color: c.fg }} />}
      <div style={{ fontSize: '14px', color: T.body, flex: 1, minWidth: '200px' }}>{children}</div>
      {action}
    </div>
  );
};

/** A plain bordered container for a page's controls — no heading, no words. */
export const Panel = ({ children, style }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, boxShadow: LIFT,
    borderRadius: '14px', padding: PAD, marginBottom: SP.block, ...style,
  }}>
    {children}
  </div>
);

/* ──────── section card ──────── */
export const Card = ({ icon: Icon, title, description, actions, tone: t = 'purple', children, style, bodyStyle }) => {
  const c = tone(t);
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '14px', boxShadow: LIFT, ...style }}>
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: SP.snug, padding: PAD, borderBottom: children ? `1px solid ${T.border}` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
            {Icon && (
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: c.bg, border: `1px solid ${c.bd}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.fg,
              }}>
                <Icon style={{ width: '16px', height: '16px' }} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: T.heading }}>{title}</h2>
              {description && <p style={{ fontSize: '13px', color: T.muted, marginTop: '3px' }}>{description}</p>}
            </div>
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      {children && <div style={{ padding: PAD, ...bodyStyle }}>{children}</div>}
    </section>
  );
};

/* ──────── read-only fact ──────── */
/**
 * A label and its value, with no border and no background.
 *
 * The rule across the app: **a border means you can type in it.** Read-only
 * facts are information, so they are set as text — boxing them makes a page of
 * facts look like a page of empty form fields waiting to be filled in.
 */
export const Field = ({ icon: Icon, label, children }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      {Icon && <Icon style={{ width: '12px', height: '12px', color: T.faint, flexShrink: 0 }} />}
      <span style={LABEL}>{label}</span>
    </div>
    <div style={{ fontSize: '14px', color: T.body, lineHeight: 1.45, wordBreak: 'break-word' }}>
      {children}
    </div>
  </div>
);

export const FieldGrid = ({ children, min = '190px' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: SP.base }}>
    {children}
  </div>
);

/* ──────── status pill ──────── */
export const Pill = ({ tone: t = 'grey', icon: Icon, children, dot }) => {
  const c = tone(t);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '3px 9px', borderRadius: '7px', whiteSpace: 'nowrap',
      background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
      fontSize: '11.5px', fontWeight: 600,
    }}>
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.fg }} />}
      {Icon && <Icon style={{ width: '12px', height: '12px' }} />}
      {children}
    </span>
  );
};

/* ──────── search input ──────── */
export const SearchInput = ({ icon: Icon, style, ...rest }) => (
  <div style={{ position: 'relative', ...style }}>
    {Icon && <Icon style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: T.faint }} />}
    <input
      className="sc-control"
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: Icon ? '10px 14px 10px 38px' : '10px 14px',
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: '9px',
        color: T.heading, fontSize: '14px', outline: 'none',
      }}
      {...rest}
    />
  </div>
);

/* ──────── table shell ──────── */
export const TH = ({ children, sortable, active, dir, onClick, width, align = 'left' }) => (
  <th
    onClick={onClick}
    title={sortable ? `Sort by ${String(children).toLowerCase()}` : undefined}
    style={{
      ...LABEL, width, textAlign: align,
      color: active ? T.body : T.faint,
      padding: '12px 16px', borderBottom: `1px solid ${T.border}`,
      background: T.bg, position: 'sticky', top: 0, zIndex: 1,
      cursor: sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
    }}
  >
    {children}
    {sortable && (
      <span style={{ marginLeft: '6px', color: active ? T.accent : T.faint }}>
        {active && dir === 'asc' ? '▲' : '▼'}
      </span>
    )}
  </th>
);

/** The stacked "LABEL / value" pairs used inside a timeline-style table cell. */
export const MetaLine = ({ label, children }) => (
  <div style={{ marginBottom: '6px' }}>
    <div style={{ ...LABEL, fontSize: '9.5px', marginBottom: '2px' }}>{label}</div>
    <div style={{ fontSize: '12.5px', color: T.body }}>{children}</div>
  </div>
);

/* ──────── stepper ──────── */
/** What a step means for the record itself. */
const STEP_STATE = {
  done: { tone: 'green', label: 'Done' },
  current: { tone: 'amber', label: 'You are here' },
  skipped: { tone: 'amber', label: 'Skipped' },
  norecord: { tone: 'grey', label: 'Not recorded' },
  todo: { tone: 'grey', label: 'Not started' },
};

/**
 * A connected progress rail.
 *
 * Three things are on show and they must never be confused:
 *   • the connecting line and the numbers say this is a SEQUENCE;
 *   • `state` says where the RECORD is (done / current / skipped / todo), shown
 *     by the marker and the caption, so it reads the same whichever step is open;
 *   • `active` says which step YOU are reading, shown by the ring and the
 *     brighter title.
 *
 * Steps stay clickable — this groups a long form, it does not gate it.
 */
export const Stepper = ({ steps, active, onSelect, onLocked }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', overflowX: 'auto',
    padding: '4px 2px 10px', marginBottom: SP.block,
  }}>
    {steps.map((step, i) => {
      const viewing = step.id === active;
      const locked = !!step.locked;
      const meta = locked
        ? { tone: 'grey', label: 'Locked' }
        : (STEP_STATE[step.state] || STEP_STATE.todo);
      const c = tone(meta.tone);
      const done = !locked && step.state === 'done';
      const current = !locked && step.state === 'current';
      const prevDone = i > 0 && steps[i - 1].state === 'done' && !steps[i - 1].locked;
      return (
        <Fragment key={step.id}>
          {i > 0 && (
            <span aria-hidden style={{
              flex: 1, minWidth: '16px', height: '2px', marginTop: '16px',
              background: prevDone ? TONES.green.bd : T.border,
            }} />
          )}
          <button
            type="button"
            onClick={() => (locked ? onLocked && onLocked(step) : onSelect(step.id))}
            aria-current={current ? 'step' : undefined}
            aria-disabled={locked || undefined}
            title={locked ? step.lockedHint || `${step.title} — locked` : `${step.title} — ${meta.label}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none',
              // still a button, because it has something to say when pressed
              cursor: locked ? 'not-allowed' : 'pointer',
              padding: '0 10px', minWidth: '120px', maxWidth: '180px', flexShrink: 0,
            }}
          >
            <span style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done || current ? c.bg : T.surface,
              border: locked ? `1.5px dashed ${T.borderHi}` : `1.5px solid ${done || current ? c.bd : T.border}`,
              color: done || current ? c.fg : T.faint,
              fontSize: '13px', fontWeight: 700,
              opacity: locked ? 0.7 : 1,
              // the step you are reading gets a ring; the record's own position does not move
              boxShadow: viewing ? `0 0 0 4px ${TONES.purple.bg}, 0 0 0 5px ${TONES.purple.bd}` : 'none',
              transition: 'box-shadow 0.15s, background 0.15s',
            }}>
              {locked
                ? <Lock style={{ width: '15px', height: '15px' }} />
                : done ? <Check style={{ width: '17px', height: '17px' }} /> : i + 1}
            </span>
            <span style={{
              fontSize: '13px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25,
              color: viewing ? T.heading : current ? T.body : T.muted,
            }}>
              {step.title}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: c.fg === T.muted ? T.faint : c.fg }}>
              {meta.label}
            </span>
          </button>
        </Fragment>
      );
    })}
  </div>
);

/* ──────── form controls ──────── */
const CONTROL = {
  width: '100%', boxSizing: 'border-box', padding: '10px 13px',
  background: T.bg, border: `1px solid ${T.border}`, borderRadius: '9px',
  color: T.heading, fontSize: '14px', outline: 'none',
};

export const FormGrid = ({ children, min = '260px', style }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: SP.base, ...style }}>
    {children}
  </div>
);

const Labelled = ({ label, hint, required, children, span }) => (
  <div style={span ? { gridColumn: '1 / -1' } : undefined}>
    {/* a control sitting under its own <SubHead> needs no second caption */}
    {label && (
      <label style={{ ...LABEL, display: 'block', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: TONES.red.fg }}> *</span>}
      </label>
    )}
    {children}
    {hint && <p style={{ fontSize: '12px', color: T.faint, marginTop: '6px' }}>{hint}</p>}
  </div>
);

/** `sc-control` is what gives every field its focus ring (see index.css). */
const controlClass = (extra) => ['sc-control', extra].filter(Boolean).join(' ');

export const Input = ({ label, hint, required, span, readOnly, style, className, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <input
      readOnly={readOnly}
      className={controlClass(className)}
      style={{ ...CONTROL, ...(readOnly ? { background: T.surface, color: T.muted, cursor: 'not-allowed' } : {}), ...style }}
      {...rest}
    />
  </Labelled>
);

export const Textarea = ({ label, hint, required, span = true, style, className, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <textarea className={controlClass(className)} style={{ ...CONTROL, minHeight: '96px', resize: 'vertical', ...style }} {...rest} />
  </Labelled>
);

export const Select = ({ label, hint, required, span, children, style, className, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <select className={controlClass(className)} style={{ ...CONTROL, cursor: 'pointer', ...style }} {...rest}>{children}</select>
  </Labelled>
);

/**
 * Pick several from a list, shown as removable chips.
 *
 * Members and the onboarding stages each had their own copy of this, differing
 * only in which picklist they read. It takes plain `options` instead, so the
 * picklist stays the caller's business and there is one control again.
 */
export const MultiSelect = ({ label, hint, required, span, options = [], selected = [], onChange, placeholder = 'Select...' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);

  /* Click away or press Escape. A dropdown whose only exit is a second click on
     the same strip is the defect the dialogs in this app already had fixed. */
  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Labelled label={label} hint={hint} required={required} span={span}>
      <div style={{ position: 'relative' }} ref={ref}>
        <div
          className={controlClass()}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={selected.length ? `${label || 'Selected'}: ${selected.join(', ')}` : `${label || 'Nothing'} selected`}
          onClick={() => setOpen((p) => !p)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((p) => !p); } }}
          style={{
            ...CONTROL, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', minHeight: '42px', flexWrap: 'wrap', gap: '6px',
          }}
        >
          {selected.length === 0
            ? <span style={{ color: T.faint }}>{placeholder}</span>
            : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selected.map((o) => (
                  <span key={o} style={{
                    background: TONES.indigo.bg, border: `1px solid ${TONES.indigo.bd}`, color: TONES.indigo.fg,
                    padding: '2px 4px 2px 9px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}>
                    {o}
                    <span
                      role="button"
                      tabIndex={0}
                      title={`Remove ${o}`}
                      aria-label={`Remove ${o}`}
                      onClick={(e) => { e.stopPropagation(); toggle(o); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(o); } }}
                      style={{ cursor: 'pointer', display: 'inline-flex', padding: '2px' }}
                    >
                      <X style={{ width: '11px', height: '11px' }} />
                    </span>
                  </span>
                ))}
              </div>
            )}
          <ChevronDown
            aria-hidden
            style={{
              width: '15px', height: '15px', flexShrink: 0, color: T.faint,
              transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
            }}
          />
        </div>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface,
            border: `1px solid ${T.borderHi}`, borderRadius: '10px', marginTop: '5px',
            zIndex: 20, maxHeight: '220px', overflowY: 'auto', padding: '5px',
            boxShadow: '0 12px 28px rgba(27, 94, 32, 0.13)',
          }}>
            {options.length === 0 && (
              <div style={{ padding: '10px 11px', fontSize: '13px', color: T.faint }}>
                Nothing to pick — add options on the Picklist Manager page.
              </div>
            )}
            {options.map((opt) => {
              const on = selected.includes(opt);
              return (
                <div
                  key={opt}
                  className="sc-row"
                  onClick={() => toggle(opt)}
                  style={{
                    padding: '9px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: '10px', color: on ? TONES.indigo.fg : T.body, fontSize: '13px',
                    background: on ? TONES.indigo.bg : 'transparent',
                  }}
                >
                  <span style={{
                    width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
                    border: on ? 'none' : `1px solid ${T.borderHi}`,
                    background: on ? T.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.surface,
                  }}>
                    {on && <Check style={{ width: '11px', height: '11px' }} />}
                  </span>
                  {opt}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Labelled>
  );
};

/* ──────── selection ──────── */
export const Checkbox = ({ checked, indeterminate, onChange, label }) => (
  <span
    role="checkbox"
    aria-checked={indeterminate ? 'mixed' : checked}
    aria-label={label}
    tabIndex={0}
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(); } }}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '17px', height: '17px', borderRadius: '5px', cursor: 'pointer', flexShrink: 0,
      background: checked || indeterminate ? T.accent : 'transparent',
      border: `1px solid ${checked || indeterminate ? T.accent : T.borderHi}`,
      transition: 'background 0.12s, border-color 0.12s',
    }}
  >
    {indeterminate
      ? <Minus style={{ width: '11px', height: '11px', color: '#1B5E20' }} />
      : checked && <Check style={{ width: '11px', height: '11px', color: '#1B5E20' }} />}
  </span>
);

/** The bar that appears once rows are ticked. */
export const SelectionBar = ({ count, children, onClear }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
    padding: '11px 16px', background: TONES.indigo.bg,
    borderBottom: `1px solid ${TONES.indigo.bd}`,
  }}>
    <span style={{ fontSize: '13px', fontWeight: 600, color: TONES.indigo.fg }}>
      {count} selected
    </span>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{children}</div>
    <button
      type="button"
      onClick={onClear}
      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.muted, fontSize: '13px', cursor: 'pointer', padding: 0 }}
    >
      Clear
    </button>
  </div>
);

/* ──────── loading ──────── */
const shimmer = (w) => ({
  height: '11px', width: w, borderRadius: '5px',
  background: T.raised, animation: 'studioPulse 1.4s ease-in-out infinite',
});

/** Placeholder rows shaped like the real ones, so the table does not jump on load. */
export const TableSkeleton = ({ columns, rows = 6 }) => (
  <tbody>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r}>
        {columns.map((width, c) => (
          <td key={c} style={TD}>
            <div style={{ ...shimmer(width), animationDelay: `${(r * columns.length + c) * 0.04}s` }} />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

/* ──────── empty state ──────── */
export const EmptyState = ({ icon: Icon, title, children }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
    {Icon && (
      <div style={{
        width: '46px', height: '46px', borderRadius: '13px', margin: '0 auto 14px',
        background: TONES.grey.bg, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint,
      }}>
        <Icon style={{ width: '21px', height: '21px' }} />
      </div>
    )}
    <p style={{ fontSize: '15px', fontWeight: 600, color: T.body, marginBottom: '6px' }}>{title}</p>
    {children && <div style={{ fontSize: '13.5px', color: T.muted }}>{children}</div>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   RICH DETAIL PRIMITIVES
   ───────────────────────────────────────────────────────────────
   A stepped detail page is mostly a long form, and a long form drawn
   as one flat stack of identical inputs reads as a wall of boxes. These
   give a page body its hierarchy without adding a single extra border:

     Split      — a quiet reference rail beside the work area
     SubHead    — a captioned hairline that groups a run of fields
     Avatar     — a person, as something you can actually see
     ContactRow — a fact you can act on (mail it, ring it, copy it)
     Choice     — a short fixed option set, picked in one click not two
     DateTile   — a date read at a glance instead of parsed
     Ring       — "how far along is this" as a shape, not a fraction
     CheckTile  — the one thing this step is asking you to confirm
     ActionTile — an action shown with its consequence
   ═══════════════════════════════════════════════════════════════ */

/* ──────── the strip a card opens with ──────── */
/**
 * A card's opening summary: a shape on the left (a ring, a date tile, an icon),
 * one plain-English headline, a supporting line, and whatever belongs on the
 * right.
 *
 * It existed three separate times — `Readiness` in the onboarding stages, the
 * final-checks strip on the lead page, and the document strip on the member
 * profile — with gaps of 15px, 18px and 20px and three different bottom rules.
 * Three spacings for one idea is what reads as "uneven", so there is one now.
 */
export const Summary = ({ left, headline, detail, right, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: SP.base, flexWrap: 'wrap',
    paddingBottom: SP.block, marginBottom: SP.block,
    borderBottom: `1px solid ${T.border}`,
  }}>
    {left}
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <div style={{ fontSize: '14.5px', fontWeight: 600, color: T.heading, wordBreak: 'break-word' }}>{headline}</div>
      {detail && <div style={{ fontSize: '13px', color: T.muted, marginTop: '4px', lineHeight: 1.45 }}>{detail}</div>}
      {children}
    </div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
  </div>
);

/* ──────── the rail layout ──────── */
/**
 * Reference on the left, work on the right.
 *
 * The rail sits on the sunken page colour so it *recedes*: it is what you
 * check against, never what you fill in. Collapses to one column on narrow
 * screens — see `.sc-split` in index.css, because inline styles cannot
 * declare a media query.
 */
export const Split = ({ rail = '300px', children }) => (
  <div className="sc-split" style={{ '--rail': rail }}>{children}</div>
);

/** The quiet panel that goes in a <Split> rail. */
export const Rail = ({ children, style }) => (
  <aside style={{
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: '12px',
    padding: PAD, alignSelf: 'start', ...style,
  }}>
    {children}
  </aside>
);

/* ──────── group caption ──────── */
/** A tiny uppercase caption trailing off into a hairline — the cheapest way
 *  to give a long form a rhythm, since it groups without boxing. */
export const SubHead = ({ icon: Icon, children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: SP.tight, marginBottom: SP.snug, ...style }}>
    {Icon && <Icon style={{ width: '13px', height: '13px', color: T.faint, flexShrink: 0 }} />}
    <span style={{ ...LABEL, whiteSpace: 'nowrap' }}>{children}</span>
    <span aria-hidden style={{ flex: 1, height: '1px', background: T.border }} />
  </div>
);

/* ──────── people ──────── */
/* Module-private on purpose: exporting a non-component from this file trips
   `react-refresh/only-export-components`, which is why theme.js exists. */
const initialsOf = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
};

/* A stable colour per person, so a long table is scannable instead of being
   247 identical squares. Deterministic from the name, drawn only from tones
   whose foreground already clears 4.5:1 against white — the initials sit on
   that colour, so the avatar can never become the page's weak point. */
const AVATAR_TONES = ['purple', 'indigo', 'blue', 'teal', 'green', 'amber', 'red'];

const toneForName = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

/**
 * Initials on a solid brand colour. Squircle at every size, so it belongs to
 * the same family as the icon chips rather than looking like a stray bubble.
 *
 * `tone` picks a colour explicitly; `tone="auto"` derives a stable one from
 * the name; omitting it uses the house gradient.
 */
export const Avatar = ({ name, size = 42, style, title, tone: t }) => {
  const resolved = t === 'auto' ? toneForName(name) : t;
  const skin = resolved
    ? { background: tone(resolved).fg }
    : { background: T.accentGradient };
  return (
    <span
      title={title || name || undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: `${size}px`, height: `${size}px`, flexShrink: 0,
        borderRadius: `${Math.max(6, Math.round(size * 0.3))}px`,
        color: '#fff',
        fontSize: `${Math.max(10, Math.round(size * 0.37))}px`,
        fontWeight: 700, letterSpacing: '0.3px', lineHeight: 1, userSelect: 'none',
        ...skin,
        ...style,
      }}
    >
      {initialsOf(name)}
    </span>
  );
};

/** A person named with their face on. */
export const PersonChip = ({ name, empty = 'Unassigned', size = 22, tone: t = 'auto' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
    {name
      ? <Avatar name={name} size={size} tone={t} />
      : <span style={{
        width: `${size}px`, height: `${size}px`, borderRadius: `${Math.max(6, Math.round(size * 0.3))}px`,
        border: `1px dashed ${T.borderHi}`, flexShrink: 0,
      }} />}
    <span style={{
      fontSize: '13.5px', fontWeight: name ? 600 : 400, color: name ? T.body : T.faint,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {name || empty}
    </span>
  </span>
);

/* ──────── an actionable fact ──────── */
/**
 * A read-only fact that you can *do* something with: mail it, ring it, copy it.
 *
 * Still not a form box — no border, no fill on the value itself. The border
 * rule holds: the only bordered thing here is the copy button, which is a
 * control.
 */
export const ContactRow = ({ icon: Icon, label, value, href, empty = 'Not recorded', tone: t = 'grey', copyable = true }) => {
  const c = tone(t);
  const has = !!value;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard is blocked (insecure origin, or the user said no) — the
      // value is on screen and selectable, so there is nothing to recover from
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', minWidth: 0 }}>
      {Icon && (
        <span style={{
          width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: has ? c.bg : 'transparent',
          border: `1px solid ${has ? c.bd : T.border}`,
          color: has ? c.fg : T.faint,
        }}>
          <Icon style={{ width: '14px', height: '14px' }} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...LABEL, fontSize: '9.5px', marginBottom: '2px' }}>{label}</div>
        {has && href ? (
          <a
            href={href}
            style={{
              fontSize: '13.5px', color: T.body, textDecoration: 'none',
              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = c.fg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.body; }}
          >
            {value}
          </a>
        ) : (
          <div style={{
            fontSize: '13.5px', color: has ? T.body : T.faint,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {has ? value : empty}
          </div>
        )}
      </div>
      {has && copyable && (
        <button
          type="button"
          onClick={copy}
          title={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
          aria-label={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '27px', height: '27px', borderRadius: '7px', flexShrink: 0,
            background: 'transparent', border: `1px solid ${copied ? TONES.green.bd : T.border}`,
            color: copied ? TONES.green.fg : T.faint, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {copied
            ? <Check style={{ width: '13px', height: '13px' }} />
            : <Copy style={{ width: '13px', height: '13px' }} />}
        </button>
      )}
    </div>
  );
};

/* ──────── a short fixed choice ──────── */
/**
 * Three or four mutually exclusive options, shown all at once and tinted with
 * their own meaning. A <Select> hides them behind a click and drains the
 * colour out of a value that has some; this does neither.
 */
export const Choice = ({ label, hint, required, span, options, value, onChange, compact, disabled }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const on = opt.value === value;
        const c = tone(opt.tone);
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={opt.hint}
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              // compact sits inline beside a label; the default fills its column
              flex: compact ? '0 0 auto' : '1 1 0',
              minWidth: compact ? 'auto' : '78px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: compact ? '6px 13px' : '10px 10px', borderRadius: compact ? '8px' : '9px',
              background: on ? c.bg : T.bg,
              border: `1px solid ${on ? c.bd : T.border}`,
              color: on ? c.fg : T.muted,
              fontSize: compact ? '12.5px' : '13px', fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {Icon
              ? <Icon style={{ width: '13px', height: '13px' }} />
              : <span style={{
                width: compact ? '6px' : '7px', height: compact ? '6px' : '7px',
                borderRadius: '50%', flexShrink: 0,
                background: on ? c.fg : T.borderHi,
              }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  </Labelled>
);

/* ──────── a date, at a glance ──────── */
/** A torn-off calendar page. Reads in one glance where "04 Sep 2026" has to
 *  be parsed — and degrades to a dashed placeholder, which matters because
 *  imported records carry dates that are not dates. */
export const DateTile = ({ date, tone: t = 'teal', size = 58 }) => {
  const parsed = date ? new Date(date) : null;
  const ok = parsed && !Number.isNaN(parsed.getTime());
  const c = tone(t);
  return (
    <div style={{
      width: `${size}px`, flexShrink: 0, borderRadius: '11px', overflow: 'hidden',
      background: T.surface,
      border: ok ? `1px solid ${c.bd}` : `1px dashed ${T.borderHi}`,
      textAlign: 'center',
    }}>
      <div style={{
        padding: '3px 0', background: ok ? c.bg : 'transparent',
        color: ok ? c.fg : T.faint, fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
        borderBottom: `1px solid ${ok ? c.bd : T.border}`,
      }}>
        {ok ? parsed.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '—'}
      </div>
      <div style={{
        padding: '5px 0 6px', color: ok ? T.heading : T.faint,
        fontSize: '20px', fontWeight: 700, lineHeight: 1.1,
      }}>
        {ok ? String(parsed.getDate()).padStart(2, '0') : '··'}
      </div>
      <div style={{ paddingBottom: '5px', fontSize: '9.5px', color: T.faint, fontWeight: 600 }}>
        {ok ? parsed.getFullYear() : 'not set'}
      </div>
    </div>
  );
};

/* ──────── progress as a shape ──────── */
export const Ring = ({ value, total, size = 62, tone: t = 'green', caption }) => {
  const c = tone(t);
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.max(0, Math.min(1, value / safeTotal));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    /* The caption sits UNDER the ring, not inside it. It used to be centred in
       the circle with `{ fontSize: '8.5px', ...LABEL }` — and because the
       spread came second, LABEL's own 11px won, so a two-word caption like
       "ASKED FOR" wrapped onto two lines and collided with the number. */
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      gap: '6px', flexShrink: 0,
    }}>
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={c.fg} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 0.45s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: `${Math.round(size * 0.3)}px`, fontWeight: 700,
            color: T.heading, lineHeight: 1, letterSpacing: '-0.4px',
          }}>
            {value}<span style={{ color: T.faint, fontWeight: 600 }}>/{total}</span>
          </span>
        </div>
      </div>
      {caption && (
        <span style={{ ...LABEL, fontSize: '9.5px', color: T.faint, whiteSpace: 'nowrap', lineHeight: 1 }}>
          {caption}
        </span>
      )}
    </div>
  );
};

/* `CheckTile` lived here: a round tick icon that was the whole row's toggle.
   Nobody could tell it was a control, and it was not a checkbox or a switch.
   Replaced by `DecisionRow` + `YesNo`; deliberately not kept around, because
   an unused confusing control is one someone copies back in later. */

/* ──────── an action, with its consequence ──────── */
/**
 * "These take effect straight away" is a promise a bare button does not keep.
 * Each action states what it will do, so nobody has to click one to find out.
 */
export const ActionTile = ({ icon: Icon, title, subtitle, onClick, to, tone: t = 'indigo', disabled }) => {
  const c = tone(t);
  const inner = (
    <>
      <span style={{
        width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
      }}>
        {Icon && <Icon style={{ width: '16px', height: '16px' }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: T.heading }}>{title}</span>
        {subtitle && (
          <span style={{ display: 'block', fontSize: '12.5px', color: T.faint, marginTop: '3px', lineHeight: 1.4 }}>
            {subtitle}
          </span>
        )}
      </span>
      <ArrowRight style={{ width: '15px', height: '15px', color: T.faint, flexShrink: 0 }} />
    </>
  );

  const skin = {
    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
    textAlign: 'left', padding: ROW_PAD, borderRadius: '12px',
    background: T.bg, border: `1px solid ${T.border}`,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    textDecoration: 'none', boxSizing: 'border-box',
  };

  const hover = {
    onMouseEnter: (e) => { if (!disabled) e.currentTarget.style.borderColor = c.bd; },
    onMouseLeave: (e) => { e.currentTarget.style.borderColor = T.border; },
  };

  if (to) return <Link className="sc-tile" to={to} style={skin} {...hover}>{inner}</Link>;
  return (
    <button type="button" className="sc-tile" onClick={onClick} disabled={disabled} style={skin} {...hover}>
      {inner}
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════
   LISTS AND SUMMARIES
   ───────────────────────────────────────────────────────────────
   Five items drawn as five bordered cards is five boxes; drawn as one
   bordered container with hairline-separated rows it is a list, and a
   list is read in a single sweep. `.sc-list` in index.css puts the
   separator between rows — inline styles cannot express "every child
   but the first".
   ═══════════════════════════════════════════════════════════════ */

export const ListPanel = ({ children, style }) => (
  <div className="sc-list" style={{
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: '12px', overflow: 'hidden', ...style,
  }}>
    {children}
  </div>
);

/**
 * One row of a ListPanel: a tinted icon chip, a title with an optional
 * second line, whatever controls belong on the right, and an optional
 * expanded region underneath (indented to line up past the chip).
 */
export const ListRow = ({ icon: Icon, tone: t = 'grey', title, subtitle, right, children, muted }) => {
  const c = tone(t);
  return (
    <div style={{ padding: ROW_PAD, opacity: muted ? 0.72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {Icon && (
          <span style={{
            width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
          }}>
            <Icon style={{ width: '14px', height: '14px' }} />
          </span>
        )}
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: T.heading, wordBreak: 'break-word' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '12.5px', color: T.faint, marginTop: '3px' }}>{subtitle}</div>}
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>{right}</div>}
      </div>
      {children && <div style={{ marginTop: '12px', paddingLeft: Icon ? '42px' : 0 }}>{children}</div>}
    </div>
  );
};

/** A thin proportional bar. Carries "how far along" without spending a line
 *  of text on a fraction the caller has usually already written. */
export const ProgressBar = ({ value, total, tone: t = 'indigo', height = 6 }) => {
  const c = tone(t);
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) * 100 : 0;
  return (
    <div style={{
      height: `${height}px`, background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: `${height}px`, overflow: 'hidden',
    }}>
      <div style={{ height: '100%', width: `${pct}%`, background: c.fg, transition: 'width 0.35s ease' }} />
    </div>
  );
};

/**
 * A summary row that opens. Built to sit inside a ListPanel, so it carries no
 * border of its own — the panel supplies the separators.
 */
export const Collapsible = ({ icon: Icon, tone: t = 'grey', title, meta, pill, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const c = tone(t);
  return (
    <div>
      <button
        type="button"
        className="sc-row"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
          textAlign: 'left', background: 'none', border: 'none',
          padding: ROW_PAD, cursor: 'pointer', borderRadius: 0,
        }}
      >
        {Icon && (
          <span style={{
            width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
          }}>
            <Icon style={{ width: '14px', height: '14px' }} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 600, color: T.heading }}>{title}</span>
        {meta && <span style={{ fontSize: '12.5px', color: T.faint, flexShrink: 0 }}>{meta}</span>}
        {pill}
        <ChevronRight style={{
          width: '15px', height: '15px', color: T.faint, flexShrink: 0,
          transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s',
        }} />
      </button>
      {open && <div style={{ padding: '2px 16px 16px', paddingLeft: Icon ? '58px' : '16px' }}>{children}</div>}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DECISIONS, CONTEXT AND STAGE CONTROL
   ───────────────────────────────────────────────────────────────
   Three problems this section answers, all of them reported rather
   than guessed at:

   1. A round tick-icon that happens to be clickable is neither a
      checkbox nor a toggle, and nobody could tell it was a control.
      NN/g's rule for two mutually exclusive options that take effect
      immediately with no Save button is an explicit labelled switch,
      with the state readable without touching it. `YesNo` is that,
      and it is now the only such control in the app.
   2. Bare pills reading "RAHUL JADHAV" and "Nothing written down"
      look like two tags of the same kind. `MicroFacts` labels them.
   3. On a wide screen a single column of full-width cards reads as a
      row of big empty rectangles. `PageBody` spends that width on a
      second column instead of stretching the first.
   ═══════════════════════════════════════════════════════════════ */

/* ──────── the binary decision ──────── */
const YES_NO = [
  { on: true, label: 'Yes', fill: '#2E7D32' },   // white on this is 5.13:1
  { on: false, label: 'No', fill: T.muted },     // white on this is 6.20:1
];

/**
 * Yes / No, both options always visible and labelled.
 *
 * "No" is grey rather than red: work not yet done is not an error, and a
 * column of red No badges made an untouched record look like a failing one.
 * Every use of this saves the instant it is pressed — that is the condition
 * for using a switch rather than a checkbox in the first place.
 */
export const YesNo = ({ value, onChange, disabled, label }) => (
  <span
    role="radiogroup"
    aria-label={label}
    style={{
      display: 'inline-flex', gap: '3px', flexShrink: 0, padding: '3px',
      borderRadius: '11px', background: T.bg, border: `1px solid ${T.border}`,
      opacity: disabled ? 0.55 : 1,
    }}
  >
    {YES_NO.map((opt) => {
      const on = opt.on === !!value;
      return (
        <button
          key={opt.label}
          type="button"
          role="radio"
          aria-checked={on}
          disabled={disabled}
          onClick={() => !disabled && onChange(opt.on)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 15px', borderRadius: '8px', minWidth: '62px',
            justifyContent: 'center',
            // the chosen answer is a SOLID fill, so which one is picked reads
            // from across the room; the other side is bare track
            background: on ? opt.fill : 'transparent',
            border: 'none',
            boxShadow: on ? '0 1px 2px rgba(27, 94, 32, 0.18)' : 'none',
            color: on ? T.surface : T.muted,
            fontSize: '12.5px', fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
          }}
        >
          {on && <Check style={{ width: '12px', height: '12px' }} />}
          {opt.label}
        </button>
      );
    })}
  </span>
);

/* ──────── labelled facts, inline ──────── */
/** Small "LABEL value" pairs on one line. A fact needs its label; a pill
 *  without one is just a word floating next to another word. */
export const MicroFacts = ({ items, style }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', alignItems: 'baseline', ...style }}>
    {items.filter(Boolean).map((f) => (
      <span key={f.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
        <span style={{ ...LABEL, fontSize: '9.5px' }}>{f.label}</span>
        <span style={{
          fontSize: '12.5px', fontWeight: 600,
          color: f.tone ? tone(f.tone).fg : T.body,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {f.value}
        </span>
      </span>
    ))}
  </div>
);

/* ──────── one thing to decide ──────── */
/**
 * A question, why it is being asked, the evidence behind it, and the answer.
 *
 * Built to sit inside a `ListPanel`, so several decisions read as one list
 * rather than as a stack of separate boxes. Only the Yes/No is clickable —
 * making the whole row a button is what made the old tile ambiguous.
 */
export const DecisionRow = ({
  icon: Icon, question, help, facts, value, onChange, disabled, action,
}) => {
  const c = tone(value ? 'green' : 'grey');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.snug, flexWrap: 'wrap', padding: ROW_PAD }}>
      {Icon && (
        <span style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
        }}>
          <Icon style={{ width: '16px', height: '16px' }} />
        </span>
      )}
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: T.heading }}>{question}</div>
        {help && <div style={{ fontSize: '12.5px', color: T.faint, marginTop: '3px', lineHeight: 1.45 }}>{help}</div>}
        {facts && facts.filter(Boolean).length > 0 && <MicroFacts items={facts} style={{ marginTop: '10px' }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {action}
        <YesNo value={value} onChange={onChange} disabled={disabled} label={question} />
      </div>
    </div>
  );
};

/* ──────── the two-column page ──────── */
/**
 * Work on the left, context on the right, the rail pinned as you scroll.
 *
 * The rail is where the record's identity and its lifecycle controls live, so
 * they are on screen whichever step is open — the rule that a lead sitting at
 * step 2 must never have its next action buried in step 4, taken further.
 * Collapses to one column below 1180px (see `.sc-page` in index.css).
 */
export const PageBody = ({ rail, children }) => (
  <div className="sc-page">
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SP.block }}>{children}</div>
    <aside className="sc-page-rail">{rail}</aside>
  </div>
);

/* ──────── move to any stage ──────── */
/**
 * Forward one step, back to anywhere.
 *
 * Stepper guidance is blunt about this: do not restrict progression, and let
 * people go back. Forward stays deliberately one-at-a-time so nobody skips a
 * stage by accident, but every stage already behind the record is one click
 * away. Each row says which direction it goes, so "back" is never a surprise.
 */
/**
 * `allow(stage, i, here)` returns true, or a string saying why not. A blocked
 * row keeps its lock icon and still answers when pressed — a dimmed row that
 * does nothing tells you only that you were wrong, never what to do instead.
 */
export const StagePicker = ({ stages, current, onSelect, allow, onBlocked }) => {
  const here = stages.indexOf(current);
  return (
    <div className="sc-list" style={{
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: '11px', overflow: 'hidden',
    }}>
      {stages.map((stage, i) => {
        const isHere = i === here;
        const back = here >= 0 && i < here;
        const verdict = isHere ? false : (allow ? allow(stage, i, here) : true);
        const allowed = verdict === true;
        const reason = typeof verdict === 'string' ? verdict : null;
        const c = tone(isHere ? 'amber' : back ? 'blue' : 'indigo');
        return (
          <button
            key={stage}
            type="button"
            className={allowed ? 'sc-row' : undefined}
            disabled={isHere}
            onClick={() => {
              if (allowed) onSelect(stage);
              else if (reason && onBlocked) onBlocked(stage, reason);
            }}
            title={isHere ? 'This is where the record is now' : allowed ? `Move to ${stage}` : reason || `${stage} cannot be reached from here`}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              textAlign: 'left', padding: '11px 13px', borderRadius: 0,
              background: isHere ? c.bg : 'none', border: 'none',
              cursor: isHere ? 'default' : allowed ? 'pointer' : 'not-allowed',
              opacity: !allowed && !isHere ? 0.55 : 1,
            }}
          >
            <span style={{
              width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: isHere ? c.fg : 'transparent',
              border: isHere ? 'none' : `1px ${allowed ? 'solid' : 'dashed'} ${T.borderHi}`,
              color: isHere ? '#fff' : T.faint,
              fontSize: '11px', fontWeight: 700,
            }}>
              {!isHere && !allowed ? <Lock style={{ width: '11px', height: '11px' }} /> : i + 1}
            </span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: '13px',
              fontWeight: isHere ? 700 : 500,
              color: isHere ? c.fg : allowed ? T.body : T.faint,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {stage}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.4px', flexShrink: 0, color: isHere ? c.fg : T.faint }}>
              {isHere ? 'NOW' : allowed ? (back ? '← BACK' : 'NEXT →') : 'LOCKED'}
            </span>
          </button>
        );
      })}
    </div>
  );
};
