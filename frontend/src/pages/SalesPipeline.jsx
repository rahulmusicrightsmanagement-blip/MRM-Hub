import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, ArrowRight, Search, CheckSquare, Square, ChevronRight,
  CheckCircle, Circle, Trash2, Edit3, Save, Eye, XCircle, UserPlus, Download,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import * as XLSX from 'xlsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlState } from '../hooks/useUrlState';
import SearchableSelect from '../components/SearchableSelect';
import { useNotificationDeeplink } from '../hooks/useNotificationDeeplink';
import Pagination from '../components/Pagination';
import { T, TONES, TD } from '../theme';
import {
  PageHeader, Button, IconButton, Segmented, Card, Pill, DistributionBar,
  SearchInput, TH, EmptyState, Checkbox, SelectionBar, TableSkeleton, Banner, Panel,
} from '../components/studio';

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

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  // meetingDate is free text and imported records carry junk — never render "Invalid Date"
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/* ──────── deadline, in plain English ──────── */
const daysToDeadline = (lead) => {
  if (!lead.deadline) return Infinity;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(lead.deadline);
  if (Number.isNaN(dl.getTime())) return Infinity;
  dl.setHours(0, 0, 0, 0);
  return Math.round((dl - now) / 86400000);
};

/* How long until the deadline, said the way a person would say it. */
const describeTiming = (lead) => {
  const days = daysToDeadline(lead);
  if (days === Infinity) return { text: '', late: false, soon: false };
  if (days < 0) return { text: days === -1 ? 'was due yesterday' : `was due ${-days} days ago`, late: true, soon: false };
  if (days === 0) return { text: 'due today', late: true, soon: false };
  if (days === 1) return { text: 'due tomorrow', late: false, soon: true };
  if (days <= 7) return { text: `due in ${days} days`, late: false, soon: true };
  return { text: `due ${fmtDate(lead.deadline)}`, late: false, soon: false };
};

/* A lead still on our plate — not closed, not handed over. */
const isOpenLead = (l) => l.stage !== 'Not Qualified' && !l.movedToOnboarding;

/* One spreadsheet row per lead. Column order here is the column order in Excel. */
const toExportRow = (lead) => ({
  'Name': lead.name || '',
  'Email': lead.email || '',
  'Phone': lead.phone || '',
  'Stage': lead.stage || '',
  'Status': getStatus(lead).label,
  'Owner': lead.spoc || '',
  'Source': lead.source || '',
  'Genre': lead.genre || '',
  'Priority': lead.priority || '',
  'Deadline': lead.deadline ? fmtDate(lead.deadline) : '',
  'Added on': fmtDate(lead.createdAt) || '',
  'Moved to onboarding': lead.movedToOnboarding ? 'Yes' : 'No',
});

/* Everything the page remembers about "what am I looking at", kept in the
   query string so a view can be pasted to a colleague. */
const VIEW_DEFAULTS = { q: '', stage: 'all', status: 'all', sort: 'createdAt', dir: 'desc', page: 1, size: 25 };

/* ═══════════════════════════════════════════
   THE STATUS COLUMN
   One short phrase saying where this lead actually is, in plain words
   rather than the internal stage jargon. `rank` is what the Status column
   sorts by, so sorting groups live work above finished work.
   ═══════════════════════════════════════════ */
const getStatus = (lead) => {
  if (lead.stage === 'Not Qualified') return { label: 'Not qualified', tone: 'grey', rank: 7 };
  if (lead.movedToOnboarding) return { label: 'Onboarded', tone: 'green', rank: 6 };
  if (lead.stage === 'New Enquiry') {
    return lead.callDone
      ? { label: 'Meeting to set', tone: 'amber', rank: 2 }
      : { label: 'Call due', tone: 'amber', rank: 1 };
  }
  if (lead.stage === 'Meeting Set') {
    return fmtDate(lead.meetingDate)
      ? { label: 'Meeting booked', tone: 'blue', rank: 4 }
      : { label: 'Date to set', tone: 'amber', rank: 3 };
  }
  if (lead.stage === 'Qualified Lead') return { label: 'Ready to onboard', tone: 'purple', rank: 5 };
  return { label: lead.stage, tone: 'grey', rank: 5 };
};

