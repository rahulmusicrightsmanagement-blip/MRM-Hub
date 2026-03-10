import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Filter, X, Mail, Phone, MessageSquare, ArrowRight,
  CheckSquare, Square, ChevronRight, Briefcase, Clock,
  CheckCircle, Circle, Trash2, Edit3, Save, Eye, XCircle, UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';

const STAGES = ['New Enquiry', 'Meeting Set', 'Qualified Lead', 'Not Qualified'];
const STAGE_COLORS = { 'New Enquiry': '#3b82f6', 'Meeting Set': '#6366f1', 'Qualified Lead': '#10b981', 'Not Qualified': '#ef4444' };
const SOURCE_LIST = ['Website Form', 'LinkedIn Outreach', 'Instagram DM', 'Industry Event', 'Referral', 'Direct Outreach'];

/* ──────── shared styles ──────── */
const INPUT = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #2d3348', backgroundColor: '#1a1e2e',
  color: '#e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const LABEL = {
  fontSize: '11px', fontWeight: 600, color: '#9ca3af',
  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', display: 'block',
};
const FIELD_BOX = {
  backgroundColor: '#161b2e', border: '1px solid #1e2540',
  borderRadius: '10px', padding: '14px 16px',
};
const SECTION_TITLE = {
  fontSize: '12px', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px',
};
const SMALL_LABEL = {
  fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const fmtDateISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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

/* ──────── Priority Badge ──────── */
const PriorityBadge = ({ priority }) => {
  const map = {
    high: { bg: '#991b1b', color: '#fca5a5' },
    medium: { bg: '#854d0e', color: '#fde047' },
    low: { bg: '#166534', color: '#86efac' },
  };
  const c = map[priority] || map.medium;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: c.bg, color: c.color }}>
      {priority}
    </span>
  );
};

/* ═══════════════════════════════════════════
   ADD / EDIT LEAD MODAL
   ═══════════════════════════════════════════ */
