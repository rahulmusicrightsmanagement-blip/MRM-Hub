import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, Archive, Inbox, Filter, Trash2, Edit3, X, Clock, CheckCircle2, Loader2, AlertCircle, ChevronDown, Check, Send, UserCheck, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';
import DateTimePicker from '../components/DateTimePicker';
import { useNotificationDeeplink } from '../hooks/useNotificationDeeplink';

const STATUS = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  NOT_COMPLETED: 'Not Completed',
};

const statusColors = {
  [STATUS.NEW]: { bg: 'rgba(59,130,246,0.14)', fg: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  [STATUS.IN_PROGRESS]: { bg: 'rgba(245,158,11,0.14)', fg: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  [STATUS.COMPLETED]: { bg: 'rgba(16,185,129,0.14)', fg: '#34d399', border: 'rgba(16,185,129,0.3)' },
  [STATUS.NOT_COMPLETED]: { bg: 'rgba(239,68,68,0.14)', fg: '#f87171', border: 'rgba(239,68,68,0.3)' },
};

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
};

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const deadlineBadge = (iso, status) => {
  if (!iso) return null;
  if (status === STATUS.COMPLETED) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { text: 'Overdue', color: '#f87171', bg: 'rgba(239,68,68,0.14)' };
  if (diffDays === 0) return { text: 'Due today', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)' };
  if (diffDays === 1) return { text: 'Due tomorrow', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)' };
  return null;
};

const ClientChat = () => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [msgsRes, membersRes, teamRes] = await Promise.all([
        authFetch('/api/client-messages'),
        authFetch('/api/members'),
        authFetch('/api/users/team'),
      ]);
      const msgsData = await msgsRes.json();
      const membersData = await membersRes.json();
      const teamData = await teamRes.json();
      setMessages(msgsData.messages || []);
      setMembers(membersData.members || []);
      setTeamMembers(teamData.users || []);
    } catch (err) {
      console.error(err);
      addToast?.('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useNotificationDeeplink({
    expectedType: ['clienttask', 'clientmessage', 'client_message'],
    records: messages,
    isReady: !loading,
    onOpen: (msg) => { setEditing(msg); setModalOpen(true); },
    onMissing: () => addToast?.('This client task is no longer available (deleted).', 'error'),
  });

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (msg) => {
    setEditing(msg);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const saveMessage = async (data) => {
    try {
      const url = editing ? `/api/client-messages/${editing._id}` : '/api/client-messages';
      const method = editing ? 'PUT' : 'POST';
      const res = await authFetch(url, { method, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Save failed');
      }
      const body = await res.json();
      const saved = body.message;
      if (editing) {
        setMessages((prev) => prev.map((m) => (m._id === saved._id ? saved : m)));
        addToast?.('Task updated', 'success');
      } else {
        setMessages((prev) => [saved, ...prev]);
        addToast?.('Task added', 'success');
      }
      closeModal();
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm('Delete this task permanently?')) return;
    try {
      const res = await authFetch(`/api/client-messages/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setMessages((prev) => prev.filter((m) => m._id !== id));
      addToast?.('Task deleted', 'success');
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const addResponse = async (id, text) => {
    try {
      const res = await authFetch(`/api/client-messages/${id}/responses`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add response');
      }
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m._id === id ? body.message : m)));
      return body.message;
    } catch (err) {
      addToast?.(err.message, 'error');
      return null;
    }
  };

  const removeResponse = async (id, rid) => {
    try {
      const res = await authFetch(`/api/client-messages/${id}/responses/${rid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete response');
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m._id === id ? body.message : m)));
      return body.message;
    } catch (err) {
      addToast?.(err.message, 'error');
      return null;
    }
  };

  const setStatus = async (id, status) => {
    try {
      const res = await authFetch(`/api/client-messages/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m._id === id ? body.message : m)));
    } catch (err) {
      addToast?.(err.message, 'error');
    }
  };

  const filtered = useMemo(() => {
    let list = [...messages];
    if (view === 'archive') {
      list = list.filter((t) => t.status === STATUS.COMPLETED || t.status === STATUS.NOT_COMPLETED);
    } else {
      if (filter === 'all') list = list.filter((t) => t.status !== STATUS.COMPLETED && t.status !== STATUS.NOT_COMPLETED);
      else if (filter === 'new') list = list.filter((t) => t.status === STATUS.NEW);
      else if (filter === 'progress') list = list.filter((t) => t.status === STATUS.IN_PROGRESS);
      else if (filter === 'completed') list = list.filter((t) => t.status === STATUS.COMPLETED);
      else if (filter === 'not_completed') list = list.filter((t) => t.status === STATUS.NOT_COMPLETED);
    }
    list.sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    return list;
  }, [messages, filter, view]);

  const counts = useMemo(() => ({
    all: messages.filter((t) => t.status !== STATUS.COMPLETED && t.status !== STATUS.NOT_COMPLETED).length,
    new: messages.filter((t) => t.status === STATUS.NEW).length,
    progress: messages.filter((t) => t.status === STATUS.IN_PROGRESS).length,
    completed: messages.filter((t) => t.status === STATUS.COMPLETED).length,
    not_completed: messages.filter((t) => t.status === STATUS.NOT_COMPLETED).length,
  }), [messages]);

  return (
    <div style={{ padding: '32px 36px', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MessageSquare style={{ width: '26px', height: '26px', color: '#60a5fa' }} />
            Client Task
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Track client tasks, deadlines, and progress with SPOC remarks
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          New Task
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Active Tasks" value={counts.all} icon={<Inbox size={18} />} color="#60a5fa" />
        <StatCard label="New" value={counts.new} icon={<AlertCircle size={18} />} color="#60a5fa" />
        <StatCard label="In Progress" value={counts.progress} icon={<Loader2 size={18} />} color="#fbbf24" />
        <StatCard label="Completed" value={counts.completed} icon={<CheckCircle2 size={18} />} color="#34d399" />
        <StatCard label="Not Completed" value={counts.not_completed} icon={<XCircle size={18} />} color="#f87171" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#141720', padding: '4px', borderRadius: '10px', border: '1px solid #1e2235' }}>
          <TabBtn active={view === 'active'} onClick={() => { setView('active'); setFilter('all'); }} icon={<Inbox size={14} />}>
            Active
          </TabBtn>
          <TabBtn active={view === 'archive'} onClick={() => { setView('archive'); setFilter('all'); }} icon={<Archive size={14} />}>
            Archive
          </TabBtn>
        </div>

        {view === 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: '#6b7280' }} />
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
            <FilterBtn active={filter === 'new'} onClick={() => setFilter('new')}>New</FilterBtn>
            <FilterBtn active={filter === 'progress'} onClick={() => setFilter('progress')}>In Progress</FilterBtn>
            <FilterBtn active={filter === 'completed'} onClick={() => setFilter('completed')}>Completed</FilterBtn>
            <FilterBtn active={filter === 'not_completed'} onClick={() => setFilter('not_completed')}>Not Completed</FilterBtn>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <EmptyState view={view} onNew={openNew} />
        ) : (
          filtered.map((msg) => (
            <TaskCard
              key={msg._id}
              task={msg}
              onEdit={() => openEdit(msg)}
              onDelete={() => deleteMessage(msg._id)}
              onStatusChange={(s) => setStatus(msg._id, s)}
            />
          ))
        )}
      </div>

      {modalOpen && (
        <TaskModal
          initial={editing ? messages.find((m) => m._id === editing._id) || editing : null}
          members={members}
          teamMembers={teamMembers}
          onClose={closeModal}
          onSave={saveMessage}
          onAddResponse={addResponse}
          onRemoveResponse={removeResponse}
        />
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }) => (
  <div style={{ padding: '18px 20px', backgroundColor: '#141720', borderRadius: '12px', border: '1px solid #1e2235' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <span style={{ color: '#9ca3af', fontSize: '13px' }}>{label}</span>
      <div style={{ color, display: 'flex' }}>{icon}</div>
    </div>
    <div style={{ fontSize: '26px', fontWeight: 700, color: 'white' }}>{value}</div>
  </div>
);

const TabBtn = ({ active, onClick, children, icon }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      backgroundColor: active ? 'rgba(37,99,235,0.16)' : 'transparent',
      color: active ? '#60a5fa' : '#9ca3af',
    }}
  >
    {icon}
    {children}
  </button>
);

const FilterBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      border: '1px solid',
      borderColor: active ? '#3b82f6' : '#1e2235',
      backgroundColor: active ? 'rgba(59,130,246,0.14)' : '#141720',
      color: active ? '#60a5fa' : '#9ca3af',
    }}
  >
    {children}
  </button>
);

const STATUS_OPTIONS = [
  { value: STATUS.NEW, label: 'New', dot: '#60a5fa', icon: AlertCircle },
  { value: STATUS.IN_PROGRESS, label: 'In Progress', dot: '#fbbf24', icon: Loader2 },
  { value: STATUS.COMPLETED, label: 'Completed', dot: '#34d399', icon: CheckCircle2 },
  { value: STATUS.NOT_COMPLETED, label: 'Not Completed', dot: '#f87171', icon: XCircle },
];

const StatusMenu = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = STATUS_OPTIONS.find((o) => o.value === value) || STATUS_OPTIONS[0];
  const sc = statusColors[value] || statusColors[STATUS.NEW];

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px 6px 12px',
          backgroundColor: sc.bg,
          border: `1px solid ${sc.border}`,
          color: sc.fg,
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: current.dot, boxShadow: `0 0 8px ${current.dot}` }} />
        {current.label}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', opacity: 0.8 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '160px',
            background: 'linear-gradient(180deg, #1a1f2e 0%, #141720 100%)',
            border: '1px solid #2d3348',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06)',
            padding: '4px',
            zIndex: 50,
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: active ? 'white' : '#d1d5db',
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: opt.dot, boxShadow: `0 0 6px ${opt.dot}` }} />
                  {opt.label}
                </span>
                {active && <Check size={13} style={{ color: '#a78bfa' }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const sc = statusColors[task.status] || statusColors[STATUS.NEW];
  const dl = deadlineBadge(task.deadline, task.status);

  return (
    <div
      style={{
        padding: '18px 20px',
        backgroundColor: '#141720',
        borderRadius: '12px',
        border: '1px solid #1e2235',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: '15px',
          flexShrink: 0,
        }}
      >
        {task.clientName?.[0]?.toUpperCase() || '?'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>{task.clientName}</h3>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>• Received {fmt(task.receivedAt)}</span>
          <span
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: sc.bg,
              color: sc.fg,
              border: `1px solid ${sc.border}`,
              fontWeight: 600,
            }}
          >
            {task.status}
          </span>
          {dl && (
            <span
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: dl.bg,
                color: dl.color,
                fontWeight: 600,
              }}
            >
              {dl.text}
            </span>
          )}
        </div>

        <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: 1.5, marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
          {task.message}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9ca3af' }}>
            <Clock size={13} />
            Deadline: {fmt(task.deadline)}
          </span>
          {task.assignedTo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#a78bfa' }}>
              <UserCheck size={13} />
              {task.assignedTo}
            </span>
          )}
          {Array.isArray(task.responses) && task.responses.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#60a5fa' }}>
              <Send size={12} />
              {task.responses.length} {task.responses.length === 1 ? 'remark' : 'remarks'}
            </span>
          )}
          <StatusMenu value={task.status} onChange={onStatusChange} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <IconBtn title="Edit" onClick={onEdit}><Edit3 size={15} /></IconBtn>
        <IconBtn title="Delete" onClick={onDelete} danger><Trash2 size={15} /></IconBtn>
      </div>
    </div>
  );
};

const IconBtn = ({ children, onClick, title, danger }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: '1px solid #1e2235',
      backgroundColor: '#0f1117',
      color: danger ? '#f87171' : '#9ca3af',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </button>
);

const EmptyState = ({ view, onNew }) => (
  <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#141720', borderRadius: '12px', border: '1px dashed #1e2235' }}>
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(59,130,246,0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}
    >
      {view === 'archive' ? <Archive size={28} color="#60a5fa" /> : <MessageSquare size={28} color="#60a5fa" />}
    </div>
    <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
      {view === 'archive' ? 'No archived tasks yet' : 'No tasks yet'}
    </h3>
    <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '20px' }}>
      {view === 'archive'
        ? 'Completed tasks will appear here for reference.'
        : 'Log your first client task to get started.'}
    </p>
    {view === 'active' && (
      <button
        onClick={onNew}
        style={{
          padding: '10px 18px',
          borderRadius: '10px',
          border: 'none',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        + Add First Entry
      </button>
    )}
  </div>
);

const TaskModal = ({ initial, members, teamMembers, onClose, onSave, onAddResponse, onRemoveResponse }) => {
  const [clientName, setClientName] = useState(initial?.clientName || '');
  const [message, setMessage] = useState(initial?.message || '');
  const [receivedAt, setReceivedAt] = useState(
    initial?.receivedAt ? new Date(initial.receivedAt).toISOString() : new Date().toISOString()
  );
  const [deadline, setDeadline] = useState(initial?.deadline ? new Date(initial.deadline).toISOString() : '');
  const [status, setStatus] = useState(initial?.status || STATUS.NEW);
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo || '');
  const [errors, setErrors] = useState({});
  const [responseText, setResponseText] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);

  const responses = initial?.responses || [];

  const teamOptions = useMemo(
    () => (teamMembers || []).map((u) => ({
      _id: u._id,
      name: u.name,
      role: Array.isArray(u.roles) ? u.roles.join(', ') : '',
    })),
    [teamMembers]
  );

  const memberOptions = useMemo(
    () => (members || []).map((m) => ({
      _id: m._id,
      name: m.name,
      initials: m.initials,
      color: m.color,
      role: Array.isArray(m.role) ? m.role.join(', ') : m.role,
      email: m.email,
    })),
    [members]
  );

  const validate = () => {
    const errs = {};
    if (!clientName.trim()) errs.clientName = 'Select a client';
    if (!message.trim()) errs.message = 'Task description is required';
    else if (message.trim().length < 2) errs.message = 'Task description is too short';

    const rcvd = receivedAt ? new Date(receivedAt) : null;
    if (!rcvd || isNaN(rcvd.getTime())) {
      errs.receivedAt = 'Pick a valid start date';
    } else {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (rcvd > todayEnd) errs.receivedAt = 'Start date cannot be in the future';
      if (rcvd.getFullYear() < 2000) errs.receivedAt = 'Invalid year';
    }

    if (!deadline) {
      errs.deadline = 'End date is required';
    } else {
      const dl = new Date(deadline);
      if (isNaN(dl.getTime())) errs.deadline = 'Pick a valid end date';
      else if (rcvd) {
        const rcvdDay = new Date(rcvd.getFullYear(), rcvd.getMonth(), rcvd.getDate()).getTime();
        const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime();
        if (dlDay < rcvdDay) errs.deadline = 'End date must be on or after start date';
      }
    }

    if (!status) errs.status = 'Status is required';
    if (!assignedTo.trim()) errs.assignedTo = 'Assign task to a team member';

    return errs;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const selected = (members || []).find((m) => m.name === clientName);
    const assignee = (teamMembers || []).find((u) => u.name === assignedTo);
    onSave({
      clientName: clientName.trim(),
      clientId: selected?._id || null,
      message: message.trim(),
      receivedAt: new Date(receivedAt).toISOString(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status,
      assignedTo: assignedTo || '',
      assignedToId: assignee?._id || null,
    });
  };

  const handleAddResponse = async () => {
    const text = responseText.trim();
    if (!text || !initial?._id) return;
    setSavingResponse(true);
    const updated = await onAddResponse(initial._id, text);
    setSavingResponse(false);
    if (updated) setResponseText('');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        overflowY: 'auto',
        padding: '40px 20px',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '600px',
          maxWidth: '100%',
          background: 'linear-gradient(180deg, #161a26 0%, #12141d 100%)',
          borderRadius: '18px',
          border: '1px solid #262d45',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06)',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '24px 28px 18px',
          borderBottom: '1px solid #1e2540',
        }}>
          <div>
            <h2 style={{ color: 'white', fontSize: '19px', fontWeight: 700, marginBottom: '4px' }}>
              {initial ? 'Edit Task' : 'New Client Task'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>
              {initial ? 'Update the task details below' : 'Log a new task from a client'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0f1117',
              border: '1px solid #2d3348',
              color: '#9ca3af',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        <SearchableSelect
          label="Client Name"
          required
          options={memberOptions}
          value={clientName}
          onChange={(v) => { setClientName(v); if (errors.clientName) setErrors((p) => ({ ...p, clientName: undefined })); }}
          placeholder="Select a client..."
          emptyMessage="No matching clients"
        />
        {errors.clientName && (
          <div style={{ color: '#f87171', fontSize: '12px', marginTop: '-10px' }}>{errors.clientName}</div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Task from Client <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })); }}
            rows={4}
            placeholder="Describe the task received from the client..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              borderColor: errors.message ? '#ef4444' : '#1e2540',
            }}
          />
          {errors.message && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.message}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <DateTimePicker
            label="Start Date"
            required
            value={receivedAt}
            onChange={(v) => { setReceivedAt(v); if (errors.receivedAt) setErrors((p) => ({ ...p, receivedAt: undefined })); }}
            error={errors.receivedAt}
          />
          <DateTimePicker
            label="End Date"
            required
            value={deadline}
            onChange={(v) => { setDeadline(v); if (errors.deadline) setErrors((p) => ({ ...p, deadline: undefined })); }}
            minDate={receivedAt}
            error={errors.deadline}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Status <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); if (errors.status) setErrors((p) => ({ ...p, status: undefined })); }} style={{ ...inputStyle, borderColor: errors.status ? '#ef4444' : '#1e2540' }}>
              <option value={STATUS.NEW}>New</option>
              <option value={STATUS.IN_PROGRESS}>In Progress</option>
              <option value={STATUS.COMPLETED}>Completed</option>
              <option value={STATUS.NOT_COMPLETED}>Not Completed</option>
            </select>
            {errors.status && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.status}</div>}
          </div>
          <div>
            <SearchableSelect
              label="Assign Task To"
              required
              options={teamOptions}
              value={assignedTo}
              onChange={(v) => { setAssignedTo(v); if (errors.assignedTo) setErrors((p) => ({ ...p, assignedTo: undefined })); }}
              placeholder="Select team member..."
              emptyMessage="No team members"
            />
            {errors.assignedTo && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.assignedTo}</div>}
          </div>
        </div>

        {initial?._id && (
          <div style={{
            padding: '16px',
            background: 'linear-gradient(180deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))',
            border: '1px solid #262d45',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Send size={14} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#d1d5db', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Remarks by SPOC
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                {responses.length} {responses.length === 1 ? 'remark' : 'remarks'}
              </span>
            </div>

            {responses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                {responses.map((r) => (
                  <div
                    key={r._id}
                    style={{
                      padding: '10px 12px',
                      background: '#0f1117',
                      border: '1px solid #1e2540',
                      borderRadius: '8px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '4px' }}>
                        {r.text}
                      </p>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>
                        {r.createdBy ? `${r.createdBy} · ` : ''}
                        {new Date(r.createdAt).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveResponse(initial._id, r._id)}
                      title="Delete remark"
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Add a remark from SPOC about this task..."
                rows={2}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  backgroundColor: '#0f1117',
                  border: '1px solid #1e2540',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleAddResponse();
                  }
                }}
              />
              <button
                type="button"
                disabled={!responseText.trim() || savingResponse}
                onClick={handleAddResponse}
                style={{
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: responseText.trim() ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#1e2540',
                  color: responseText.trim() ? 'white' : '#6b7280',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: responseText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: savingResponse ? 0.6 : 1,
                }}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
        )}

        </div>

        {/* Sticky footer */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          padding: '14px 28px',
          borderTop: '1px solid #1e2540',
          background: 'rgba(15,17,23,0.6)',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #1e2540',
              backgroundColor: 'transparent',
              color: '#9ca3af',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {initial ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#0f1117',
  border: '1px solid #1e2540',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default ClientChat;
