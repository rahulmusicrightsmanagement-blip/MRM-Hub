import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Edit3, X, Clock, CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronRight, Check,
  Send, UserCheck, XCircle, MessageCircle, MessageSquare, Users, Flag, Eye, Lock, Search, CalendarClock,
  ListTodo, Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';
import DateTimePicker from '../components/DateTimePicker';
import { useNotificationDeeplink } from '../hooks/useNotificationDeeplink';
import { useUrlState } from '../hooks/useUrlState';
import {
  PageHeader, Button, IconButton, StatGrid, StatCard, Segmented, Card, Panel, Pill,
  SearchInput, TH, EmptyState, TableSkeleton, Avatar, PersonChip,
} from '../components/studio';
import { T, TONES, TD, LABEL, SP, toneOf } from '../theme';

const STATUS = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  NOT_COMPLETED: 'Not Completed',
};

const STATUS_OPTIONS = [
  { value: STATUS.NEW, label: 'New', tone: 'blue', icon: AlertCircle },
  { value: STATUS.IN_PROGRESS, label: 'In Progress', tone: 'amber', icon: Loader2 },
  { value: STATUS.COMPLETED, label: 'Completed', tone: 'green', icon: CheckCircle2 },
  { value: STATUS.NOT_COMPLETED, label: 'Not Completed', tone: 'red', icon: XCircle },
];
const statusTone = (status) => (STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0]).tone;

const isClosed = (t) => t.status === STATUS.COMPLETED || t.status === STATUS.NOT_COMPLETED;

/* One status filter, driven by the stat cards. "open" is the default and is
   what the old Active tab showed: anything not yet closed either way. */
const STATUS_FILTERS = {
  open: (t) => !isClosed(t),
  new: (t) => t.status === STATUS.NEW,
  progress: (t) => t.status === STATUS.IN_PROGRESS,
  completed: (t) => t.status === STATUS.COMPLETED,
  not_completed: (t) => t.status === STATUS.NOT_COMPLETED,
  all: () => true,
};