const STAGE_TONES = {
  'New Enquiry': 'blue',
  'Meeting Set': 'indigo',
  'Qualified Lead': 'green',
  'Not Qualified': 'red',
};
const stageTone = (stage) => STAGE_TONES[stage] || 'grey';

/* Sorting. Every comparator has to be NaN-free or the whole sort silently rots. */
const text = (v) => (v || '').toString().toLowerCase();
const blanksLast = (v) => (text(v) === '' ? 1 : 0);

const COMPARATORS = {
  name: (a, b) => text(a.name).localeCompare(text(b.name)),
  stage: (a, b) => text(a.stage).localeCompare(text(b.stage)),
  spoc: (a, b) => blanksLast(a.spoc) - blanksLast(b.spoc) || text(a.spoc).localeCompare(text(b.spoc)),
  deadline: (a, b) => { const d = daysToDeadline(a) - daysToDeadline(b); return Number.isNaN(d) ? 0 : d; },
  status: (a, b) => getStatus(a).rank - getStatus(b).rank,
  createdAt: (a, b) => (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0),
};

/* Stage and status were two columns saying nearly the same thing. They are now
   one: the plain-English status leads, with the formal stage beneath it. */
const COLUMNS = [
  { key: 'name', label: 'Lead', width: 'auto' },
  { key: 'status', label: 'Status', width: '190px' },
  { key: 'spoc', label: 'Owner', width: '150px' },
  { key: 'deadline', label: 'Timeline', width: '165px' },
];

/* The status pill row. "Overdue" deliberately overlaps "Needs action" —
   these are shortcuts, not a partition. */
const isOverdue = (l) => isOpenLead(l) && describeTiming(l).late;

const STATUS_FILTERS = [
  { id: 'all', label: 'All', icon: null, test: () => true },
  { id: 'active', label: 'Needs action', test: isOpenLead },
  { id: 'overdue', label: 'Overdue', test: isOverdue },
  { id: 'onboarded', label: 'Onboarded', test: (l) => !!l.movedToOnboarding && l.stage !== 'Not Qualified' },
  { id: 'closed', label: 'Not qualified', test: (l) => l.stage === 'Not Qualified' },
];

/* ═══════════════════════════════════════════
   ADD / EDIT LEAD MODAL
   ═══════════════════════════════════════════ */
const LeadFormModal = ({ onClose, onSubmit, teamMembers, members, initialData }) => {
  const { getOptions } = usePicklist();
  const sourceList = getOptions('lead_source');
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
              <div>
                <label style={LABEL}>Name *</label>
                <input
                  style={{ ...INPUT, backgroundColor: '#141823', cursor: 'not-allowed', opacity: 0.8 }}
                  value={form.name}
                  readOnly
                  title="Edit from the Members page"
                />
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Name is managed from the Members page.</p>
              </div>
              <div><label style={LABEL}>Genre</label><input style={INPUT} placeholder="e.g. Bollywood Playback" value={form.genre} onChange={(e) => set('genre', e.target.value)} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={LABEL}>Email *</label>
                <input
                  style={{ ...INPUT, backgroundColor: '#141823', cursor: 'not-allowed', opacity: 0.8 }}
                  placeholder="email@example.com"
                  value={form.email}
                  readOnly
                  title="Edit from the Members page"
                />
              </div>
              <div>
                <label style={LABEL}>Phone</label>
                <input
                  style={{ ...INPUT, backgroundColor: '#141823', cursor: 'not-allowed', opacity: 0.8 }}
                  placeholder="+91 98xxx xxxxx"
                  value={form.phone}
                  readOnly
                  title="Edit from the Members page"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={LABEL}>Lead Source</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.source} onChange={(e) => set('source', e.target.value)}>
                  {sourceList.map((s) => <option key={s} value={s}>{s}</option>)}
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
              <input style={{ ...INPUT, colorScheme: 'dark' }} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
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
                  {sourceList.map((s) => <option key={s} value={s}>{s}</option>)}
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
              <input style={{ ...INPUT, colorScheme: 'dark' }} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
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
   ONE ROW OF THE TABLE
   ═══════════════════════════════════════════ */
