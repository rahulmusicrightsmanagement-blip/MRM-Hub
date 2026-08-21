import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, CalendarCheck, ShieldCheck, Plus, Save, Trash2, ArrowRight,
  XCircle, UserPlus, CheckCircle, Circle, CheckSquare, Square, X, ExternalLink,
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

/* Which step the lead is actually sitting on, worked out from its stage.
   Returns null when the journey is over — handed to onboarding, or closed. */
const STEP_BY_STAGE = {
  'New Enquiry': 'call',
  'Meeting Set': 'meeting',
  'Qualified Lead': 'handover',
};
const currentStepOf = (lead) => {
  if (!lead) return null;
  if (lead.stage === 'Not Qualified') return null;
  if (lead.movedToOnboarding) return null;
  return STEP_BY_STAGE[lead.stage] || 'details';
};

/* Has the work on this step actually been done? */
const STEP_DONE = {
  details: (l) => !!l.spoc && !!l.source,
  call: (l) => !!l.callDone,
  meeting: (l) => !!l.meetingDate,
  handover: (l) => !!l.movedToOnboarding,
};

const STEP_ORDER = ['details', 'call', 'meeting', 'handover'];

/* Where each step stands. "current" wins over "done", because where the lead
   sits right now matters more than whether that step's boxes are ticked.
   The distinction that earns its keep is the last three:
     skipped   — the lead moved past this without it being filled in (a gap)
     norecord  — the journey is over; this was never recorded, and never will be
     todo      — genuinely still ahead */
const stateOf = (stepId, lead, current) => {
  if (stepId === current) return 'current';
  if (STEP_DONE[stepId] && STEP_DONE[stepId](lead)) return 'done';
  if (lead.movedToOnboarding || lead.stage === 'Not Qualified') return 'norecord';
  const here = STEP_ORDER.indexOf(current);
  const mine = STEP_ORDER.indexOf(stepId);
  if (here >= 0 && mine >= 0 && mine < here) return 'skipped';
  return 'todo';
};

/* The fields the Save button writes. Anything not listed here is an action,
   not a form value, and is saved the moment it is clicked. */
const EDITABLE = [
  'genre', 'source', 'priority', 'spoc', 'deadline', 'notes',
  'inquiryNotes', 'meetingDate', 'meetingLink', 'meetingAssignedWith', 'meetingNotes',
];

const draftFrom = (lead) => ({
  genre: lead.genre || '',
  source: lead.source || '',
  priority: lead.priority || 'medium',
  spoc: lead.spoc || '',
  deadline: toDateInput(lead.deadline),
  notes: lead.notes || '',
  inquiryNotes: lead.inquiryNotes || '',
  meetingDate: lead.meetingDate || '',
  meetingLink: lead.meetingLink || '',
  meetingAssignedWith: lead.meetingAssignedWith || '',
  meetingNotes: lead.meetingNotes || '',
});

/* ═══════════════════════════════════════════
   A TICKABLE CHECK
   ═══════════════════════════════════════════ */
const Check = ({ checked, label, subtitle, onToggle, disabled }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: '11px', width: '100%',
      textAlign: 'left', padding: '13px 14px', borderRadius: '10px',
      background: T.bg, border: `1px solid ${checked ? TONES.green.bd : T.border}`,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      transition: 'border-color 0.15s',
    }}
  >
    {checked
      ? <CheckCircle style={{ width: '19px', height: '19px', color: TONES.green.fg, flexShrink: 0 }} />
      : <Circle style={{ width: '19px', height: '19px', color: T.faint, flexShrink: 0 }} />}
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: checked ? T.muted : '#fff' }}>{label}</span>
      {subtitle && <span style={{ display: 'block', fontSize: '12px', color: T.faint, marginTop: '3px' }}>{subtitle}</span>}
    </span>
    <Pill tone={checked ? 'green' : 'grey'}>{checked ? 'Done' : 'Pending'}</Pill>
  </button>
);

/* ═══════════════════════════════════════════
   HAND OVER TO ONBOARDING
   ═══════════════════════════════════════════ */