// module level, because useUrlState needs a stable reference
const VIEW_DEFAULTS = { scope: 'all', status: 'open' };

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const deadlineBadge = (iso, status) => {
  if (!iso || isClosed({ status })) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { text: 'Overdue', tone: 'red' };
  if (diffDays === 0) return { text: 'Due today', tone: 'amber' };
  if (diffDays === 1) return { text: 'Due tomorrow', tone: 'amber' };
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

const isCreatedByCurrentUser = (task, user) => {
  if (!task || !user) return false;
  const userId = toId(user._id || user.id);
  const creatorId = toId(task.createdById);
  if (userId && creatorId) return userId === creatorId;
  const by = task.createdBy || task.assignedBy;
  return !!by && normalizeName(by) === normalizeName(user.name);
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

const SCOPES = {
  all: () => true,
  mine: isAssignedToCurrentUser,
  byme: isCreatedByCurrentUser,
};

const LINK = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: T.accent, fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', textDecoration: 'underline',
};

const ClientChat = () => {
  const { authFetch, user: currentUser, isGuest } = useAuth();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useUrlState(VIEW_DEFAULTS);
  const [query, setQuery] = useState('');
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

  const scope = SCOPES[view.scope] ? view.scope : 'all';
  const status = STATUS_FILTERS[view.status] ? view.status : 'open';

  // the scope narrows everything below it, so the stat cards count "my" tasks when "mine" is on
  const scoped = useMemo(
    () => messages.filter((t) => SCOPES[scope](t, currentUser)),
    [messages, scope, currentUser],
  );

  const counts = useMemo(() => {
    const out = {};
    for (const [key, test] of Object.entries(STATUS_FILTERS)) out[key] = scoped.filter(test).length;
    out.overdue = scoped.filter((t) => deadlineBadge(t.deadline, t.status)?.text === 'Overdue').length;
    return out;
  }, [scoped]);

  const scopeCounts = useMemo(() => {
    const open = messages.filter(STATUS_FILTERS.open);
    return {
      all: open.length,
      mine: open.filter((t) => isAssignedToCurrentUser(t, currentUser)).length,
      byme: open.filter((t) => isCreatedByCurrentUser(t, currentUser)).length,
    };
  }, [messages, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scoped.filter(STATUS_FILTERS[status]).filter((t) => !q || [
      t.clientName, t.message, t.assignedTo, t.createdBy, t.assignedBy,
    ].some((v) => (v || '').toLowerCase().includes(q)));
    list.sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
    return list;
  }, [scoped, status, query]);

  const pickStatus = (key) => setView({ status: status === key && key !== 'open' ? 'open' : key });
  const filtersOn = scope !== 'all' || status !== 'open' || !!query;
  const resetAll = () => { setView({ scope: 'all', status: 'open' }); setQuery(''); };

  const statCards = [
    { key: 'open', label: 'Open tasks', icon: ListTodo, tone: 'indigo', caption: counts.overdue ? `${counts.overdue} past deadline` : 'Nothing overdue' },
    { key: 'new', label: 'New', icon: AlertCircle, tone: 'blue', caption: 'Not picked up yet' },
    { key: 'progress', label: 'In progress', icon: Loader2, tone: 'amber', caption: 'Being worked on' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'green', caption: 'Done and closed' },
    { key: 'not_completed', label: 'Not completed', icon: XCircle, tone: 'red', caption: 'Closed unfinished' },
  ];

  // the counts live on the stat cards above, so the chips do not repeat them
  const statusOptions = [
    { value: 'open', label: 'Open', icon: ListTodo },
    { value: 'new', label: 'New', icon: AlertCircle },
    { value: 'progress', label: 'In Progress', icon: Loader2 },
    { value: 'completed', label: 'Completed', icon: CheckCircle2 },
    { value: 'not_completed', label: 'Not Completed', icon: XCircle },
    { value: 'all', label: 'All', icon: Filter },
  ];

  const scopeOptions = [
    { value: 'all', label: 'All tasks', icon: Users, count: scopeCounts.all },
    { value: 'mine', label: 'My work', icon: UserCheck, count: scopeCounts.mine },
    { value: 'byme', label: 'Assigned by me', icon: Send, count: scopeCounts.byme },
  ];

  const emptyTitle = messages.length === 0
    ? 'No tasks yet'
    : scope === 'mine' && !query && status === 'open'
      ? 'Nothing open is assigned to you'
      : 'Nothing matches these filters';

  return (
    // capped, like the other list pages: a table stretched across 1900px puts
    // the status an arm's length from the task it belongs to
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Client Task' }]}
        title="Client Task"
        subtitle="Tasks from clients and for SPOCs: who owns each one, when it is due, and where it stands."
        actions={(
          <>
            <Button variant="ghost" icon={Users} onClick={() => openNew('spoc')}>Task for SPOC</Button>
            <Button icon={Plus} onClick={() => openNew('client')}>New client task</Button>
          </>
        )}
      />

      {/* The cards ARE the status filter: click one to narrow the table to it,
          click it again to go back to everything still open. */}
      <StatGrid columns={5}>
        {statCards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={loading ? '–' : counts[c.key]}
            caption={c.caption}
            icon={c.icon}
            tone={c.tone}
            active={status === c.key}
            onClick={() => pickStatus(c.key)}
          />
        ))}
      </StatGrid>

      <Panel style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Segmented options={scopeOptions} value={scope} onChange={(v) => setView({ scope: v })} tone="purple" />
          <SearchInput
            icon={Search}
            placeholder="Search client, task or person"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: '1 1 240px', maxWidth: '380px', marginLeft: 'auto' }}
          />
          {filtersOn && (
            <Button variant="ghost" icon={X} onClick={resetAll} title="Back to all open tasks" style={{ padding: '9px 14px', fontSize: '13px' }}>
              Reset
            </Button>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: SP.snug, flexWrap: 'wrap',
          marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${T.border}`,
        }}>
          <span style={{ ...LABEL, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} />
            Status
          </span>
          <Segmented options={statusOptions} value={status} onChange={(v) => setView({ status: v })} tone="indigo" />
        </div>
      </Panel>

      <Card bodyStyle={{ padding: 0 }}>
        {!loading && filtered.length === 0 ? (
          <EmptyState icon={messages.length === 0 ? MessageSquare : Search} title={emptyTitle}>
            {messages.length === 0
              ? <button type="button" onClick={() => openNew('client')} style={LINK}>Add the first task</button>
              : <button type="button" onClick={resetAll} style={LINK}>Show all open tasks</button>}
          </EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH width="48px" align="center">#</TH>
                  <TH>Task</TH>
                  <TH width="230px">People</TH>
                  <TH width="170px">Timeline</TH>
                  <TH width="130px">Remarks</TH>
                  <TH width="170px">Status</TH>
                  <TH width="96px" align="right" />
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton columns={['18px', '75%', '70%', '60%', '50%', '60%', '40px']} rows={8} />
              ) : (
                <tbody>
                  {filtered.map((task, idx) => (
                    <TaskRow
                      key={task._id}
                      index={idx + 1}
                      task={task}
                      currentUser={currentUser}
                      onOpen={openEdit}
                      onDelete={deleteMessage}
                      onStatusChange={setStatus}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </Card>

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

/* The menu is position:fixed, measured off the button, so it is never clipped
   by the table's horizontal scroller (which also clips vertically). */
const StatusMenu = ({ value, onChange }) => {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const current = STATUS_OPTIONS.find((o) => o.value === value) || STATUS_OPTIONS[0];
  const c = toneOf(current.tone);

  useEffect(() => {
    if (!pos) return undefined;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setPos(null);
    };
    const close = () => setPos(null);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const menuH = 176;
    const up = r.bottom + menuH + 8 > window.innerHeight;
    setPos({ left: r.left, top: up ? r.top - menuH - 6 : r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Change status"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '6px 9px 6px 11px', borderRadius: '8px', cursor: 'pointer',
          background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
          fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.fg }} />
        {current.label}
        <ChevronDown size={13} style={{ transform: pos ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 60, minWidth: '180px',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: '11px',
            boxShadow: '0 16px 36px -12px rgba(27, 94, 32, 0.30)', padding: '5px',
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === value;
            const oc = toneOf(opt.tone);
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                className="mrm-nav"
                onClick={() => { setPos(null); if (!active) onChange(opt.value); }}
                style={{
                  justifyContent: 'space-between', fontSize: '13px', padding: '8px 10px',
                  ...(active ? { background: oc.bg, color: oc.fg, fontWeight: 600 } : null),
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                  <Icon size={14} style={{ color: oc.fg }} />
                  {opt.label}
                </span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

const stop = (e) => e.stopPropagation();

const TaskRow = ({ index, task, currentUser, onOpen, onDelete, onStatusChange }) => {
  const [showRemarks, setShowRemarks] = useState(false);
  const dl = deadlineBadge(task.deadline, task.status);
  const remarks = Array.isArray(task.responses) ? task.responses : [];
  const role = getRole(task, currentUser);
  const canEdit = role === 'creator';
  const canChangeStatus = role !== 'viewer';
  const isMine = isAssignedToCurrentUser(task, currentUser);
  const isSpoc = task.taskType === 'spoc';
  const name = task.clientName || 'Unnamed';
  const by = task.createdBy || task.assignedBy;
  const closed = isClosed(task);

  /* Tasks assigned to you carry a green edge, so "mine" reads down the table
     even with the scope filter off. Hover is a faint wash, as on the other lists. */
  const edge = isMine ? TONES.green.bd : 'transparent';

  return (
    <>
      <tr
        onClick={() => onOpen(task)}
        title={canEdit ? 'Open to edit' : 'Open to view'}
        style={{
          cursor: 'pointer', boxShadow: `inset 3px 0 0 ${edge}`,
          transition: 'background 0.14s ease, box-shadow 0.14s ease',
          opacity: closed ? 0.82 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = TONES.grey.bg;
          if (!isMine) e.currentTarget.style.boxShadow = `inset 3px 0 0 ${T.borderHi}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${edge}`;
        }}
      >
        <td style={{ ...TD, textAlign: 'center', color: T.faint, fontSize: '12.5px', fontWeight: 600 }}>{index}</td>

        <td style={TD}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
            <Avatar name={name} size={36} tone="auto" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: T.heading }}>{name}</span>
                <Pill tone={isSpoc ? 'teal' : 'blue'}>{isSpoc ? 'SPOC' : 'Client'}</Pill>
                {isSpoc && task.priority && ['High', 'Urgent'].includes(task.priority) && (
                  <Pill tone={task.priority === 'Urgent' ? 'red' : 'amber'} icon={Flag}>{task.priority}</Pill>
                )}
              </div>
              <div
                title={task.message || ''}
                style={{
                  marginTop: '4px', fontSize: '13px', color: T.body, lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', wordBreak: 'break-word', maxWidth: '560px',
                }}
              >
                {task.message || <span style={{ color: T.faint }}>No description</span>}
              </div>
            </div>
          </div>
        </td>

        <td style={TD}>
          <div style={{ display: 'grid', gap: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ ...LABEL, fontSize: '10px', width: '20px', flexShrink: 0 }}>By</span>
              <PersonChip name={by} size={22} empty="Unknown" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ ...LABEL, fontSize: '10px', width: '20px', flexShrink: 0 }}>To</span>
              <PersonChip name={task.assignedTo} size={22} empty="Unassigned" />
              {isMine && <Pill tone="green">You</Pill>}
            </div>
          </div>
        </td>

        <td style={TD}>
          {task.deadline ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: T.body, whiteSpace: 'nowrap' }}>
              <CalendarClock size={13} style={{ color: T.faint }} />
              {fmt(task.deadline)}
            </div>
          ) : (
            <span style={{ fontSize: '13.5px', color: T.faint }}>No deadline</span>
          )}
          <div style={{ marginTop: '6px' }}>
            {dl
              ? <Pill tone={dl.tone} icon={Clock}>{dl.text}</Pill>
              : <span style={{ fontSize: '11.5px', color: T.faint, whiteSpace: 'nowrap' }}>Assigned {fmt(task.receivedAt)}</span>}
          </div>
        </td>

        <td style={TD} onClick={stop}>
          {remarks.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowRemarks((v) => !v)}
              aria-expanded={showRemarks}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                background: showRemarks ? TONES.indigo.bg : T.surface,
                border: `1px solid ${showRemarks ? TONES.indigo.bd : T.border}`,
                color: TONES.indigo.fg, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              <MessageCircle size={13} />
              {remarks.length} {remarks.length === 1 ? 'remark' : 'remarks'}
              <ChevronDown size={13} style={{ transform: showRemarks ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          ) : (
            <span style={{ color: T.faint, fontSize: '12.5px' }}>None yet</span>
          )}
        </td>

        <td style={TD} onClick={stop}>
          {canChangeStatus ? (
            <StatusMenu value={task.status} onChange={(s) => onStatusChange(task._id, s)} />
          ) : (
            <span title="Only the creator or the assignee can change this">
              <Pill tone={statusTone(task.status)} icon={Lock}>{task.status}</Pill>
            </span>
          )}
        </td>

        <td style={{ ...TD, textAlign: 'right' }} onClick={stop}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IconButton
              icon={canEdit ? Edit3 : Eye}
              title={canEdit ? 'Edit task' : role === 'assignee' ? 'View and add remarks' : 'View only'}
              tone={canEdit ? 'indigo' : 'blue'}
              onClick={() => onOpen(task)}
            />
            {canEdit && <IconButton icon={Trash2} title="Delete task" tone="red" onClick={() => onDelete(task._id)} />}
          </div>
        </td>
      </tr>

      {showRemarks && remarks.length > 0 && (
        <tr style={{ background: T.page }}>
          <td colSpan={7} style={{ padding: 0, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ padding: '14px 20px 18px 108px', display: 'grid', gap: SP.tight }}>
              {remarks.map((r, i) => (
                <div key={r._id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Avatar name={r.createdBy || '?'} size={26} tone="auto" />
                  <div style={{
                    flex: 1, minWidth: 0, maxWidth: '820px', padding: '9px 12px',
                    background: T.surface, border: `1px solid ${T.border}`, borderRadius: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: T.heading }}>{r.createdBy || 'Someone'}</span>
                      <span style={{ fontSize: '11.5px', color: T.faint }}>
                        {r.createdAt && new Date(r.createdAt).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: T.body, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/* Both task modals close on Escape as well as on the backdrop. */
const useEscape = (onClose) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
};

const fmtLong = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

/* Two equal columns that are allowed to shrink. A plain `1fr 1fr` cannot go
   below its content's natural width, which is what pushed the End Date picker
   out past the right edge of the dialog. */
const TWO_COL = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: SP.base };

const ErrorText = ({ children }) => (children
  ? <div style={{ color: TONES.red.fg, fontSize: '12px', marginTop: '6px' }}>{children}</div>
  : null);

const FieldLabel = ({ children, required }) => (
  <label style={{ ...LABEL, display: 'block', marginBottom: '6px' }}>
    {children}{required && <span style={{ color: TONES.red.fg }}> *</span>}
  </label>
);

/* Read-only values are text, not boxes: a border means you can type in it. */
const ReadField = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <FieldLabel>{label}</FieldLabel>
    <div style={{ fontSize: '14px', color: T.body, fontWeight: 500, padding: '2px 0', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
      {value}
    </div>
  </div>
);

const TEXTAREA = {
  width: '100%', boxSizing: 'border-box', padding: '10px 13px', minHeight: '96px',
  background: T.bg, border: `1px solid ${T.border}`, borderRadius: '9px',
  color: T.heading, fontSize: '14px', lineHeight: 1.5, outline: 'none',
  fontFamily: 'inherit', resize: 'vertical',
};

/* A short fixed option set picked in one click, each in its own tone — so
   "Not Completed" never looks the same as "New". */
const TonePicker = ({ options, value, onChange, disabled, columns }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))`, gap: SP.tight }}>
    {options.map((opt) => {
      const on = opt.value === value;
      const c = toneOf(opt.tone);
      const Icon = opt.icon;
      return (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={on}
          onClick={() => { if (!on) onChange(opt.value); }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '9px 8px', borderRadius: '9px', whiteSpace: 'nowrap',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            background: on ? c.bg : T.surface,
            border: `1px solid ${on ? c.fg : T.border}`,
            boxShadow: on ? `0 0 0 1px ${c.fg}` : 'none',
            color: on ? c.fg : T.muted,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled && !on ? 0.55 : 1,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {Icon && <Icon size={14} />}
          {opt.label || opt.value}
        </button>
      );
    })}
  </div>
);

