import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, Check, Copy, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const fmtDateISO = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const getDeadlineStatus = (deadline) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline); dl.setHours(0, 0, 0, 0);
  const diffDays = (dl - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  if (diffDays <= 2) return 'yellow';
  return 'green';
};
const DEADLINE_COLORS = {
  green: { bg: '#166534', color: '#86efac', border: '#22c55e', label: 'On Track' },
  yellow: { bg: '#854d0e', color: '#fde047', border: '#f59e0b', label: 'Near Deadline' },
  red: { bg: '#991b1b', color: '#fca5a5', border: '#ef4444', label: 'Overdue' },
};

const statusColors = {
  Active: { bg: '#065f46', text: '#34d399' },
  Onboarding: { bg: '#713f12', text: '#fbbf24' },
  Inactive: { bg: '#374151', text: '#9ca3af' },
};

const kycColors = {
  Verified: { bg: '#065f46', text: '#34d399' },
  Pending: { bg: '#7f1d1d', text: '#f87171' },
};

const StatusBadge = ({ status, colors: colorMap }) => {
  const c = (colorMap || statusColors)[status] || { bg: '#374151', text: '#9ca3af' };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
};

/* ────────── Add Member Modal ────────── */
const ROLE_OPTIONS = ['Singer-Songwriter', 'Playback Singer', 'Composer', 'Lyricist', 'Music Producer', 'Instrumentalist'];

