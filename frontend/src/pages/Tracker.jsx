import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Clock, X, Calendar, CheckCircle,
  AlertTriangle, Zap, ListTodo, Trash2, Check, Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/* ═══════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════ */
const API = '/api';
const CATEGORIES = ['All Categories', 'Pipeline', 'Onboarding', 'Registration', 'Internal', 'Members'];
const TASK_CATEGORIES = ['Pipeline', 'Onboarding', 'Registration', 'Internal', 'Members'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

const CATEGORY_COLORS = {
  Pipeline: { bg: 'rgba(99,102,241,0.18)', border: '#6366f1', text: '#a5b4fc' },
  Onboarding: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', text: '#fcd34d' },
  Registration: { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#f9a8d4' },
  Internal: { bg: 'rgba(168,85,247,0.18)', border: '#a855f7', text: '#d8b4fe' },
  Members: { bg: 'rgba(251,146,60,0.18)', border: '#fb923c', text: '#fdba74' },
};

const PRIORITY_COLORS = {
  High: { bg: '#991b1b', color: '#fca5a5', label: 'HIGH' },
  Medium: { bg: '#854d0e', color: '#fde047', label: 'MED' },
  Low: { bg: '#166534', color: '#86efac', label: 'LOW' },
};

const SPOC_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#f97316', '#14b8a6', '#a855f7', '#ef4444', '#06b6d4'];

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getSunday = (mon) => {
  const d = new Date(mon);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
const fmtDate = (d) => d.getDate();
const fmtMonthRange = (mon, sun) => {
  const mf = mon.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const sf = sun.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${mf} — ${sf}`;
};
const fmtDateISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const parseTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const to12h = (t) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const isToday = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
};

// Returns 'green' (new/far from deadline), 'yellow' (half time passed), 'red' (overdue)
const getDeadlineStatus = (deadline, assignedDate) => {
  if (!deadline) return 'green';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const diffDays = (dl - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  // If we have an assignedDate, use half the total time as the threshold
  if (assignedDate) {
    const ad = new Date(assignedDate);
    ad.setHours(0, 0, 0, 0);
    const totalDays = (dl - ad) / (1000 * 60 * 60 * 24);
    const halfDays = totalDays / 2;
    const elapsed = (now - ad) / (1000 * 60 * 60 * 24);
    if (totalDays > 0 && elapsed >= halfDays) return 'yellow';
  } else {
    // Fallback: within 2 days of deadline
    if (diffDays <= 2) return 'yellow';
  }
  return 'green';
};

const DEADLINE_COLORS = {
  green: { bg: '#166534', color: '#86efac', border: '#22c55e', label: 'On Track', cardBg: 'rgba(34,197,94,0.18)', cardText: '#86efac' },
  yellow: { bg: '#854d0e', color: '#fde047', border: '#f59e0b', label: 'Near Deadline', cardBg: 'rgba(245,158,11,0.18)', cardText: '#fcd34d' },
  red: { bg: '#991b1b', color: '#fca5a5', border: '#ef4444', label: 'Overdue', cardBg: 'rgba(239,68,68,0.18)', cardText: '#fca5a5' },
};

/* ═══════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════ */
const INPUT = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #2d3348', backgroundColor: '#1a1e2e',
  color: '#e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const LABEL = {
  fontSize: '11px', fontWeight: 600, color: '#9ca3af',
  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', display: 'block',
};
const SELECT = {
  ...INPUT, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px',
};

/* ═══════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════ */
const StatCard = ({ label, value, color }) => (
  <div style={{
    backgroundColor: '#1a1e2e', border: '1px solid #2d3348', borderRadius: '12px',
    padding: '16px 20px', minWidth: '120px', flex: 1,
  }}>
    <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
      {label}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: color || '#e5e7eb' }}>{value}</div>
  </div>
);

/* ═══════════════════════════════════════════
   FILTER DROPDOWN
   ═══════════════════════════════════════════ */
const FilterDropdown = ({ value, options, onChange, width = 170 }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #2d3348',
          backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px',
          cursor: 'pointer', minWidth: `${width}px`, justifyContent: 'space-between',
        }}
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50,
            backgroundColor: '#1e2235', border: '1px solid #2d3348', borderRadius: '10px',
            padding: '6px', minWidth: `${width}px`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none',
                  borderRadius: '6px', backgroundColor: value === opt ? '#6366f1' : 'transparent',
                  color: value === opt ? 'white' : '#d1d5db', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (value !== opt) e.target.style.backgroundColor = '#252a3d'; }}
                onMouseLeave={(e) => { if (value !== opt) e.target.style.backgroundColor = 'transparent'; }}
              >
                {value === opt && <Check style={{ width: 14, height: 14 }} />}
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TASK CARD (on calendar)
   ═══════════════════════════════════════════ */
const TaskCard = ({ task, onClick }) => {
  const cat = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Pipeline;
  const pri = PRIORITY_COLORS[task.priority];
  const dlStatus = task.completed ? null : getDeadlineStatus(task.deadline, task.assignedDate);
  const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;
  const cardBg = task.completed ? 'rgba(100,100,100,0.15)' : (dlColor ? dlColor.cardBg : cat.bg);
  const cardBorder = task.completed ? '#4b5563' : (dlColor ? dlColor.border : cat.border);
  const cardTextColor = task.completed ? '#6b7280' : (dlColor ? dlColor.cardText : cat.text);

  return (
    <div
      onClick={() => onClick(task)}
      style={{
        backgroundColor: cardBg,
        borderLeft: `3px solid ${cardBorder}`,
        borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
        overflow: 'hidden', boxSizing: 'border-box',
        transition: 'transform 0.15s, box-shadow 0.15s',
        position: 'relative', minHeight: '42px',
        opacity: task.completed ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: cardTextColor, lineHeight: '1.3', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.completed ? 'line-through' : 'none' }}>
        {task.title}
      </div>
      <div style={{ fontSize: '11px', color: task.completed ? '#6b7280' : '#9ca3af', textDecoration: task.completed ? 'line-through' : 'none' }}>{to12h(task.startTime)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
        {task.priority === 'High' && (
          <div style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
            backgroundColor: pri.bg, color: pri.color, display: 'inline-block',
          }}>
            {pri.label}
          </div>
        )}
        {dlColor && (
          <div style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
            backgroundColor: dlColor.bg, color: dlColor.color, display: 'inline-block',
          }}>
            {dlColor.label}
          </div>
        )}
      </div>
      {task.spoc && (
        <div style={{
          position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px',
          borderRadius: '50%', backgroundColor: task.spocColor || '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 700, color: 'white',
        }}>
          {getInitials(task.spoc)}
        </div>
      )}
      {task.completed && (
        <div style={{ position: 'absolute', top: '6px', right: task.spoc ? '34px' : '8px' }}>
          <CheckCircle style={{ width: 14, height: 14, color: '#22c55e' }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCHEDULE TASK MODAL
   ═══════════════════════════════════════════ */
const ScheduleModal = ({ onClose, onSubmit, weekDays, teamMembers, initialData }) => {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    initialData
      ? {
          title: initialData.title,
          day: fmtDateISO(new Date(initialData.date)),
          startTime: initialData.startTime,
          duration: initialData.duration,
          category: initialData.category,
          priority: initialData.priority,
          spoc: initialData.spoc,
          deadline: initialData.deadline ? fmtDateISO(new Date(initialData.deadline)) : '',
        }
      : {
          title: '',
          day: fmtDateISO(weekDays[0]),
          startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
          duration: 60,
          category: 'Pipeline',
          priority: 'Medium',
          spoc: '',
          deadline: '',
        },
  );
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const spocObj = teamMembers.find((m) => m.name === form.spoc);
    onSubmit({
      ...form,
      date: form.day,
      deadline: form.deadline || null,
      spocColor: spocObj?.color || '#6366f1',
      ...(isEdit && initialData?._id ? { _id: initialData._id } : {}),
    });
    onClose();
  };

  const dayOptions = weekDays.map((d) => ({
    label: `${fmtDay(d)} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`,
    value: fmtDateISO(d),
  }));

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e2235', borderRadius: '16px', padding: '32px', width: '520px',
          maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{isEdit ? 'Edit Task' : 'Schedule New Task'}</h2>
          <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
        </div>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <label style={LABEL}>Task Title *</label>
          <input
            style={INPUT}
            placeholder="e.g. Discovery call — Arijit Singh"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            autoFocus
          />
        </div>

        {/* Day / Start Time / Duration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={LABEL}>Day</label>
            <select style={SELECT} value={form.day} onChange={(e) => set('day', e.target.value)}>
              {dayOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Start Time</label>
            <input style={INPUT} type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Duration (min)</label>
            <select style={SELECT} value={form.duration} onChange={(e) => set('duration', Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category / Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={LABEL}>Category</label>
            <select style={SELECT} value={form.category} onChange={(e) => set('category', e.target.value)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Priority</label>
            <select style={SELECT} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Deadline */}
        <div style={{ marginBottom: '20px' }}>
          <label style={LABEL}>Deadline</label>
          <input
            style={{ ...INPUT, colorScheme: 'dark' }}
            type="date"
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
          />
        </div>

        {/* SPOC */}
        <div style={{ marginBottom: '24px' }}>
          <label style={LABEL}>Assign SPOC</label>
          <select style={SELECT} value={form.spoc} onChange={(e) => set('spoc', e.target.value)}>
            <option value="">Select a team member...</option>
            {teamMembers.map((m) => (
              <option key={m._id || m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          borderTop: '1px solid #2d3348', paddingTop: '20px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: '1px solid #2d3348',
              backgroundColor: 'transparent', color: '#9ca3af', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              backgroundColor: '#6366f1', color: 'white', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            {isEdit ? 'Update Task' : 'Schedule Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   TASK DETAIL MODAL
   ═══════════════════════════════════════════ */
const TaskDetailModal = ({ task, onClose, onToggle, onDelete, onEdit }) => {
  if (!task) return null;
  const cat = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Pipeline;
  const pri = PRIORITY_COLORS[task.priority];
  const dlStatus = task.completed ? null : getDeadlineStatus(task.deadline, task.assignedDate);
  const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e2235', borderRadius: '16px', padding: '28px', width: '420px',
          border: '1px solid #2d3348',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
              backgroundColor: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
            }}>
              {task.category}
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginTop: '10px' }}>{task.title}</h2>
          </div>
          <X style={{ width: 18, height: 18, color: '#9ca3af', cursor: 'pointer', flexShrink: 0 }} onClick={onClose} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Date</div>
            <div style={{ fontSize: '13px', color: '#e5e7eb' }}>
              {new Date(task.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>
          <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Time</div>
            <div style={{ fontSize: '13px', color: '#e5e7eb' }}>{to12h(task.startTime)} · {task.duration} min</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Priority</div>
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
              backgroundColor: pri.bg, color: pri.color,
            }}>
              {task.priority}
            </span>
          </div>
          <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Assigned To</div>
            <div style={{ fontSize: '13px', color: '#e5e7eb' }}>{task.spoc || 'Unassigned'}</div>
            {task.assignedDate && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                on {new Date(task.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {task.deadline && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Deadline</div>
              <div style={{ fontSize: '13px', color: '#e5e7eb' }}>
                {new Date(task.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ backgroundColor: '#161b2e', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Status</div>
              {dlColor ? (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
                  backgroundColor: dlColor.bg, color: dlColor.color,
                }}>
                  {dlColor.label}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#22c55e' }}>Completed</span>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: task.completed ? '#22c55e' : '#9ca3af' }}>
            {task.completed ? '✓ Completed' : '○ Pending'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #2d3348', paddingTop: '16px' }}>
          <button
            onClick={() => onToggle(task._id)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #2d3348',
              backgroundColor: task.completed ? '#1a1e2e' : '#166534', color: task.completed ? '#9ca3af' : '#86efac',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <CheckCircle style={{ width: 14, height: 14 }} />
            {task.completed ? 'Mark Pending' : 'Mark Done'}
          </button>
          <button
            onClick={() => onEdit(task)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #2d3348',
              backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task._id)}
            style={{
              padding: '10px 16px', borderRadius: '10px', border: '1px solid #991b1b',
              backgroundColor: '#1a1e2e', color: '#fca5a5', fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AGENDA VIEW
   ═══════════════════════════════════════════ */
const AgendaView = ({ tasks, weekDays, onTaskClick }) => {
  const grouped = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => { map[fmtDateISO(d)] = []; });
    tasks.forEach((t) => {
      const key = fmtDateISO(new Date(t.date));
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [tasks, weekDays]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {weekDays.map((day) => {
        const key = fmtDateISO(day);
        const dayTasks = grouped[key] || [];
        const today = isToday(day);
        return (
          <div key={key}>
            <div style={{
              fontSize: '13px', fontWeight: 700, color: today ? '#6366f1' : '#9ca3af',
              marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>{fmtDay(day)} {day.getDate()} {day.toLocaleDateString('en-GB', { month: 'short' })}</span>
              {today && <span style={{ fontSize: '10px', backgroundColor: '#6366f1', color: 'white', padding: '1px 8px', borderRadius: '10px' }}>TODAY</span>}
              <span style={{ fontSize: '11px', color: '#6b7280' }}>({dayTasks.length} tasks)</span>
            </div>
            {dayTasks.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#4b5563', padding: '8px 16px', backgroundColor: '#161b2e', borderRadius: '8px' }}>
                No tasks scheduled
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayTasks.map((t) => {
                  const cat = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Pipeline;
                  const pri = PRIORITY_COLORS[t.priority];
                  const tdlStatus = t.completed ? null : getDeadlineStatus(t.deadline, t.assignedDate);
                  const tdlColor = tdlStatus ? DEADLINE_COLORS[tdlStatus] : null;
                  return (
                    <div
                      key={t._id}
                      onClick={() => onTaskClick(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                        backgroundColor: t.completed ? 'rgba(100,100,100,0.1)' : (tdlColor ? tdlColor.cardBg : '#161b2e'),
                        borderRadius: '10px', borderLeft: `3px solid ${t.completed ? '#4b5563' : (tdlColor ? tdlColor.border : cat.border)}`,
                        cursor: 'pointer', transition: 'background-color 0.15s',
                        opacity: t.completed ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e2235'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.completed ? 'rgba(100,100,100,0.1)' : (tdlColor ? tdlColor.cardBg : '#161b2e'); }}
                    >
                      <div style={{ width: '60px', fontSize: '12px', color: t.completed ? '#6b7280' : '#9ca3af', fontWeight: 600, textDecoration: t.completed ? 'line-through' : 'none' }}>{to12h(t.startTime)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: t.completed ? '#6b7280' : (tdlColor ? tdlColor.cardText : '#e5e7eb'), textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.category} · {t.duration} min</div>
                      </div>
                      {tdlColor && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                          backgroundColor: tdlColor.bg, color: tdlColor.color,
                        }}>
                          {tdlColor.label}
                        </span>
                      )}
                      {t.priority === 'High' && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                          backgroundColor: pri.bg, color: pri.color,
                        }}>
                          HIGH
                        </span>
                      )}
                      {t.spoc && (
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          backgroundColor: t.spocColor || '#6366f1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: 'white',
                        }}>
                          {getInitials(t.spoc)}
                        </div>
                      )}
                      {t.completed && <CheckCircle style={{ width: 16, height: 16, color: '#22c55e' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN TRACKER COMPONENT
   ═══════════════════════════════════════════ */
const Tracker = () => {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ thisWeek: 0, today: 0, highPriority: 0, completed: 0 });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [spocFilter, setSpocFilter] = useState('All SPOCs');
  const [viewMode, setViewMode] = useState('Week'); // 'Week' | 'Agenda'
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const weekEnd = useMemo(() => getSunday(weekStart), [weekStart]);
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const spocOptions = useMemo(() => {
    return ['All SPOCs', ...teamMembers.map((m) => m.name)];
  }, [teamMembers]);

  /* ── Fetch team members ── */
  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/users/team`);
      if (res.ok) {
        const data = await res.json();
        const members = (data.users || []).map((u, i) => ({
          ...u,
          color: SPOC_COLORS[i % SPOC_COLORS.length],
        }));
        setTeamMembers(members);
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  /* ── Fetch tasks for current week ── */
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        start: fmtDateISO(weekStart),
        end: fmtDateISO(weekEnd),
      });
      if (categoryFilter !== 'All Categories') params.set('category', categoryFilter);
      if (spocFilter !== 'All SPOCs') params.set('spoc', spocFilter);

      const res = await authFetch(`${API}/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  }, [authFetch, weekStart, weekEnd, categoryFilter, spocFilter]);

  /* ── Fetch stats ── */
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        start: fmtDateISO(weekStart),
        end: fmtDateISO(weekEnd),
      });
      const res = await authFetch(`${API}/tasks/stats?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
  }, [authFetch, weekStart, weekEnd]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchTeamMembers();
      setLoading(false);
    };
    load();
  }, [fetchTeamMembers]);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  /* ── Create / Update task ── */
  const handleSaveTask = async (form) => {
    try {
      if (form._id) {
        // Update
        const res = await authFetch(`${API}/tasks/${form._id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update task');
        toast.success('Task updated');
      } else {
        // Create
        const res = await authFetch(`${API}/tasks`, {
          method: 'POST',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to create task');
        toast.success('Task scheduled');
      }
      fetchTasks();
      fetchStats();
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ── Toggle completed ── */
  const handleToggle = async (id) => {
    try {
      const res = await authFetch(`${API}/tasks/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
      toast.success('Task status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ── Delete task ── */
  const handleDelete = async (id) => {
    try {
      const res = await authFetch(`${API}/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ── Edit (opens schedule modal with data) ── */
  const handleEdit = (task) => {
    setSelectedTask(null);
    setEditingTask(task);
    setShowScheduleModal(true);
  };

  /* ── Week navigation ── */
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(getMonday(new Date()));

  /* ── Filter tasks by search query ── */
  const searchedTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.spoc && t.spoc.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  /* ── Tasks grouped by day and time for week view ── */
  const tasksByDay = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => { map[fmtDateISO(d)] = []; });
    searchedTasks.forEach((t) => {
      const key = fmtDateISO(new Date(t.date));
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [searchedTasks, weekDays]);

  const todayStr = fmtDateISO(new Date());

  return (
    <div style={{ padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: 0 }}>Productivity Tracker</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Weekly calendar view of all tasks and scheduled activities</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={goToday}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: '1px solid #2d3348',
              backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Today
          </button>
          <button
            onClick={() => { setEditingTask(null); setShowScheduleModal(true); }}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: 'none',
              backgroundColor: '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Schedule Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
        <StatCard label="This Week" value={stats.thisWeek} />
        <StatCard label="Today" value={stats.today} color="#6366f1" />
        <StatCard label="High Priority" value={stats.highPriority} color="#f59e0b" />
        <StatCard label="Completed" value={stats.completed} color="#22c55e" />
      </div>

      {/* Controls Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={prevWeek} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', minWidth: '220px', textAlign: 'center' }}>
            {fmtMonthRange(weekStart, weekEnd)}
          </span>
          <button onClick={nextWeek} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}>
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Search + Filters + View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '180px', padding: '8px 12px 8px 32px', background: '#141720', border: '1px solid #2d3348', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <FilterDropdown value={categoryFilter} options={CATEGORIES} onChange={setCategoryFilter} width={160} />
          <FilterDropdown value={spocFilter} options={spocOptions} onChange={setSpocFilter} width={150} />
          <div style={{
            display: 'flex', borderRadius: '8px', border: '1px solid #2d3348', overflow: 'hidden', marginLeft: '8px',
          }}>
            {['Week', 'Agenda'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '8px 16px', border: 'none', fontSize: '13px', fontWeight: 600,
                  backgroundColor: viewMode === mode ? '#6366f1' : '#1a1e2e',
                  color: viewMode === mode ? 'white' : '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar / Agenda */}
      <div style={{
        flex: 1, overflow: 'auto', borderRadius: '12px', border: '1px solid #2d3348',
        backgroundColor: '#13161f',
      }}>
        {viewMode === 'Agenda' ? (
          <div style={{ padding: '20px' }}>
            <AgendaView tasks={searchedTasks} weekDays={weekDays} onTaskClick={setSelectedTask} />
          </div>
        ) : (
          /* Week Calendar View */
          (() => {
            /* ── Compute extra height each hour needs per-day (for stacked tasks) ── */
            const CARD_H = 62; // fixed card height in px
            const CARD_GAP = 4;
            const BASE_SLOT_H = 70;

            // Build a map: dayKey → hour → [tasks]
            const hourTaskMap = {}; // { dayKey: { hour: [task,...] } }
            weekDays.forEach((day) => {
              const dk = fmtDateISO(day);
              hourTaskMap[dk] = {};
              const dt = tasksByDay[dk] || [];
              dt.forEach((task) => {
                const h = Math.floor(parseTime(task.startTime) / 60);
                if (!hourTaskMap[dk][h]) hourTaskMap[dk][h] = [];
                hourTaskMap[dk][h].push(task);
              });
            });

            // For each hour, find the max tasks across all 7 days
            const hourMaxTasks = {};
            HOURS.forEach((h) => {
              let max = 0;
              weekDays.forEach((day) => {
                const dk = fmtDateISO(day);
                const count = (hourTaskMap[dk]?.[h] || []).length;
                if (count > max) max = count;
              });
              hourMaxTasks[h] = max;
            });

            // Compute actual slot height for each hour
            const slotHeight = (h) => {
              const n = hourMaxTasks[h] || 0;
              if (n <= 1) return BASE_SLOT_H;
              return Math.max(BASE_SLOT_H, n * (CARD_H + CARD_GAP) + 8);
            };

            const totalHeight = 52 + HOURS.reduce((sum, h) => sum + slotHeight(h), 0);

            return (
          <div style={{ display: 'flex', minHeight: `${totalHeight}px` }}>
            {/* Time gutter */}
            <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #1e2235' }}>
              <div style={{ height: '52px', borderBottom: '1px solid #1e2235' }} />
              {HOURS.map((h) => (
                <div key={h} style={{
                  height: `${slotHeight(h)}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  paddingTop: '4px', fontSize: '11px', color: '#6b7280', fontWeight: 500,
                  borderBottom: '1px solid #1a1d28',
                }}>
                  {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const dayKey = fmtDateISO(day);
              const today = dayKey === todayStr;

              return (
                <div
                  key={dayKey}
                  style={{
                    flex: 1, borderRight: dayIdx < 6 ? '1px solid #1e2235' : 'none',
                    backgroundColor: today ? 'rgba(99,102,241,0.04)' : 'transparent',
                  }}
                >
                  {/* Day header */}
                  <div style={{
                    height: '52px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    borderBottom: '1px solid #1e2235', position: 'sticky', top: 0,
                    backgroundColor: today ? 'rgba(99,102,241,0.08)' : '#13161f', zIndex: 2,
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: today ? '#818cf8' : '#6b7280', letterSpacing: '0.5px' }}>
                      {fmtDay(day)}
                    </div>
                    <div style={{
                      fontSize: '18px', fontWeight: 700,
                      width: today ? '32px' : 'auto', height: today ? '32px' : 'auto',
                      borderRadius: today ? '50%' : '0',
                      backgroundColor: today ? '#6366f1' : 'transparent',
                      color: today ? 'white' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {fmtDate(day)}
                    </div>
                  </div>

                  {/* Hour slots with tasks stacked inside */}
                  {HOURS.map((h) => {
                    const slotTasks = (hourTaskMap[dayKey]?.[h] || []);
                    return (
                      <div key={h} style={{
                        height: `${slotHeight(h)}px`,
                        borderBottom: '1px solid #1a1d28',
                        padding: slotTasks.length ? '4px 4px 0' : 0,
                        display: 'flex', flexDirection: 'column', gap: `${CARD_GAP}px`,
                        boxSizing: 'border-box',
                      }}>
                        {slotTasks.map((task) => (
                          <TaskCard key={task._id} task={task} onClick={setSelectedTask} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
            );
          })()
        )}
      </div>

      {/* Modals */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => { setShowScheduleModal(false); setEditingTask(null); }}
          onSubmit={handleSaveTask}
          weekDays={weekDays}
          teamMembers={teamMembers}
          initialData={editingTask}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};

export default Tracker;