const RoleBanner = ({ role }) => {
  const c = toneOf(role === 'assignee' ? 'green' : 'blue');
  const text = role === 'assignee'
    ? 'You are the assignee: you can update the status and add remarks.'
    : 'View only: only the person who created this task can edit it.';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '9px',
      background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: '13px', fontWeight: 500,
    }}>
      <Lock size={13} style={{ flexShrink: 0 }} />
      {text}
    </div>
  );
};

/* The dialog shell both task modals share. */
const ModalFrame = ({ icon: Icon, tone: t, title, subtitle, onClose, onSubmit, footer, children }) => {
  const c = toneOf(t);
  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(27, 94, 32, 0.28)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 9999, overflowY: 'auto', padding: '40px 20px',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: '640px', maxWidth: '100%', margin: 'auto', background: T.surface,
          borderRadius: '16px', border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(27, 94, 32, 0.18)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: SP.snug,
          padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{
            width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
          }}>
            {Icon && <Icon size={19} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: T.heading }}>{title}</h2>
            <p style={{ fontSize: '13px', color: T.muted, marginTop: '3px' }}>{subtitle}</p>
          </div>
          <IconButton icon={X} title="Close (Esc)" onClick={onClose} />
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: SP.block }}>
          {children}
        </div>

        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center',
          padding: '14px 24px', borderTop: `1px solid ${T.border}`, background: T.page,
          borderRadius: '0 0 16px 16px',
        }}>
          {footer}
        </div>
      </form>
    </div>
  );
};

