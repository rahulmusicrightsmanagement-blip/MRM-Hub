import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, ShieldCheck, FileSignature, UserCheck, MessageSquare, CheckCircle2,
  ArrowRight, Save, Trash2, XCircle, X, User, Mail, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { T, TONES, LABEL } from '../theme';
import {
  PageHeader, Button, Card, Stepper, FormGrid, Input, Textarea, Select,
  Pill, Field, FieldGrid, EmptyState, Banner,
} from '../components/studio';
import { StageContent, MultiRoleSelect } from '../components/onboardingStages';

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** An icon per known stage; anything the picklist grows falls back sensibly. */
const STAGE_ICONS = {
  'Document Submission': FileText,
  'KYC Verification': ShieldCheck,
  'Contract Signing': FileSignature,
  'Active Member': UserCheck,
  'Contact Made': MessageSquare,
  'Completed': CheckCircle2,
};

const STAGE_BLURB = {
  'Document Submission': 'Collect Aadhaar, PAN and anything else needed',
  'KYC Verification': 'Check the documents actually match',
  'Contract Signing': 'Send, sign and file the agreement',
  'Active Member': 'Set up the group, email and MRM ID',
  'Contact Made': 'First contact as a live client',
  'Completed': 'Everything is done',
};

/* The fields the Save button writes. Everything else is a stage action that
   saves the moment it is clicked, inside its own stage panel. */
const EDITABLE = ['phone', 'contractType', 'spoc', 'priority', 'notes', 'clientNumber'];

const draftFrom = (entry) => ({
  phone: entry.phone || '',
  contractType: entry.contractType || 'Retainer',
  spoc: entry.spoc || '',
  priority: entry.priority || 'medium',
  notes: entry.notes || '',
  clientNumber: entry.clientNumber || '',
});

/** done / current / todo, worked out from where the entry sits in the stage list. */
const stageStateOf = (stage, entry, stages) => {
  const here = stages.indexOf(entry.stage);
  const mine = stages.indexOf(stage);
  if (mine < 0 || here < 0) return 'todo';
  if (mine < here) return 'done';
  if (mine === here) return entry.stage === 'Completed' ? 'done' : 'current';
  return 'todo';
};

const OnboardingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch, isGuest } = useAuth();
  const { addToast } = useToast();
  const { getOptions } = usePicklist();
  const { setCached, invalidate } = useDataCache();
  const STAGES = getOptions('onboarding_stage');

  const [openStage, setOpenStage] = useState(null);
  // Never null. Setting state during render schedules a re-render but the
  // current pass still runs to completion, so the form must always have
  // something to read.
  const [draft, setDraft] = useState(() => draftFrom({}));
  const [draftFor, setDraftFor] = useState(null);
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const actionsRef = useRef(null);

  const entriesQ = useCachedFetch('onboarding:list', async () => {
    const r = await authFetch('/api/onboarding');
    const d = await r.json();
    return d.entries || [];
  });
  const teamQ = useCachedFetch('users:team', async () => {
    const r = await authFetch('/api/users/team');
    const d = await r.json();
    return d.users || [];
  });

  const entries = useMemo(() => entriesQ.data || [], [entriesQ.data]);
  const teamMembers = teamQ.data || [];
  const loading = entriesQ.loading && !entriesQ.data;
  const entry = useMemo(() => entries.find((e) => e._id === id) || null, [entries, id]);

  // Fill the form once per entry, keyed on the id and not the object: a stage
  // panel writing to the server hands back a new entry, and that must not wipe
  // notes someone is halfway through typing.
  if (entry && draftFor !== entry._id) {
    setDraftFor(entry._id);
    setDraft(draftFrom(entry));
    setRoles(Array.isArray(entry.role) ? entry.role : []);
    setOpenStage(entry.stage);
  }

  const blockGuestAction = useCallback(() => {
    if (!isGuest) return false;
    addToast('Guest users have view-only access', 'error');
    return true;
  }, [isGuest, addToast]);

  const applyEntry = useCallback((updated) => {
    setCached('onboarding:list', (entriesQ.data || []).map((e) => (e._id === updated._id ? updated : e)));
  }, [setCached, entriesQ.data]);

  const patchEntry = useCallback(async (fields, message) => {
    if (blockGuestAction()) return null;
    try {
      const res = await authFetch(`/api/onboarding/${id}`, { method: 'PUT', body: JSON.stringify(fields) });
      const data = await res.json();
      if (!res.ok) { addToast('Could not save', 'error'); return null; }
      applyEntry(data.entry);
      // the backend syncs clientNumber/KYC → Member and contractType → Lead
      invalidate('members:list');
      invalidate('leads:list');
      if (message) addToast(message);
      return data.entry;
    } catch (err) {
      console.error('Onboarding update failed:', err);
      addToast('Could not save', 'error');
      return null;
    }
  }, [authFetch, id, addToast, applyEntry, invalidate, blockGuestAction]);

  const rolesChanged = useMemo(() => {
    if (!entry) return false;
    const original = Array.isArray(entry.role) ? entry.role : [];
    return original.length !== roles.length || original.some((r, i) => r !== roles[i]);
  }, [entry, roles]);

  const dirty = useMemo(() => {
    if (!entry || !draft) return false;
    const original = draftFrom(entry);
    return rolesChanged || EDITABLE.some((k) => (draft[k] || '') !== (original[k] || ''));
  }, [entry, draft, rolesChanged]);

  const set = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!dirty || saving) return;
    const original = draftFrom(entry);
    const changed = {};
    EDITABLE.forEach((k) => { if ((draft[k] || '') !== (original[k] || '')) changed[k] = draft[k]; });
    if (rolesChanged) changed.role = roles;
    setSaving(true);
    await patchEntry(changed, 'Changes saved');
    setSaving(false);
  };

  const handleDelete = async () => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${id}`, { method: 'DELETE' });
      if (!res.ok) { addToast('Could not delete', 'error'); return; }
      setCached('onboarding:list', (entriesQ.data || []).filter((e) => e._id !== id));
      addToast('Entry deleted');
      navigate('/onboarding');
    } catch (err) {
      console.error('Onboarding delete failed:', err);
      addToast('Could not delete', 'error');
    }
  };

  const handleReject = async () => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${id}/not-qualified`, {
        method: 'POST', body: JSON.stringify({ reason: rejectReason || '' }),
      });
      if (!res.ok) { addToast('Could not update', 'error'); return; }
      setCached('onboarding:list', (entriesQ.data || []).filter((e) => e._id !== id));
      invalidate('leads:list');
      addToast('Moved back to Sales Pipeline as Not Qualified');
      navigate('/onboarding');
    } catch (err) {
      console.error('Not qualified failed:', err);
      addToast('Could not update', 'error');
    }
  };

  /* Advancing stops one short of "Completed" — that stage is reached by
     finishing the work, not by pressing a button. Rule kept from the old modal. */
  const stageIdx = entry ? STAGES.indexOf(entry.stage) : -1;
  const canAdvance = stageIdx >= 0 && stageIdx < STAGES.length - 2 && entry && entry.stage !== 'Completed';
  const nextStage = canAdvance ? STAGES[stageIdx + 1] : null;

  const handleAdvance = () => patchEntry({ stage: nextStage }, `Moved to ${nextStage}`);

  const steps = useMemo(() => {
    if (!entry) return [];
    return STAGES.map((stage) => ({
      id: stage,
      icon: STAGE_ICONS[stage] || FileText,
      title: stage,
      description: STAGE_BLURB[stage] || '',
      state: stageStateOf(stage, entry, STAGES),
    }));
  }, [entry, STAGES]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: T.muted }}>Loading client...</div>;
  }

  if (!entry) {
    return (
      <div style={{ padding: '26px 30px' }}>
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Onboarding', to: '/onboarding' }, { label: 'Not found' }]}
          title="Client not found"
        />
        <Card>
          <EmptyState icon={XCircle} title="This onboarding entry is no longer available">
            It may have been deleted or sent back to the pipeline.{' '}
            <button type="button" onClick={() => navigate('/onboarding')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '13.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Back to onboarding
            </button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  const journey = entry.stage === 'Completed'
    ? { tone: 'green', icon: CheckCircle2, text: 'Onboarding is complete. Nothing further is needed here.' }
    : stageIdx >= 0
      ? { tone: 'amber', icon: ArrowRight, text: `This client is at Step ${stageIdx + 1} of ${STAGES.length} — ${entry.stage}. ${STAGE_BLURB[entry.stage] || ''}` }
      : { tone: 'grey', icon: ArrowRight, text: `This client is at the “${entry.stage}” stage.` };

  return (
    <div style={{ padding: '26px 30px 50px' }}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', to: '/' },
          { label: 'Onboarding', to: '/onboarding' },
          { label: entry.name },
        ]}
        title={entry.name}
        subtitle={[entry.email, entry.phone].filter(Boolean).join('  ·  ') || 'No contact details recorded'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/onboarding')}>Back</Button>
            <Button icon={Save} onClick={handleSave} disabled={!dirty || saving} style={!dirty || saving ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      />

      {/* One strip: the sentence, the facts that qualify it, and the next
          action. The stage is not repeated — the sentence already names it. */}
      <Banner
        tone={journey.tone}
        icon={journey.icon}
        action={<>
          {entry.clientNumber && <Pill tone="purple">MRM {entry.clientNumber}</Pill>}
          {entry.priority && entry.priority !== 'medium' && (
            <Pill tone={entry.priority === 'high' ? 'red' : 'grey'}>{entry.priority} priority</Pill>
          )}
          {dirty && <Pill tone="amber">Unsaved changes</Pill>}
          {canAdvance && (
            <Button icon={ArrowRight} onClick={handleAdvance} style={{ padding: '9px 16px', fontSize: '13px' }}>
              Move to {nextStage}
            </Button>
          )}
        </>}
      >
        {journey.text}
      </Banner>

      <Stepper steps={steps} active={openStage} onSelect={setOpenStage} />

      {/* ── the panel for whichever stage is open ── */}
      {openStage && (
      <Card
        icon={STAGE_ICONS[openStage] || FileText}
        title={openStage}
        description={STAGE_BLURB[openStage] || 'Work for this stage'}
        tone={openStage === entry.stage ? 'amber' : 'indigo'}
      >
        {openStage !== entry.stage && (
          <p style={{ fontSize: '13px', color: T.faint, marginBottom: '14px' }}>
            You are looking at <strong style={{ color: T.body }}>{openStage}</strong>, but this client is
            currently at <strong style={{ color: TONES.amber.fg }}>{entry.stage}</strong>. Changes still save.
          </p>
        )}
        <StageContent entry={entry} stage={openStage} onUpdate={applyEntry} teamMembers={teamMembers} />
      </Card>
      )}

      {/* ── Always on show, whatever stage you are reading ── */}
      <div ref={actionsRef} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '18px' }}>
        <Card icon={User} title="Client details" description="Contract, owner and internal notes." tone="purple">
          {/* read-only facts, so they read as information rather than as
              form boxes you are meant to fill in */}
          <FieldGrid min="190px">
            <Field icon={User} label="Name">{entry.name}</Field>
            <Field icon={Mail} label="Email">{entry.email || '—'}</Field>
            <Field icon={CalendarCheck} label="Added on">{fmtDate(entry.createdAt) || '—'}</Field>
          </FieldGrid>
          <p style={{ fontSize: '12px', color: T.faint, margin: '10px 0 22px' }}>
            Name and email are managed on the Members page.
          </p>

          <FormGrid>
            <Input label="Phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98xxx xxxxx" />
            <Select label="Contract type" value={draft.contractType} onChange={(e) => set('contractType', e.target.value)}>
              {['Retainer', 'Royalty', 'Work-Based', 'Inhouse'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Owner (SPOC)" value={draft.spoc} onChange={(e) => set('spoc', e.target.value)}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </Select>
            <Select label="Priority" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Input label="MRM ID" value={draft.clientNumber} onChange={(e) => set('clientNumber', e.target.value)} placeholder="e.g. MRM-0142" />
          </FormGrid>
          <div style={{ marginTop: '16px' }}>
            <span style={{ ...LABEL, display: 'block', marginBottom: '7px' }}>Roles</span>
            <MultiRoleSelect selected={roles} onChange={setRoles} />
          </div>
          <div style={{ marginTop: '16px' }}>
            <FormGrid>
              <Textarea label="Notes" span value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering about this client..." />
            </FormGrid>
          </div>
        </Card>

        <Card icon={ArrowRight} title="Move this client on" description="These take effect straight away." tone="amber">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {canAdvance && <Button icon={ArrowRight} onClick={handleAdvance}>Move to {nextStage}</Button>}
            {entry.stage !== 'Completed' && (
              <Button variant="ghost" icon={XCircle} onClick={() => setShowReject(true)} style={{ color: TONES.red.fg }}>
                Not qualified
              </Button>
            )}
            {!canAdvance && entry.stage !== 'Completed' && (
              <p style={{ fontSize: '13px', color: T.faint, alignSelf: 'center' }}>
                “Completed” is reached by finishing the work in this stage, not by a button.
              </p>
            )}
          </div>

          {showReject && (
            <div style={{ background: T.bg, border: `1px solid ${TONES.red.bd}`, borderRadius: '12px', padding: '18px', marginTop: '14px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: TONES.red.fg, marginBottom: '12px' }}>
                Send {entry.name} back to the Sales Pipeline as Not Qualified?
              </p>
              <FormGrid>
                <Textarea label="Reason (optional)" span placeholder="e.g. Did not return the documents..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ minHeight: '70px' }} />
              </FormGrid>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <Button variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                <Button icon={XCircle} onClick={handleReject} style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>Confirm</Button>
              </div>
            </div>
          )}
          {/* a quiet line, not its own bordered card with a red icon chip */}
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '18px', paddingTop: '16px' }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', color: TONES.red.fg }}>
                  Delete {entry.name} permanently? This cannot be undone.
                </span>
                <Button variant="ghost" icon={X} onClick={() => setConfirmDelete(false)} style={{ padding: '7px 13px', fontSize: '13px' }}>Cancel</Button>
                <Button icon={Trash2} onClick={handleDelete} style={{ padding: '7px 13px', fontSize: '13px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>Yes, delete</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', color: T.faint, fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 style={{ width: '13px', height: '13px' }} /> Delete this entry
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingDetail;