const LeadTableRow = ({ lead, onClick, selected, onToggleSelect }) => {
  const status = getStatus(lead);
  const live = isOpenLead(lead);
  // a deadline on a finished lead is history — show it plainly, never as a warning
  const timing = live ? describeTiming(lead) : { text: '', late: false, soon: false };
  const dueColor = timing.late ? TONES.red.fg : timing.soon ? TONES.amber.fg : T.body;

  return (
    <tr
      onClick={() => onClick(lead)}
      style={{ cursor: 'pointer', transition: 'background 0.12s', background: selected ? TONES.indigo.bg : 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.raised; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? TONES.indigo.bg : 'transparent'; }}
    >
      <td style={TD}>
        <Checkbox checked={!!selected} onChange={onToggleSelect} label={`Select ${lead.name}`} />
      </td>

      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
            background: lead.color || T.accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff',
          }}>
            {lead.initials || (lead.name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: T.heading }}>{lead.name}</div>
            <div style={{ fontSize: '12px', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[lead.email, lead.source].filter(Boolean).join('  ·  ')}
            </div>
          </div>
        </div>
      </td>

      <td style={TD}>
        <Pill tone={status.tone} dot>{status.label}</Pill>
        <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '4px' }}>{lead.stage}</div>
      </td>

      <td style={TD}>
        {lead.spoc
          ? <span style={{ fontSize: '13.5px' }}>{lead.spoc}</span>
          : <span style={{ color: T.faint, fontSize: '13.5px' }}>Unassigned</span>}
      </td>

      <td style={TD}>
        {lead.deadline ? (
          <>
            <div style={{ fontSize: '13.5px', color: dueColor }}>
              {timing.text && (timing.late || timing.soon) ? timing.text : `Due ${fmtDate(lead.deadline)}`}
            </div>
            <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '3px' }}>Added {fmtDate(lead.createdAt) || '—'}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '13.5px', color: T.faint }}>No deadline</div>
            <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '3px' }}>Added {fmtDate(lead.createdAt) || '—'}</div>
          </>
        )}
      </td>

      <td style={{ ...TD, textAlign: 'right' }}>
        <IconButton
          icon={Eye}
          title={`Open ${lead.name}`}
          tone="indigo"
          onClick={(e) => { e.stopPropagation(); onClick(lead); }}
        />
      </td>
    </tr>
  );
};

/* ═══════════════════════════════════════════
   MAIN SALES PIPELINE PAGE
   ═══════════════════════════════════════════ */