/* The remarks thread at the foot of both modals. It writes the instant you
   press Add — separate from the form's Save, as before. */
const RemarksPanel = ({ taskId, responses, role, currentUser, canAdd, onAdd, onRemove, title, placeholder, readOnlyText }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const value = text.trim();
    if (!value || !taskId) return;
    setSaving(true);
    const updated = await onAdd(taskId, value);
    setSaving(false);
    if (updated) setText('');
  };

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: '12px', background: T.page, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
        borderBottom: `1px solid ${T.border}`, background: T.surface,
      }}>
        <MessageCircle size={15} style={{ color: TONES.indigo.fg }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: T.heading }}>{title}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '11.5px', fontWeight: 700, padding: '1px 8px', borderRadius: '999px',
          background: T.raised, color: T.body,
        }}>
          {responses.length}
        </span>
      </div>

      <div style={{ padding: '14px 16px', display: 'grid', gap: SP.snug }}>
        {responses.length === 0 ? (
          <p style={{ fontSize: '13px', color: T.faint }}>No remarks yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
            {responses.map((r) => {
              const canDelete = role === 'creator' || (currentUser && r.createdById && r.createdById === currentUser._id);
              return (
                <div key={r._id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Avatar name={r.createdBy || '?'} size={28} tone="auto" />
                  <div style={{
                    flex: 1, minWidth: 0, padding: '9px 12px',
                    background: T.surface, border: `1px solid ${T.border}`, borderRadius: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: T.heading }}>{r.createdBy || 'Someone'}</span>
                      <span style={{ fontSize: '11.5px', color: T.faint }}>
                        {r.createdAt && new Date(r.createdAt).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          className="mrm-icon-btn"
                          onClick={() => onRemove(taskId, r._id)}
                          title="Delete remark"
                          aria-label="Delete remark"
                          style={{ marginLeft: 'auto', padding: '3px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: T.body, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canAdd ? (
          <div>
            <div style={{ display: 'flex', gap: SP.tight, alignItems: 'flex-end' }}>
              <textarea
                className="sc-control"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                rows={2}
                style={{ ...TEXTAREA, minHeight: '64px', background: T.surface, flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button icon={Send} disabled={!text.trim() || saving} onClick={add} style={{ padding: '10px 16px' }}>
                {saving ? 'Adding…' : 'Add'}
              </Button>
            </div>
            <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '6px' }}>Ctrl + Enter to add. Remarks save straight away.</div>
          </div>
        ) : (
          <p style={{ fontSize: '12.5px', color: T.faint, fontStyle: 'italic' }}>{readOnlyText}</p>
        )}
      </div>
    </div>
  );
};

const STATUS_PICKS = STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, tone: o.tone, icon: o.icon }));

const StatusField = ({ status, onChange, disabled, saving, error }) => (
  <div>
    <FieldLabel required>Status</FieldLabel>
    <TonePicker options={STATUS_PICKS} value={status} onChange={onChange} disabled={disabled} />
    {saving && <div style={{ color: TONES.blue.fg, fontSize: '12px', marginTop: '6px' }}>Saving status…</div>}
    <ErrorText>{error}</ErrorText>
  </div>
);

const ModalFooter = ({ canEditAll, onClose, submitLabel }) => (canEditAll ? (
  <>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button type="submit" icon={Check}>{submitLabel}</Button>
  </>
) : (
  <Button variant="ghost" onClick={onClose}>Close</Button>
));

const TaskModal = ({ initial, members, teamMembers, role = 'creator', currentUser, onClose, onSave, onAddResponse, onRemoveResponse, onStatusChange }) => {
  useEscape(onClose);
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

  const clearError = (key) => { if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined })); };

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

  const handleStatusChange = async (nextStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    clearError('status');
    if (!canEditAll && role === 'assignee' && initial?._id && onStatusChange) {
      setSavingStatus(true);
      const updated = await onStatusChange(initial._id, nextStatus);
      setSavingStatus(false);
      if (updated?.status) setStatus(updated.status);
      else setStatus(previousStatus);
    }
  };

  return (
    <ModalFrame
      icon={isNew ? Plus : canEditAll ? Edit3 : Eye}
      tone="purple"
      title={isNew ? 'New client task' : canEditAll ? 'Edit task' : 'Task details'}
      subtitle={isNew ? 'Log a task that came in from a client.' : canEditAll ? 'Update the task details below.' : `Created by ${initial.createdBy || initial.assignedBy || 'someone else'}.`}
      onClose={onClose}
      onSubmit={submit}
      footer={<ModalFooter canEditAll={canEditAll} onClose={onClose} submitLabel={isNew ? 'Add task' : 'Save changes'} />}
    >
      {!isNew && !canEditAll && <RoleBanner role={role} />}

      <div style={TWO_COL}>
        <div style={{ minWidth: 0 }}>
          {canEditAll ? (
            <SearchableSelect
              label="Client Name"
              required
              options={memberOptions}
              value={clientName}
              onChange={(v) => { setClientName(v); clearError('clientName'); }}
              placeholder="Select a client..."
              emptyMessage="No matching clients"
            />
          ) : (
            <ReadField label="Client" value={clientName || '—'} />
          )}
          <ErrorText>{errors.clientName}</ErrorText>
        </div>
        <div style={{ minWidth: 0 }}>
          {canEditAll ? (
            <SearchableSelect
              label="Assign Task To"
              required
              options={teamOptions}
              value={assignedTo}
              onChange={(v) => { setAssignedTo(v); clearError('assignedTo'); }}
              placeholder="Select team member..."
              emptyMessage="No team members"
            />
          ) : (
            <ReadField label="Assigned to" value={assignedTo || '—'} />
          )}
          <ErrorText>{errors.assignedTo}</ErrorText>
        </div>
      </div>

      {canEditAll ? (
        <div>
          <FieldLabel required>Task from client</FieldLabel>
          <textarea
            className="sc-control"
            value={message}
            onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
            rows={4}
            placeholder="Describe the task received from the client..."
            style={{ ...TEXTAREA, borderColor: errors.message ? TONES.red.bd : T.border }}
          />
          <ErrorText>{errors.message}</ErrorText>
        </div>
      ) : (
        <ReadField label="Task from client" value={message || '—'} />
      )}

      <div style={TWO_COL}>
        {canEditAll ? (
          <DateTimePicker
            label="Start Date"
            required
            value={receivedAt}
            onChange={(v) => { setReceivedAt(v); clearError('receivedAt'); }}
            error={errors.receivedAt}
          />
        ) : (
          <ReadField label="Start date" value={fmtLong(receivedAt)} />
        )}
        {canEditAll ? (
          <DateTimePicker
            label="End Date"
            required
            value={deadline}
            onChange={(v) => { setDeadline(v); clearError('deadline'); }}
            minDate={receivedAt}
            error={errors.deadline}
          />
        ) : (
          <ReadField label="End date" value={fmtLong(deadline)} />
        )}
      </div>

      <StatusField status={status} onChange={handleStatusChange} disabled={readOnly || savingStatus} saving={savingStatus} error={errors.status} />

      {initial?._id && (
        <RemarksPanel
          taskId={initial._id}
          responses={responses}
          role={role}
          currentUser={currentUser}
          canAdd={canAddRemark}
          onAdd={onAddResponse}
          onRemove={onRemoveResponse}
          title="Remarks by SPOC"
          placeholder="Add a remark about this task..."
          readOnlyText="Read-only: only the assignee or the task creator can add remarks."
        />
      )}
    </ModalFrame>
  );
};

