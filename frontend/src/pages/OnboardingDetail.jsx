import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, ShieldCheck, FileSignature, UserCheck, MessageSquare, CheckCircle2,
  ArrowRight, Save, Trash2, XCircle, X, User, Mail, CalendarCheck,
  Users, StickyNote, IdCard, Phone, Milestone, CalendarClock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { T, TONES, LABEL } from '../theme';
import {
  PageHeader, Button, Card, Stepper, FormGrid, Input, Textarea, Select,
  Pill, EmptyState, Banner,
  SubHead, Avatar, ContactRow, Choice, ActionTile, PageBody, StagePicker,
} from '../components/studio';
import { StageContent, MultiRoleSelect } from '../components/onboardingStages';
import { journeyStages } from '../components/onboardingStyles';

const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* The value a native date input wants. Imported records carry junk dates, so
   an unparseable one becomes an empty field rather than "Invalid Date". */
const toDateInput = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* How late, said the way a person would say it. Same wording as the Sales
   Pipeline, and — like there — it is suppressed once the record is finished:
   a deadline on a completed onboarding is history, not a warning. */
const relDay = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(t) - startOf(new Date())) / 86400000);
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days === -1) return 'was due yesterday';
  return days > 0 ? `due in ${days} days` : `was due ${-days} days ago`;
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

/* These were the wrong way round: the "Active Member" panel is a review of
   the three stages behind it, and it is "Contact Made" that sets up the group,
   the email and the MRM ID. */
const STAGE_BLURB = {
  'Document Submission': 'Collect Aadhaar, PAN and anything else needed',
  'KYC Verification': 'Check the documents actually match',
  'Contract Signing': 'Send, sign and file the agreement',
  'Active Member': 'Review everything collected before going live',
  'Contact Made': 'Set up the group, the email and the MRM ID',
  // the banner above already says the onboarding is complete
  'Completed': 'The full record of this onboarding',
};

/* Priority carries a meaning you can see; a <Select> renders "High" in the
   same grey as "Low". Shared wording with the Sales Pipeline on purpose. */
const PRIORITY_CHOICES = [
  { value: 'high', label: 'High', tone: 'red', hint: 'Chase this one first' },
  { value: 'medium', label: 'Medium', tone: 'amber', hint: 'Normal pace' },
  { value: 'low', label: 'Low', tone: 'teal', hint: 'No rush' },
];

/* The fields the Save button writes. Everything else is a stage action that
   saves the moment it is clicked, inside its own stage panel. */
const EDITABLE = ['phone', 'contractType', 'spoc', 'priority', 'notes', 'clientNumber', 'deadline'];