const SalesPipeline = () => {
  const navigate = useNavigate();
  const { authFetch, isGuest } = useAuth();
  const { addToast } = useToast();
  const { getOptions } = usePicklist();
  const { setCached, invalidate } = useDataCache();
  const STAGES = getOptions('lead_stage');
  const [showAddModal, setShowAddModal] = useState(false);
  const openLead = useCallback((lead) => navigate(`/sales-pipeline/${lead._id}`), [navigate]);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [view, setView] = useUrlState(VIEW_DEFAULTS);
  const [selected, setSelected] = useState(() => new Set());
  const searchRef = useRef(null);

  // the search box stays local so typing is instant, then lands in the URL
  useEffect(() => {
    if (debouncedQuery !== view.q) setView({ q: debouncedQuery, page: 1 });
  }, [debouncedQuery, view.q, setView]);

  // "/" jumps to the search box, the way most list tools behave
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      e.preventDefault();
      if (searchRef.current) searchRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const blockGuestAction = useCallback(() => {
    if (!isGuest) return false;
    addToast('Guest users have view-only access', 'error');
    return true;
  }, [isGuest, addToast]);

  const leadsQ = useCachedFetch('leads:list', async () => {
    const r = await authFetch('/api/leads');
    const d = await r.json();
    return d.leads || [];
  });
  const teamQ = useCachedFetch('users:team', async () => {
    const r = await authFetch('/api/users/team');
    const d = await r.json();
    return d.users || [];
  });
  const membersQ = useCachedFetch('members:list', async () => {
    const r = await authFetch('/api/members');
    const d = await r.json();
    return d.members || [];
  });

  const leads = useMemo(() => leadsQ.data || [], [leadsQ.data]);
  const teamMembers = teamQ.data || [];
  const members = membersQ.data || [];
  const loading = (leadsQ.loading && !leadsQ.data) || (teamQ.loading && !teamQ.data) || (membersQ.loading && !membersQ.data);

  const setLeads = (updater) => {
    const current = leadsQ.data || [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    setCached('leads:list', next);
  };

  useNotificationDeeplink({
    expectedType: 'lead',
    records: leads,
    isReady: !loading,
    onOpen: openLead,
    onMissing: () => addToast('This lead is no longer in the pipeline (deleted or moved to onboarding).', 'error'),
  });

  const handleAddLead = async (form) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch('/api/leads', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        setLeads((p) => [data.lead, ...p]);
        // Backend auto-creates a Member if none exists for this email/name — drop stale members cache.
        invalidate('members:list');
        addToast('Lead created');
      }
      else addToast('Failed to create lead', 'error');
    } catch (err) { console.error('Failed to add lead:', err); addToast('Failed to create lead', 'error'); }
  };

  /* ── search → stage → status → sort ── */
  const rows = useMemo(() => {
    let list = leads;

    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        (l._id && l._id.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.spoc && l.spoc.toLowerCase().includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q))
      );
    }
    if (view.stage !== 'all') list = list.filter((l) => l.stage === view.stage);
    const sf = STATUS_FILTERS.find((s) => s.id === view.status);
    if (sf && sf.id !== 'all') list = list.filter(sf.test);

    const cmp = COMPARATORS[view.sort] || COMPARATORS.createdAt;
    return [...list].sort((a, b) => (view.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
  }, [leads, debouncedQuery, view.stage, view.status, view.sort, view.dir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / view.size));
  const safePage = Math.min(Math.max(1, view.page), totalPages);
  const pageRows = rows.slice((safePage - 1) * view.size, safePage * view.size);

  const stageSegments = useMemo(() => STAGES.map((stage) => ({
    id: stage,
    label: stage,
    tone: stageTone(stage),
    value: leads.filter((l) => l.stage === stage).length,
  })), [leads, STAGES]);

  const statusOptions = STATUS_FILTERS.map((f) => ({
    value: f.id, label: f.label, count: leads.filter(f.test).length,
  }));

  const overdueCount = leads.filter(isOverdue).length;
  const filtersOn = !!searchQuery || view.stage !== 'all' || view.status !== 'all';
  const resetAll = () => {
    setSearchQuery('');
    setView({ q: '', stage: 'all', status: 'all', page: 1 });
  };
  const pickStage = (v) => setView({ stage: v, page: 1 });
  const pickStatus = (v) => setView({ status: v, page: 1 });
  const toggleSort = (key) => setView(
    view.sort === key
      ? { sort: key, dir: view.dir === 'asc' ? 'desc' : 'asc', page: 1 }
      : { sort: key, dir: ['name', 'stage', 'spoc'].includes(key) ? 'asc' : 'desc', page: 1 },
  );

  /* ── ticking rows ── */
  const pageIds = pageRows.map((l) => l._id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    return next;
  });

  /* ── export what you are looking at, or just what you ticked ── */
  const exportRows = (list, scope) => {
    try {
      if (!list.length) { addToast('Nothing to export', 'error'); return; }
      const data = list.map(toExportRow);
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet['!cols'] = [{ wch: 26 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
        { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Sales Pipeline');
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Sales_Pipeline_${scope}_${stamp}.xlsx`);
      addToast(`Exported ${data.length} lead${data.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export Excel', 'error');
    }
  };

  return (
    <div style={{ padding: '26px 30px 50px' }}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Sales Pipeline' }]}
        title="Sales Pipeline"
        subtitle="Track every enquiry from first contact through to onboarding."
        actions={
          <>
            <Button variant="ghost" icon={Download} disabled={loading} onClick={() => exportRows(rows, 'view')}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => { if (blockGuestAction()) return; setShowAddModal(true); }}>
              New Lead
            </Button>
          </>
        }
      />

      {/* A pointer, not a report: it says something needs attention and takes
          you there. The number itself stays on the Overdue chip. */}
      {!loading && leads.length > 0 && (
        overdueCount > 0
          ? (
            <Banner
              tone="amber"
              icon={AlertTriangle}
              action={<Button icon={ArrowRight} onClick={() => pickStatus('overdue')} style={{ padding: '8px 14px', fontSize: '13px' }}>Show them</Button>}
            >
              Some leads have passed their deadline.
            </Banner>
          )
          : <Banner tone="green" icon={CheckCircle2}>Nothing is overdue. Everything here is on track.</Banner>
      )}

      {/* Where everything sits, and how to narrow it — one panel, no heading:
          the page is named once, and each count appears once. */}
      <Panel>
        <DistributionBar
          segments={stageSegments}
          active={view.stage}
          onSelect={pickStage}
          emptyLabel="No leads yet"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${T.border}` }}>
          <Segmented options={statusOptions} value={view.status} onChange={pickStatus} tone="purple" />
          <SearchInput
            ref={searchRef}
            icon={Search}
            placeholder="Search name, email, phone or owner...    /"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: '1 1 260px', maxWidth: '380px', marginLeft: 'auto' }}
          />
          {filtersOn && (
            <Button variant="ghost" icon={X} onClick={resetAll} style={{ padding: '9px 14px', fontSize: '13px' }}>Reset</Button>
          )}
        </div>
      </Panel>

      {/* ── The list ── */}
      <Card bodyStyle={{ padding: 0 }}>
        {selected.size > 0 && (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button
              variant="ghost"
              icon={Download}
              style={{ padding: '7px 13px', fontSize: '13px' }}
              onClick={() => exportRows(leads.filter((l) => selected.has(l._id)), 'selected')}
            >
              Export selected
            </Button>
          </SelectionBar>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState icon={Search} title={leads.length === 0 ? 'No leads yet' : 'Nothing matches these filters'}>
            {leads.length === 0
              ? 'Use “New Lead” above to add the first one.'
              : <button type="button" onClick={resetAll} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '13.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Reset the filters</button>}
          </EmptyState>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH width="44px">
                      {!loading && pageIds.length > 0 && (
                        <Checkbox
                          checked={allPageSelected}
                          indeterminate={selectedOnPage > 0 && !allPageSelected}
                          onChange={togglePage}
                          label="Select every lead on this page"
                        />
                      )}
                    </TH>
                    {COLUMNS.map((col) => (
                      <TH
                        key={col.key}
                        sortable
                        width={col.width}
                        active={view.sort === col.key}
                        dir={view.dir}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                      </TH>
                    ))}
                    <TH width="70px" align="right">Actions</TH>
                  </tr>
                </thead>
                {loading ? (
                  <TableSkeleton columns={['17px', '55%', '70%', '60%', '80%', '65%', '32px']} rows={7} />
                ) : (
                  <tbody>
                    {pageRows.map((lead) => (
                      <LeadTableRow
                        key={lead._id}
                        lead={lead}
                        onClick={openLead}
                        selected={selected.has(lead._id)}
                        onToggleSelect={() => toggleRow(lead._id)}
                      />
                    ))}
                  </tbody>
                )}
              </table>
            </div>
            {!loading && (
              <div style={{ padding: '0 16px' }}>
                <Pagination
                  page={safePage}
                  pageSize={view.size}
                  total={rows.length}
                  onPageChange={(p) => setView({ page: p })}
                  onPageSizeChange={(n) => setView({ size: n, page: 1 })}
                  pageSizeOptions={[25, 50, 100]}
                  label="Rows per page"
                />
              </div>
            )}
          </>
        )}
      </Card>

      {showAddModal && <LeadFormModal onClose={() => setShowAddModal(false)} onSubmit={handleAddLead} teamMembers={teamMembers} members={members} />}
    </div>
  );
};

export default SalesPipeline;
