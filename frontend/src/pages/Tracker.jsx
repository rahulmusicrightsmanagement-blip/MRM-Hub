import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Clock, X, Calendar, CheckCircle,
  AlertTriangle, Zap, ListTodo, Trash2, Check, Search, ExternalLink, User, Users, AlarmClock,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useGuestGuard } from '../hooks/useGuestGuard';

/* ═══════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════ */
const API = '/api';
const PRIORITIES = ['High', 'Medium', 'Low'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

const CATEGORY_COLORS = {
  Pipeline: { bg: 'rgba(46, 125, 50, 0.18)', border: 'rgba(165, 214, 167, 0.75)', text: '#256B29' },
  Onboarding: { bg: 'rgba(249, 168, 37, 0.18)', border: '#FFE082', text: '#7A4400' },
  Registration: { bg: 'rgba(216, 27, 96, 0.18)', border: '#F8BBD0', text: '#AD1457' },
  Internal: { bg: 'rgba(46, 125, 50, 0.18)', border: 'rgba(165, 214, 167, 0.75)', text: '#256B29' },
  Members: { bg: 'rgba(239, 108, 0, 0.18)', border: '#FFCCBC', text: '#BF360C' },
};
const FALLBACK_CAT_COLORS = [
  { bg: 'rgba(46, 125, 50, 0.18)', border: 'rgba(165, 214, 167, 0.75)', text: '#256B29' },
  { bg: 'rgba(249, 168, 37, 0.18)', border: '#FFE082', text: '#7A4400' },
  { bg: 'rgba(67, 160, 71, 0.18)', border: '#66BB6A', text: '#2E7D32' },
  { bg: 'rgba(216, 27, 96, 0.18)', border: '#F8BBD0', text: '#AD1457' },
  { bg: 'rgba(0, 172, 193, 0.18)', border: '#B2DFDB', text: '#004D40' },
];
const getCategoryColor = (cat, allCats) => CATEGORY_COLORS[cat] || FALLBACK_CAT_COLORS[allCats.indexOf(cat) % FALLBACK_CAT_COLORS.length] || FALLBACK_CAT_COLORS[0];

const PRIORITY_COLORS = {
  High: { bg: '#FFEBEE', color: '#B71C1C', label: 'HIGH' },
  Medium: { bg: '#FFF8E1', color: '#7A4400', label: 'MED' },
  Low: { bg: '#E8F5E9', color: '#2E7D32', label: 'LOW' },
};

const SPOC_COLORS = ['#256B29', '#2E7D32', '#7A4400', '#AD1457', '#0D47A1', '#BF360C', '#004D40', '#256B29', '#B71C1C', '#004D40'];

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
/* The date a task sits on: when it was assigned (task.date) or when it is due
   (task.deadline). Only placement changes — the task itself is untouched. */
const placeDateOf = (task, dateMode) => (dateMode === 'deadline' ? task.deadline : task.date);
const fmtShort = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

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

// Returns 'green' (far from deadline), 'yellow' (near/half time passed), 'red' (overdue)
const getDeadlineStatus = (deadline, assignedDate) => {
  if (!deadline) return 'green';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const diffDays = (dl - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  // Always flag "near deadline" when within 2 days — matches SocietyReg pill logic
  if (diffDays <= 2) return 'yellow';
  // Also flag yellow once half the assigned window has elapsed
  if (assignedDate) {
    const ad = new Date(assignedDate);
    ad.setHours(0, 0, 0, 0);
    const totalDays = (dl - ad) / (1000 * 60 * 60 * 24);
    const elapsed = (now - ad) / (1000 * 60 * 60 * 24);
    if (totalDays > 0 && elapsed >= totalDays / 2) return 'yellow';
  }
  return 'green';
};

const DEADLINE_COLORS = {
  green: { bg: '#E8F5E9', color: '#2E7D32', border: '#66BB6A', label: 'On Track', cardBg: 'rgba(67, 160, 71, 0.18)', cardText: '#2E7D32' },
  yellow: { bg: '#FFF8E1', color: '#7A4400', border: '#FFE082', label: 'Near Deadline', cardBg: 'rgba(249, 168, 37, 0.18)', cardText: '#7A4400' },
  red: { bg: '#FFEBEE', color: '#B71C1C', border: '#FFCDD2', label: 'Overdue', cardBg: 'rgba(229, 57, 53, 0.18)', cardText: '#B71C1C' },
};

/* ═══════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════ */
const INPUT = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #A5D6A7', backgroundColor: '#FFFFFF',
  color: '#1B5E20', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const LABEL = {
  fontSize: '11px', fontWeight: 600, color: '#4A6851',
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
    backgroundColor: '#FFFFFF', border: '1px solid #A5D6A7', borderRadius: '12px',
    padding: '16px 20px', minWidth: '120px', flex: 1,
  }}>
    <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A6851', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
      {label}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: color || '#1B5E20' }}>{value}</div>
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
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #A5D6A7',
          backgroundColor: '#FFFFFF', color: '#1B5E20', fontSize: '13px',
          cursor: 'pointer', minWidth: `${width}px`, justifyContent: 'space-between',
        }}
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A6851" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50,
            backgroundColor: '#FFFFFF', border: '1px solid #A5D6A7', borderRadius: '10px',
            padding: '6px', minWidth: `${width}px`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none',
                  borderRadius: '6px', backgroundColor: value === opt ? '#256B29' : 'transparent',
                  color: value === opt ? 'white' : '#fff', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (value !== opt) e.target.style.backgroundColor = '#1B5E20'; }}
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
const TaskCard = ({ task, onClick, dateMode }) => {
  const cat = getCategoryColor(task.category, []);
  const pri = PRIORITY_COLORS[task.priority];
  const dlStatus = task.completed ? null : getDeadlineStatus(task.deadline, task.assignedDate);
  const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;
  const cardBg = task.completed ? 'rgba(100,100,100,0.15)' : (dlColor ? dlColor.cardBg : cat.bg);
  const cardBorder = task.completed ? '#F1F6F1' : (dlColor ? dlColor.border : cat.border);
  const cardTextColor = task.completed ? 'rgba(165, 214, 167, 0.55)' : (dlColor ? dlColor.cardText : cat.text);

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
      <div style={{ fontSize: '11px', color: task.completed ? '#5B7362' : '#4A6851', textDecoration: task.completed ? 'line-through' : 'none' }}>
        {dateMode === 'deadline' ? `Due · assigned ${fmtShort(task.date)}` : to12h(task.startTime)}
      </div>
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
          borderRadius: '50%', backgroundColor: task.spocColor || '#256B29',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 700, color: 'white',
        }}>
          {getInitials(task.spoc)}
        </div>
      )}
      {task.completed && (
        <div style={{ position: 'absolute', top: '6px', right: task.spoc ? '34px' : '8px' }}>
          <CheckCircle style={{ width: 14, height: 14, color: '#2E7D32' }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   SCHEDULE TASK MODAL
   ═══════════════════════════════════════════ */
const ScheduleModal = ({ onClose, onSubmit, weekDays, teamMembers, initialData }) => {
  const { getOptions } = usePicklist();
  const TASK_CATEGORIES = getOptions('task_category');
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
      spocColor: spocObj?.color || '#256B29',
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
          backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '520px',
          maxHeight: '90vh', overflowY: 'auto', border: '1px solid #A5D6A7',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1B5E20' }}>{isEdit ? 'Edit Task' : 'Schedule New Task'}</h2>
          <X style={{ width: '20px', height: '20px', color: '#4A6851', cursor: 'pointer' }} onClick={onClose} />
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

        {/* Day / Start Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
            style={{ ...INPUT, colorScheme: 'light' }}
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
          borderTop: '1px solid #A5D6A7', paddingTop: '20px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: '1px solid #A5D6A7',
              backgroundColor: 'transparent', color: '#4A6851', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              backgroundColor: '#256B29', color: 'white', fontSize: '14px',
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
const TaskDetailModal = ({ task, onClose, onToggle, onDelete, onEdit, onOpenSource }) => {
  if (!task) return null;
  // Mirrored from Client Task's "Task for SPOC" — edited and deleted there.
  const fromSpocTask = task.sourceType === 'spoctask';
  const cat = getCategoryColor(task.category, []);
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
          backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '28px', width: '420px',
          border: '1px solid #A5D6A7',
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
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1B5E20', marginTop: '10px' }}>{task.title}</h2>
          </div>
          <X style={{ width: 18, height: 18, color: '#4A6851', cursor: 'pointer', flexShrink: 0 }} onClick={onClose} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Date</div>
            <div style={{ fontSize: '13px', color: '#1B5E20' }}>
              {new Date(task.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Time</div>
            <div style={{ fontSize: '13px', color: '#1B5E20' }}>{to12h(task.startTime)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Priority</div>
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
              backgroundColor: pri.bg, color: pri.color,
            }}>
              {task.priority}
            </span>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Assigned To</div>
            <div style={{ fontSize: '13px', color: '#1B5E20' }}>{task.spoc || 'Unassigned'}</div>
            {task.assignedDate && (
              <div style={{ fontSize: '11px', color: '#5B7362', marginTop: '4px' }}>
                on {new Date(task.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {task.deadline && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Deadline</div>
              <div style={{ fontSize: '13px', color: '#1B5E20' }}>
                {new Date(task.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', color: '#5B7362', marginBottom: '4px' }}>Status</div>
              {dlColor ? (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
                  backgroundColor: dlColor.bg, color: dlColor.color,
                }}>
                  {dlColor.label}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#2E7D32' }}>Completed</span>
              )}
            </div>
          </div>
        )}

        {fromSpocTask && (
          <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#E8F5E9', border: '1px solid #CFE5D1' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#4A6851', marginBottom: '6px' }}>
              SPOC task · from Client Task
            </div>
            <div style={{ fontSize: '13px', color: '#2F4A36', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
              {task.notes || task.title}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: task.completed ? '#2E7D32' : '#4A6851' }}>
            {task.completed ? '✓ Completed' : '○ Pending'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #A5D6A7', paddingTop: '16px' }}>
          <button
            onClick={() => onToggle(task._id)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #A5D6A7',
              backgroundColor: task.completed ? '#FFFFFF' : '#E8F5E9', color: task.completed ? '#4A6851' : '#2E7D32',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <CheckCircle style={{ width: 14, height: 14 }} />
            {task.completed ? 'Mark Pending' : 'Mark Done'}
          </button>
          {fromSpocTask ? (
            <button
              onClick={onOpenSource}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #A5D6A7',
                backgroundColor: '#FFFFFF', color: '#1B5E20', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Open in Client Task
            </button>
          ) : (
            <>
            <button
              onClick={() => onEdit(task)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #A5D6A7',
                backgroundColor: '#FFFFFF', color: '#1B5E20', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(task._id)}
              style={{
                padding: '10px 16px', borderRadius: '10px', border: '1px solid #FFCDD2',
                backgroundColor: '#FFFFFF', color: '#B71C1C', fontSize: '13px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AGENDA VIEW
   ═══════════════════════════════════════════ */
const AgendaView = ({ tasks, weekDays, onTaskClick, dateMode }) => {
  const grouped = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => { map[fmtDateISO(d)] = []; });
    tasks.forEach((t) => {
      const placed = placeDateOf(t, dateMode);
      if (!placed) return;
      const key = fmtDateISO(new Date(placed));
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [tasks, weekDays, dateMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {weekDays.map((day) => {
        const key = fmtDateISO(day);
        const dayTasks = grouped[key] || [];
        const today = isToday(day);
        return (
          <div key={key}>
            <div style={{
              fontSize: '13px', fontWeight: 700, color: today ? '#256B29' : '#4A6851',
              marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>{fmtDay(day)} {day.getDate()} {day.toLocaleDateString('en-GB', { month: 'short' })}</span>
              {today && <span style={{ fontSize: '10px', backgroundColor: '#256B29', color: 'white', padding: '1px 8px', borderRadius: '10px' }}>TODAY</span>}
              <span style={{ fontSize: '11px', color: '#5B7362' }}>({dayTasks.length} tasks)</span>
            </div>
            {dayTasks.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#5B7362', padding: '8px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px' }}>
                No tasks scheduled
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayTasks.map((t) => {
                  const cat = getCategoryColor(t.category, []);
                  const pri = PRIORITY_COLORS[t.priority];
                  const tdlStatus = t.completed ? null : getDeadlineStatus(t.deadline, t.assignedDate);
                  const tdlColor = tdlStatus ? DEADLINE_COLORS[tdlStatus] : null;
                  return (
                    <div
                      key={t._id}
                      onClick={() => onTaskClick(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                        backgroundColor: t.completed ? 'rgba(100,100,100,0.1)' : (tdlColor ? tdlColor.cardBg : '#FFFFFF'),
                        borderRadius: '10px', borderLeft: `3px solid ${t.completed ? 'rgba(165, 214, 167, 0.55)' : (tdlColor ? tdlColor.border : cat.border)}`,
                        cursor: 'pointer', transition: 'background-color 0.15s',
                        opacity: t.completed ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1B5E20'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.completed ? 'rgba(100,100,100,0.1)' : (tdlColor ? tdlColor.cardBg : '#FFFFFF'); }}
                    >
                      <div style={{ width: '60px', fontSize: '12px', color: t.completed ? '#5B7362' : '#4A6851', fontWeight: 600, textDecoration: t.completed ? 'line-through' : 'none' }}>{dateMode === 'deadline' ? 'Due' : to12h(t.startTime)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: t.completed ? '#5B7362' : (tdlColor ? tdlColor.cardText : '#1B5E20'), textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: '#5B7362', marginTop: '2px', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.category}</div>
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
                          backgroundColor: t.spocColor || '#256B29',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: 'white',
                        }}>
                          {getInitials(t.spoc)}
                        </div>
                      )}
                      {t.completed && <CheckCircle style={{ width: 16, height: 16, color: '#2E7D32' }} />}
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
// Remembered per browser, like the sidebar's collapsed state.
const MINE_KEY = 'mrm.tracker.mine';
const readMine = () => {
  try { return globalThis.localStorage?.getItem(MINE_KEY) === '1'; } catch { return false; }
};
const DATE_MODE_KEY = 'mrm.tracker.dateMode';
const readDateMode = () => {
  try { return globalThis.localStorage?.getItem(DATE_MODE_KEY) === 'deadline' ? 'deadline' : 'assigned'; } catch { return 'assigned'; }
};

const Tracker = () => {
  const { authFetch, user, isFullAccess } = useAuth();
  const { addToast } = useToast();
  const { isGuest, guardAction, blockGuestAction } = useGuestGuard();
  const { getOptions } = usePicklist();
  const TASK_CATEGORIES = getOptions('task_category');
  const CATEGORIES = ['All Categories', ...TASK_CATEGORIES];

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ thisWeek: 0, today: 0, highPriority: 0, completed: 0 });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [spocFilter, setSpocFilter] = useState('All SPOCs');
  // "My calendar": only the signed-in user's work. Non-full-access users only
  // ever get their own tasks from the API, so for them it is always on.
  const [mineOnly, setMineOnly] = useState(readMine);
  const showMine = !isFullAccess || mineOnly;
  const effectiveSpoc = showMine ? (user?.name || '') : spocFilter;
  // 'assigned' places tasks on the day they were assigned, 'deadline' on the
  // day they are due. Tasks with no deadline have no place in deadline view.
  const [dateMode, setDateModeState] = useState(readDateMode);
  const setDateMode = (next) => {
    setDateModeState(next);
    try { globalThis.localStorage?.setItem(DATE_MODE_KEY, next); } catch { /* not worth recovering from */ }
  };
  const toggleMine = (next) => {
    setMineOnly(next);
    try { globalThis.localStorage?.setItem(MINE_KEY, next ? '1' : '0'); } catch { /* not worth recovering from */ }
  };
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
      const params = dateMode === 'deadline'
        // Deadlines carry a time of day, so the week is sent as exact local bounds.
        ? new URLSearchParams({ dateField: 'deadline', start: weekStart.toISOString(), end: weekEnd.toISOString() })
        : new URLSearchParams({ start: fmtDateISO(weekStart), end: fmtDateISO(weekEnd) });
      if (categoryFilter !== 'All Categories') params.set('category', categoryFilter);
      if (effectiveSpoc && effectiveSpoc !== 'All SPOCs') params.set('spoc', effectiveSpoc);

      const res = await authFetch(`${API}/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  }, [authFetch, weekStart, weekEnd, categoryFilter, effectiveSpoc, dateMode]);

  /* ── Fetch stats ── */
  const fetchStats = useCallback(async () => {
    try {
      const params = dateMode === 'deadline'
        // Deadlines carry a time of day, so the week is sent as exact local bounds.
        ? new URLSearchParams({ dateField: 'deadline', start: weekStart.toISOString(), end: weekEnd.toISOString() })
        : new URLSearchParams({ start: fmtDateISO(weekStart), end: fmtDateISO(weekEnd) });
      if (effectiveSpoc && effectiveSpoc !== 'All SPOCs') params.set('spoc', effectiveSpoc);
      const res = await authFetch(`${API}/tasks/stats?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
  }, [authFetch, weekStart, weekEnd, effectiveSpoc, dateMode]);

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

  /* ── Notification deep-link: open the referenced task ── */
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = (params.get('notifType') || '').toLowerCase();
    const id = params.get('notifId');
    if (!id || !type.includes('task')) return;

    let cancelled = false;
    (async () => {
      const clearUrl = () => {
        const clean = new URLSearchParams(location.search);
        clean.delete('notifType');
        clean.delete('notifId');
        const qs = clean.toString();
        navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
      };

      const hit = tasks.find((t) => t._id === id);
      if (hit) {
        clearUrl();
        if (isGuest) setSelectedTask(hit);
        else setEditingTask(hit);
        return;
      }

      try {
        const res = await authFetch(`${API}/tasks/${id}`);
        if (cancelled) return;
        if (res.status === 404) {
          clearUrl();
          addToast('This task was deleted and is no longer available.', 'error');
          return;
        }
        if (res.status === 403) {
          clearUrl();
          addToast('You do not have access to this task.', 'error');
          return;
        }
        if (!res.ok) {
          clearUrl();
          return;
        }
        const data = await res.json();
        if (!cancelled && data.task) {
          clearUrl();
          const taskDate = new Date(data.task.date);
          setWeekStart(getMonday(taskDate));
          if (isGuest) setSelectedTask(data.task);
          else setEditingTask(data.task);
        }
      } catch (err) {
        console.error('Notif task fetch failed:', err);
        if (!cancelled) clearUrl();
      }
    })();
    return () => { cancelled = true; };
  }, [location.search, location.key, tasks, authFetch, location.pathname, navigate, isGuest]);

  /* ── Create / Update task ── */
  const handleSaveTask = async (form) => {
    if (blockGuestAction()) return;
    try {
      if (form._id) {
        // Update
        const res = await authFetch(`${API}/tasks/${form._id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update task');
        addToast('Task updated');
      } else {
        // Create
        const res = await authFetch(`${API}/tasks`, {
          method: 'POST',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to create task');
        addToast('Task scheduled');
      }
      fetchTasks();
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  /* ── Toggle completed ── */
  const handleToggle = async (id) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`${API}/tasks/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
      addToast('Task status updated');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  /* ── Delete task ── */
  const handleDelete = async (id) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`${API}/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
      addToast('Task deleted');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  /* ── Edit (opens schedule modal with data) ── */
  const handleEdit = (task) => {
    if (blockGuestAction()) return;
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
      (t._id && t._id.toLowerCase().includes(q)) ||
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
      const placed = placeDateOf(t, dateMode);
      if (!placed) return;
      const key = fmtDateISO(new Date(placed));
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [searchedTasks, weekDays, dateMode]);

  const todayStr = fmtDateISO(new Date());

  return (
    <div style={{ padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1B5E20', margin: 0 }}>Productivity Tracker</h1>
          <p style={{ fontSize: '13px', color: '#5B7362', marginTop: '4px' }}>{dateMode === 'deadline'
            ? (showMine ? 'Your tasks, placed on the day they are due' : 'All tasks, placed on the day they are due')
            : (showMine ? 'Your tasks and scheduled activities for the week' : 'Weekly calendar view of all tasks and scheduled activities')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={goToday}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: '1px solid #A5D6A7',
              backgroundColor: '#FFFFFF', color: '#1B5E20', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Today
          </button>
          <button
            onClick={() => guardAction(() => { setEditingTask(null); setShowScheduleModal(true); })}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: 'none',
              backgroundColor: '#256B29', color: 'white', fontSize: '13px', fontWeight: 600,
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
        <StatCard label={dateMode === 'deadline' ? 'Due This Week' : 'This Week'} value={stats.thisWeek} />
        <StatCard label={dateMode === 'deadline' ? 'Due Today' : 'Today'} value={stats.today} color="#256B29" />
        <StatCard label="High Priority" value={stats.highPriority} color="#7A4400" />
        <StatCard label="Completed" value={stats.completed} color="#2E7D32" />
      </div>

      {/* Controls Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={prevWeek} style={{ background: 'none', border: 'none', color: '#4A6851', cursor: 'pointer', padding: '4px' }}>
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1B5E20', minWidth: '220px', textAlign: 'center' }}>
            {fmtMonthRange(weekStart, weekEnd)}
          </span>
          <button onClick={nextWeek} style={{ background: 'none', border: 'none', color: '#4A6851', cursor: 'pointer', padding: '4px' }}>
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Search + Filters + View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #A5D6A7', overflow: 'hidden', marginRight: '8px' }}>
            {[['assigned', 'Assigned on'], ['deadline', 'Deadline']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setDateMode(val)}
                aria-pressed={dateMode === val}
                title={val === 'deadline' ? 'Show each task on its deadline date' : 'Show each task on the date it was assigned'}
                style={{
                  padding: '8px 14px', border: 'none', fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  backgroundColor: dateMode === val ? '#256B29' : '#FFFFFF',
                  color: dateMode === val ? 'white' : '#4A6851',
                  cursor: 'pointer',
                }}
              >
                {val === 'deadline' ? <AlarmClock size={14} /> : <Calendar size={14} />}
                {label}
              </button>
            ))}
          </div>
          {isFullAccess && (
            <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #A5D6A7', overflow: 'hidden', marginRight: '8px' }}>
              {[['Everyone', false], ['My calendar', true]].map(([label, val]) => (
                <button
                  key={label}
                  onClick={() => toggleMine(val)}
                  aria-pressed={mineOnly === val}
                  style={{
                    padding: '8px 14px', border: 'none', fontSize: '13px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: mineOnly === val ? '#256B29' : '#FFFFFF',
                    color: mineOnly === val ? 'white' : '#4A6851',
                    cursor: 'pointer',
                  }}
                >
                  {val ? <User size={14} /> : <Users size={14} />}
                  {label}
                </button>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#5B7362' }} />
            <input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '180px', padding: '8px 12px 8px 32px', background: '#FFFFFF', border: '1px solid #A5D6A7', borderRadius: '8px', color: '#1B5E20', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <FilterDropdown value={categoryFilter} options={CATEGORIES} onChange={setCategoryFilter} width={160} />
          {!showMine && (
            <FilterDropdown value={spocFilter} options={spocOptions} onChange={setSpocFilter} width={150} />
          )}
          <div style={{
            display: 'flex', borderRadius: '8px', border: '1px solid #A5D6A7', overflow: 'hidden', marginLeft: '8px',
          }}>
            {['Week', 'Agenda'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '8px 16px', border: 'none', fontSize: '13px', fontWeight: 600,
                  backgroundColor: viewMode === mode ? '#256B29' : '#FFFFFF',
                  color: viewMode === mode ? 'white' : '#4A6851',
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
        flex: 1, overflow: 'auto', borderRadius: '12px', border: '1px solid #A5D6A7',
        backgroundColor: '#E8F5E9',
      }}>
        {viewMode === 'Agenda' ? (
          <div style={{ padding: '20px' }}>
            <AgendaView tasks={searchedTasks} weekDays={weekDays} onTaskClick={setSelectedTask} dateMode={dateMode} />
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
            <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid rgba(165, 214, 167, 0.55)' }}>
              <div style={{ height: '52px', borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }} />
              {HOURS.map((h) => (
                <div key={h} style={{
                  height: `${slotHeight(h)}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  paddingTop: '4px', fontSize: '11px', color: '#5B7362', fontWeight: 500,
                  borderBottom: '1px solid rgba(165, 214, 167, 0.55)',
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
                    flex: 1, borderRight: dayIdx < 6 ? '1px solid rgba(165, 214, 167, 0.55)' : 'none',
                    backgroundColor: today ? 'rgba(46, 125, 50, 0.04)' : 'transparent',
                  }}
                >
                  {/* Day header */}
                  <div style={{
                    height: '52px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    borderBottom: '1px solid rgba(165, 214, 167, 0.55)', position: 'sticky', top: 0,
                    backgroundColor: today ? 'rgba(46, 125, 50, 0.08)' : '#E8F5E9', zIndex: 2,
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: today ? '#256B29' : '#5B7362', letterSpacing: '0.5px' }}>
                      {fmtDay(day)}
                    </div>
                    <div style={{
                      fontSize: '18px', fontWeight: 700,
                      width: today ? '32px' : 'auto', height: today ? '32px' : 'auto',
                      borderRadius: today ? '50%' : '0',
                      backgroundColor: today ? '#256B29' : 'transparent',
                      color: today ? '#fff' : '#1B5E20',
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
                        borderBottom: '1px solid rgba(165, 214, 167, 0.55)',
                        padding: slotTasks.length ? '4px 4px 0' : 0,
                        display: 'flex', flexDirection: 'column', gap: `${CARD_GAP}px`,
                        boxSizing: 'border-box',
                      }}>
                        {slotTasks.map((task) => (
                          <TaskCard key={task._id} task={task} onClick={setSelectedTask} dateMode={dateMode} />
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
          onOpenSource={() => navigate('/client-chat')}
        />
      )}
    </div>
  );
};

export default Tracker;
