import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, Download, Edit3, Trash2, ChevronRight, Mail, Flame,
  AlertTriangle, CheckCircle2, ArrowRight, Users, IdCard, Sparkles, Handshake,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGuestGuard } from '../hooks/useGuestGuard';
import { useUrlState } from '../hooks/useUrlState';
import Pagination from '../components/Pagination';
import { T, TONES, TD } from '../theme';
import {
  PageHeader, Button, Segmented, Card, Pill, DistributionBar, SearchInput, TH,
  EmptyState, Checkbox, SelectionBar, TableSkeleton, Banner, Panel,
  Avatar, PersonChip, SubHead, FormGrid, Input, Select, Textarea, MultiSelect, Choice,
} from '../components/studio';

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toDateInput = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* Contract type is the roster's main axis, so it keeps its colour coding — but
   as tones rather than four raw hexes, and the standalone "Contract Type:"
   legend strip is gone: the filter chips below it carried the same four labels
   in the same four colours, so it was a key to a key. */
const CONTRACT_TYPES = ['Royalty', 'Retainer', 'Work-Based', 'Inhouse'];
const CONTRACT_TONES = {
  Royalty: 'green', Retainer: 'blue', 'Work-Based': 'amber', Inhouse: 'purple',
};
const NO_CONTRACT = 'No contract';

const STATUS_TONES = { Active: 'green', Onboarding: 'amber', Inactive: 'grey' };

/* Pending is amber, not red. Work not yet done is not a failure — the same rule
   that took red off the "No" button. `Rejected` is the real error state, and it
   used to render in the same grey as an unknown value because the old colour
   map only knew Verified and Pending. */
const KYC_TONES = { Verified: 'green', Pending: 'amber', Rejected: 'red' };

const roleList = (m) => (Array.isArray(m.role) ? m.role : (m.role ? [m.role] : []));

const text = (v) => (v || '').toString().toLowerCase();
const blanksLast = (v) => (text(v) === '' ? 1 : 0);

const COLUMNS = [
  { key: 'name', label: 'Member', width: 'auto' },
  { key: 'roles', label: 'Roles', width: '190px' },
  { key: 'status', label: 'Status', width: '150px' },
  { key: 'contract', label: 'Contract', width: '165px' },
  { key: 'spoc', label: 'Owner', width: '160px' },
];

const VIEW_DEFAULTS = { q: '', contract: 'all', status: 'all', sort: 'createdAt', dir: 'desc', page: 1, size: 25 };

const toExportRow = (m, contract) => ({
  'Name': m.name || '',
  'MRM ID': m.clientNumber || '',
  'Email': m.email || '',
  'Phone': m.phone || '',
  'Roles': roleList(m).join(', '),
  'Genre': m.genre || '',
  'Status': m.status || '',
  'KYC': m.kycStatus || '',
  'Contract': contract || '',
  'Owner': m.spoc || '',
  'Priority': m.priority || '',
  'Registrations': m.registrations ?? 0,
  'PAN': m.panCard || '',
  'Aadhaar': m.aadhaar || '',
  'IPI': m.ipiNumber || '',
  'ISNI': m.isni || '',
  'Lead source': m.leadSource || '',
  'Referred by': m.isReferred ? (m.referredBy || 'Yes') : '',
  'Added on': fmtDate(m.createdAt) || '',
});

const PRIORITY_CHOICES = [
  { value: 'high', label: 'High', tone: 'red', hint: 'Chase this one first' },
  { value: 'medium', label: 'Medium', tone: 'amber', hint: 'Normal pace' },
  { value: 'low', label: 'Low', tone: 'teal', hint: 'No rush' },
];

/* ═══════════════════════════════════════════
   ADD / EDIT MEMBER
   ═══════════════════════════════════════════ */
