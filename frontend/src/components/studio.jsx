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
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Check, Minus } from 'lucide-react';
import { T, TONES, LABEL, TD, toneOf as tone } from '../theme';

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

export const Button = ({ variant = 'primary', icon: Icon, children, style, ...rest }) => {
  const skin = variant === 'primary'
    ? { background: T.accentGradient, border: 'none', color: '#fff' }
    : { background: T.surface, border: `1px solid ${T.border}`, color: T.body };
  return (
    <button type="button" style={{ ...BUTTON_BASE, ...skin, ...style }} {...rest}>
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
  <div style={{ marginBottom: '22px' }}>
    {breadcrumb && <Breadcrumb items={breadcrumb} />}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: '25px', fontWeight: 700, color: T.heading, marginBottom: subtitle ? '5px' : 0 }}>{title}</h1>
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
    gap: '14px', marginBottom: '20px',
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
        {caption && <div style={{ fontSize: '12px', color: T.faint, marginTop: '7px' }}>{caption}</div>}
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
        background: T.bg, border: `1px solid ${T.border}`, marginBottom: '14px',
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
                display: 'inline-flex', alignItems: 'center', gap: '7px',
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
              display: 'inline-flex', alignItems: 'center', gap: '7px',
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
                background: on ? 'rgba(255,255,255,0.10)' : T.raised,
                color: on ? c.fg : T.faint,
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
      padding: '12px 15px', borderRadius: '11px', marginBottom: '14px',
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
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: '14px', padding: '16px 18px', marginBottom: '18px', ...style,
  }}>
    {children}
  </div>
);

/* ──────── section card ──────── */
export const Card = ({ icon: Icon, title, description, actions, tone: t = 'purple', children, style, bodyStyle }) => {
  const c = tone(t);
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '14px', ...style }}>
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: '12px', padding: '18px 20px', borderBottom: children ? `1px solid ${T.border}` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', minWidth: 0 }}>
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
      {children && <div style={{ padding: '18px 20px', ...bodyStyle }}>{children}</div>}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
      {Icon && <Icon style={{ width: '12px', height: '12px', color: T.faint, flexShrink: 0 }} />}
      <span style={LABEL}>{label}</span>
    </div>
    <div style={{ fontSize: '14px', color: T.body, lineHeight: 1.45, wordBreak: 'break-word' }}>
      {children}
    </div>
  </div>
);

export const FieldGrid = ({ children, min = '190px' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '18px 30px' }}>
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
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: Icon ? '10px 14px 10px 38px' : '10px 14px',
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: '9px',
        color: '#fff', fontSize: '14px', outline: 'none',
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
      <span style={{ marginLeft: '6px', color: active ? T.accent : '#333a4d' }}>
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
export const Stepper = ({ steps, active, onSelect }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', overflowX: 'auto',
    padding: '4px 2px 10px', marginBottom: '16px',
  }}>
    {steps.map((step, i) => {
      const viewing = step.id === active;
      const meta = STEP_STATE[step.state] || STEP_STATE.todo;
      const c = tone(meta.tone);
      const done = step.state === 'done';
      const current = step.state === 'current';
      const prevDone = i > 0 && steps[i - 1].state === 'done';
      return (
        <Fragment key={step.id}>
          {i > 0 && (
            <span aria-hidden style={{
              flex: 1, minWidth: '16px', height: '2px', marginTop: '18px',
              background: prevDone ? TONES.green.bd : T.border,
            }} />
          )}
          <button
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={current ? 'step' : undefined}
            title={`${step.title} — ${meta.label}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 10px', minWidth: '120px', maxWidth: '180px', flexShrink: 0,
            }}
          >
            <span style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done || current ? c.bg : T.surface,
              border: `1.5px solid ${done || current ? c.bd : T.border}`,
              color: done || current ? c.fg : T.faint,
              fontSize: '13px', fontWeight: 700,
              // the step you are reading gets a ring; the record's own position does not move
              boxShadow: viewing ? `0 0 0 4px ${TONES.purple.bg}, 0 0 0 5px ${TONES.purple.bd}` : 'none',
              transition: 'box-shadow 0.15s, background 0.15s',
            }}>
              {done ? <Check style={{ width: '17px', height: '17px' }} /> : i + 1}
            </span>
            <span style={{
              fontSize: '13px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25,
              color: viewing ? '#fff' : current ? T.body : T.muted,
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
  color: '#fff', fontSize: '14px', outline: 'none',
};

export const FormGrid = ({ children, min = '260px' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '16px' }}>
    {children}
  </div>
);

const Labelled = ({ label, hint, required, children, span }) => (
  <div style={span ? { gridColumn: '1 / -1' } : undefined}>
    <label style={{ ...LABEL, display: 'block', marginBottom: '7px' }}>
      {label}{required && <span style={{ color: TONES.red.fg }}> *</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: '12px', color: T.faint, marginTop: '6px' }}>{hint}</p>}
  </div>
);

export const Input = ({ label, hint, required, span, readOnly, style, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <input
      readOnly={readOnly}
      style={{ ...CONTROL, ...(readOnly ? { background: T.surface, color: T.muted, cursor: 'not-allowed' } : {}), ...style }}
      {...rest}
    />
  </Labelled>
);

export const Textarea = ({ label, hint, required, span = true, style, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <textarea style={{ ...CONTROL, minHeight: '96px', resize: 'vertical', ...style }} {...rest} />
  </Labelled>
);

export const Select = ({ label, hint, required, span, children, style, ...rest }) => (
  <Labelled label={label} hint={hint} required={required} span={span}>
    <select style={{ ...CONTROL, cursor: 'pointer', ...style }} {...rest}>{children}</select>
  </Labelled>
);

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
      ? <Minus style={{ width: '11px', height: '11px', color: '#fff' }} />
      : checked && <Check style={{ width: '11px', height: '11px', color: '#fff' }} />}
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