const draftFrom = (entry) => ({
  phone: entry.phone || '',
  contractType: entry.contractType || 'Retainer',
  spoc: entry.spoc || '',
  priority: entry.priority || 'medium',
  notes: entry.notes || '',
  clientNumber: entry.clientNumber || '',
  deadline: toDateInput(entry.deadline),
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
  const STAGES = useMemo(() => journeyStages(getOptions('onboarding_stage')), [getOptions]);

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

  useEffect(() => {
    if (showReject) actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [showReject]);

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
    if ('deadline' in changed) changed.deadline = changed.deadline || null;
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

  /* Moving the record moves what you are reading with it. Clicking a stage on
     the rail still only changes the view — that is a different intent. */
  const handleAdvance = async () => {
    if (await patchEntry({ stage: nextStage }, `Moved to ${nextStage}`)) setOpenStage(nextStage);
  };

  /* Forward one stage at a time, back to any earlier one. "Completed" stays
     unreachable from the picker — it is reached by finishing the work in the
     last working stage, which is the rule the old modal had and which the
     stepper research does not contradict: it is a restriction on skipping
     ahead, not on going back. */
  const handleMoveToStage = async (stage) => {
    if (!entry || stage === entry.stage) return;
    if (await patchEntry({ stage }, `Moved to ${stage}`)) setOpenStage(stage);
  };
  const allowStage = (stage, i, here) => {
    if (here < 0) return true;
    if (i < here) return true;
    if (i === here + 1 && i <= STAGES.length - 2) return true;
    if (i === STAGES.length - 1) return '“Completed” is reached by finishing the work in the last stage, not by picking it.';
    return `Move to ${STAGES[here + 1]} first — a client advances one stage at a time.`;
  };

  /* A stage is locked until the client reaches it. The rule follows the
     RECORD, not your browsing, so moving back locks the later stages again —
     and it is navigation only: a stage panel writes straight to the server, so
     anything already recorded on a re-locked stage is still there. A completed
     client is fully readable; locking an archive only gets in the way. */
  const steps = useMemo(() => {
    if (!entry) return [];
    const here = STAGES.indexOf(entry.stage);
    const finished = entry.stage === 'Completed';
    return STAGES.map((stage, i) => ({
      id: stage,
      icon: STAGE_ICONS[stage] || FileText,
      title: stage,
      description: STAGE_BLURB[stage] || '',
      state: stageStateOf(stage, entry, STAGES),
      locked: !finished && here >= 0 && i > here,
      lockedHint: `${stage} unlocks when this client reaches that stage`,
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
            <button type="button" onClick={() => navigate('/onboarding')} style={{ background: 'none', border: 'none', color: T.accent, fontSize: '13.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Back to onboarding
            </button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  /* Every way this client can be moved on, each stated with its consequence. */
  const moveActions = [];
  if (entry.stage !== 'Completed') moveActions.push({
    key: 'reject', icon: XCircle, tone: 'red', title: 'Not qualified',
    subtitle: 'Sends them back to the Sales Pipeline and removes this entry.',
    onClick: () => setShowReject(true),
  });

  /* Suppressed on a finished client: an archived deadline is noise. */
  const overdueText = entry.stage === 'Completed' ? '' : relDay(entry.deadline);
  const overdueTone = overdueText.startsWith('was due') || overdueText === 'due today'
    ? 'red'
    : overdueText === 'due tomorrow' || /due in [1-7] days/.test(overdueText) ? 'amber' : null;

  const journey = entry.stage === 'Completed'
    ? { tone: 'green', icon: CheckCircle2, text: 'Onboarding is complete. Nothing further is needed here.' }
    : stageIdx >= 0
      ? { tone: 'amber', icon: ArrowRight, text: `This client is on step ${stageIdx + 1} of ${STAGES.length}.` }
      : { tone: 'grey', icon: ArrowRight, text: `This client is at the “${entry.stage}” stage.` };

  return (
    // capped, because a card stretched across 1600px reads as an empty rectangle
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
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
            <Button variant="ghost" onClick={() => navigate('/onboarding')} title="Back to the onboarding list">Back</Button>
            <Button
              icon={Save}
              onClick={handleSave}
              disabled={!dirty || saving}
              title={dirty ? 'Save the client details below' : 'Nothing has changed yet'}
            >
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
          {overdueTone && <Pill tone={overdueTone} icon={CalendarClock}>{overdueText}</Pill>}
          {entry.clientNumber && <Pill tone="purple">MRM {entry.clientNumber}</Pill>}
          {entry.priority && entry.priority !== 'medium' && (
            <Pill tone={entry.priority === 'high' ? 'red' : 'grey'}>{entry.priority} priority</Pill>
          )}
          {dirty && <Pill tone="amber">Unsaved changes</Pill>}
          {canAdvance && (
            <Button
              icon={ArrowRight}
              onClick={handleAdvance}
              title={`Move this client on to ${nextStage} and open that stage`}
              style={{ padding: '9px 16px', fontSize: '13px' }}
            >
              Move to {nextStage}
            </Button>
          )}
        </>}
      >
        {journey.text}
      </Banner>

      <Stepper
        steps={steps}
        active={openStage}
        onSelect={setOpenStage}
        onLocked={(st) => addToast(
          `${st.title} is locked until this client reaches that stage. Use the Stage panel on the right to move them on.`,
          'error',
        )}
      />

      <PageBody
        rail={(
          <>
            {/* Who this is, pinned — visible from whichever stage is open. */}
            <Card icon={User} title="Who this is" tone="purple" bodyStyle={{ padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Avatar name={entry.name} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: T.heading, lineHeight: 1.25, wordBreak: 'break-word' }}>
                    {entry.name || 'Unnamed client'}
                  </div>
                  <div style={{ fontSize: '12px', color: T.faint, marginTop: '2px' }}>
                    {roles.length ? roles.join(', ') : 'No roles set'}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '2px' }}>
                <ContactRow
                  icon={Mail} label="Email" tone="blue" empty="No email"
                  value={entry.email} href={entry.email ? `mailto:${entry.email}` : undefined}
                />
                <ContactRow
                  icon={Phone} label="Phone" tone="teal" empty="No phone"
                  value={entry.phone} href={entry.phone ? `tel:${entry.phone}` : undefined}
                />
                <ContactRow icon={CalendarCheck} label="Added on" tone="grey" empty="Unknown" copyable={false} value={fmtDate(entry.createdAt)} />
              </div>
              <p style={{ fontSize: '11px', color: T.faint, marginTop: '10px', lineHeight: 1.5 }}>
                Name and email are managed on the Members page.
              </p>
            </Card>

            {/* Forward one, back to anywhere. */}
            <Card
              icon={Milestone} title="Stage" tone="amber"
              description="Forward one step at a time; back to any earlier one."
              bodyStyle={{ padding: '15px 17px' }}
            >
              <StagePicker
                stages={STAGES}
                current={entry.stage}
                onSelect={handleMoveToStage}
                allow={allowStage}
                onBlocked={(stage, why) => addToast(why, 'error')}
              />
              {entry.stage !== 'Completed' && (
                <p style={{ fontSize: '12px', color: T.faint, marginTop: '11px', lineHeight: 1.5 }}>
                  “Completed” is reached by finishing the work in the last stage, not by picking it.
                </p>
              )}

              {moveActions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {moveActions.map((a) => (
                    <ActionTile
                      key={a.key} icon={a.icon} tone={a.tone}
                      title={a.title} subtitle={a.subtitle} onClick={a.onClick}
                    />
                  ))}
                </div>
              )}

              <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '16px', paddingTop: '14px' }}>
                {confirmDelete ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: TONES.red.fg, lineHeight: 1.5 }}>
                      Delete {entry.name} permanently? This cannot be undone.
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Button variant="ghost" icon={X} onClick={() => setConfirmDelete(false)} style={{ padding: '7px 13px', fontSize: '12.5px' }}>Cancel</Button>
                      <Button variant="danger" icon={Trash2} onClick={handleDelete} style={{ padding: '7px 13px', fontSize: '12.5px' }}>Yes, delete</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    title={`Permanently delete ${entry.name} from onboarding`}
                    onMouseEnter={(e) => { e.currentTarget.style.color = TONES.red.fg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.faint; }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: T.faint, fontSize: '12.5px', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                  >
                    <Trash2 style={{ width: '13px', height: '13px' }} /> Delete this entry
                  </button>
                )}
              </div>
            </Card>
          </>
        )}
      >
        {showReject && (
          <div ref={actionsRef}>
            <Card
              icon={XCircle} tone="red"
              title={`Send ${entry.name} back to the Sales Pipeline?`}
              description="The lead is reopened there as Not Qualified, and this onboarding entry is removed."
            >
              <Textarea label="Reason (optional)" span placeholder="e.g. Did not return the documents..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ minHeight: '70px' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <Button variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                <Button variant="danger" icon={XCircle} onClick={handleReject}>Send back to the pipeline</Button>
              </div>
            </Card>
          </div>
        )}

        {/* the panel for whichever stage is open */}
        {openStage && (
          <Card
            icon={STAGE_ICONS[openStage] || FileText}
            title={openStage}
            description={STAGE_BLURB[openStage] || 'Work for this stage'}
            tone={openStage === entry.stage ? 'amber' : 'indigo'}
          >
            {openStage !== entry.stage && (
              <p style={{ fontSize: '13px', color: T.faint, marginBottom: '16px' }}>
                You are looking at <strong style={{ color: T.body }}>{openStage}</strong>, but this client is
                currently at <strong style={{ color: TONES.amber.fg }}>{entry.stage}</strong>. Changes still save.
              </p>
            )}
            <StageContent entry={entry} stage={openStage} onUpdate={applyEntry} teamMembers={teamMembers} />
          </Card>
        )}

        <Card icon={User} title="Client details" description="Contract, owner and internal notes." tone="purple">
          <SubHead icon={Users}>Ownership &amp; contract</SubHead>
          <FormGrid min="280px">
            <Select label="Owner (SPOC)" value={draft.spoc} onChange={(e) => set('spoc', e.target.value)}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </Select>
            <Select label="Contract type" value={draft.contractType} onChange={(e) => set('contractType', e.target.value)}>
              {['Retainer', 'Royalty', 'Work-Based', 'Inhouse'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Choice label="Priority" options={PRIORITY_CHOICES} value={draft.priority} onChange={(v) => set('priority', v)} />
          </FormGrid>

          <SubHead icon={IdCard} style={{ marginTop: '24px' }}>Identity</SubHead>
          <FormGrid min="280px">
            <Input label="Phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98xxx xxxxx" />
            <Input label="MRM ID" value={draft.clientNumber} onChange={(e) => set('clientNumber', e.target.value)} placeholder="e.g. MRM-0142" />
            <MultiRoleSelect selected={roles} onChange={setRoles} />
          </FormGrid>

          <SubHead icon={CalendarClock} style={{ marginTop: '24px' }}>Timeline</SubHead>
          <FormGrid min="280px">
            <Input
              label="Deadline" type="date" style={{ colorScheme: 'light' }}
              value={draft.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              hint={entry.stage === 'Completed'
                ? 'This client is finished, so the deadline is history.'
                : 'Drives the Overdue filter on the Onboarding list.'}
            />
          </FormGrid>

          <SubHead icon={StickyNote} style={{ marginTop: '24px' }}>Notes</SubHead>
          <Textarea
            span placeholder="Anything worth remembering about this client..."
            value={draft.notes} onChange={(e) => set('notes', e.target.value)}
          />
        </Card>
      </PageBody>
    </div>
  );
};

export default OnboardingDetail;
