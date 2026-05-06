import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, Archive, Inbox, Filter, Trash2, Edit3, X, Clock, CheckCircle2, Loader2, AlertCircle, ChevronDown, Check, Send, UserCheck, XCircle, MessageCircle, Users, Flag, Eye, Lock } from 'lucide-react';
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

const normalizeName = (value) => (value || '').trim().toLowerCase();
const toId = (value) => value?.toString?.() || value || '';

const isAssignedToCurrentUser = (task, user) => {
  if (!task || !user) return false;
  const userId = toId(user._id || user.id);
  const assigneeId = toId(task.assignedToId);
  if (userId && assigneeId && userId === assigneeId) return true;
  return !!task.assignedTo && normalizeName(task.assignedTo) === normalizeName(user.name);
};

const getRole = (task, user) => {
  if (!user) return 'viewer';
  const uid = toId(user._id || user.id);
  const creatorId = toId(task.createdById);
  const isCreator = creatorId && uid && creatorId === uid;
  const isAssignee = isAssignedToCurrentUser(task, user);
  if (isCreator) return 'creator';
  if (isAssignee) return 'assignee';
  return 'viewer';
};

const ClientChat = () => {
  const { authFetch, user: currentUser, isGuest } = useAuth();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalType, setModalType] = useState('client');

  const blockGuestAction = () => {
    if (!isGuest) return false;
    addToast?.('Guest users have view-only access', 'error');
    return true;
  };

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

  const openNew = (type = 'client') => {
    if (blockGuestAction()) return;
    setEditing(null);
    setModalType(type);
    setModalOpen(true);
  };

  const openEdit = (msg) => {
    setEditing(msg);
    setModalType(msg.taskType === 'spoc' ? 'spoc' : 'client');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setModalType('client');
  };

  const saveMessage = async (data) => {
    if (blockGuestAction()) return;
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
    if (blockGuestAction()) return;
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
    if (blockGuestAction()) return null;
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
    if (blockGuestAction()) return null;
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
    if (blockGuestAction()) return null;
    try {
      const res = await authFetch(`/api/client-messages/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const body = await res.json();
      setMessages((prev) => prev.map((m) => (m._id === id ? body.message : m)));
      return body.message;
    } catch (err) {
      addToast?.(err.message, 'error');
      return null;
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => openNew('client')}
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
          <button
            onClick={() => openNew('spoc')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981, #14b8a6)',
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            <Users style={{ width: '16px', height: '16px' }} />
            Task for SPOC
          </button>
        </div>
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

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0', backgroundColor: '#141720', borderRadius: '12px', border: '1px solid #1e2235' }}>Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <EmptyState view={view} onNew={openNew} />
      ) : (
        <TaskTable
          tasks={filtered}
          onEdit={openEdit}
          onDelete={deleteMessage}
          onStatusChange={setStatus}
          currentUser={currentUser}
        />
      )}

      {modalOpen && (() => {
        const initial = editing ? messages.find((m) => m._id === editing._id) || editing : null;
        const role = initial ? getRole(initial, currentUser) : 'creator';
        return modalType === 'spoc' ? (
          <SpocTaskModal
            initial={initial}
            teamMembers={teamMembers}
            role={role}
            currentUser={currentUser}
            onClose={closeModal}
            onSave={(data) => saveMessage({ ...data, taskType: 'spoc' })}
            onAddResponse={addResponse}
            onRemoveResponse={removeResponse}
            onStatusChange={setStatus}
          />
        ) : (
          <TaskModal
            initial={initial}
            members={members}
            teamMembers={teamMembers}
            role={role}
            currentUser={currentUser}
            onClose={closeModal}
            onSave={(data) => saveMessage({ ...data, taskType: 'client' })}
            onAddResponse={addResponse}
            onRemoveResponse={removeResponse}
            onStatusChange={setStatus}
          />
        );
      })()}
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

const TaskTable = ({ tasks, onEdit, onDelete, onStatusChange, currentUser }) => {
  const [expanded, setExpanded] = useState(null);

  const cellBase = {
    padding: '14px 12px',
    fontSize: '13px',
    color: '#d1d5db',
    borderBottom: '1px solid #1e2235',
    verticalAlign: 'top',
  };

  const headBase = {
    padding: '12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'left',
    borderBottom: '1px solid #2d3348',
    background: '#0f1117',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      backgroundColor: '#141720',
      borderRadius: '12px',
      border: '1px solid #1e2235',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
          <thead>
            <tr>
              <th style={{ ...headBase, width: '50px', textAlign: 'center' }}>Sr.</th>
              <th style={{ ...headBase, minWidth: '180px' }}>Task Person</th>
              <th style={{ ...headBase, minWidth: '260px' }}>Task Name</th>
              <th style={{ ...headBase, minWidth: '140px' }}>Assigned By</th>
              <th style={{ ...headBase, minWidth: '160px' }}>Assigned To</th>
              <th style={{ ...headBase, minWidth: '180px' }}>Remarks</th>
              <th style={{ ...headBase, minWidth: '120px' }}>Date Assigned</th>
              <th style={{ ...headBase, minWidth: '120px' }}>Deadline</th>
              <th style={{ ...headBase, minWidth: '160px' }}>Status</th>
              <th style={{ ...headBase, width: '90px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, idx) => {
              const sc = statusColors[task.status] || statusColors[STATUS.NEW];
              const dl = deadlineBadge(task.deadline, task.status);
              const remarks = Array.isArray(task.responses) ? task.responses : [];
              const isOpen = expanded === task._id;
              const rowBg = idx % 2 === 0 ? '#141720' : '#171b27';
              const role = getRole(task, currentUser);
              const canEdit = role === 'creator';
              const canDelete = role === 'creator';
              const canChangeStatus = role !== 'viewer';
              const isMine = isAssignedToCurrentUser(task, currentUser);

              return (
                <React.Fragment key={task._id}>
                  <tr style={{ background: rowBg, transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1f2e'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
                  >
                    <td style={{ ...cellBase, textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>{idx + 1}</td>

                    <td style={cellBase}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: task.taskType === 'spoc'
                            ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                            : 'linear-gradient(135deg, #25D366, #128C7E)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0,
                        }}>
                          {task.clientName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>
                            {task.clientName || '—'}
                          </span>
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            width: 'fit-content',
                            background: task.taskType === 'spoc' ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.15)',
                            color: task.taskType === 'spoc' ? '#34d399' : '#60a5fa',
                            border: `1px solid ${task.taskType === 'spoc' ? 'rgba(16,185,129,0.3)' : 'rgba(96,165,250,0.3)'}`,
                          }}>
                            {task.taskType === 'spoc' ? 'SPOC' : 'Client'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ ...cellBase, color: '#e5e7eb', maxWidth: '320px' }}>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {task.message || '—'}
                      </div>
                    </td>

                    <td style={{ ...cellBase, color: '#9ca3af' }}>
                      {task.createdBy || task.assignedBy || '—'}
                    </td>

                    <td style={cellBase}>
                      {task.assignedTo ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#a78bfa', fontWeight: 500 }}>
                          <UserCheck size={13} />
                          {task.assignedTo}
                        </span>
                      ) : <span style={{ color: '#6b7280' }}>—</span>}
                    </td>

                    <td style={cellBase}>
                      {remarks.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : task._id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '8px',
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.25)',
                            color: '#60a5fa', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <MessageCircle size={12} />
                          {remarks.length} {remarks.length === 1 ? 'remark' : 'remarks'}
                          <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>No remarks</span>
                      )}
                    </td>

                    <td style={{ ...cellBase, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={12} />
                        {fmt(task.receivedAt)}
                      </span>
                    </td>

                    <td style={{ ...cellBase, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#d1d5db' }}>{fmt(task.deadline)}</span>
                        {dl && (
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                            backgroundColor: dl.bg, color: dl.color, fontWeight: 600,
                            width: 'fit-content',
                          }}>
                            {dl.text}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={cellBase}>
                      {canChangeStatus ? (
                        <StatusMenu value={task.status} onChange={(s) => onStatusChange(task._id, s)} />
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: sc.bg,
                          border: `1px solid ${sc.border}`,
                          color: sc.fg,
                          fontSize: '12px', fontWeight: 600,
                          borderRadius: '8px',
                        }}>
                          <Lock size={11} />
                          {task.status}
                        </span>
                      )}
                    </td>

                    <td style={{ ...cellBase, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {isMine && <YourTaskBadge />}
                        {canEdit ? (
                          <IconBtn title="Edit task" onClick={() => onEdit(task)}><Edit3 size={14} /></IconBtn>
                        ) : (
                          <IconBtn title={role === 'assignee' ? 'View / add remarks' : 'View only'} onClick={() => onEdit(task)} info><Eye size={14} /></IconBtn>
                        )}
                        {canDelete && (
                          <IconBtn title="Delete" onClick={() => onDelete(task._id)} danger><Trash2 size={14} /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isOpen && remarks.length > 0 && (
                    <tr key={`${task._id}-remarks`} style={{ background: '#0f1117' }}>
                      <td colSpan={10} style={{ padding: '0', borderBottom: '1px solid #1e2235' }}>
                        <div style={{ padding: '14px 20px 18px 60px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MessageCircle size={12} style={{ color: '#60a5fa' }} />
                            All Remarks ({remarks.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {remarks.map((r, i) => (
                              <div key={r._id || i} style={{
                                padding: '10px 12px',
                                background: '#141720',
                                border: '1px solid #1e2540',
                                borderRadius: '8px',
                              }}>
                                <p style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '4px' }}>
                                  {r.text}
                                </p>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                  {r.createdBy ? `${r.createdBy} · ` : ''}
                                  {r.createdAt && new Date(r.createdAt).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const YourTaskBadge = () => (
  <span
    title="Assigned to your profile"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      minHeight: '32px',
      padding: '0 9px',
      borderRadius: '8px',
      border: '1px solid rgba(16,185,129,0.35)',
      background: 'rgba(16,185,129,0.12)',
      color: '#34d399',
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    <UserCheck size={13} />
    Yours
  </span>
);

const IconBtn = ({ children, onClick, title, danger, info }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: '1px solid #1e2235',
      backgroundColor: '#0f1117',
      color: danger ? '#f87171' : info ? '#60a5fa' : '#9ca3af',
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

const TaskModal = ({ initial, members, teamMembers, role = 'creator', currentUser, onClose, onSave, onAddResponse, onRemoveResponse, onStatusChange }) => {
  const isNew = !initial;
  const canEditAll = isNew || role === 'creator';
  const canAddRemark = role !== 'viewer';
  const readOnly = role === 'viewer';
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
  const [savingStatus, setSavingStatus] = useState(false);

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
    let validReceivedAt = false;
    if (!rcvd || isNaN(rcvd.getTime())) {
      errs.receivedAt = 'Pick a valid start date';
    } else {
      validReceivedAt = true;
      if (rcvd.getFullYear() < 2000) errs.receivedAt = 'Invalid year';
    }

    if (!deadline) {
      errs.deadline = 'End date is required';
    } else {
      const dl = new Date(deadline);
      if (isNaN(dl.getTime())) errs.deadline = 'Pick a valid end date';
      else if (validReceivedAt) {
        const rcvdDay = new Date(rcvd.getFullYear(), rcvd.getMonth(), rcvd.getDate()).getTime();
        const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime();
        if (rcvdDay > dlDay) errs.receivedAt = 'Start date must be on or before end date';
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

  const handleStatusChange = async (nextStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    if (errors.status) setErrors((p) => ({ ...p, status: undefined }));
    if (!canEditAll && role === 'assignee' && initial?._id && onStatusChange) {
      setSavingStatus(true);
      const updated = await onStatusChange(initial._id, nextStatus);
      setSavingStatus(false);
      if (updated?.status) setStatus(updated.status);
      else setStatus(previousStatus);
    }
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

        {!isNew && !canEditAll && (
          <RoleBanner role={role} />
        )}

        {canEditAll ? (
          <SearchableSelect
            label="Client Name"
            required
            options={memberOptions}
            value={clientName}
            onChange={(v) => { setClientName(v); if (errors.clientName) setErrors((p) => ({ ...p, clientName: undefined })); }}
            placeholder="Select a client..."
            emptyMessage="No matching clients"
          />
        ) : (
          <ReadField label="Client Name" value={clientName || '—'} />
        )}
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
            readOnly={!canEditAll}
            placeholder="Describe the task received from the client..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              borderColor: errors.message ? '#ef4444' : '#1e2540',
              opacity: !canEditAll ? 0.7 : 1,
              cursor: !canEditAll ? 'not-allowed' : 'text',
            }}
          />
          {errors.message && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.message}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {canEditAll ? (
            <DateTimePicker
              label="Start Date"
              required
              value={receivedAt}
              onChange={(v) => { setReceivedAt(v); if (errors.receivedAt) setErrors((p) => ({ ...p, receivedAt: undefined })); }}
              error={errors.receivedAt}
            />
          ) : (
            <ReadField label="Start Date" value={receivedAt ? new Date(receivedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          )}
          {canEditAll ? (
            <DateTimePicker
              label="End Date"
              required
              value={deadline}
              onChange={(v) => { setDeadline(v); if (errors.deadline) setErrors((p) => ({ ...p, deadline: undefined })); }}
              minDate={receivedAt}
              error={errors.deadline}
            />
          ) : (
            <ReadField label="End Date" value={deadline ? new Date(deadline).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Status <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={status}
              disabled={readOnly || savingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ ...inputStyle, borderColor: errors.status ? '#ef4444' : '#1e2540', opacity: readOnly || savingStatus ? 0.7 : 1, cursor: readOnly || savingStatus ? 'not-allowed' : 'pointer' }}
            >
              <option value={STATUS.NEW}>New</option>
              <option value={STATUS.IN_PROGRESS}>In Progress</option>
              <option value={STATUS.COMPLETED}>Completed</option>
              <option value={STATUS.NOT_COMPLETED}>Not Completed</option>
            </select>
            {savingStatus && <div style={{ color: '#60a5fa', fontSize: '12px', marginTop: '4px' }}>Saving status...</div>}
            {errors.status && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.status}</div>}
          </div>
          <div>
            {canEditAll ? (
              <SearchableSelect
                label="Assign Task To"
                required
                options={teamOptions}
                value={assignedTo}
                onChange={(v) => { setAssignedTo(v); if (errors.assignedTo) setErrors((p) => ({ ...p, assignedTo: undefined })); }}
                placeholder="Select team member..."
                emptyMessage="No team members"
              />
            ) : (
              <ReadField label="Assigned To" value={assignedTo || '—'} />
            )}
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
                    {(role === 'creator' || (currentUser && r.createdById && r.createdById === currentUser._id)) && (
                      <button
                        type="button"
                        onClick={() => onRemoveResponse(initial._id, r._id)}
                        title="Delete remark"
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canAddRemark ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Add a remark about this task..."
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
            ) : (
              <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', padding: '8px 4px' }}>
                Read-only — only the assignee or task creator can add remarks.
              </div>
            )}
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
          {(canEditAll) && (
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
          )}
        </div>
      </form>
    </div>
  );
};

const RoleBanner = ({ role }) => {
  const cfg = role === 'assignee'
    ? { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', color: '#34d399', text: 'Assignee view — you can update status and add remarks.' }
    : { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', color: '#60a5fa', text: 'View only — only the task creator can edit task details.' };
  return (
    <div style={{
      padding: '10px 14px',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '8px',
      color: cfg.color,
      fontSize: '12px',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <Lock size={12} />
      {cfg.text}
    </div>
  );
};

const ReadField = ({ label, value }) => (
  <div>
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{
      padding: '10px 12px',
      backgroundColor: '#0a0d14',
      border: '1px dashed #1e2540',
      borderRadius: '8px',
      color: '#d1d5db',
      fontSize: '14px',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
    }}>
      {value}
    </div>
  </div>
);

const PRIORITY_OPTIONS = [
  { value: 'Low', color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.3)' },
  { value: 'Medium', color: '#60a5fa', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.3)' },
  { value: 'High', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.3)' },
  { value: 'Urgent', color: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.3)' },
];

const SpocTaskModal = ({ initial, teamMembers, role = 'creator', currentUser, onClose, onSave, onAddResponse, onRemoveResponse, onStatusChange }) => {
  const isNew = !initial;
  const canEditAll = isNew || role === 'creator';
  const canAddRemark = role !== 'viewer';
  const readOnly = role === 'viewer';
  const [spocName, setSpocName] = useState(initial?.clientName || '');
  const [taskTitle, setTaskTitle] = useState(initial?.taskTitle || '');
  const [message, setMessage] = useState(initial?.message || '');
  const [receivedAt, setReceivedAt] = useState(
    initial?.receivedAt ? new Date(initial.receivedAt).toISOString() : new Date().toISOString()
  );
  const [deadline, setDeadline] = useState(initial?.deadline ? new Date(initial.deadline).toISOString() : '');
  const [status, setStatus] = useState(initial?.status || STATUS.NEW);
  const [priority, setPriority] = useState(initial?.priority || 'Medium');
  const [errors, setErrors] = useState({});
  const [responseText, setResponseText] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const responses = initial?.responses || [];

  const teamOptions = useMemo(
    () => (teamMembers || []).map((u) => ({
      _id: u._id,
      name: u.name,
      role: Array.isArray(u.roles) ? u.roles.join(', ') : '',
    })),
    [teamMembers]
  );

  const validate = () => {
    const errs = {};
    if (!spocName.trim()) errs.spocName = 'Select a SPOC';
    if (!message.trim()) errs.message = 'Task description is required';
    else if (message.trim().length < 2) errs.message = 'Task description is too short';

    const rcvd = receivedAt ? new Date(receivedAt) : null;
    let validReceivedAt = false;
    if (!rcvd || isNaN(rcvd.getTime())) {
      errs.receivedAt = 'Pick a valid start date';
    } else {
      validReceivedAt = true;
      if (rcvd.getFullYear() < 2000) errs.receivedAt = 'Invalid year';
    }

    if (!deadline) {
      errs.deadline = 'End date is required';
    } else {
      const dl = new Date(deadline);
      if (isNaN(dl.getTime())) errs.deadline = 'Pick a valid end date';
      else if (validReceivedAt) {
        const rcvdDay = new Date(rcvd.getFullYear(), rcvd.getMonth(), rcvd.getDate()).getTime();
        const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime();
        if (rcvdDay > dlDay) errs.receivedAt = 'Start date must be on or before end date';
      }
    }

    if (!status) errs.status = 'Status is required';
    if (!priority) errs.priority = 'Priority is required';

    return errs;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const spoc = (teamMembers || []).find((u) => u.name === spocName);
    const titlePrefix = taskTitle.trim() ? `${taskTitle.trim()}\n\n` : '';
    onSave({
      clientName: spocName.trim(),
      clientId: spoc?._id || null,
      message: titlePrefix + message.trim(),
      receivedAt: new Date(receivedAt).toISOString(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status,
      priority,
      assignedTo: spocName.trim(),
      assignedToId: spoc?._id || null,
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

  const handleStatusChange = async (nextStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    if (errors.status) setErrors((p) => ({ ...p, status: undefined }));
    if (!canEditAll && role === 'assignee' && initial?._id && onStatusChange) {
      setSavingStatus(true);
      const updated = await onStatusChange(initial._id, nextStatus);
      setSavingStatus(false);
      if (updated?.status) setStatus(updated.status);
      else setStatus(previousStatus);
    }
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
          border: '1px solid #1f3a32',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.08)',
          margin: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '24px 28px 18px',
          borderBottom: '1px solid #1e3a32',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #14b8a6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={20} color="white" />
            </div>
            <div>
              <h2 style={{ color: 'white', fontSize: '19px', fontWeight: 700, marginBottom: '4px' }}>
                {initial ? 'Edit SPOC Task' : 'New Task for SPOC'}
              </h2>
              <p style={{ color: '#6b7280', fontSize: '12px' }}>
                {initial ? 'Update internal task assigned to a SPOC' : 'Assign an internal task to a team SPOC'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0f1117', border: '1px solid #2d3348',
              color: '#9ca3af', cursor: 'pointer',
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {!isNew && !canEditAll && <RoleBanner role={role} />}

          {canEditAll ? (
            <SearchableSelect
              label="SPOC Name"
              required
              options={teamOptions}
              value={spocName}
              onChange={(v) => { setSpocName(v); if (errors.spocName) setErrors((p) => ({ ...p, spocName: undefined })); }}
              placeholder="Select a SPOC..."
              emptyMessage="No team members"
            />
          ) : (
            <ReadField label="SPOC Name" value={spocName || '—'} />
          )}
          {errors.spocName && (
            <div style={{ color: '#f87171', fontSize: '12px', marginTop: '-10px' }}>{errors.spocName}</div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Task Title
            </label>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              readOnly={!canEditAll}
              placeholder="Short title for this task (optional)"
              style={{ ...inputStyle, opacity: !canEditAll ? 0.7 : 1, cursor: !canEditAll ? 'not-allowed' : 'text' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Task Description <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })); }}
              rows={4}
              readOnly={!canEditAll}
              placeholder="Describe what the SPOC needs to do..."
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
                borderColor: errors.message ? '#ef4444' : '#1e2540',
                opacity: !canEditAll ? 0.7 : 1,
                cursor: !canEditAll ? 'not-allowed' : 'text',
              }}
            />
            {errors.message && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.message}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {canEditAll ? (
              <DateTimePicker
                label="Start Date"
                required
                value={receivedAt}
                onChange={(v) => { setReceivedAt(v); if (errors.receivedAt) setErrors((p) => ({ ...p, receivedAt: undefined })); }}
                error={errors.receivedAt}
              />
            ) : (
              <ReadField label="Start Date" value={receivedAt ? new Date(receivedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
            )}
            {canEditAll ? (
              <DateTimePicker
                label="Deadline"
                required
                value={deadline}
                onChange={(v) => { setDeadline(v); if (errors.deadline) setErrors((p) => ({ ...p, deadline: undefined })); }}
                minDate={receivedAt}
                error={errors.deadline}
              />
            ) : (
              <ReadField label="Deadline" value={deadline ? new Date(deadline).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
              <Flag size={11} style={{ display: 'inline', marginRight: '4px' }} />
              Priority <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRIORITY_OPTIONS.map((p) => {
                const selected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    disabled={!canEditAll}
                    onClick={() => canEditAll && setPriority(p.value)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${selected ? p.border : '#1e2540'}`,
                      background: selected ? p.bg : 'transparent',
                      color: selected ? p.color : '#6b7280',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: canEditAll ? 'pointer' : 'not-allowed',
                      opacity: canEditAll ? 1 : 0.6,
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.value}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Status <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={status}
              disabled={readOnly || savingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ ...inputStyle, borderColor: errors.status ? '#ef4444' : '#1e2540', opacity: readOnly || savingStatus ? 0.7 : 1, cursor: readOnly || savingStatus ? 'not-allowed' : 'pointer' }}
            >
              <option value={STATUS.NEW}>New</option>
              <option value={STATUS.IN_PROGRESS}>In Progress</option>
              <option value={STATUS.COMPLETED}>Completed</option>
              <option value={STATUS.NOT_COMPLETED}>Not Completed</option>
            </select>
            {savingStatus && <div style={{ color: '#60a5fa', fontSize: '12px', marginTop: '4px' }}>Saving status...</div>}
            {errors.status && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>{errors.status}</div>}
          </div>

          {initial?._id && (
            <div style={{
              padding: '16px',
              background: 'linear-gradient(180deg, rgba(16,185,129,0.06), rgba(20,184,166,0.04))',
              border: '1px solid #1f3a32',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Send size={14} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#d1d5db', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Remarks / Updates
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
                      {(role === 'creator' || (currentUser && r.createdById && r.createdById === currentUser._id)) && (
                        <button
                          type="button"
                          onClick={() => onRemoveResponse(initial._id, r._id)}
                          title="Delete remark"
                          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canAddRemark ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Add an update / remark..."
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
                      background: responseText.trim() ? 'linear-gradient(135deg, #10b981, #14b8a6)' : '#1e2540',
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
              ) : (
                <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', padding: '8px 4px' }}>
                  Read-only — only the assigned SPOC or task creator can add remarks.
                </div>
              )}
            </div>
          )}

        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          padding: '14px 28px',
          borderTop: '1px solid #1e3a32',
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
          {(canEditAll) && (
            <button
              type="submit"
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {initial ? 'Save Changes' : 'Create SPOC Task'}
            </button>
          )}
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