const MemberFormModal = ({ onClose, onSubmit, initialData }) => {
  const { getOptions } = usePicklist();
  const sourceList = getOptions('lead_source');
  const roleOptions = getOptions('member_roles');
  const isEdit = !!initialData;

  const [form, setForm] = useState(() => initialData || {
    name: '', role: [], email: '', phone: '', genre: '', languages: '', bio: '',
    clientNumber: '', panCard: '', aadhaar: '', dateOfFirstContact: '',
    leadSource: '', priority: 'medium', isReferred: false, referredBy: '', referralCommission: '',
  });
  const [conflicts, setConflicts] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* Escape closes, and so does the backdrop. This dialog had neither — the
     only way out was a 20px × glyph in the corner. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    // clear the red highlight on the very field being fixed
    if (conflicts.includes(field)) setConflicts((prev) => prev.filter((c) => c !== field));
  };

  const FIELD_LABELS = { name: 'Name', email: 'Email', clientNumber: 'MRM Membership ID' };
  const bad = (field) => (conflicts.includes(field)
    ? { borderColor: TONES.red.bd, boxShadow: `0 0 0 1px ${TONES.red.bd}` }
    : undefined);

  const canSubmit = !!form.name.trim() && !!form.email.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(form);
      if (result && result.ok) { setConflicts([]); setErrorMsg(''); onClose(); }
      else if (result && result.status === 409) {
        setConflicts(Array.isArray(result.conflicts) ? result.conflicts : []);
        setErrorMsg(result.message || 'Duplicate name, email or MRM ID already exists.');
      } else {
        setErrorMsg((result && result.message) || 'Failed to save member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(27, 94, 32, 0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 50, padding: '24px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit ${form.name}` : 'Add a new member'}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: '16px', width: '100%', maxWidth: '620px',
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(27, 94, 32, 0.18)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '20px 22px', borderBottom: `1px solid ${T.border}`,
        }}>
          {isEdit
            ? <Avatar name={form.name} size={38} tone="auto" />
            : (
              <span style={{
                width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: TONES.purple.bg, border: `1px solid ${TONES.purple.bd}`, color: TONES.purple.fg,
              }}>
                <Plus style={{ width: '18px', height: '18px' }} />
              </span>
            )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: T.heading }}>
              {isEdit ? form.name || 'Edit member' : 'Add a new member'}
            </h2>
            <p style={{ fontSize: '13px', color: T.muted, marginTop: '3px' }}>
              {isEdit
                ? 'Name and email are the source of truth for leads, onboarding and royalty.'
                : 'A member is an artist on the roster. Leads and onboarding entries both hang off one.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, cursor: 'pointer',
            }}
          >
            <X style={{ width: '15px', height: '15px' }} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px',
              padding: '12px 14px', borderRadius: '10px',
              background: TONES.red.bg, border: `1px solid ${TONES.red.bd}`,
            }}>
              <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0, color: TONES.red.fg, marginTop: '1px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TONES.red.fg, fontSize: '13px', fontWeight: 700 }}>That would be a duplicate</div>
                <div style={{ color: TONES.red.fg, fontSize: '12.5px', marginTop: '2px', lineHeight: 1.45 }}>{errorMsg}</div>
                {conflicts.length > 0 && (
                  <div style={{ color: TONES.red.fg, fontSize: '11.5px', marginTop: '5px' }}>
                    Already taken: {conflicts.map((c) => FIELD_LABELS[c] || c).join(', ')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setErrorMsg(''); setConflicts([]); }}
                title="Dismiss"
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', color: TONES.red.fg, cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )}

          <SubHead icon={Users}>Who they are</SubHead>
          <FormGrid min="240px">
            <Input
              label="Full name" required
              placeholder="e.g. Prateek Kuhad"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              style={bad('name')}
              hint={conflicts.includes('name') ? 'Another member already has this name.' : undefined}
            />
            <Input
              label="Email" required
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              style={bad('email')}
              hint={conflicts.includes('email') ? 'Another member already has this email.' : undefined}
            />
            <Input label="Phone" placeholder="+91 98xxx xxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input label="Genre" placeholder="e.g. Indie Folk / Pop" value={form.genre} onChange={(e) => set('genre', e.target.value)} />
            <MultiSelect
              label="Roles"
              options={roleOptions}
              selected={Array.isArray(form.role) ? form.role : []}
              onChange={(v) => set('role', v)}
              placeholder="What do they do?"
            />
            <Input label="Languages" placeholder="e.g. Hindi, English" hint="Comma separated." value={form.languages} onChange={(e) => set('languages', e.target.value)} />
          </FormGrid>
          <div style={{ marginTop: '12px' }}>
            <Textarea
              span label="Bio" placeholder="A line or two about the artist..."
              value={form.bio} onChange={(e) => set('bio', e.target.value)}
            />
          </div>

          <SubHead icon={IdCard} style={{ marginTop: '24px' }}>Identity &amp; KYC</SubHead>
          <FormGrid min="240px">
            <Input
              label="MRM membership ID"
              placeholder="e.g. MRM-176"
              value={form.clientNumber || ''}
              onChange={(e) => set('clientNumber', e.target.value)}
              style={bad('clientNumber')}
              hint={conflicts.includes('clientNumber') ? 'Another member already holds this ID.' : undefined}
            />
            <Input label="PAN number" placeholder="ABCPK1234A" value={form.panCard} onChange={(e) => set('panCard', e.target.value)} />
            <Input label="Aadhaar number" placeholder="1234 5678 9012" value={form.aadhaar} onChange={(e) => set('aadhaar', e.target.value)} />
            <Input
              label="First contacted" type="date" style={{ colorScheme: 'light' }}
              value={toDateInput(form.dateOfFirstContact) || form.dateOfFirstContact || ''}
              onChange={(e) => set('dateOfFirstContact', e.target.value)}
            />
          </FormGrid>

          <SubHead icon={Sparkles} style={{ marginTop: '24px' }}>Where they came from</SubHead>
          <FormGrid min="240px">
            <Select label="Lead source" value={form.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
              <option value="">Not set</option>
              {sourceList.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Choice label="Priority" options={PRIORITY_CHOICES} value={form.priority} onChange={(v) => set('priority', v)} />
          </FormGrid>

          <SubHead icon={Handshake} style={{ marginTop: '24px' }}>Referral</SubHead>
          <Choice
            label="Did somebody refer them?"
            options={[
              { value: 'yes', label: 'Yes', tone: 'green' },
              { value: 'no', label: 'No', tone: 'grey' },
            ]}
            value={form.isReferred ? 'yes' : 'no'}
            onChange={(v) => set('isReferred', v === 'yes')}
            compact
          />
          {form.isReferred && (
            <FormGrid min="240px" style={{ marginTop: '12px' }}>
              <Input label="Referred by" placeholder="e.g. John Doe" value={form.referredBy} onChange={(e) => set('referredBy', e.target.value)} />
              <Input label="Referral commission" placeholder="e.g. 10% or ₹5000" value={form.referralCommission} onChange={(e) => set('referralCommission', e.target.value)} />
            </FormGrid>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          padding: '16px 22px', borderTop: `1px solid ${T.border}`, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', color: T.faint }}>
            {canSubmit ? 'Press Esc to cancel.' : 'A name and an email are required.'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button
              icon={isEdit ? Edit3 : Plus}
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              title={canSubmit ? undefined : 'Fill in a name and an email first'}
            >
              {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add member'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ONE ROW OF THE TABLE
   ═══════════════════════════════════════════ */
const MemberRow = ({ member, contract, onOpen, onEdit, onDelete, selected, onToggleSelect, confirming, onCancelDelete }) => {
  const name = member.name || 'Unnamed member';
  const roles = roleList(member);
  const urgent = member.priority === 'high' && member.status !== 'Inactive';

  const rest = selected ? TONES.indigo.bg : 'transparent';
  const edge = selected ? T.accent : 'transparent';

  return (
    <>
      <tr
        onClick={() => onOpen(member)}
        title={`Open ${name}`}
        style={{
          cursor: 'pointer', background: rest,
          boxShadow: `inset 3px 0 0 ${edge}`,
          transition: 'background 0.14s ease, box-shadow 0.14s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = TONES.grey.bg;
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${T.borderHi}`;
          e.currentTarget.querySelectorAll('[data-hover]').forEach((el) => { el.style.opacity = '1'; });
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = rest;
          e.currentTarget.style.boxShadow = `inset 3px 0 0 ${edge}`;
          e.currentTarget.querySelectorAll('[data-hover]').forEach((el) => { el.style.opacity = '0'; });
        }}
      >
        <td style={TD} onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!selected} onChange={onToggleSelect} label={`Select ${name}`} />
        </td>

        <td style={TD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <Avatar name={name} size={36} tone="auto" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{
                  fontSize: '14px', fontWeight: 600, color: T.heading,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {name}
                </span>
                {urgent && (
                  <span title="High priority" style={{ display: 'inline-flex', flexShrink: 0, color: TONES.red.fg }}>
                    <Flame style={{ width: '13px', height: '13px' }} />
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px',
                fontSize: '12px', color: T.muted, minWidth: 0,
              }}>
                {member.email && <Mail style={{ width: '11px', height: '11px', flexShrink: 0, color: T.faint }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.email || 'No email'}
                </span>
                {member.clientNumber && (
                  <>
                    <span style={{ color: T.faint, flexShrink: 0 }}>·</span>
                    <span style={{ flexShrink: 0, color: T.faint }}>MRM {member.clientNumber}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>

        <td style={TD}>
          {roles.length === 0
            ? <span style={{ fontSize: '13px', color: T.faint }}>No role set</span>
            : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {roles.slice(0, 2).map((r) => <Pill key={r} tone="indigo">{r}</Pill>)}
                {roles.length > 2 && (
                  <span title={roles.join(', ')} style={{ fontSize: '11.5px', color: T.faint, alignSelf: 'center' }}>
                    +{roles.length - 2}
                  </span>
                )}
              </div>
            )}
        </td>

        <td style={TD}>
          <Pill tone={STATUS_TONES[member.status] || 'grey'} dot>{member.status || 'Unknown'}</Pill>
          <div style={{ marginTop: '5px' }}>
            <span style={{ fontSize: '11.5px', color: (KYC_TONES[member.kycStatus] ? TONES[KYC_TONES[member.kycStatus]].fg : T.faint) }}>
              KYC {(member.kycStatus || 'unknown').toLowerCase()}
            </span>
          </div>
        </td>

        <td style={TD}>
          {contract
            ? <Pill tone={CONTRACT_TONES[contract] || 'grey'}>{contract}</Pill>
            : <span style={{ fontSize: '13.5px', color: T.faint }}>{NO_CONTRACT}</span>}
          <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '5px' }}>
            {member.registrations ?? 0} registration{(member.registrations ?? 0) === 1 ? '' : 's'}
          </div>
        </td>

        <td style={TD}>
          <PersonChip name={member.spoc} size={24} empty="Nobody yet" />
        </td>

        {/* Row actions fade in on hover; the chevron says the row itself opens. */}
        <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
          <span data-hover style={{ opacity: 0, transition: 'opacity 0.14s ease', display: 'inline-flex', gap: '2px', verticalAlign: 'middle' }}>
            <button
              type="button"
              className="mrm-icon-ghost"
              onClick={() => onEdit(member)}
              title={`Edit ${name}`}
              aria-label={`Edit ${name}`}
            >
              <Edit3 style={{ width: '15px', height: '15px' }} />
            </button>
            <button
              type="button"
              className="mrm-icon-btn"
              onClick={() => onDelete(member._id)}
              title={`Delete ${name}`}
              aria-label={`Delete ${name}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'inline-flex' }}
            >
              <Trash2 style={{ width: '15px', height: '15px' }} />
            </button>
          </span>
          <span
            aria-hidden
            style={{ display: 'inline-flex', color: T.accent, marginLeft: '4px', verticalAlign: 'middle' }}
          >
            <ChevronRight style={{ width: '17px', height: '17px' }} />
          </span>
        </td>
      </tr>

      {confirming && (
        <tr>
          <td colSpan={COLUMNS.length + 2} style={{ ...TD, background: TONES.red.bg, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <AlertTriangle style={{ width: '16px', height: '16px', color: TONES.red.fg, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: '220px', fontSize: '13px', color: TONES.red.fg }}>
                Delete <strong>{name}</strong> permanently? Their leads, onboarding and royalty records stay,
                but stop pointing at anybody.
              </span>
              <Button variant="ghost" onClick={onCancelDelete} style={{ padding: '7px 13px', fontSize: '12.5px' }}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={() => onDelete(member._id, true)} style={{ padding: '7px 13px', fontSize: '12.5px' }}>
                Yes, delete
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════
   MAIN MEMBERS PAGE
   ═══════════════════════════════════════════ */
const Members = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { setCached, invalidate } = useDataCache();
  const { guardAction, blockGuestAction } = useGuestGuard();

  const [view, setView] = useUrlState(VIEW_DEFAULTS);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const searchRef = useRef(null);

  const membersQ = useCachedFetch('members:list', async () => {
    const r = await authFetch('/api/members');
    const d = await r.json();
    return d.members || [];
  });
  const onboardingQ = useCachedFetch('onboarding:list', async () => {
    const r = await authFetch('/api/onboarding');
    const d = await r.json();
    return d.entries || [];
  });

  const members = useMemo(() => membersQ.data || [], [membersQ.data]);
  const onboardingEntries = useMemo(() => onboardingQ.data || [], [onboardingQ.data]);
  const loading = (membersQ.loading && !membersQ.data) || (onboardingQ.loading && !onboardingQ.data);

  const openMember = useCallback((m) => navigate(`/members/${m._id}`), [navigate]);

  useEffect(() => {
    if (debouncedQuery !== view.q) setView({ q: debouncedQuery, page: 1 });
  }, [debouncedQuery, view.q, setView]);

  // "/" jumps to the search box
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

  /* Contract type lives on the onboarding entry, matched by MRM ID first and by
     name only as a fallback — an id is unique, a name is not. */
  const contractMap = useMemo(() => {
    const map = {};
    onboardingEntries.forEach((e) => {
      if (e.clientNumber) map[e.clientNumber] = e.contractType || '';
      if (e.name) map[`name:${e.name.toLowerCase()}`] = e.contractType || '';
    });
    return map;
  }, [onboardingEntries]);

  const contractOf = useCallback(
    (m) => contractMap[m.clientNumber] || contractMap[`name:${(m.name || '').toLowerCase()}`] || '',
    [contractMap],
  );

  const setMembers = (updater) => {
    const current = membersQ.data || [];
    setCached('members:list', typeof updater === 'function' ? updater(current) : updater);
  };

  const STATUS_FILTERS = useMemo(() => [
    { id: 'all', label: 'All', test: () => true },
    { id: 'active', label: 'Active', test: (m) => m.status === 'Active' },
    { id: 'onboarding', label: 'Onboarding', test: (m) => m.status === 'Onboarding' },
    { id: 'inactive', label: 'Inactive', test: (m) => m.status === 'Inactive' },
    { id: 'kyc', label: 'KYC not done', test: (m) => m.kycStatus !== 'Verified' },
    { id: 'unassigned', label: 'No owner', test: (m) => !m.spoc },
  ], []);

  const rows = useMemo(() => {
    let list = members;
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m._id && m._id.toLowerCase().includes(q)) ||
        (m.clientNumber && m.clientNumber.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q)) ||
        (m.genre && m.genre.toLowerCase().includes(q)) ||
        (m.spoc && m.spoc.toLowerCase().includes(q)) ||
        roleList(m).some((r) => r.toLowerCase().includes(q))
      );
    }
    if (view.contract !== 'all') {
      list = list.filter((m) => (view.contract === NO_CONTRACT ? !contractOf(m) : contractOf(m) === view.contract));
    }
    const sf = STATUS_FILTERS.find((s) => s.id === view.status);
    if (sf && sf.id !== 'all') list = list.filter(sf.test);

    const cmp = {
      name: (a, b) => text(a.name).localeCompare(text(b.name)),
      roles: (a, b) => blanksLast(roleList(a)[0]) - blanksLast(roleList(b)[0]) || text(roleList(a)[0]).localeCompare(text(roleList(b)[0])),
      status: (a, b) => text(a.status).localeCompare(text(b.status)),
      contract: (a, b) => blanksLast(contractOf(a)) - blanksLast(contractOf(b)) || text(contractOf(a)).localeCompare(text(contractOf(b))),
      spoc: (a, b) => blanksLast(a.spoc) - blanksLast(b.spoc) || text(a.spoc).localeCompare(text(b.spoc)),
      createdAt: (a, b) => (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0),
    }[view.sort] || ((a, b) => (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0));

    return [...list].sort((a, b) => (view.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
  }, [members, debouncedQuery, view.contract, view.status, view.sort, view.dir, contractOf, STATUS_FILTERS]);

  const totalPages = Math.max(1, Math.ceil(rows.length / view.size));
  const safePage = Math.min(Math.max(1, view.page), totalPages);
  const pageRows = rows.slice((safePage - 1) * view.size, safePage * view.size);

  const contractSegments = useMemo(() => {
    const buckets = [...CONTRACT_TYPES, NO_CONTRACT];
    return buckets.map((label) => ({
      id: label,
      label,
      tone: CONTRACT_TONES[label] || 'grey',
      value: members.filter((m) => (label === NO_CONTRACT ? !contractOf(m) : contractOf(m) === label)).length,
    }));
  }, [members, contractOf]);

  const statusOptions = STATUS_FILTERS.map((f) => ({
    value: f.id, label: f.label, count: members.filter(f.test).length,
  }));

  const unassignedCount = members.filter((m) => !m.spoc).length;
  const filtersOn = !!searchQuery || view.contract !== 'all' || view.status !== 'all';
  const resetAll = () => { setSearchQuery(''); setView({ q: '', contract: 'all', status: 'all', page: 1 }); };
  const pickContract = (v) => setView({ contract: v, page: 1 });
  const pickStatus = (v) => setView({ status: v, page: 1 });
  const toggleSort = (key) => setView(
    view.sort === key
      ? { sort: key, dir: view.dir === 'asc' ? 'desc' : 'asc', page: 1 }
      : { sort: key, dir: key === 'createdAt' ? 'desc' : 'asc', page: 1 },
  );

  const pageIds = pageRows.map((m) => m._id);
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

  const handleAdd = async (form) => {
    if (blockGuestAction()) return { ok: false, message: 'Guest users have view-only access' };
    try {
      const res = await authFetch('/api/members', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setMembers((p) => [data.member, ...p]); addToast('Member added'); return { ok: true }; }
      if (res.status === 409) {
        return { ok: false, status: 409, conflicts: data.conflicts || [], message: data.message || 'Duplicate name, email or MRM ID already exists.' };
      }
      return { ok: false, status: res.status, message: data.message || 'Failed to add member.' };
    } catch (err) {
      console.error('Failed to add member:', err);
      return { ok: false, message: 'Failed to add member.' };
    }
  };

  /* The edit form is built from the member rather than spread wholesale, so the
     PUT carries exactly the editable fields. `clientNumber` belongs in here —
     it is on the form, and leaving it out showed an empty MRM ID box for a
     member who already had one. */
  const startEdit = (m) => setEditing({
    _id: m._id,
    name: m.name || '', role: roleList(m), email: m.email || '', phone: m.phone || '',
    genre: m.genre || '', languages: m.languages || '', bio: m.bio || '',
    clientNumber: m.clientNumber || '', panCard: m.panCard || '', aadhaar: m.aadhaar || '',
    dateOfFirstContact: m.dateOfFirstContact || '', leadSource: m.leadSource || '',
    priority: m.priority || 'medium', isReferred: !!m.isReferred,
    referredBy: m.referredBy || '', referralCommission: m.referralCommission || '',
  });

  const handleEdit = async (form) => {
    if (!editing) return { ok: false, message: 'No member selected' };
    if (blockGuestAction()) return { ok: false, message: 'Guest users have view-only access' };
    try {
      const res = await authFetch(`/api/members/${editing._id}`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMembers((p) => p.map((m) => (m._id === editing._id ? data.member : m)));
        // the backend propagates name/email/phone out to every record that names them
        invalidate('leads:list');
        invalidate('onboarding:list');
        invalidate('societyregs:list');
        invalidate('royalty:list');
        addToast('Member updated');
        return { ok: true };
      }
      if (res.status === 409) {
        return { ok: false, status: 409, conflicts: data.conflicts || [], message: data.message || 'Duplicate name, email or MRM ID already exists.' };
      }
      return { ok: false, status: res.status, message: data.message || 'Failed to update member.' };
    } catch (err) {
      console.error('Failed to edit member:', err);
      return { ok: false, message: 'Failed to update member.' };
    }
  };

  const handleDelete = async (memberId, confirmed) => {
    if (!confirmed) { guardAction(() => setConfirmDeleteId(memberId)); return; }
    if (blockGuestAction()) return;
    setConfirmDeleteId(null);
    try {
      const res = await authFetch(`/api/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers((p) => p.filter((m) => m._id !== memberId));
        setSelected((prev) => { const next = new Set(prev); next.delete(memberId); return next; });
        addToast('Member deleted');
      } else addToast('Failed to delete member', 'error');
    } catch (err) {
      console.error('Failed to delete member:', err);
      addToast('Failed to delete member', 'error');
    }
  };

  const exportRows = (list, scope) => {
    try {
      if (!list.length) { addToast('Nothing to export', 'error'); return; }
      const data = list.map((m) => toExportRow(m, contractOf(m)));
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 26 }, { wch: 18 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 13 },
        { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Members');
      XLSX.writeFile(wb, `Members_${scope}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast(`Exported ${data.length} member${data.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export Excel', 'error');
    }
  };

  return (
    // capped, because a table stretched across 1600px puts the owner column an
    // inch from the name it belongs to
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Members' }]}
        title="Members"
        subtitle="Every artist on the roster. Leads, onboarding and royalty records all hang off one of these."
        actions={
          <>
            <Button
              variant="ghost"
              icon={Download}
              disabled={loading || rows.length === 0}
              title={rows.length ? `Download these ${rows.length} member${rows.length === 1 ? '' : 's'} as Excel` : 'Nothing to export'}
              onClick={() => exportRows(rows, 'view')}
            >
              Export
            </Button>
            <Button
              icon={Plus}
              title="Add an artist to the roster"
              onClick={() => guardAction(() => setShowAddModal(true))}
            >
              New Member
            </Button>
          </>
        }
      />

      {/* A pointer, not a report: the number itself stays on the "No owner" chip. */}
      {!loading && members.length > 0 && (
        unassignedCount > 0
          ? (
            <Banner
              tone="amber"
              icon={AlertTriangle}
              action={(
                <Button
                  icon={ArrowRight}
                  onClick={() => pickStatus('unassigned')}
                  title="Filter the list down to members with nobody assigned"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Show them
                </Button>
              )}
            >
              Some members have nobody looking after them.
            </Banner>
          )
          : <Banner tone="green" icon={CheckCircle2}>Every member has somebody looking after them.</Banner>
      )}

      <Panel>
        <DistributionBar
          segments={contractSegments}
          active={view.contract}
          onSelect={pickContract}
          emptyLabel="No members yet"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${T.border}` }}>
          <Segmented options={statusOptions} value={view.status} onChange={pickStatus} tone="purple" />
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px', marginLeft: 'auto' }}>
            <SearchInput
              ref={searchRef}
              icon={Search}
              placeholder="Search name, MRM ID, email, role or owner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
            {!searchQuery && (
              <kbd
                aria-hidden
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  padding: '2px 7px', borderRadius: '5px', pointerEvents: 'none',
                  background: T.bg, border: `1px solid ${T.border}`,
                  color: T.faint, fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                /
              </kbd>
            )}
          </div>
          {filtersOn && (
            <Button variant="ghost" icon={X} onClick={resetAll} title="Clear the search, the contract and the status filter" style={{ padding: '9px 14px', fontSize: '13px' }}>
              Reset
            </Button>
          )}
        </div>
      </Panel>

      <Card bodyStyle={{ padding: 0 }}>
        {selected.size > 0 && (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button
              variant="ghost"
              icon={Download}
              title={`Download the ${selected.size} ticked member${selected.size === 1 ? '' : 's'} as Excel`}
              style={{ padding: '7px 13px', fontSize: '13px' }}
              onClick={() => exportRows(members.filter((m) => selected.has(m._id)), 'selected')}
            >
              Export selected
            </Button>
          </SelectionBar>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState icon={Search} title={members.length === 0 ? 'No members yet' : 'Nothing matches these filters'}>
            {members.length === 0
              ? 'Use “New Member” above to add the first artist to the roster.'
              : <button type="button" onClick={resetAll} style={{ background: 'none', border: 'none', color: T.accent, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Reset the filters</button>}
          </EmptyState>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH width="44px">
                      {!loading && pageIds.length > 0 && (
                        <Checkbox
                          checked={allPageSelected}
                          indeterminate={selectedOnPage > 0 && !allPageSelected}
                          onChange={togglePage}
                          label="Select every member on this page"
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
                    <TH width="96px" align="right" />
                  </tr>
                </thead>
                {loading ? (
                  <TableSkeleton columns={['17px', '60%', '70%', '55%', '65%', '60%', '40px']} rows={8} />
                ) : (
                  <tbody>
                    {pageRows.map((m) => (
                      <MemberRow
                        key={m._id}
                        member={m}
                        contract={contractOf(m)}
                        onOpen={openMember}
                        onEdit={(mm) => guardAction(() => startEdit(mm))}
                        onDelete={handleDelete}
                        confirming={confirmDeleteId === m._id}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        selected={selected.has(m._id)}
                        onToggleSelect={() => toggleRow(m._id)}
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

      {showAddModal && (
        <MemberFormModal onClose={() => setShowAddModal(false)} onSubmit={handleAdd} />
      )}
      {editing && (
        <MemberFormModal onClose={() => setEditing(null)} onSubmit={handleEdit} initialData={editing} />
      )}
    </div>
  );
};

export default Members;