const LeadFormModal = ({ onClose, onSubmit, teamMembers, members, initialData }) => {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    initialData
      ? { ...initialData, deadline: initialData.deadline ? fmtDateISO(new Date(initialData.deadline)) : '' }
      : { name: '', genre: '', email: '', phone: '', source: '', priority: 'medium', spoc: '', notes: '', deadline: '' },
  );
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleMemberSelect = (memberName) => {
    if (!memberName) { setForm((p) => ({ ...p, name: '', genre: '', email: '', phone: '', source: '' })); return; }
    const m = members.find((x) => x.name === memberName);
    if (m) setForm((p) => ({ ...p, name: m.name, genre: m.genre || '', email: m.email || '', phone: m.phone || '', source: m.leadSource || '' }));
  };

  const handleSubmit = () => {
    if (!form.name) return;
    onSubmit(form);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: '32px', width: '520px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{isEdit ? 'Edit Lead' : 'Add New Lead'}</h2>
          <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
        </div>

        {isEdit ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div><label style={LABEL}>Name *</label><input style={INPUT} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div><label style={LABEL}>Genre</label><input style={INPUT} placeholder="e.g. Bollywood Playback" value={form.genre} onChange={(e) => set('genre', e.target.value)} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div><label style={LABEL}>Email *</label><input style={INPUT} placeholder="email@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label style={LABEL}>Phone</label><input style={INPUT} placeholder="+91 98xxx xxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={LABEL}>Lead Source</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.source} onChange={(e) => set('source', e.target.value)}>
                  {SOURCE_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Priority</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={LABEL}>Assign SPOC</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={form.spoc} onChange={(e) => set('spoc', e.target.value)}>
                <option value="">Select a team member..</option>
                {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={LABEL}>Deadline</label>
              <input style={INPUT} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={LABEL}>Notes</label>
              <textarea style={{ ...INPUT, minHeight: '90px', resize: 'vertical' }} placeholder="Add initial notes about this lead..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <SearchableSelect label="Select Member" required options={members} value={form.name} onChange={handleMemberSelect} placeholder="Search member..." emptyMessage="No members found. Add members first." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={LABEL}>Lead Source</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.source} onChange={(e) => set('source', e.target.value)}>
                  <option value="">Select source...</option>
                  {SOURCE_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Assign SPOC</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.spoc} onChange={(e) => set('spoc', e.target.value)}>
                  <option value="">Select a team member..</option>
                  {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={LABEL}>Deadline</label>
              <input style={INPUT} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleSubmit} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isEdit ? <><Edit3 style={{ width: '16px', height: '16px' }} /> Save Changes</> : <><Plus style={{ width: '16px', height: '16px' }} /> Create Lead</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CHECKLIST ROW  (native checkbox + label for reliable clicks)
   ═══════════════════════════════════════════ */
let checklistIdCounter = 0;
const ChecklistRow = ({ checked, label, subtitle, badgeLabel, onToggle, borderBottom }) => {
  const [localChecked, setLocalChecked] = useState(checked);
  const [id] = useState(() => `chk-${++checklistIdCounter}`);

  // sync with parent prop
  useEffect(() => { setLocalChecked(checked); }, [checked]);

  const handleChange = () => {
    setLocalChecked((prev) => !prev);  // optimistic
    onToggle();
  };

  const badgeColor = localChecked ? '#10b981' : (badgeLabel === 'No' ? '#ef4444' : '#f59e0b');
  const badgeBg = localChecked ? '#052e16' : (badgeLabel === 'No' ? '#450a0a' : '#451a03');

  return (
    <div style={{ borderBottom: borderBottom ? '1px solid #1e2540' : 'none' }}>
      <input
        type="checkbox"
        id={id}
        checked={localChecked}
        onChange={handleChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <label
        htmlFor={id}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 0', width: '100%', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {localChecked
          ? <CheckCircle style={{ width: '20px', height: '20px', color: '#10b981', flexShrink: 0 }} />
          : <Circle style={{ width: '20px', height: '20px', color: '#6b7280', flexShrink: 0 }} />}
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '14px', color: localChecked ? '#9ca3af' : '#e5e7eb', fontWeight: 500 }}>{label}</span>
          {subtitle && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{subtitle}</p>}
        </div>
        {badgeLabel && (
          <span style={{
            fontSize: '11px', fontWeight: 600, color: badgeColor,
            padding: '2px 10px', borderRadius: '6px', background: badgeBg,
          }}>
            {localChecked ? (badgeLabel === 'No' ? 'Yes' : 'Verified') : badgeLabel}
          </span>
        )}
      </label>
    </div>
  );
};

/* ═══════════════════════════════════════════
   VIEW DETAILS TOGGLE (expandable section)
   ═══════════════════════════════════════════ */
const ViewDetailsToggle = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '4px', marginBottom: '4px' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#818cf8', fontSize: '12px', fontWeight: 600, padding: '4px 0',
        }}
      >
        <Eye style={{ width: '14px', height: '14px' }} />
        {open ? `Hide ${title}` : `View ${title}`}
      </button>
      {open && (
        <div style={{
          marginTop: '8px', padding: '14px', backgroundColor: '#111525',
          border: '1px solid #1e2540', borderRadius: '10px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MOVE TO ONBOARDING MODAL
   ═══════════════════════════════════════════ */
const MoveToOnboardingModal = ({ lead, teamMembers, onClose, onConfirm }) => {
  const [spoc, setSpoc] = useState(lead.spoc || '');
  const [contractType, setContractType] = useState('Retailer');
  const [deadline, setDeadline] = useState('');

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
    >
      <div
        style={{ backgroundColor: '#1e2235', borderRadius: '14px', padding: '28px', width: '400px', border: '1px solid #2d3348' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus style={{ width: '18px', height: '18px', color: '#10b981' }} /> Move to Onboarding
          </h3>
          <X style={{ width: '18px', height: '18px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
        </div>

        <div style={{ padding: '12px 14px', backgroundColor: '#161b2e', borderRadius: '10px', border: '1px solid #1e2540', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>{lead.name}</p>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>{lead.email}</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL}>Assign SPOC</label>
          <select
            style={{ ...INPUT, cursor: 'pointer' }}
            value={spoc}
            onChange={(e) => setSpoc(e.target.value)}
          >
            <option value="">Select SPOC...</option>
            {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={LABEL}>Contract Type</label>
          <select
            style={{ ...INPUT, cursor: 'pointer' }}
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
          >
            {['Retailer', 'Royalty', 'Work-Based'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={LABEL}>Deadline</label>
          <input
            type="date"
            style={{ ...INPUT, cursor: 'pointer', colorScheme: 'dark' }}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm({ spoc, contractType, deadline })}
            style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus style={{ width: '14px', height: '14px' }} /> Confirm & Move
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SUB-TASK ROW  (native checkbox + label)
   ═══════════════════════════════════════════ */
let subTaskIdCounter = 0;
const SubTaskRow = ({ task, leadId, onToggleSubtask }) => {
  const [localDone, setLocalDone] = useState(task.done);
  const [id] = useState(() => `stk-${++subTaskIdCounter}`);

  useEffect(() => { setLocalDone(task.done); }, [task.done]);

  const handleChange = () => {
    setLocalDone((prev) => !prev);
    onToggleSubtask(leadId, task._id, !task.done);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          id={id}
          checked={localDone}
          onChange={handleChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
          {localDone
            ? <CheckSquare style={{ width: '18px', height: '18px', color: '#10b981' }} />
            : <Square style={{ width: '18px', height: '18px', color: '#6b7280' }} />}
          <span style={{ fontSize: '14px', color: localDone ? '#6b7280' : '#e5e7eb', textDecoration: localDone ? 'line-through' : 'none' }}>{task.text}</span>
        </label>
      </div>
      {task.assignee && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{task.assignee}</span>}
    </div>
  );
};

/* ═══════════════════════════════════════════
   LEAD DETAIL MODAL
   ═══════════════════════════════════════════ */
const LeadDetailModal = ({
  lead, onClose, onMoveNext, onUpdateLead,
  onDeleteLead, onToggleSubtask,
  onAddSubtask, teamMembers, onMoveToOnboarding, onMarkNotQualified, onRevertLead, onRestartOnboarding,
}) => {
  const { addToast } = useToast();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showNotQualifiedConfirm, setShowNotQualifiedConfirm] = useState(false);
  const [notQualifiedReason, setNotQualifiedReason] = useState('');

  // editable text fields — save on blur
  const [inquiryNotes, setInquiryNotes] = useState(lead.inquiryNotes || '');
  const [meetingDate, setMeetingDate] = useState(lead.meetingDate || '');
  const [meetingLink, setMeetingLink] = useState(lead.meetingLink || '');
  const [meetingAssignedWith, setMeetingAssignedWith] = useState(lead.meetingAssignedWith || '');
  const [meetingNotes, setMeetingNotes] = useState(lead.meetingNotes || '');

  // keep local text state in sync when lead prop updates
  useEffect(() => { setInquiryNotes(lead.inquiryNotes || ''); }, [lead.inquiryNotes]);
  useEffect(() => { setMeetingDate(lead.meetingDate || ''); }, [lead.meetingDate]);
  useEffect(() => { setMeetingLink(lead.meetingLink || ''); }, [lead.meetingLink]);
  useEffect(() => { setMeetingAssignedWith(lead.meetingAssignedWith || ''); }, [lead.meetingAssignedWith]);
  useEffect(() => { setMeetingNotes(lead.meetingNotes || ''); }, [lead.meetingNotes]);

  const currentStageIdx = STAGES.indexOf(lead.stage);
  const canMoveNext = currentStageIdx < STAGES.length - 1;
  const nextStage = canMoveNext ? STAGES[currentStageIdx + 1] : null;
  const subtasks = lead.subTasks || [];
  const doneTasks = subtasks.filter((t) => t.done).length;
  const date = fmtDate(lead.createdAt);

  const update = useCallback(
    (fields) => onUpdateLead(lead._id, fields),
    [lead._id, onUpdateLead],
  );

  /* ── stage-specific task sections ── */
  const renderStageTasks = () => {
    if (lead.stage === 'New Enquiry') {
      return (
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ ...FIELD_BOX, padding: '16px' }}>
            <p style={SECTION_TITLE}>Inquiry Tasks</p>

            <ChecklistRow
              checked={!!lead.callDone}
              label="Call Done?"
              badgeLabel={lead.callDone ? 'Yes' : 'No'}
              onToggle={() => update({ callDone: !lead.callDone })}
              borderBottom
            />

            <div style={{ marginTop: '12px' }}>
              <p style={SMALL_LABEL}>Inquiry Notes</p>
              <textarea
                value={inquiryNotes}
                onChange={(e) => setInquiryNotes(e.target.value)}
                onBlur={() => { if (inquiryNotes !== (lead.inquiryNotes || '')) update({ inquiryNotes }); }}
                placeholder="Add notes from the inquiry call..."
                style={{ ...INPUT, minHeight: '70px', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (lead.stage === 'Meeting Set') {
      return (
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ ...FIELD_BOX, padding: '16px' }}>
            <p style={SECTION_TITLE}>Meeting Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <p style={SMALL_LABEL}>Meeting Date</p>
                <input type="date" value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  onBlur={() => { if (meetingDate !== (lead.meetingDate || '')) update({ meetingDate }); }}
                  style={{ ...INPUT, cursor: 'pointer', colorScheme: 'dark' }} />
              </div>
              <div>
                <p style={SMALL_LABEL}>Meeting Link</p>
                <input value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  onBlur={() => { if (meetingLink !== (lead.meetingLink || '')) update({ meetingLink }); }}
                  placeholder="https://meet.google.com/..."
                  style={INPUT} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <p style={SMALL_LABEL}>Meeting Assigned With</p>
              <input value={meetingAssignedWith}
                onChange={(e) => setMeetingAssignedWith(e.target.value)}
                onBlur={() => { if (meetingAssignedWith !== (lead.meetingAssignedWith || '')) update({ meetingAssignedWith }); }}
                placeholder="e.g. John Doe, Rahul M."
                style={INPUT} />
            </div>
            <div>
              <p style={SMALL_LABEL}>Meeting Notes</p>
              <textarea value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                onBlur={() => { if (meetingNotes !== (lead.meetingNotes || '')) update({ meetingNotes }); }}
                placeholder="Agenda, discussion points, outcomes..."
                style={{ ...INPUT, minHeight: '70px', resize: 'vertical' }} />
            </div>
          </div>
        </div>
      );
    }

    if (lead.stage === 'Qualified Lead') {
      return (
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ ...FIELD_BOX, padding: '16px' }}>
            <p style={SECTION_TITLE}>Verification Checklist</p>

            {/* Step 1 — Inquiry */}
            <ChecklistRow
              checked={!!lead.inquiryVerified}
              label="Verify Inquiry (Step 1)"
              subtitle={`Call: ${lead.callDone ? 'Done' : 'Not done'} · Notes: ${lead.inquiryNotes ? 'Added' : 'None'}`}
              badgeLabel={lead.inquiryVerified ? 'Verified' : 'Pending'}
              onToggle={() => update({ inquiryVerified: !lead.inquiryVerified })}
              borderBottom
            />
            {/* View Inquiry Details */}
            <ViewDetailsToggle title="Inquiry Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><p style={SMALL_LABEL}>Call Done</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.callDone ? 'Yes' : 'No'}</p></div>
                <div><p style={SMALL_LABEL}>Source</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.source || '—'}</p></div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <p style={SMALL_LABEL}>Inquiry Notes</p>
                <p style={{ fontSize: '13px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>{lead.inquiryNotes || 'No notes added'}</p>
              </div>
            </ViewDetailsToggle>

            {/* Step 2 — Meeting */}
            <div style={{ marginTop: '8px' }}>
              <ChecklistRow
                checked={!!lead.meetingVerified}
                label="Verify Meeting (Step 2)"
                subtitle={`Date: ${lead.meetingDate || 'Not set'} · Link: ${lead.meetingLink ? 'Added' : 'None'} · With: ${lead.meetingAssignedWith || 'N/A'}`}
                badgeLabel={lead.meetingVerified ? 'Verified' : 'Pending'}
                onToggle={() => update({ meetingVerified: !lead.meetingVerified })}
              />
            </div>
            {/* View Meeting Details */}
            <ViewDetailsToggle title="Meeting Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><p style={SMALL_LABEL}>Meeting Date</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.meetingDate ? fmtDate(lead.meetingDate) : 'Not set'}</p></div>
                <div><p style={SMALL_LABEL}>Assigned With</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.meetingAssignedWith || '—'}</p></div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <p style={SMALL_LABEL}>Meeting Link</p>
                {lead.meetingLink
                  ? <a href={lead.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#818cf8', wordBreak: 'break-all' }}>{lead.meetingLink}</a>
                  : <p style={{ fontSize: '13px', color: '#6b7280' }}>No link added</p>}
              </div>
              <div style={{ marginTop: '10px' }}>
                <p style={SMALL_LABEL}>Meeting Notes</p>
                <p style={{ fontSize: '13px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>{lead.meetingNotes || 'No notes added'}</p>
              </div>
            </ViewDetailsToggle>
          </div>

          {/* Onboarded Success Badge */}
          {lead.movedToOnboarding && (
            <div style={{ marginTop: '14px', background: 'rgba(16,185,129,0.12)', border: '1px solid #065f46', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CheckCircle style={{ width: '18px', height: '18px', color: '#10b981' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>Moved to Onboarding</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {lead.onboardingSpoc && (
                  <div><p style={SMALL_LABEL}>Onboarding SPOC</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.onboardingSpoc}</p></div>
                )}
                {lead.onboardingContractType && (
                  <div><p style={SMALL_LABEL}>Contract Type</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.onboardingContractType}</p></div>
                )}
              </div>
              {lead.onboardedAt && (
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Onboarded on {fmtDate(lead.onboardedAt)}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    if (lead.stage === 'Not Qualified') {
      return (
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ ...FIELD_BOX, padding: '16px' }}>
            <p style={SECTION_TITLE}>Lead Summary</p>
            {lead.previousStage && (
              <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>
                Moved from <span style={{ fontWeight: 700, color: '#fca5a5' }}>{lead.previousStage}</span>
              </p>
            )}
            {lead.notQualifiedReason && (
              <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid #991b1b', borderRadius: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Reason</p>
                <p style={{ fontSize: '13px', color: '#fca5a5', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{lead.notQualifiedReason}</p>
              </div>
            )}

            {/* Inquiry Summary */}
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#161b2e', borderRadius: '8px', border: '1px solid #2d3348' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Inquiry</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><p style={SMALL_LABEL}>Call Done</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.callDone ? 'Yes' : 'No'}</p></div>
                <div><p style={SMALL_LABEL}>Source</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.source || '—'}</p></div>
              </div>
              {lead.inquiryNotes && (
                <div style={{ marginTop: '8px' }}>
                  <p style={SMALL_LABEL}>Notes</p>
                  <p style={{ fontSize: '13px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>{lead.inquiryNotes}</p>
                </div>
              )}
              <div style={{ marginTop: '6px' }}>
                <p style={SMALL_LABEL}>Verified</p>
                <p style={{ fontSize: '13px', color: lead.inquiryVerified ? '#10b981' : '#f87171' }}>{lead.inquiryVerified ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Meeting Summary */}
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#161b2e', borderRadius: '8px', border: '1px solid #2d3348' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Meeting</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><p style={SMALL_LABEL}>Date</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.meetingDate ? fmtDate(lead.meetingDate) : 'Not set'}</p></div>
                <div><p style={SMALL_LABEL}>Assigned With</p><p style={{ fontSize: '13px', color: '#e5e7eb' }}>{lead.meetingAssignedWith || '—'}</p></div>
              </div>
              {lead.meetingLink && (
                <div style={{ marginTop: '8px' }}>
                  <p style={SMALL_LABEL}>Link</p>
                  <a href={lead.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#818cf8', wordBreak: 'break-all' }}>{lead.meetingLink}</a>
                </div>
              )}
              {lead.meetingNotes && (
                <div style={{ marginTop: '8px' }}>
                  <p style={SMALL_LABEL}>Notes</p>
                  <p style={{ fontSize: '13px', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>{lead.meetingNotes}</p>
                </div>
              )}
              <div style={{ marginTop: '6px' }}>
                <p style={SMALL_LABEL}>Verified</p>
                <p style={{ fontSize: '13px', color: lead.meetingVerified ? '#10b981' : '#f87171' }}>{lead.meetingVerified ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Sub-tasks Summary */}
            {(lead.subTasks || []).length > 0 && (
              <div style={{ padding: '10px 12px', background: '#161b2e', borderRadius: '8px', border: '1px solid #2d3348' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Sub-Tasks</p>
                {(lead.subTasks || []).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {t.done
                      ? <CheckSquare style={{ width: '14px', height: '14px', color: '#10b981' }} />
                      : <Square style={{ width: '14px', height: '14px', color: '#6b7280' }} />}
                    <span style={{ fontSize: '13px', color: t.done ? '#6b7280' : '#e5e7eb', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                    {t.assignee && <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>{t.assignee}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Revert Button */}
            {lead.previousStage && (
              <button
                type="button"
                onClick={() => { lead.movedToOnboarding ? onRestartOnboarding(lead._id) : onRevertLead(lead._id); onClose(); }}
                style={{
                  marginTop: '16px', width: '100%', padding: '10px 16px', borderRadius: '8px',
                  border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)',
                  color: '#818cf8', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <ArrowRight style={{ width: '14px', height: '14px', transform: 'rotate(180deg)' }} />
                {lead.movedToOnboarding ? 'Re-start Onboarding' : `Revert to ${lead.previousStage}`}
              </button>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        style={{ backgroundColor: '#1e2235', borderRadius: '16px', width: '540px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* stage progress */}
        <div style={{ padding: '20px 28px 0', display: 'flex', gap: '4px' }}>
          {STAGES.map((s, i) => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: i <= currentStageIdx ? '#6366f1' : '#2d3348' }} />
          ))}
        </div>

        {/* header */}
        <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: lead.color || '#6366f1', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '15px',
            }}>
              {lead.initials || lead.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{lead.name}</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>{lead.genre}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PriorityBadge priority={lead.priority} />
            <button type="button" onClick={() => setConfirmDelete(true)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
              <Trash2 style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* delete confirmation */}
        {confirmDelete && (
          <div style={{ padding: '0 28px', marginBottom: '12px' }}>
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#fca5a5' }}>Delete this lead permanently?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => { onDeleteLead(lead._id); onClose(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* info fields */}
        <div style={{ padding: '0 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={FIELD_BOX}><p style={SMALL_LABEL}>Source</p><p style={{ fontSize: '14px', color: '#e5e7eb' }}>{lead.source}</p></div>
          <div style={FIELD_BOX}><p style={SMALL_LABEL}>Email</p><p style={{ fontSize: '14px', color: '#e5e7eb' }}>{lead.email}</p></div>
        </div>
        <div style={{ padding: '0 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={FIELD_BOX}><p style={SMALL_LABEL}>Phone</p><p style={{ fontSize: '14px', color: '#e5e7eb' }}>{lead.phone || '—'}</p></div>
          <div style={FIELD_BOX}><p style={SMALL_LABEL}>Date</p><p style={{ fontSize: '14px', color: '#e5e7eb' }}>{date}</p></div>
        </div>
        <div style={{ padding: '0 28px', marginBottom: '12px' }}>
          <div style={FIELD_BOX}><p style={SMALL_LABEL}>Notes</p><p style={{ fontSize: '14px', color: '#e5e7eb' }}>{lead.notes || 'No notes yet'}</p></div>
        </div>
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ ...FIELD_BOX, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Assigned SPOC</p>
            <div style={{ textAlign: 'right' }}>
              {lead.spoc ? <span style={{ fontSize: '14px', color: '#e5e7eb' }}>{lead.spoc}</span> : <span style={{ fontSize: '13px', color: '#6b7280' }}>Unassigned</span>}
              {lead.assignedDate && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  Assigned on {new Date(lead.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </div>
        {lead.deadline && (() => {
          const dlStatus = getDeadlineStatus(lead.deadline);
          const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;
          return (
            <div style={{ padding: '0 28px', marginBottom: '16px' }}>
              <div style={{ ...FIELD_BOX, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Deadline</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#e5e7eb' }}>{fmtDate(lead.deadline)}</span>
                  {dlColor && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', backgroundColor: dlColor.bg, color: dlColor.color }}>
                      {dlColor.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* stage tasks */}
        {renderStageTasks()}

        {/* sub-tasks */}
        <div style={{ padding: '0 28px', marginBottom: '24px' }}>
          <div style={{ ...FIELD_BOX, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Tasks</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{doneTasks}/{subtasks.length}</span>
              </div>
              <button type="button" onClick={() => setShowAddTask(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div style={{ height: '4px', backgroundColor: '#2d3348', borderRadius: '2px', marginBottom: '14px' }}>
                <div style={{ height: '100%', borderRadius: '2px', backgroundColor: '#6366f1', width: `${(doneTasks / subtasks.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {subtasks.map((task) => (
                <SubTaskRow key={task._id} task={task} leadId={lead._id} onToggleSubtask={onToggleSubtask} />
              ))}
              {subtasks.length === 0 && !showAddTask && (
                <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '8px 0' }}>No sub-tasks yet</p>
              )}
            </div>

            {showAddTask && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input autoFocus value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Describe the sub-task..." style={INPUT} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                    <option value="">Assign to...</option>
                    {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
                  </select>
                  <button type="button"
                    onClick={() => { if (!newTaskText.trim()) return; onAddSubtask(lead._id, newTaskText.trim(), newTaskAssignee); setNewTaskText(''); setNewTaskAssignee(''); setShowAddTask(false); }}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Add Task
                  </button>
                  <button type="button"
                    onClick={() => { setShowAddTask(false); setNewTaskText(''); setNewTaskAssignee(''); }}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #2d3348', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Close</button>
          <button type="button" onClick={() => {
            update({ inquiryNotes, meetingDate, meetingLink, meetingAssignedWith, meetingNotes });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1500);
            addToast('Progress saved successfully');
          }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: savedFlash ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #374151, #4b5563)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.3s' }}>
            {savedFlash ? <><CheckCircle style={{ width: '16px', height: '16px' }} /> Saved!</> : <><Save style={{ width: '16px', height: '16px' }} /> Save Progress</>}
          </button>

          {/* Not Qualified — available for any stage except already Not Qualified or already onboarded */}
          {lead.stage !== 'Not Qualified' && !lead.movedToOnboarding && (
            <button type="button" onClick={() => setShowNotQualifiedConfirm(true)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <XCircle style={{ width: '16px', height: '16px' }} /> Not Qualified
            </button>
          )}

          {/* Not Qualified confirmation panel */}
          {showNotQualifiedConfirm && (
            <div style={{ width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid #991b1b', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <p style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600, margin: 0 }}>⚠ Confirm: Mark as Not Qualified</p>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Reason (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Budget constraints, not a good fit..."
                  value={notQualifiedReason}
                  onChange={(e) => setNotQualifiedReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#1a1f2e', border: '1px solid #991b1b', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowNotQualifiedConfirm(false); setNotQualifiedReason(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #2d3348', background: 'transparent', color: '#9ca3af', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => { onMarkNotQualified(lead._id, notQualifiedReason); setShowNotQualifiedConfirm(false); setNotQualifiedReason(''); onClose(); }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle style={{ width: '14px', height: '14px' }} /> Confirm Not Qualified
                </button>
              </div>
            </div>
          )}

          {/* Revert — only for Not Qualified with a previous stage */}
          {lead.stage === 'Not Qualified' && lead.previousStage && (
            <button type="button" onClick={() => { lead.movedToOnboarding ? onRestartOnboarding(lead._id) : onRevertLead(lead._id); onClose(); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} /> {lead.movedToOnboarding ? 'Re-start Onboarding' : `Revert to ${lead.previousStage}`}
            </button>
          )}

          {/* Move to Onboarding — only for Qualified Lead and not already onboarded */}
          {lead.stage === 'Qualified Lead' && !lead.movedToOnboarding && (
            <button type="button" onClick={() => setShowOnboardingModal(true)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus style={{ width: '16px', height: '16px' }} /> Move to Onboarding
            </button>
          )}

          {/* Move to next stage — available for New Enquiry and Meeting Set */}
          {canMoveNext && lead.stage !== 'Qualified Lead' && (
            <button type="button" onClick={() => { onMoveNext(lead._id); onClose(); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight style={{ width: '16px', height: '16px' }} /> Move to {nextStage}
            </button>
          )}
        </div>

        {/* Move to Onboarding sub-modal */}
        {showOnboardingModal && (
          <MoveToOnboardingModal
            lead={lead}
            teamMembers={teamMembers}
            onClose={() => setShowOnboardingModal(false)}
            onConfirm={(opts) => { onMoveToOnboarding(lead, opts); setShowOnboardingModal(false); onClose(); }}
          />
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   LEAD CARD
   ═══════════════════════════════════════════ */
const LeadCard = ({ lead, onClick }) => {
  const sourceIcon = {
    'Website Form': <Mail style={{ width: '13px', height: '13px' }} />,
    'LinkedIn Outreach': <Briefcase style={{ width: '13px', height: '13px' }} />,
    'Instagram DM': <MessageSquare style={{ width: '13px', height: '13px' }} />,
    'Industry Event': <Briefcase style={{ width: '13px', height: '13px' }} />,
    'Referral': <ChevronRight style={{ width: '13px', height: '13px' }} />,
    'Direct Outreach': <Phone style={{ width: '13px', height: '13px' }} />,
  };
  const date = fmtDate(lead.createdAt);
  const dlStatus = getDeadlineStatus(lead.deadline);
  const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;

  return (
    <div
      onClick={() => onClick(lead)}
      style={{ backgroundColor: '#161b2e', border: `1px solid ${dlColor ? dlColor.border : '#1e2540'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = dlColor ? dlColor.border : '#3a3f60'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = dlColor ? dlColor.border : '#1e2540'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{lead.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {dlColor && (
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: dlColor.bg, color: dlColor.color }}>
              {dlColor.label}
            </span>
          )}
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ color: '#6b7280' }}>{sourceIcon[lead.source] || <Mail style={{ width: '13px', height: '13px' }} />}</span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{lead.source}</span>
      </div>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{lead.genre}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Clock style={{ width: '12px', height: '12px', color: '#6b7280' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>{date}</span>
      </div>
      {lead.movedToOnboarding && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(16,185,129,0.12)', borderRadius: '6px', width: 'fit-content' }}>
          <CheckCircle style={{ width: '12px', height: '12px', color: '#10b981' }} />
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Onboarded</span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN SALES PIPELINE PAGE
   ═══════════════════════════════════════════ */
const SalesPipeline = () => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [lR, uR, mR] = await Promise.all([
          authFetch('/api/leads'),
          authFetch('/api/users'),
          authFetch('/api/members'),
        ]);
        const [lD, uD, mD] = await Promise.all([lR.json(), uR.json(), mR.json()]);
        setLeads(lD.leads || []);
        setTeamMembers(uD.users || []);
        setMembers(mD.members || []);
      } catch (err) { console.error('Failed to fetch:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [authFetch]);

  const handleAddLead = async (form) => {
    try {
      const res = await authFetch('/api/leads', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setLeads((p) => [data.lead, ...p]); addToast('Lead created'); }
      else addToast('Failed to create lead', 'error');
    } catch (err) { console.error('Failed to add lead:', err); addToast('Failed to create lead', 'error'); }
  };

  const handleDeleteLead = async (leadId) => {
    try {
      const res = await authFetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) { setLeads((p) => p.filter((l) => l._id !== leadId)); addToast('Lead deleted'); }
      else addToast('Failed to delete lead', 'error');
    } catch (err) { console.error('Failed to delete lead:', err); addToast('Failed to delete lead', 'error'); }
  };

  const handleMoveNext = async (leadId) => {
    const lead = leads.find((l) => l._id === leadId);
    if (!lead) return;
    const idx = STAGES.indexOf(lead.stage);
    if (idx >= STAGES.length - 1) return;
    try {
      const res = await authFetch(`/api/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ stage: STAGES[idx + 1] }) });
      const data = await res.json();
      if (res.ok) { setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l))); addToast(`Moved to ${STAGES[idx + 1]}`); }
      else addToast('Failed to move lead', 'error');
    } catch (err) { console.error('Failed to move lead:', err); addToast('Failed to move lead', 'error'); }
  };

  const handleUpdateLead = useCallback(async (leadId, fields) => {
    try {
      const res = await authFetch(`/api/leads/${leadId}`, { method: 'PUT', body: JSON.stringify(fields) });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        setSelectedLead((prev) => (prev && prev._id === leadId ? data.lead : prev));
      } else addToast('Failed to update lead', 'error');
    } catch (err) { console.error('Failed to update lead:', err); addToast('Failed to update lead', 'error'); }
  }, [authFetch, addToast]);

  const handleToggleSubtask = async (leadId, taskId, done) => {
    try {
      const res = await authFetch(`/api/leads/${leadId}/subtasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ done }) });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        setSelectedLead((prev) => (prev && prev._id === leadId ? data.lead : prev));
      } else addToast('Failed to update task', 'error');
    } catch (err) { console.error('Failed to toggle task:', err); addToast('Failed to update task', 'error'); }
  };

  const handleAddSubtask = async (leadId, text, assignee) => {
    try {
      const res = await authFetch(`/api/leads/${leadId}/subtasks`, { method: 'POST', body: JSON.stringify({ text, assignee }) });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        setSelectedLead((prev) => (prev && prev._id === leadId ? data.lead : prev));
        addToast('Sub-task added');
      } else addToast('Failed to add sub-task', 'error');
    } catch (err) { console.error('Failed to add task:', err); addToast('Failed to add sub-task', 'error'); }
  };

  const handleMoveToOnboarding = async (lead, opts) => {
    try {
      // Create onboarding entry from the qualified lead
      const res = await authFetch('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          name: lead.name,
          email: lead.email,
          phone: lead.phone || '',
          role: [],
          contractType: opts.contractType || 'Retailer',
          spoc: opts.spoc || lead.spoc || '',
          notes: lead.notes || '',
          priority: lead.priority || 'medium',
          deadline: opts.deadline || '',
        }),
      });
      if (res.ok) {
        // Mark the lead as onboarded but keep it in Qualified Lead
        const updateRes = await authFetch(`/api/leads/${lead._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            movedToOnboarding: true,
            onboardingSpoc: opts.spoc || lead.spoc || '',
            onboardingContractType: opts.contractType || 'Retailer',
            onboardedAt: new Date().toISOString(),
          }),
        });
        if (updateRes.ok) {
          const data = await updateRes.json();
          setLeads((p) => p.map((l) => (l._id === lead._id ? data.lead : l)));
        }
        addToast(`${lead.name} moved to Onboarding`);
      } else addToast('Failed to create onboarding entry', 'error');
    } catch (err) { console.error('Move to onboarding error:', err); addToast('Failed to move to onboarding', 'error'); }
  };

  const handleMarkNotQualified = async (leadId, reason) => {
    const lead = leads.find((l) => l._id === leadId);
    if (!lead) return;
    try {
      const res = await authFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ stage: 'Not Qualified', previousStage: lead.stage, notQualifiedReason: reason || '' }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        addToast('Lead marked as Not Qualified');
      } else addToast('Failed to update lead', 'error');
    } catch (err) { console.error('Mark not qualified error:', err); addToast('Failed to update lead', 'error'); }
  };

  const handleRevertLead = async (leadId) => {
    const lead = leads.find((l) => l._id === leadId);
    if (!lead || !lead.previousStage) return;
    try {
      const res = await authFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ stage: lead.previousStage, previousStage: '' }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        addToast(`Lead reverted to ${lead.previousStage}`);
      } else addToast('Failed to revert lead', 'error');
    } catch (err) { console.error('Revert lead error:', err); addToast('Failed to revert lead', 'error'); }
  };

  const handleRestartOnboarding = async (leadId) => {
    const lead = leads.find((l) => l._id === leadId);
    if (!lead) return;
    try {
      const res = await authFetch(`/api/onboarding/restart/${leadId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        // Update lead in state (now back to qualified/onboarded)
        setLeads((p) => p.map((l) => (l._id === leadId ? data.lead : l)));
        addToast(`${lead.name} re-added to Onboarding`);
      } else addToast('Failed to restart onboarding', 'error');
    } catch (err) { console.error('Restart onboarding error:', err); addToast('Failed to restart onboarding', 'error'); }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading pipeline...</div>;

  return (
    <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white' }}>Sales Pipeline</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              <Filter style={{ width: '16px', height: '16px' }} /> Filter
            </button>
            <button type="button" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus style={{ width: '16px', height: '16px' }} /> New Lead
            </button>
          </div>
        </div>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Manage prospect enquiries from lead to qualification</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', flex: 1, minHeight: 0 }}>
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} style={{ backgroundColor: '#111525', border: '1px solid #1e2540', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: STAGE_COLORS[stage] }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{stage}</span>
                </div>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1e2540', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>{stageLeads.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                {stageLeads.map((lead) => <LeadCard key={lead._id} lead={lead} onClick={setSelectedLead} />)}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && <LeadFormModal onClose={() => setShowAddModal(false)} onSubmit={handleAddLead} teamMembers={teamMembers} members={members} />}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onMoveNext={handleMoveNext}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          teamMembers={teamMembers}
          onMoveToOnboarding={handleMoveToOnboarding}
          onMarkNotQualified={handleMarkNotQualified}
          onRevertLead={handleRevertLead}
          onRestartOnboarding={handleRestartOnboarding}
        />
      )}
    </div>
  );
};

export default SalesPipeline;