const PRIORITY_OPTIONS = [
  { value: 'Low', tone: 'green' },
  { value: 'Medium', tone: 'blue' },
  { value: 'High', tone: 'amber' },
  { value: 'Urgent', tone: 'red' },
];

const SpocTaskModal = ({ initial, teamMembers, role = 'creator', currentUser, onClose, onSave, onAddResponse, onRemoveResponse, onStatusChange }) => {
  useEscape(onClose);
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

  const clearError = (key) => { if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined })); };

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

  const handleStatusChange = async (nextStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    clearError('status');
    if (!canEditAll && role === 'assignee' && initial?._id && onStatusChange) {
      setSavingStatus(true);
      const updated = await onStatusChange(initial._id, nextStatus);
      setSavingStatus(false);
      if (updated?.status) setStatus(updated.status);
      else setStatus(previousStatus);
    }
  };

  return (
    <ModalFrame
      icon={Users}
      tone="teal"
      title={isNew ? 'New task for a SPOC' : canEditAll ? 'Edit SPOC task' : 'SPOC task details'}
      subtitle={isNew ? 'Assign an internal task to a team SPOC.' : canEditAll ? 'Update this internal task.' : `Created by ${initial.createdBy || initial.assignedBy || 'someone else'}.`}
      onClose={onClose}
      onSubmit={submit}
      footer={<ModalFooter canEditAll={canEditAll} onClose={onClose} submitLabel={isNew ? 'Create SPOC task' : 'Save changes'} />}
    >
      {!isNew && !canEditAll && <RoleBanner role={role} />}

      <div style={TWO_COL}>
        <div style={{ minWidth: 0 }}>
          {canEditAll ? (
            <SearchableSelect
              label="SPOC Name"
              required
              options={teamOptions}
              value={spocName}
              onChange={(v) => { setSpocName(v); clearError('spocName'); }}
              placeholder="Select a SPOC..."
              emptyMessage="No team members"
            />
          ) : (
            <ReadField label="SPOC" value={spocName || '—'} />
          )}
          <ErrorText>{errors.spocName}</ErrorText>
        </div>
        {canEditAll ? (
          <div style={{ minWidth: 0 }}>
            <FieldLabel>Task title</FieldLabel>
            <input
              className="sc-control"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Short title (optional)"
              style={{ ...TEXTAREA, minHeight: 0, resize: 'none', padding: '11px 13px' }}
            />
          </div>
        ) : (
          <ReadField label="Task title" value={taskTitle || '—'} />
        )}
      </div>

      {canEditAll ? (
        <div>
          <FieldLabel required>Task description</FieldLabel>
          <textarea
            className="sc-control"
            value={message}
            onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
            rows={4}
            placeholder="Describe what the SPOC needs to do..."
            style={{ ...TEXTAREA, borderColor: errors.message ? TONES.red.bd : T.border }}
          />
          <ErrorText>{errors.message}</ErrorText>
        </div>
      ) : (
        <ReadField label="Task description" value={message || '—'} />
      )}

      <div style={TWO_COL}>
        {canEditAll ? (
          <DateTimePicker
            label="Start Date"
            required
            value={receivedAt}
            onChange={(v) => { setReceivedAt(v); clearError('receivedAt'); }}
            error={errors.receivedAt}
          />
        ) : (
          <ReadField label="Start date" value={fmtLong(receivedAt)} />
        )}
        {canEditAll ? (
          <DateTimePicker
            label="Deadline"
            required
            value={deadline}
            onChange={(v) => { setDeadline(v); clearError('deadline'); }}
            minDate={receivedAt}
            error={errors.deadline}
          />
        ) : (
          <ReadField label="Deadline" value={fmtLong(deadline)} />
        )}
      </div>

      <div>
        <FieldLabel required>Priority</FieldLabel>
        <TonePicker
          options={PRIORITY_OPTIONS.map((p) => ({ ...p, icon: p.value === 'Urgent' || p.value === 'High' ? Flag : undefined }))}
          value={priority}
          onChange={setPriority}
          disabled={!canEditAll}
        />
        <ErrorText>{errors.priority}</ErrorText>
      </div>

      <StatusField status={status} onChange={handleStatusChange} disabled={readOnly || savingStatus} saving={savingStatus} error={errors.status} />

      {initial?._id && (
        <RemarksPanel
          taskId={initial._id}
          responses={responses}
          role={role}
          currentUser={currentUser}
          canAdd={canAddRemark}
          onAdd={onAddResponse}
          onRemove={onRemoveResponse}
          title="Remarks and updates"
          placeholder="Add an update or remark..."
          readOnlyText="Read-only: only the assigned SPOC or the task creator can add remarks."
        />
      )}
    </ModalFrame>
  );
};

export default ClientChat;
