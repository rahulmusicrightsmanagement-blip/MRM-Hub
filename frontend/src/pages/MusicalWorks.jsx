import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Eye, X, Music, Check, ArrowRight, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';

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
  Registered: { bg: '#065f46', text: '#34d399' },
  'Pending Review': { bg: '#713f12', text: '#fbbf24' },
  Draft: { bg: '#374151', text: '#9ca3af' },
};

const StatusBadge = ({ status }) => {
  const colors = statusColors[status] || { bg: '#374151', text: '#9ca3af' };
  return (
    <span style={{ background: colors.bg, color: colors.text, padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
};

/* ────────── Add Work Modal ────────── */
const AddWorkModal = ({ onClose, onAdd, teamMembers, members }) => {
  const [form, setForm] = useState({
    title: '', artist: '', album: '', genre: '', isrc: '', iswc: '',
    language: 'Hindi', duration: '', status: 'Draft', publisher: '',
    territories: 'Worldwide', writers: '', spoc: '', deadline: '',
  });

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = () => {
    if (!form.title.trim() || !form.artist.trim()) return;
    onAdd(form);
    onClose();
  };

  const inputStyle = { width: '100%', padding: '10px 14px', background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' };
  const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '640px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>Add Musical Work</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Track Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} placeholder="e.g. Kasoor" value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
          </div>
          <div>
            <SearchableSelect
              label="Artist"
              required
              options={members}
              value={form.artist}
              onChange={(name) => handleChange('artist', name)}
              placeholder="Search member..."
              emptyMessage="No members found. Add members first."
            />
          </div>
          <div>
            <label style={labelStyle}>Album</label>
            <input style={inputStyle} placeholder="e.g. Cold/Mess" value={form.album} onChange={(e) => handleChange('album', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} placeholder="e.g. Indie Folk" value={form.genre} onChange={(e) => handleChange('genre', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ISRC</label>
            <input style={inputStyle} placeholder="e.g. INSO12000123" value={form.isrc} onChange={(e) => handleChange('isrc', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ISWC</label>
            <input style={inputStyle} placeholder="e.g. T-345.678.901-C" value={form.iswc} onChange={(e) => handleChange('iswc', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.language} onChange={(e) => handleChange('language', e.target.value)}>
              {['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Instrumental'].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duration</label>
            <input style={inputStyle} placeholder="e.g. 4:12" value={form.duration} onChange={(e) => handleChange('duration', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="Draft">Draft</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Registered">Registered</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Publisher</label>
            <input style={inputStyle} placeholder="e.g. Self-Published" value={form.publisher} onChange={(e) => handleChange('publisher', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Territories</label>
            <input style={inputStyle} placeholder="Worldwide" value={form.territories} onChange={(e) => handleChange('territories', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Writers (comma-separated)</label>
          <input style={inputStyle} placeholder="e.g. Prateek Kuhad, Amit Trivedi" value={form.writers} onChange={(e) => handleChange('writers', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Assign SPOC</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.spoc} onChange={(e) => handleChange('spoc', e.target.value)}>
              <option value="">Select a team member...</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'dark' }} value={form.deadline} onChange={(e) => handleChange('deadline', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a3050', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Work
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────── Edit Work Modal ────────── */
const EditWorkModal = ({ work, onClose, onSave, teamMembers, members }) => {
  const [form, setForm] = useState({
    title: work.title || '', artist: work.artist || '', album: work.album || '',
    genre: work.genre || '', isrc: work.isrc || '', iswc: work.iswc || '',
    language: work.language || 'Hindi', duration: work.duration || '',
    status: work.status || 'Draft', publisher: work.publisher || '',
    territories: work.territories || '', writers: work.writers || '', spoc: work.spoc || '',
    deadline: work.deadline ? fmtDateISO(new Date(work.deadline)) : '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.artist.trim()) return;
    setSaving(true);
    await onSave(work._id, form);
    setSaving(false);
    onClose();
  };

  const inputStyle = { width: '100%', padding: '10px 14px', background: '#1a1f2e', border: '1px solid #2a3050', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' };
  const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '640px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>Edit Musical Work</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Track Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
          </div>
          <div>
            <SearchableSelect label="Artist" required options={members} value={form.artist} onChange={(name) => handleChange('artist', name)} placeholder="Search member..." emptyMessage="No members found." />
          </div>
          <div>
            <label style={labelStyle}>Album</label>
            <input style={inputStyle} value={form.album} onChange={(e) => handleChange('album', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} value={form.genre} onChange={(e) => handleChange('genre', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ISRC</label>
            <input style={inputStyle} value={form.isrc} onChange={(e) => handleChange('isrc', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ISWC</label>
            <input style={inputStyle} value={form.iswc} onChange={(e) => handleChange('iswc', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.language} onChange={(e) => handleChange('language', e.target.value)}>
              {['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Instrumental'].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duration</label>
            <input style={inputStyle} value={form.duration} onChange={(e) => handleChange('duration', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="Draft">Draft</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Registered">Registered</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Publisher</label>
            <input style={inputStyle} value={form.publisher} onChange={(e) => handleChange('publisher', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Territories</label>
            <input style={inputStyle} value={form.territories} onChange={(e) => handleChange('territories', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Writers (comma-separated)</label>
          <input style={inputStyle} value={form.writers} onChange={(e) => handleChange('writers', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Assign SPOC</label>
            <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }} value={form.spoc} onChange={(e) => handleChange('spoc', e.target.value)}>
              <option value="">Select a team member...</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'dark' }} value={form.deadline} onChange={(e) => handleChange('deadline', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a3050', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 20px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────── Detail Modal ────────── */
const WorkDetailModal = ({ work, onClose, onUpdateStatus, onAddTask, onToggleTask, onEdit, onDelete, teamMembers }) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const spocMember = teamMembers.find((m) => m.name === work.spoc);
  const completedTasks = work.subTasks.filter((t) => t.done).length;
  const totalTasks = work.subTasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const toggleTask = (taskId) => {
    const task = work.subTasks.find((t) => t._id === taskId);
    if (task) onToggleTask(work._id, taskId, !task.done);
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    onAddTask(work._id, newTaskText.trim(), newTaskAssignee);
    setNewTaskText('');
    setNewTaskAssignee('');
    setShowAddTask(false);
  };

  const infoFieldStyle = { background: '#161b2e', borderRadius: '10px', padding: '14px 16px' };
  const infoLabelStyle = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };
  const infoValueStyle = { color: '#fff', fontSize: '14px', fontWeight: 500 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '640px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>
        {/* Header with Edit/Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>Musical Work Details</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onEdit} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2a3050', background: 'transparent', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
              <Edit2 size={14} /> Edit
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2a3050', background: 'transparent', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', marginLeft: '4px' }}><X size={20} /></button>
          </div>
        </div>

        {/* Title + Artist header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#2d1f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={22} color="#a78bfa" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: 0 }}>{work.title}</h3>
            <p style={{ color: '#8892b0', fontSize: '13px', margin: '2px 0 0' }}>{work.artist}{work.album ? ` — ${work.album}` : ''}</p>
          </div>
          <StatusBadge status={work.status} />
        </div>

        {/* All info fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Album</div><div style={infoValueStyle}>{work.album || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Genre</div><div style={infoValueStyle}>{work.genre || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>ISRC</div><div style={infoValueStyle}>{work.isrc || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>ISWC</div><div style={infoValueStyle}>{work.iswc || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Language</div><div style={infoValueStyle}>{work.language || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Duration</div><div style={infoValueStyle}>{work.duration || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Publisher</div><div style={infoValueStyle}>{work.publisher || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Territories</div><div style={infoValueStyle}>{work.territories || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Status</div><div style={infoValueStyle}>{work.status || '—'}</div></div>
          <div style={infoFieldStyle}><div style={infoLabelStyle}>Release Date</div><div style={infoValueStyle}>{work.releaseDate || '—'}</div></div>
        </div>

        <div style={{ ...infoFieldStyle, marginBottom: '16px' }}><div style={infoLabelStyle}>Writers</div><div style={infoValueStyle}>{work.writers || '—'}</div></div>

        {/* Assigned SPOC */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid #1e2540', borderBottom: '1px solid #1e2540', marginBottom: '16px' }}>
          <span style={{ color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned SPOC</span>
          {spocMember ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#161b2e', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{spocMember.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
              <span style={{ color: '#fff', fontWeight: 500 }}>{spocMember.name}</span>
            </span>
          ) : <span style={{ color: '#555', fontSize: '13px' }}>Not assigned</span>}
          {work.assignedDate && (
            <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>
              on {new Date(work.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Deadline */}
        {work.deadline && (() => {
          const ds = getDeadlineStatus(work.deadline);
          const dc = ds ? DEADLINE_COLORS[ds] : null;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #1e2540', marginBottom: '16px' }}>
              <span style={{ color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#fff', fontSize: '13px' }}>{new Date(work.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                {dc && <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px', background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>{dc.label}</span>}
              </div>
            </div>
          );
        })()}

        {/* Sub-Tasks */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-Tasks</span>
            <span style={{ color: '#8892b0', fontSize: '13px' }}>{completedTasks}/{totalTasks}</span>
          </div>
          <button onClick={() => setShowAddTask(true)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={14} /> Add
          </button>
        </div>

        {totalTasks > 0 && (
          <div style={{ height: '4px', background: '#1e2540', borderRadius: '4px', marginBottom: '12px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#22c55e', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {work.subTasks.map((task) => {
            const a = teamMembers.find((m) => m.name === task.assignee);
            const initials = a ? a.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '';
            return (
              <div key={task._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                <button onClick={() => toggleTask(task._id)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: task.done ? 'none' : '2px solid #3a4060', background: task.done ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {task.done && <Check size={14} color="#fff" />}
                </button>
                <span style={{ flex: 1, color: task.done ? '#6b7280' : '#fff', fontSize: '13px', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
                {a && <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</span>}
              </div>
            );
          })}
        </div>

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

        {/* Stage Progression */}
        {work.status !== 'Registered' && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1e2540' }}>
            {work.status === 'Draft' && (
              <>
                <button onClick={() => onUpdateStatus(work._id, 'Pending Review')} style={{ flex: 1, padding: '10px 18px', background: '#92400e', border: 'none', borderRadius: '8px', color: '#fbbf24', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Move to Pending Review <ArrowRight size={16} />
                </button>
                <button onClick={() => onUpdateStatus(work._id, 'Registered')} style={{ flex: 1, padding: '10px 18px', background: '#065f46', border: 'none', borderRadius: '8px', color: '#34d399', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Mark as Registered <ArrowRight size={16} />
                </button>
              </>
            )}
            {work.status === 'Pending Review' && (
              <button onClick={() => onUpdateStatus(work._id, 'Registered')} style={{ flex: 1, padding: '10px 18px', background: '#065f46', border: 'none', borderRadius: '8px', color: '#34d399', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Mark as Registered <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px' }}>
            <p style={{ color: '#fca5a5', fontSize: '14px', marginBottom: '12px', fontWeight: 500 }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{work.title}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #2a3050', background: 'transparent', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => onDelete(work._id)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────── Main Page ────────── */
const MusicalWorks = () => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [works, setWorks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWork, setSelectedWork] = useState(null);
  const [editWork, setEditWork] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [worksRes, usersRes, membersRes] = await Promise.all([
          authFetch('/api/musicalworks'),
          authFetch('/api/users'),
          authFetch('/api/members'),
        ]);
        const worksData = await worksRes.json();
        const usersData = await usersRes.json();
        const membersData = await membersRes.json();
        setWorks(worksData.works || []);
        setTeamMembers(usersData.users || []);
        setAllMembers(membersData.members || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authFetch]);

  const filteredWorks = useMemo(() => {
    let result = works;
    if (activeFilter === 'Registered') result = result.filter((w) => w.status === 'Registered');
    else if (activeFilter === 'Pending') result = result.filter((w) => w.status === 'Pending Review');
    else if (activeFilter === 'Draft') result = result.filter((w) => w.status === 'Draft');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((w) => w.title.toLowerCase().includes(q) || w.artist.toLowerCase().includes(q) || (w.isrc && w.isrc.toLowerCase().includes(q)) || (w.genre && w.genre.toLowerCase().includes(q)));
    }
    return result;
  }, [works, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    const base = searchQuery.trim()
      ? works.filter((w) => { const q = searchQuery.toLowerCase(); return w.title.toLowerCase().includes(q) || w.artist.toLowerCase().includes(q); })
      : works;
    return {
      All: base.length,
      Registered: base.filter((w) => w.status === 'Registered').length,
      Pending: base.filter((w) => w.status === 'Pending Review').length,
      Draft: base.filter((w) => w.status === 'Draft').length,
    };
  }, [works, searchQuery]);

  const handleAddWork = async (form) => {
    try {
      const res = await authFetch('/api/musicalworks', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setWorks((p) => [data.work, ...p]); addToast('Musical work added'); }
      else addToast('Failed to add work', 'error');
    } catch (err) {
      console.error('Failed to add work:', err);
      addToast('Failed to add work', 'error');
    }
  };

  const handleUpdateStatus = async (workId, status) => {
    try {
      const res = await authFetch(`/api/musicalworks/${workId}`, { method: 'PUT', body: JSON.stringify({ status }) });
      const data = await res.json();
      if (res.ok) {
        setWorks((p) => p.map((w) => (w._id === workId ? data.work : w)));
        setSelectedWork(data.work);
        addToast(`Status updated to ${status}`);
      } else addToast('Failed to update status', 'error');
    } catch (err) {
      console.error('Failed to update status:', err);
      addToast('Failed to update status', 'error');
    }
  };

  const handleAddTask = async (workId, text, assignee) => {
    try {
      const res = await authFetch(`/api/musicalworks/${workId}/subtasks`, { method: 'POST', body: JSON.stringify({ text, assignee }) });
      const data = await res.json();
      if (res.ok) {
        setWorks((p) => p.map((w) => (w._id === workId ? data.work : w)));
        setSelectedWork(data.work);
        addToast('Task added');
      } else addToast('Failed to add task', 'error');
    } catch (err) {
      console.error('Failed to add task:', err);
      addToast('Failed to add task', 'error');
    }
  };

  const handleToggleTask = async (workId, taskId, done) => {
    try {
      const res = await authFetch(`/api/musicalworks/${workId}/subtasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ done }) });
      const data = await res.json();
      if (res.ok) {
        setWorks((p) => p.map((w) => (w._id === workId ? data.work : w)));
        setSelectedWork(data.work);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleEditWork = async (workId, form) => {
    try {
      const res = await authFetch(`/api/musicalworks/${workId}`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        setWorks((p) => p.map((w) => (w._id === workId ? data.work : w)));
        setSelectedWork(data.work);
        addToast('Musical work updated');
      } else addToast('Failed to update work', 'error');
    } catch (err) {
      console.error('Failed to edit work:', err);
      addToast('Failed to update work', 'error');
    }
  };

  const handleDeleteWork = async (workId) => {
    try {
      const res = await authFetch(`/api/musicalworks/${workId}`, { method: 'DELETE' });
      if (res.ok) {
        setWorks((p) => p.filter((w) => w._id !== workId));
        setSelectedWork(null);
        addToast('Musical work deleted');
      } else addToast('Failed to delete work', 'error');
    } catch (err) {
      console.error('Failed to delete work:', err);
      addToast('Failed to delete work', 'error');
    }
  };

  const filters = ['All', 'Registered', 'Pending', 'Draft'];

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading musical works...</div>;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 }}>Musical Works</h1>
          <p style={{ color: '#8892b0', fontSize: '14px', margin: '4px 0 0' }}>Repertoire with music metadata and unique identifiers</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Add Work
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 1 340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input placeholder="Search by title, artist, ISRC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#141720', border: '1px solid #1e2540', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#141720', borderRadius: '8px', padding: '3px' }}>
          {filters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: activeFilter === f ? '#1e2540' : 'transparent', color: activeFilter === f ? '#fff' : '#8892b0', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
              {f}
              {f === 'All' && <span style={{ background: activeFilter === f ? '#3b82f6' : '#2a3050', color: '#fff', padding: '1px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>{counts[f]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#141720', borderRadius: '12px', border: '1px solid #1e2540', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.3fr 1.5fr 1.2fr 0.8fr 1.2fr 44px', padding: '14px 20px', borderBottom: '1px solid #1e2540' }}>
          {['Track', 'ISRC', 'ISWC', 'Genre', 'Duration', 'Status', ''].map((h) => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {filteredWorks.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
            {searchQuery || activeFilter !== 'All' ? 'No works match the current filters.' : 'No musical works yet. Click "+ Add Work" to get started.'}
          </div>
        ) : (
          filteredWorks.map((work) => (
            <div key={work._id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.3fr 1.5fr 1.2fr 0.8fr 1.2fr 44px', padding: '14px 20px', borderBottom: '1px solid #1e2540', alignItems: 'center', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1f30')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#2d1f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Music size={16} color="#a78bfa" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{work.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{work.artist}</div>
                </div>
              </div>
              <span style={{ color: '#ccc', fontSize: '13px' }}>{work.isrc}</span>
              <span style={{ color: '#ccc', fontSize: '13px' }}>{work.iswc}</span>
              <span style={{ color: '#ccc', fontSize: '13px' }}>{work.genre}</span>
              <span style={{ color: '#ccc', fontSize: '13px' }}>{work.duration}</span>
              <StatusBadge status={work.status} />
              <button onClick={() => setSelectedWork(work)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {showAddModal && <AddWorkModal onClose={() => setShowAddModal(false)} onAdd={handleAddWork} teamMembers={teamMembers} members={allMembers} />}
      {selectedWork && !editWork && (
        <WorkDetailModal
          work={selectedWork}
          onClose={() => setSelectedWork(null)}
          onUpdateStatus={handleUpdateStatus}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onEdit={() => setEditWork(selectedWork)}
          onDelete={handleDeleteWork}
          teamMembers={teamMembers}
        />
      )}
      {editWork && (
        <EditWorkModal
          work={editWork}
          onClose={() => setEditWork(null)}
          onSave={handleEditWork}
          teamMembers={teamMembers}
          members={allMembers}
        />
      )}
    </div>
  );
};

export default MusicalWorks;
