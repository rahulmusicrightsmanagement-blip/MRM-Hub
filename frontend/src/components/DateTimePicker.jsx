import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');

const parseValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const toTypedString = (d) => {
  if (!d) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

// Parse strings like "14-04-2026" or "14/04/2026"
const parseTyped = (str) => {
  if (!str) return null;
  const cleaned = str.trim().replace(/\//g, '-');
  const m = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd), month = Number(mm) - 1, year = Number(yyyy);
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const d = new Date(year, month, day, 0, 0, 0, 0);
  if (d.getDate() !== day || d.getMonth() !== month || d.getFullYear() !== year) return null;
  return d;
};

const buildCalendarGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, muted: true, date: new Date(year, month - 1, prevDays - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, muted: false, date: new Date(year, month, i) });
  }
  let idx = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: idx, muted: true, date: new Date(year, month + 1, idx) });
    idx++;
  }
  return cells;
};

const sameDate = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const DateTimePicker = ({ value, onChange, placeholder = 'DD-MM-YYYY', minDate, label, required, error }) => {
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(parsed || new Date());
  const [selected, setSelected] = useState(parsed);
  const [typed, setTyped] = useState(parsed ? toTypedString(parsed) : '');
  const [typedError, setTypedError] = useState('');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    const p = parseValue(value);
    setSelected(p);
    setTyped(p ? toTypedString(p) : '');
    if (p) setViewDate(p);
  }, [value]);

  useEffect(() => {
    const onClick = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 300;
    const popHeight = 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    if (left + popWidth > vw - 12) left = vw - popWidth - 12;
    if (left < 12) left = 12;

    let top = rect.bottom + 8;
    if (top + popHeight > vh - 12) {
      top = Math.max(12, rect.top - popHeight - 8);
    }
    setPopoverPos({ top, left, width: popWidth });
  }, [open]);

  const grid = useMemo(() => buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const minD = parseValue(minDate);
  const today = new Date();

  const commit = (d) => {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    onChange(out.toISOString());
    setSelected(out);
    setTyped(toTypedString(out));
    setTypedError('');
  };

  const isDisabled = (d) => {
    if (!minD) return false;
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const minDay = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate()).getTime();
    return day < minDay;
  };

  const handleDayClick = (cell) => {
    if (cell.muted) {
      setViewDate(cell.date);
      return;
    }
    if (isDisabled(cell.date)) return;
    commit(cell.date);
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
    setSelected(null);
    setTyped('');
    setTypedError('');
  };

  const setToday = () => {
    const now = new Date();
    setViewDate(now);
    commit(now);
    setOpen(false);
  };

  const autoFormat = (raw, prev) => {
    if (raw.length < prev.length) return raw;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = '';
    if (digits.length > 0) out += digits.slice(0, 2);
    if (digits.length >= 2) out += (digits.length > 2 ? '-' : '');
    if (digits.length >= 3) out += digits.slice(2, 4);
    if (digits.length >= 4) out += (digits.length > 4 ? '-' : '');
    if (digits.length >= 5) out += digits.slice(4, 8);
    return out;
  };

  const handleTypedChange = (e) => {
    let v = autoFormat(e.target.value, typed);
    setTyped(v);
    if (v === '') {
      setTypedError('');
      onChange('');
      setSelected(null);
      return;
    }
    const parsedDate = parseTyped(v);
    if (parsedDate) {
      setTypedError('');
      if (minD && parsedDate < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())) {
        setTypedError('Date must not be before minimum');
        return;
      }
      setViewDate(parsedDate);
      setSelected(parsedDate);
      onChange(parsedDate.toISOString());
    }
  };

  const handleTypedBlur = () => {
    if (!typed) return;
    const parsedDate = parseTyped(typed);
    if (!parsedDate) {
      setTypedError('Use DD-MM-YYYY');
    } else {
      setTyped(toTypedString(parsedDate));
    }
  };

  const showError = error || typedError;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      <div
        ref={triggerRef}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '10px',
          border: `1px solid ${showError ? '#ef4444' : open ? '#6366f1' : '#2d3348'}`,
          backgroundColor: '#0f1117',
          transition: 'all 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <Calendar size={15} style={{ color: selected ? '#8b5cf6' : '#6b7280', flexShrink: 0, marginLeft: '12px' }} />
        <input
          type="text"
          value={typed}
          onChange={handleTypedChange}
          onBlur={handleTypedBlur}
          onClick={() => setOpen(false)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '11px 10px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#e5e7eb',
            fontSize: '13px',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            letterSpacing: '0.3px',
            minWidth: 0,
          }}
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}
          >
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            background: open ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
            border: 'none',
            padding: '10px 12px',
            cursor: 'pointer',
            color: open ? 'white' : '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            borderLeft: '1px solid #2d3348',
            transition: 'all 0.15s',
          }}
          aria-label="Open calendar"
        >
          <Calendar size={14} />
        </button>
      </div>

      {showError && (
        <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{showError}</div>
      )}

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            width: popoverPos.width,
            zIndex: 10000,
            background: 'linear-gradient(180deg, #191d2b 0%, #141720 100%)',
            border: '1px solid #2d3348',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '6px' }}>
            <NavBtn onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </NavBtn>
            <div style={{ display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' }}>
              <select
                value={viewDate.getMonth()}
                onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value), 1))}
                style={selectStyle}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewDate.getFullYear()}
                onChange={(e) => setViewDate(new Date(Number(e.target.value), viewDate.getMonth(), 1))}
                style={selectStyle}
              >
                {Array.from({ length: 21 }, (_, i) => viewDate.getFullYear() - 10 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <NavBtn onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
              <ChevronRight size={14} />
            </NavBtn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '12px' }}>
            {grid.map((cell, i) => {
              const isSel = sameDate(cell.date, selected);
              const isToday = sameDate(cell.date, today);
              const disabled = isDisabled(cell.date);
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => handleDayClick(cell)}
                  style={{
                    height: '34px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isSel ? 700 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: isSel ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    color: disabled ? '#3f4558' : cell.muted ? '#4b5266' : isSel ? 'white' : isToday ? '#a78bfa' : '#d1d5db',
                    outline: isToday && !isSel ? '1px solid rgba(167,139,250,0.4)' : 'none',
                    outlineOffset: '-1px',
                    transition: 'all 0.12s',
                    opacity: disabled ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel && !disabled) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={setToday} style={quickBtn}>Today</button>
            <button type="button" onClick={() => setOpen(false)} style={{ ...quickBtn, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '26px',
      height: '26px',
      borderRadius: '7px',
      border: '1px solid #2d3348',
      background: '#0f1117',
      color: '#9ca3af',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {children}
  </button>
);

const selectStyle = {
  background: '#0f1117',
  border: '1px solid #2d3348',
  color: '#e5e7eb',
  padding: '4px 6px',
  borderRadius: '7px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
};

const quickBtn = {
  flex: 1,
  padding: '7px 12px',
  borderRadius: '8px',
  border: '1px solid #2d3348',
  background: '#0f1117',
  color: '#9ca3af',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default DateTimePicker;