const HandoverPanel = ({ lead, teamMembers, onCancel, onConfirm }) => {
  const [spoc, setSpoc] = useState(lead.spoc || '');
  const [contractType, setContractType] = useState('Retainer');
  const [deadline, setDeadline] = useState('');

  return (
    <div style={{ background: T.bg, border: `1px solid ${TONES.green.bd}`, borderRadius: '12px', padding: '18px', marginTop: '14px' }}>
      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Move {lead.name} to Onboarding</p>
      <p style={{ fontSize: '13px', color: T.muted, marginBottom: '16px' }}>
        This creates the onboarding record. The lead stays here for reference.
      </p>
      <FormGrid min="200px">
        <Select label="Assign SPOC" value={spoc} onChange={(e) => setSpoc(e.target.value)}>
          <option value="">Select SPOC...</option>
          {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
        </Select>
        <Select label="Contract type" value={contractType} onChange={(e) => setContractType(e.target.value)}>
          {['Retainer', 'Royalty', 'Work-Based', 'Inhouse'].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ colorScheme: 'dark' }} />
      </FormGrid>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button icon={UserPlus} onClick={() => onConfirm({ spoc, contractType, deadline })}>Confirm &amp; move</Button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   THE PAGE
   ═══════════════════════════════════════════ */
const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch, isGuest } = useAuth();
  const { addToast } = useToast();
  const { getOptions } = usePicklist();
  const { setCached, invalidate } = useDataCache();
  const STAGES = getOptions('lead_stage');
  const sourceList = getOptions('lead_source');

  const [step, setStep] = useState('details');
  // Never null. Setting state during render schedules a re-render but the
  // current pass still runs to completion, so the form must always have
  // something to read.
  const [draft, setDraft] = useState(() => draftFrom({}));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const actionsRef = useRef(null);

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

  const leads = useMemo(() => leadsQ.data || [], [leadsQ.data]);
  const teamMembers = teamQ.data || [];
  const loading = leadsQ.loading && !leadsQ.data;
  const lead = useMemo(() => leads.find((l) => l._id === id) || null, [leads, id]);

  // Fill the form once per lead. Deliberately keyed on the id and not on the
  // lead object: ticking a checkbox writes to the server and hands back a new
  // lead object, and that must not wipe notes someone is halfway through typing.
  const [draftFor, setDraftFor] = useState(null);
  if (lead && draftFor !== lead._id) {
    setDraftFor(lead._id);
    setDraft(draftFrom(lead));
    // land on the step that actually needs doing, not always the first one
    setStep(currentStepOf(lead) || 'details');
  }

  const blockGuestAction = useCallback(() => {
    if (!isGuest) return false;
    addToast('Guest users have view-only access', 'error');
    return true;
  }, [isGuest, addToast]);

  const applyLead = useCallback((updated) => {
    setCached('leads:list', (leadsQ.data || []).map((l) => (l._id === updated._id ? updated : l)));
  }, [setCached, leadsQ.data]);

  const patchLead = useCallback(async (fields, message) => {
    if (blockGuestAction()) return null;
    try {
      const res = await authFetch(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(fields) });
      const data = await res.json();
      if (!res.ok) { addToast('Could not save', 'error'); return null; }
      applyLead(data.lead);
      if (message) addToast(message);
      return data.lead;
    } catch (err) {
      console.error('Lead update failed:', err);
      addToast('Could not save', 'error');
      return null;
    }
  }, [authFetch, id, addToast, applyLead, blockGuestAction]);

  /* ── what the Save button writes ── */
  const dirty = useMemo(() => {
    if (!lead || !draft) return false;
    const original = draftFrom(lead);
    return EDITABLE.some((k) => (draft[k] || '') !== (original[k] || ''));
  }, [lead, draft]);

  const set = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!dirty || saving) return;
    const original = draftFrom(lead);
    const changed = {};
    EDITABLE.forEach((k) => { if ((draft[k] || '') !== (original[k] || '')) changed[k] = draft[k]; });
    setSaving(true);
    await patchLead(changed, 'Changes saved');
    setSaving(false);
  };

  /* ── actions ── */
  const handleDelete = async () => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) { addToast('Could not delete', 'error'); return; }
      setCached('leads:list', (leadsQ.data || []).filter((l) => l._id !== id));
      addToast('Lead deleted');
      navigate('/sales-pipeline');
    } catch (err) {
      console.error('Lead delete failed:', err);
      addToast('Could not delete', 'error');
    }
  };

  const handleMoveNext = async () => {
    const idx = STAGES.indexOf(lead.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    await patchLead({ stage: STAGES[idx + 1] }, `Moved to ${STAGES[idx + 1]}`);
  };

  const handleReject = async () => {
    await patchLead({ stage: 'Not Qualified', previousStage: lead.stage, notQualifiedReason: rejectReason }, 'Marked as not qualified');
    setShowReject(false);
    setRejectReason('');
  };

  const handleRevert = async () => {
    if (!lead.previousStage) return;
    await patchLead({ stage: lead.previousStage, previousStage: '' }, `Reverted to ${lead.previousStage}`);
  };

  const handleHandover = async (opts) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          name: lead.name, email: lead.email, phone: lead.phone || '', role: [],
          contractType: opts.contractType || 'Retainer',
          spoc: opts.spoc || lead.spoc || '', notes: lead.notes || '',
          priority: lead.priority || 'medium', deadline: opts.deadline || '',
        }),
      });
      if (!res.ok) { addToast('Could not create the onboarding record', 'error'); return; }
      invalidate('onboarding:list');
      await patchLead({
        movedToOnboarding: true,
        onboardingSpoc: opts.spoc || lead.spoc || '',
        onboardingContractType: opts.contractType || 'Retainer',
        onboardedAt: new Date().toISOString(),
      }, `${lead.name} moved to Onboarding`);
      setShowHandover(false);
    } catch (err) {
      console.error('Handover failed:', err);
      addToast('Could not move to onboarding', 'error');
    }
  };

  const handleRestartOnboarding = async () => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/restart/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { addToast('Could not restart onboarding', 'error'); return; }
      applyLead(data.lead);
      invalidate('onboarding:list');
      addToast(`${lead.name} re-added to Onboarding`);
    } catch (err) {
      console.error('Restart onboarding failed:', err);
      addToast('Could not restart onboarding', 'error');
    }
  };

  const toggleSubtask = async (taskId, done) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/leads/${id}/subtasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ done }) });
      const data = await res.json();
      if (res.ok) applyLead(data.lead); else addToast('Could not update the task', 'error');
    } catch (err) { console.error('Subtask toggle failed:', err); addToast('Could not update the task', 'error'); }
  };

  const addSubtask = async () => {
    if (blockGuestAction() || !newTaskText.trim()) return;
    try {
      const res = await authFetch(`/api/leads/${id}/subtasks`, {
        method: 'POST', body: JSON.stringify({ text: newTaskText.trim(), assignee: newTaskAssignee }),
      });
      const data = await res.json();
      if (!res.ok) { addToast('Could not add the task', 'error'); return; }
      applyLead(data.lead);
      setNewTaskText(''); setNewTaskAssignee(''); setAddingTask(false);
      addToast('Sub-task added');
    } catch (err) { console.error('Add subtask failed:', err); addToast('Could not add the task', 'error'); }
  };

  /* ── the four steps ── */
  const current = currentStepOf(lead);
  const steps = useMemo(() => {
    if (!lead) return [];
    const defs = [
      { id: 'details', icon: User, title: 'Lead details', description: 'Who they are and who owns them' },
      { id: 'call', icon: Phone, title: 'First call', description: 'The intro call and what came of it' },
      { id: 'meeting', icon: CalendarCheck, title: 'Meeting', description: 'When you are meeting and what was said' },
      { id: 'handover', icon: ShieldCheck, title: 'Qualify & hand over', description: 'Final checks, then move them on' },
    ];
    return defs.map((d) => ({ ...d, state: stateOf(d.id, lead, currentStepOf(lead)) }));
  }, [lead]);
  const currentIdx = steps.findIndex((st) => st.id === current);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: T.muted }}>Loading lead...</div>;
  }

  if (!lead) {
    return (
      <div style={{ padding: '26px 30px' }}>
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Sales Pipeline', to: '/sales-pipeline' }, { label: 'Not found' }]}
          title="Lead not found"
        />
        <Card>
          <EmptyState icon={XCircle} title="This lead is no longer in the pipeline">
            It may have been deleted, or it belongs to a colleague.{' '}
            <button type="button" onClick={() => navigate('/sales-pipeline')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '13.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Back to the pipeline
            </button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  /* One sentence saying where this lead is in its journey. */
  const journey = lead.movedToOnboarding
    ? { tone: 'green', icon: CheckCircle, text: 'Handed over to the onboarding team. Nothing further is needed here.' }
    : lead.stage === 'Not Qualified'
      ? { tone: 'grey', icon: XCircle, text: `Closed as not qualified${lead.notQualifiedReason ? ` — ${lead.notQualifiedReason}` : ''}.` }
      : currentIdx >= 0
        ? { tone: 'amber', icon: ArrowRight, text: `This lead is at Step ${currentIdx + 1} of ${steps.length} — ${steps[currentIdx].title}. ${steps[currentIdx].description}.` }
        : { tone: 'grey', icon: Circle, text: `This lead is at the “${lead.stage}” stage.` };

  /* The one action this lead is waiting for. Sits in the banner so it is
     reachable from any step, not buried in the last one. */
  const primaryAction = (() => {
    if (lead.movedToOnboarding || lead.stage === 'Not Qualified') return null;
    if (lead.stage === 'Qualified Lead') return { label: 'Move to Onboarding', icon: UserPlus, kind: 'handover' };
    const idx = STAGES.indexOf(lead.stage);
    if (idx >= 0 && idx < STAGES.length - 1) return { label: `Move to ${STAGES[idx + 1]}`, icon: ArrowRight, kind: 'next' };
    return null;
  })();

  const runPrimaryAction = () => {
    if (!primaryAction) return;
    if (primaryAction.kind === 'next') { handleMoveNext(); return; }
    // the handover form lives further down the page — open it and go to it
    setShowHandover(true);
    if (actionsRef.current) actionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const subtasks = lead.subTasks || [];
  const doneTasks = subtasks.filter((t) => t.done).length;
  const stageIdx = STAGES.indexOf(lead.stage);
  const canMoveNext = stageIdx >= 0 && stageIdx < STAGES.length - 1 && lead.stage !== 'Qualified Lead';
  const nextStage = canMoveNext ? STAGES[stageIdx + 1] : null;

  return (
    <div style={{ padding: '26px 30px 50px' }}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', to: '/' },
          { label: 'Sales Pipeline', to: '/sales-pipeline' },
          { label: lead.name },
        ]}
        title={lead.name}
        subtitle={[lead.email, lead.phone].filter(Boolean).join('  ·  ') || 'No contact details recorded'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/sales-pipeline')}>Back</Button>
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
          {lead.priority && lead.priority !== 'medium' && (
            <Pill tone={lead.priority === 'high' ? 'red' : 'grey'}>{lead.priority} priority</Pill>
          )}
          {dirty && <Pill tone="amber">Unsaved changes</Pill>}
          {primaryAction && (
            <Button icon={primaryAction.icon} onClick={runPrimaryAction} style={{ padding: '9px 16px', fontSize: '13px' }}>
              {primaryAction.label}
            </Button>
          )}
        </>}
      >
        {journey.text}
      </Banner>

      <Stepper steps={steps} active={step} onSelect={setStep} />

      {/* ═══ STEP 1 ═══ */}
      {step === 'details' && draft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Card icon={User} title="Lead details" description="Who they are, who owns them, and by when." tone="indigo">
            {/* read-only facts, so they read as information rather than as
                form boxes you are meant to fill in */}
            <FieldGrid min="190px">
              <Field icon={User} label="Name">{lead.name}</Field>
              <Field icon={Mail} label="Email">{lead.email || '—'}</Field>
              <Field icon={Phone} label="Phone">{lead.phone || 'Not recorded'}</Field>
              <Field icon={CalendarCheck} label="Added on">{fmtDate(lead.createdAt) || '—'}</Field>
            </FieldGrid>
            <p style={{ fontSize: '12px', color: T.faint, margin: '10px 0 22px' }}>
              Name, email and phone are managed on the Members page.
            </p>

            <FormGrid>
              <Select label="Owner (SPOC)" value={draft.spoc} onChange={(e) => set('spoc', e.target.value)}>
                <option value="">Unassigned</option>
                {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
              </Select>
              <Select label="Lead source" value={draft.source} onChange={(e) => set('source', e.target.value)}>
                <option value="">Not set</option>
                {sourceList.map((sName) => <option key={sName} value={sName}>{sName}</option>)}
              </Select>
              <Select label="Priority" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
              <Input label="Genre" placeholder="e.g. Bollywood Playback" value={draft.genre} onChange={(e) => set('genre', e.target.value)} />
              <Input label="Deadline" type="date" value={draft.deadline} onChange={(e) => set('deadline', e.target.value)} style={{ colorScheme: 'dark' }} />
              <Textarea label="Notes" span placeholder="Anything worth remembering about this lead..." value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </FormGrid>
          </Card>
        </div>
      )}

      {/* ═══ STEP 2 ═══ */}
      {step === 'call' && draft && (
        <Card icon={Phone} title="First call" description="Tick this off once you have actually spoken to them." tone="blue">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Check
              checked={!!lead.callDone}
              label="Intro call done"
              subtitle={lead.callDone ? 'Saved as soon as you tick it' : 'Nobody has spoken to them yet'}
              onToggle={() => patchLead({ callDone: !lead.callDone }, lead.callDone ? 'Call marked as not done' : 'Call marked as done')}
            />
            <FormGrid>
              <Textarea
                label="Call notes" span
                placeholder="What did they ask for? What did you promise?"
                value={draft.inquiryNotes}
                onChange={(e) => set('inquiryNotes', e.target.value)}
              />
            </FormGrid>
          </div>
        </Card>
      )}

      {/* ═══ STEP 3 ═══ */}
      {step === 'meeting' && draft && (
        <Card icon={CalendarCheck} title="Meeting" description="Put the meeting in the diary and record what came out of it." tone="teal">
          <FormGrid>
            <Input label="Meeting date" type="date" value={toDateInput(draft.meetingDate) || draft.meetingDate} onChange={(e) => set('meetingDate', e.target.value)} style={{ colorScheme: 'dark' }} />
            <Select label="Meeting with" value={draft.meetingAssignedWith} onChange={(e) => set('meetingAssignedWith', e.target.value)}>
              <option value="">Not set</option>
              {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
            </Select>
            <Input label="Meeting link" span placeholder="https://meet.google.com/..." value={draft.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} />
            <Textarea label="Meeting notes" span placeholder="What was agreed?" value={draft.meetingNotes} onChange={(e) => set('meetingNotes', e.target.value)} />
          </FormGrid>
          {lead.meetingLink && (
            <a
              href={lead.meetingLink} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '14px', fontSize: '13px', color: '#818cf8' }}
            >
              <ExternalLink style={{ width: '14px', height: '14px' }} /> Open the saved meeting link
            </a>
          )}
        </Card>
      )}

      {/* ═══ STEP 4 ═══ */}
      {step === 'handover' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Card icon={ShieldCheck} title="Final checks" description="Confirm the earlier steps really are complete." tone="green">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Check
                checked={!!lead.inquiryVerified}
                label="Enquiry verified"
                subtitle={`Call: ${lead.callDone ? 'done' : 'not done'} · Notes: ${lead.inquiryNotes ? 'added' : 'none'}`}
                onToggle={() => patchLead({ inquiryVerified: !lead.inquiryVerified })}
              />
              <Check
                checked={!!lead.meetingVerified}
                label="Meeting verified"
                subtitle={`Date: ${fmtDate(lead.meetingDate) || 'not set'} · Link: ${lead.meetingLink ? 'added' : 'none'} · With: ${lead.meetingAssignedWith || 'not set'}`}
                onToggle={() => patchLead({ meetingVerified: !lead.meetingVerified })}
              />
            </div>
            <div style={{ marginTop: '16px' }}>
              <FieldGrid>
                <Field icon={Phone} label="Call">{lead.callDone ? 'Done' : 'Not done'}</Field>
                <Field icon={CalendarCheck} label="Meeting date">{fmtDate(lead.meetingDate) || 'Not set'}</Field>
                <Field icon={User} label="Owner">{lead.spoc || 'Unassigned'}</Field>
              </FieldGrid>
            </div>
          </Card>

          <Card
            icon={CheckSquare} title="Sub-tasks"
            description={subtasks.length ? `${doneTasks} of ${subtasks.length} done` : 'Break the work down if it helps.'}
            tone="indigo"
            actions={<Button variant="ghost" icon={Plus} onClick={() => setAddingTask(true)} style={{ padding: '8px 14px', fontSize: '13px' }}>Add</Button>}
          >
            {subtasks.length > 0 && (
              <div style={{ height: '4px', background: T.border, borderRadius: '2px', marginBottom: '16px' }}>
                <div style={{ height: '100%', borderRadius: '2px', background: T.accent, width: `${(doneTasks / subtasks.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {subtasks.map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => toggleSubtask(task._id, !task.done)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                  }}
                >
                  {task.done
                    ? <CheckSquare style={{ width: '17px', height: '17px', color: TONES.green.fg, flexShrink: 0 }} />
                    : <Square style={{ width: '17px', height: '17px', color: T.faint, flexShrink: 0 }} />}
                  <span style={{ flex: 1, fontSize: '14px', color: task.done ? T.faint : T.body, textDecoration: task.done ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                  {task.assignee && <span style={{ fontSize: '12px', color: T.faint }}>{task.assignee}</span>}
                </button>
              ))}
              {subtasks.length === 0 && !addingTask && (
                <p style={{ fontSize: '13.5px', color: T.faint, padding: '6px 0' }}>No sub-tasks yet.</p>
              )}
            </div>

            {addingTask && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input label="What needs doing?" autoFocus value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Describe the sub-task..." />
                <FormGrid min="200px">
                  <Select label="Assign to" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}>
                    <option value="">Nobody in particular</option>
                    {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
                  </Select>
                </FormGrid>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => { setAddingTask(false); setNewTaskText(''); setNewTaskAssignee(''); }}>Cancel</Button>
                  <Button icon={Plus} onClick={addSubtask}>Add sub-task</Button>
                </div>
              </div>
            )}
          </Card>

        </div>
      )}

      {/* ═══ Always on show: whatever step you are reading, the ways to move
             this lead on are right here. ═══ */}
      <div ref={actionsRef} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '18px' }}>
        <Card icon={ArrowRight} title="Move this lead on" description="These take effect straight away." tone="amber">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {canMoveNext && (
              <Button icon={ArrowRight} onClick={handleMoveNext}>Move to {nextStage}</Button>
            )}
            {lead.stage === 'Qualified Lead' && !lead.movedToOnboarding && (
              <Button icon={UserPlus} onClick={() => setShowHandover(true)}>Move to Onboarding</Button>
            )}
            {lead.stage === 'Not Qualified' && lead.previousStage && (
              <Button
                variant="ghost"
                icon={ArrowRight}
                onClick={lead.movedToOnboarding ? handleRestartOnboarding : handleRevert}
              >
                {lead.movedToOnboarding ? 'Re-start onboarding' : `Revert to ${lead.previousStage}`}
              </Button>
            )}
            {lead.stage !== 'Not Qualified' && !lead.movedToOnboarding && (
              <Button variant="ghost" icon={XCircle} onClick={() => setShowReject(true)} style={{ color: TONES.red.fg }}>
                Not qualified
              </Button>
            )}
          </div>

          {showHandover && (
            <HandoverPanel lead={lead} teamMembers={teamMembers} onCancel={() => setShowHandover(false)} onConfirm={handleHandover} />
          )}

          {showReject && (
            <div style={{ background: T.bg, border: `1px solid ${TONES.red.bd}`, borderRadius: '12px', padding: '18px', marginTop: '14px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: TONES.red.fg, marginBottom: '12px' }}>Mark {lead.name} as not qualified?</p>
              <Textarea label="Reason (optional)" span placeholder="e.g. Budget constraints, not a good fit..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ minHeight: '70px' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <Button variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                <Button icon={XCircle} onClick={handleReject} style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>Confirm</Button>
              </div>
            </div>
          )}

          {lead.notQualifiedReason && (
            <p style={{ marginTop: '14px', fontSize: '13px', color: T.muted }}>
              <span style={{ ...LABEL, marginRight: '8px' }}>Reason</span>{lead.notQualifiedReason}
            </p>
          )}
          {/* Deleting had its own bordered card with a red icon chip — far too
              much shouting for an action nobody uses twice. A quiet line now. */}
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '18px', paddingTop: '16px' }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', color: TONES.red.fg }}>
                  Delete {lead.name} permanently? This cannot be undone.
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
                <Trash2 style={{ width: '13px', height: '13px' }} /> Delete this lead
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LeadDetail;