const MultiRoleSelect = ({ selected, onChange, inputStyle, labelStyle }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toggle = (role) => {
    onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role]);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <label style={labelStyle}>Role</label>
      <div onClick={() => setOpen(!open)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '42px', flexWrap: 'wrap', gap: '4px' }}>
        {selected.length === 0 ? <span style={{ color: '#6b7280' }}>Select roles...</span> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {selected.map((r) => (
              <span key={r} style={{ background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {r}
                <span onClick={(e) => { e.stopPropagation(); toggle(r); }} style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>&times;</span>
              </span>
            ))}
          </div>
        )}
        <span style={{ color: '#6b7280', fontSize: '12px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '8px', marginTop: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
          {ROLE_OPTIONS.map((role) => (
            <div key={role} onClick={() => toggle(role)} style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', background: selected.includes(role) ? '#2a3050' : 'transparent' }}
              onMouseEnter={(e) => { if (!selected.includes(role)) e.currentTarget.style.background = '#1e2540'; }}
              onMouseLeave={(e) => { if (!selected.includes(role)) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: selected.includes(role) ? 'none' : '2px solid #3a4060', background: selected.includes(role) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', flexShrink: 0 }}>
                {selected.includes(role) && '✓'}
              </span>
              {role}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AddMemberModal = ({ onClose, onAdd, teamMembers, initialData }) => {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    initialData
      ? { ...initialData }
      : { name: '', role: [], email: '', phone: '', genre: '', languages: '', bio: '', panCard: '', aadhaar: '', dateOfFirstContact: '', leadSource: '', priority: 'medium', isReferred: false, referredBy: '', referralCommission: '' },
  );

  const h = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    onAdd(form);
    onClose();
  };

  const inputStyle = { width: '100%', padding: '10px 14px', background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' };
  const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' };
  const sectionStyle = { fontSize: '13px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', marginTop: '8px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '560px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>{isEdit ? 'Edit Member' : 'Add New Member'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
        </div>

        {/* Personal Details */}
        <div style={sectionStyle}>Personal Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} placeholder="e.g. Prateek Kuhad" value={form.name} onChange={(e) => h('name', e.target.value)} />
          </div>
          <MultiRoleSelect selected={form.role} onChange={(v) => h('role', v)} inputStyle={inputStyle} labelStyle={labelStyle} />
          <div>
            <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} placeholder="email@example.com" value={form.email} onChange={(e) => h('email', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} placeholder="+91 98xxx xxxxx" value={form.phone} onChange={(e) => h('phone', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} placeholder="e.g. Indie Folk / Pop" value={form.genre} onChange={(e) => h('genre', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Languages (comma-separated)</label>
            <input style={inputStyle} placeholder="e.g. Hindi, English" value={form.languages} onChange={(e) => h('languages', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Bio</label>
          <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Brief description of the artist..." value={form.bio} onChange={(e) => h('bio', e.target.value)} />
        </div>

        {/* KYC */}
        <div style={{ ...sectionStyle, marginTop: '24px' }}>KYC Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>PAN Card Number</label>
            <input style={inputStyle} placeholder="e.g. ABCPK1234A" value={form.panCard} onChange={(e) => h('panCard', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Aadhaar Number</label>
            <input style={inputStyle} placeholder="e.g. XXXX-XXXX-1234" value={form.aadhaar} onChange={(e) => h('aadhaar', e.target.value)} />
          </div>
        </div>

        {/* Date of First Contact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Date of First Contact</label>
            <input type="date" style={{ ...inputStyle, colorScheme: 'dark' }} value={form.dateOfFirstContact} onChange={(e) => h('dateOfFirstContact', e.target.value)} />
          </div>
        </div>

        {/* Lead Info */}
        <div style={{ ...sectionStyle, marginTop: '24px' }}>Lead Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Lead Source</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.leadSource} onChange={(e) => h('leadSource', e.target.value)}>
              <option value="">Select source...</option>
              {['Website Form', 'LinkedIn Outreach', 'Instagram DM', 'Industry Event', 'Referral', 'Direct Outreach'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.priority} onChange={(e) => h('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Referral Info */}
        <div style={{ ...sectionStyle, marginTop: '24px' }}>Referral Information</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Is Referred?</label>
          <button
            type="button"
            onClick={() => h('isReferred', !form.isReferred)}
            style={{
              width: '42px', height: '24px', borderRadius: '12px', border: 'none',
              backgroundColor: form.isReferred ? '#22c55e' : '#374151',
              position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', left: form.isReferred ? '21px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '12px', color: form.isReferred ? '#34d399' : '#9ca3af' }}>
            {form.isReferred ? 'Yes' : 'No'}
          </span>
        </div>
        {form.isReferred && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Referred By</label>
              <input style={inputStyle} placeholder="e.g. John Doe" value={form.referredBy} onChange={(e) => h('referredBy', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Referral Commission</label>
              <input style={inputStyle} placeholder="e.g. 10% or ₹5000" value={form.referralCommission} onChange={(e) => h('referralCommission', e.target.value)} />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a3050', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isEdit ? <><Edit3 size={16} /> Save Changes</> : <><Plus size={16} /> Add Member</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────── Member Profile Modal ────────── */
const MemberProfileModal = ({ member, onClose, onUpdate, onDelete, onEdit, onAddTask, onToggleTask, teamMembers }) => {
  const [activeTab, setActiveTab] = useState('General Info');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const spocMember = teamMembers.find((m) => m.name === member.spoc);
  const completedTasks = member.subTasks.filter((t) => t.done).length;
  const totalTasks = member.subTasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const tabs = ['General Info', 'Additional Info', 'KYC', 'Unique IDs'];

  const toggleTask = (taskId) => {
    const task = member.subTasks.find((t) => t._id === taskId);
    if (task) onToggleTask(member._id, taskId, !task.done);
  };
  const addTask = () => {
    if (!newTaskText.trim()) return;
    onAddTask(member._id, newTaskText.trim(), newTaskAssignee);
    setNewTaskText('');
    setNewTaskAssignee('');
    setShowAddTask(false);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 1500);
  };

  const infoBox = { background: '#161b2e', borderRadius: '10px', padding: '14px 16px' };
  const infoLabel = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };
  const infoVal = { color: '#fff', fontSize: '14px', fontWeight: 500 };

  /* ─── Shared: SPOC + Sub-Tasks ─── */
  const renderSpocAndTasks = () => (
    <>
      {/* Assigned SPOC */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid #1e2540', borderBottom: '1px solid #1e2540', marginBottom: '16px' }}>
        <span style={{ color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned SPOC</span>
        {spocMember ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#161b2e', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{spocMember.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
            <span style={{ color: '#fff', fontWeight: 500 }}>{spocMember.name}</span>
          </span>
        ) : <span style={{ color: '#555', fontSize: '13px' }}>Not assigned</span>}
        {member.assignedDate && (
          <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>
            on {new Date(member.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Deadline */}
      {member.deadline && (() => {
        const dlStatus = getDeadlineStatus(member.deadline);
        const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e2540', marginBottom: '16px' }}>
            <span style={{ color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontSize: '13px' }}>{new Date(member.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              {dlColor && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: dlColor.bg, color: dlColor.color }}>{dlColor.label}</span>}
            </div>
          </div>
        );
      })()}

      {/* Sub-Tasks header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-Tasks</span>
          <span style={{ color: '#8892b0', fontSize: '13px' }}>{completedTasks}/{totalTasks}</span>
        </div>
        <button onClick={() => setShowAddTask(true)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div style={{ height: '4px', background: '#1e2540', borderRadius: '4px', marginBottom: '12px' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#22c55e', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {member.subTasks.map((task) => {
          const a = teamMembers.find((m) => m.name === task.assignee);
          const initials = a ? a.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '';
          return (
            <div key={task._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
              <button onClick={() => toggleTask(task._id)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: task.done ? 'none' : '2px solid #3a4060', background: task.done ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {task.done && <Check size={14} color="#fff" />}
              </button>
              <span style={{ flex: 1, color: task.done ? '#6b7280' : '#fff', fontSize: '13px', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
              {a && (
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline Add Task */}
      {showAddTask && (
        <div style={{ marginTop: '12px', padding: '14px', background: '#161b2e', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input autoFocus placeholder="Task description..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()}
            style={{ width: '100%', padding: '8px 12px', background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', cursor: 'pointer', appearance: 'auto' }}>
              <option value="">Assign to...</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </select>
            <button onClick={addTask} style={{ padding: '8px 16px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add Task</button>
            <button onClick={() => { setShowAddTask(false); setNewTaskText(''); setNewTaskAssignee(''); }}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #2a3050', borderRadius: '6px', color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );

  const renderCopyRow = (label, value, fieldKey) => (
    <div style={{ ...infoBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div>
        <div style={infoLabel}>{label}</div>
        <div style={{ ...infoVal, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{value || '—'}</div>
      </div>
      {value && (
        <button onClick={() => copyToClipboard(value, fieldKey)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === fieldKey ? '#22c55e' : '#8892b0', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {copiedField === fieldKey ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '600px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>Member Profile</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => onEdit(member)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><Edit3 size={18} /></button>
            <button onClick={() => setConfirmDelete(true)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={18} /></button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
          </div>
        </div>

        {confirmDelete && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#fca5a5' }}>Delete this member permanently?</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { onDelete(member._id); onClose(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}

        {/* Avatar + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            {member.initials}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: 0 }}>{member.name}</h3>
            <p style={{ color: '#8892b0', fontSize: '13px', margin: '2px 0 0' }}>{Array.isArray(member.role) ? member.role.join(', ') : member.role} · {member.genre || 'N/A'}</p>
          </div>
          <StatusBadge status={member.status} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#141720', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === t ? '#1e2540' : 'transparent', color: activeTab === t ? '#fff' : '#8892b0', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'General Info' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={infoBox}><div style={infoLabel}>Member ID</div><div style={infoVal}>{member._id?.slice(-6).toUpperCase() || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Email</div><div style={infoVal}>{member.email || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Phone</div><div style={infoVal}>{member.phone || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Role</div><div style={infoVal}>{Array.isArray(member.role) ? member.role.join(', ') : member.role}</div></div>
              <div style={infoBox}><div style={infoLabel}>Join Date</div><div style={infoVal}>{member.joinDate || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Status</div><div style={infoVal}>{member.status}</div></div>
            </div>
            <div style={{ ...infoBox, marginBottom: '16px' }}><div style={infoLabel}>Bio</div><div style={infoVal}>{member.bio || '—'}</div></div>
            {renderSpocAndTasks()}
          </>
        )}

        {activeTab === 'Additional Info' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={infoBox}><div style={infoLabel}>Genre</div><div style={infoVal}>{member.genre || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Languages</div><div style={infoVal}>{member.languages || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Territories</div><div style={infoVal}>{member.territories || '—'}</div></div>
              <div style={infoBox}><div style={infoLabel}>Society Registrations</div><div style={infoVal}>{member.registrations}</div></div>
            </div>
            {renderSpocAndTasks()}
          </>
        )}

        {activeTab === 'KYC' && (
          <>
            {/* KYC Status row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: '12px' }}>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>KYC Status</span>
              <StatusBadge status={member.kycStatus} colors={kycColors} />
            </div>
            {/* PAN */}
            <div style={{ ...infoBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={infoLabel}>PAN Card</div>
                <div style={infoVal}>{member.panCard || '—'}</div>
              </div>
              {member.panCard && <StatusBadge status={member.panVerified ? 'Verified' : 'Pending'} colors={kycColors} />}
            </div>
            {/* Aadhaar */}
            <div style={{ ...infoBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={infoLabel}>Aadhaar</div>
                <div style={infoVal}>{member.aadhaar || '—'}</div>
              </div>
              {member.aadhaar && <StatusBadge status={member.aadhaarVerified ? 'Verified' : 'Pending'} colors={kycColors} />}
            </div>
            {renderSpocAndTasks()}
          </>
        )}

        {activeTab === 'Unique IDs' && (
          <>
            {renderCopyRow('Member ID', member._id, 'memberId')}
            {renderCopyRow('IPI Number', member.ipiNumber, 'ipi')}
            {renderCopyRow('ISNI', member.isni, 'isni')}
            <div style={{ marginTop: '4px' }} />
            {renderSpocAndTasks()}
          </>
        )}
      </div>
    </div>
  );
};

/* ────────── Main Page ────────── */
const Members = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, usersRes] = await Promise.all([
          authFetch('/api/members'),
          authFetch('/api/users/team'),
        ]);
        const membersData = await membersRes.json();
        const usersData = await usersRes.json();
        setMembers(membersData.members || []);
        setTeamMembers(usersData.users || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authFetch]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m._id && m._id.toLowerCase().includes(q)) ||
        (m.clientNumber && m.clientNumber.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (Array.isArray(m.role) ? m.role.some((r) => r.toLowerCase().includes(q)) : (m.role || '').toLowerCase().includes(q)) ||
        (m.genre && m.genre.toLowerCase().includes(q)) ||
        (m.status && m.status.toLowerCase().includes(q)) ||
        (m.spoc && m.spoc.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const handleAddMember = async (form) => {
    try {
      const res = await authFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { setMembers((p) => [data.member, ...p]); addToast('Member added'); }
      else addToast('Failed to add member', 'error');
    } catch (err) {
      console.error('Failed to add member:', err);
      addToast('Failed to add member', 'error');
    }
  };

  const handleEditMember = (member) => {
    setSelectedMember(null);
    setEditingMember({
      _id: member._id, name: member.name, role: Array.isArray(member.role) ? member.role : [], email: member.email,
      phone: member.phone || '', genre: member.genre || '', languages: member.languages || '', bio: member.bio || '',
      panCard: member.panCard || '', aadhaar: member.aadhaar || '', dateOfFirstContact: member.dateOfFirstContact || '', spoc: member.spoc || '',
      leadSource: member.leadSource || '', priority: member.priority || 'medium',
      isReferred: member.isReferred || false, referredBy: member.referredBy || '', referralCommission: member.referralCommission || '',
    });
  };

  const handleEditSubmit = async (form) => {
    if (!editingMember) return;
    try {
      const res = await authFetch(`/api/members/${editingMember._id}`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setMembers((p) => p.map((m) => (m._id === editingMember._id ? data.member : m))); addToast('Member updated'); }
      else addToast('Failed to update member', 'error');
    } catch (err) { console.error('Failed to edit member:', err); addToast('Failed to update member', 'error'); }
  };

  const handleDeleteMember = async (memberId) => {
    try {
      const res = await authFetch(`/api/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) { setMembers((p) => p.filter((m) => m._id !== memberId)); addToast('Member deleted'); }
      else addToast('Failed to delete member', 'error');
    } catch (err) { console.error('Failed to delete member:', err); addToast('Failed to delete member', 'error'); }
  };

  const handleAddTask = async (memberId, text, assignee) => {
    try {
      const res = await authFetch(`/api/members/${memberId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ text, assignee }),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((p) => p.map((m) => (m._id === memberId ? data.member : m)));
        setSelectedMember(data.member);
        addToast('Task added');
      } else addToast('Failed to add task', 'error');
    } catch (err) {
      console.error('Failed to add task:', err);
      addToast('Failed to add task', 'error');
    }
  };

  const handleToggleTask = async (memberId, taskId, done) => {
    try {
      const res = await authFetch(`/api/members/${memberId}/subtasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ done }),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((p) => p.map((m) => (m._id === memberId ? data.member : m)));
        setSelectedMember(data.member);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading members...</div>;
  }

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 }}>Member Management</h1>
          <p style={{ color: '#8892b0', fontSize: '14px', margin: '4px 0 0' }}>Manage member profiles, KYC, and unique identifiers</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Add Member
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '24px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
        <input placeholder="Search by name, role, ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#141720', border: '1px solid #1e2540', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '60px 0' }}>
          {searchQuery ? 'No members match your search.' : 'No members yet. Click "+ Add Member" to get started.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredMembers.map((m) => (
            <div key={m._id} onClick={() => navigate(`/members/${m._id}`)}
              style={{ background: '#141720', border: '1px solid #1e2540', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e2540')}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {m.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{m.name}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div style={{ color: '#8892b0', fontSize: '12px', marginTop: '2px' }}>{Array.isArray(m.role) ? m.role.join(', ') : m.role}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditMember(m); }}
                    title="Edit member"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', borderRadius: '6px', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m._id); }}
                    title="Delete member"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', borderRadius: '6px', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {/* Stats */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px', color: '#8892b0' }}>
                <span>Registrations: <strong style={{ color: '#fff' }}>{m.registrations}</strong></span>
              </div>
              {/* Tags */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <StatusBadge status={`KYC: ${m.kycStatus}`} colors={{ 'KYC: Verified': { bg: '#065f46', text: '#34d399' }, 'KYC: Pending': { bg: '#7f1d1d', text: '#f87171' } }} />
              </div>

              {/* Delete confirmation */}
              {confirmDeleteId === m._id && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#fca5a5' }}>Delete this member?</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMember(m._id); setConfirmDeleteId(null); }} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} onAdd={handleAddMember} teamMembers={teamMembers} />}
      {editingMember && <AddMemberModal onClose={() => setEditingMember(null)} onAdd={handleEditSubmit} teamMembers={teamMembers} initialData={editingMember} />}
      {selectedMember && <MemberProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} onUpdate={() => {}} onDelete={handleDeleteMember} onEdit={handleEditMember} onAddTask={handleAddTask} onToggleTask={handleToggleTask} teamMembers={teamMembers} />}
    </div>
  );
};

export default Members;
