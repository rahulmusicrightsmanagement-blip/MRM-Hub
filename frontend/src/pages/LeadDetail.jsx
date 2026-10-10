import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, CalendarCheck, ShieldCheck, Plus, Save, Trash2, ArrowRight,
  XCircle, UserPlus, CheckCircle, Circle, CheckSquare, Square, X, ExternalLink,
  StickyNote, Video, Clock, Users, Flag, Milestone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { T, TONES, LABEL, SP, ROW_PAD } from '../theme';
import {
  PageHeader, Button, Card, Stepper, FormGrid, Input, Textarea, Select,
  Pill, Field, EmptyState, Banner,
  SubHead, Avatar, PersonChip, ContactRow, Choice, DateTile, Ring, ActionTile, Summary,
  PageBody, StagePicker, ListPanel, DecisionRow,
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

/* "in 5 days" / "3 days ago" — a date you have to subtract from is a date
   nobody reads. Returns '' for anything unparseable, because imported records
   carry junk in their date fields. */
const relDay = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(t) - startOf(new Date())) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
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

/* A step is locked when the lead has not reached it yet.
   ─────────────────────────────────────────────────────────────
   Locking follows where the RECORD is, never where you have browsed, so
   going back to an earlier stage locks the later ones again. It is purely a
   navigation rule: nothing is ever cleared, so anything already filled in on
   a step that re-locks is still there when the lead returns to it.

   "Lead details" is never locked — it is the lead itself, not a stage. Once
   the journey is over the whole record is readable, because locking an
   archived lead would only get in the way of reading it. */
const lockedSteps = (lead) => {
  if (!lead || lead.movedToOnboarding || lead.stage === 'Not Qualified') return new Set();
  const here = STEP_ORDER.indexOf(currentStepOf(lead));
  if (here < 0) return new Set();
  return new Set(STEP_ORDER.filter((id, i) => i > here && id !== 'details'));
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

/* Priority carries a meaning you can see. A <Select> hides all three options
   behind a click and renders "High" in exactly the same grey as "Low". */
const PRIORITY_CHOICES = [
  { value: 'high', label: 'High', tone: 'red', hint: 'Chase this one first' },
  { value: 'medium', label: 'Medium', tone: 'amber', hint: 'Normal pace' },
  { value: 'low', label: 'Low', tone: 'teal', hint: 'No rush' },
];

/* An <a> dressed as a ghost button — for the two places a step offers to do
   the thing it is asking about (ring them, join the call). It has to be a
   link rather than a <Button>, and it has to sit outside the tick button,
   since an anchor inside a button is neither valid nor clickable. */
const LINK_BUTTON = {
  display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0,
  padding: '10px 15px', borderRadius: '9px', textDecoration: 'none',
  background: T.surface, border: `1px solid ${T.borderHi}`,
  color: T.body, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
};

/* ═══════════════════════════════════════════
   HAND OVER TO ONBOARDING
   ═══════════════════════════════════════════ */
const HandoverPanel = ({ lead, teamMembers, onCancel, onConfirm }) => {
  const [spoc, setSpoc] = useState(lead.spoc || '');
  const [contractType, setContractType] = useState('Retainer');
  const [deadline, setDeadline] = useState('');

  return (
    <div style={{ background: T.bg, border: `1px solid ${TONES.green.bd}`, borderRadius: '12px', padding: '18px', marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Avatar name={lead.name} size={34} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: T.heading }}>Move {lead.name} to Onboarding</p>
      </div>
      <FormGrid min="200px">
        <Select label="Assign SPOC" value={spoc} onChange={(e) => setSpoc(e.target.value)}>
          <option value="">Select SPOC...</option>
          {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
        </Select>
        <Select label="Contract type" value={contractType} onChange={(e) => setContractType(e.target.value)}>
          {['Retainer', 'Royalty', 'Work-Based', 'Inhouse'].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ colorScheme: 'light' }} />
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

  /* The handover and reject forms are raised from the rail but rendered at the
     top of the work column, so they only exist once the flag is set — the
     scroll has to happen after that render, not in the click handler. */
  useEffect(() => {
    if (showHandover || showReject) actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [showHandover, showReject]);

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
    const next = STAGES[idx + 1];
    if (await patchLead({ stage: next }, `Moved to ${next}`)) showStageFor(next);
  };

  /* Move to any stage, in either direction. Going forward is still one step
     at a time so nobody skips a stage by accident; going back is unrestricted,
     because a stepper that will not let you return is the single most common
     complaint about the pattern. Coming back out of "Not Qualified" also
     forgets where it was closed from — that is what reverting means. */
  const handleMoveToStage = async (stage) => {
    if (!lead || stage === lead.stage) return;
    const fields = { stage };
    if (lead.stage === 'Not Qualified') fields.previousStage = '';
    if (await patchLead(fields, `Moved to ${stage}`)) showStageFor(stage);
  };

  /* Moving the record moves what you are reading with it, forwards or back.
     The step panel is only chosen for you here and on first load — clicking a
     step on the rail still just changes the view, because that is a different
     intent and merging the two is what made the stepper confusing before. */
  function showStageFor(stage) {
    setStep(STEP_BY_STAGE[stage] || 'details');
  }

  const handleReject = async () => {
    await patchLead({ stage: 'Not Qualified', previousStage: lead.stage, notQualifiedReason: rejectReason }, 'Marked as not qualified');
    setShowReject(false);
    setRejectReason('');
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
    const shut = lockedSteps(lead);
    return defs.map((d) => ({
      ...d,
      state: stateOf(d.id, lead, currentStepOf(lead)),
      locked: shut.has(d.id),
      lockedHint: `${d.title} unlocks when this lead reaches that stage`,
    }));
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
            <button type="button" onClick={() => navigate('/sales-pipeline')} style={{ background: 'none', border: 'none', color: T.accent, fontSize: '13.5px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
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
    setShowHandover(true);
  };

  const subtasks = lead.subTasks || [];
  const doneTasks = subtasks.filter((t) => t.done).length;

  /* The lead has left the pipeline — onboarded, or closed. */
  const finished = !!lead.movedToOnboarding || lead.stage === 'Not Qualified';

  /* A deadline only means something while the lead is still live. Roughly 240
     of these records are bulk-imported archive whose deadline lapsed months
     ago and never mattered, so a finished lead is shown no countdown at all. */
  const deadlineRel = finished ? '' : relDay(draft.deadline);
  const deadlineHint = deadlineRel
    ? (
      <span style={{ color: deadlineRel.endsWith('ago') || deadlineRel === 'yesterday' ? TONES.red.fg : TONES.amber.fg }}>
        {deadlineRel.endsWith('ago') || deadlineRel === 'yesterday' ? `Overdue — was due ${deadlineRel}` : `Due ${deadlineRel}`}
      </span>
    )
    : undefined;

  /* The meeting, read at a glance. The date follows the draft so the tile
     moves as you pick one; meetingDate is free text on imported records, so
     an unparseable value is shown as itself rather than swallowed. */
  const meetingRelText = relDay(draft.meetingDate);
  const meetingHeadline = fmtDate(draft.meetingDate)
    ? `Meeting on ${fmtDate(draft.meetingDate)}`
    : draft.meetingDate || 'No meeting in the diary yet';
  const meetingRel = !meetingRelText
    ? null
    : meetingRelText.endsWith('ago') || meetingRelText === 'yesterday'
      ? { label: meetingRelText, tone: 'grey' }
      : meetingRelText === 'today'
        ? { label: 'today', tone: 'amber' }
        : { label: meetingRelText, tone: 'teal' };

  const checksDone = (lead.inquiryVerified ? 1 : 0) + (lead.meetingVerified ? 1 : 0);

  /* Every way this lead can be moved on, each stated with its consequence.
     Built once and rendered below the stepper on every step — a lead sitting
     at step 2 must never have its next action buried in step 4. */
  const moveActions = [];
  if (lead.stage === 'Qualified Lead' && !lead.movedToOnboarding) moveActions.push({
    key: 'handover', icon: UserPlus, tone: 'green', title: 'Move to Onboarding',
    subtitle: 'Creates the onboarding record. The lead stays here for reference.',
    onClick: () => setShowHandover(true),
  });
  /* Reverting a closed lead is now just "pick an earlier stage" in the picker,
     so only the one thing the picker cannot do is left here. */
  if (lead.stage === 'Not Qualified' && lead.previousStage && lead.movedToOnboarding) moveActions.push({
    key: 'restart', icon: UserPlus, tone: 'teal', title: 'Re-start onboarding',
    subtitle: 'Puts this artist back into the onboarding queue.',
    onClick: handleRestartOnboarding,
  });
  if (lead.stage !== 'Not Qualified' && !lead.movedToOnboarding) moveActions.push({
    key: 'reject', icon: XCircle, tone: 'red', title: 'Not qualified',
    subtitle: 'Closes the lead. Reopen it any time from the stage list above.',
    onClick: () => setShowReject(true),
  });
  /* Nothing in the app linked the two records together, so a handed-over lead
     was a dead end. The Onboarding list reads ?q= on load, so this lands on
     the artist rather than on 240 rows of archive. */
  if (lead.movedToOnboarding) moveActions.push({
    key: 'view', icon: ExternalLink, tone: 'teal', title: 'View in Onboarding',
    subtitle: 'Opens the onboarding list filtered to this artist.',
    to: `/onboarding?q=${encodeURIComponent(lead.name || '')}`,
  });

  /* "Not Qualified" is a stage, but closing a lead asks for a reason, so it is
     not something the picker should do silently — it stays an action. */
  const pipelineStages = STAGES.filter((st) => st !== 'Not Qualified');
  const allowStage = (stage, i, here) => {
    if (here < 0) return true;      // the lead is closed: any stage reopens it
    if (i < here) return true;      // back to anywhere
    if (i === here + 1) return true; // forward one at a time
    return `Move to ${pipelineStages[here + 1]} first — a lead advances one stage at a time.`;
  };

  /* What became of a finished lead. None of this appeared anywhere in the app
     before, and none of it repeats the banner at the top of the page. */
  const finishedFacts = [];
  if (lead.movedToOnboarding) {
    finishedFacts.push({ key: 'when', icon: CalendarCheck, label: 'Handed over', value: fmtDate(lead.onboardedAt) || 'Date not recorded' });
    finishedFacts.push({ key: 'spoc', icon: User, label: 'Onboarding SPOC', value: lead.onboardingSpoc || 'Unassigned' });
    finishedFacts.push({ key: 'contract', icon: ShieldCheck, label: 'Contract', value: lead.onboardingContractType || 'Not set' });
  }
  if (lead.stage === 'Not Qualified' && lead.previousStage) {
    finishedFacts.push({ key: 'was', icon: ArrowRight, label: 'Closed from', value: lead.previousStage });
  }

  return (
    // capped, because a card stretched across 1600px reads as an empty rectangle
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
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
            <Button icon={Save} onClick={handleSave} disabled={!dirty || saving}>
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

      <Stepper
        steps={steps}
        active={step}
        onSelect={setStep}
        onLocked={(st) => addToast(
          `${st.title} is locked until this lead reaches that stage. Use the Stage panel on the right to move it on.`,
          'error',
        )}
      />

      <PageBody
        rail={(
          <>
            {/* Who this is, pinned. It used to live inside step 1, which meant
                that from step 2 onward you could not see whose lead you were
                working on. */}
            <Card icon={User} title="Who this is" tone="indigo" bodyStyle={{ padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Avatar name={lead.name} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: T.heading, lineHeight: 1.25, wordBreak: 'break-word' }}>
                    {lead.name || 'Unnamed lead'}
                  </div>
                  <div style={{ fontSize: '12px', color: T.faint, marginTop: '2px' }}>
                    {draft.genre || 'No genre recorded'}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '2px' }}>
                <ContactRow
                  icon={Mail} label="Email" tone="blue" empty="No email"
                  value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined}
                />
                <ContactRow
                  icon={Phone} label="Phone" tone="teal" empty="No phone"
                  value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined}
                />
                <ContactRow icon={CalendarCheck} label="Added on" tone="grey" empty="Unknown" value={fmtDate(lead.createdAt)} />
              </div>
              <p style={{ fontSize: '11px', color: T.faint, marginTop: '10px', lineHeight: 1.5 }}>
                Name, email and phone are managed on the Members page.
              </p>
            </Card>

            {/* Forward one, back to anywhere. */}
            <Card
              icon={Milestone} title="Stage" tone="amber"
              description="Forward one step at a time; back to any earlier one."
              bodyStyle={{ padding: '15px 17px' }}
            >
              <StagePicker
                stages={pipelineStages}
                current={lead.stage}
                onSelect={handleMoveToStage}
                allow={allowStage}
                onBlocked={(stage, why) => addToast(why, 'error')}
              />
              {lead.stage === 'Not Qualified' && (
                <p style={{ fontSize: '12px', color: T.faint, marginTop: '11px', lineHeight: 1.5 }}>
                  This lead is closed. Picking any stage above reopens it.
                </p>
              )}

              {moveActions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {moveActions.map((a) => (
                    <ActionTile
                      key={a.key} icon={a.icon} tone={a.tone}
                      title={a.title} subtitle={a.subtitle}
                      onClick={a.onClick} to={a.to}
                    />
                  ))}
                </div>
              )}

              {finishedFacts.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${T.border}` }}>
                  <SubHead icon={ShieldCheck}>On the record</SubHead>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {finishedFacts.map((f) => (
                      <Field key={f.key} icon={f.icon} label={f.label}>{f.value}</Field>
                    ))}
                  </div>
                </div>
              )}

              {/* Deleting stays a quiet line, never its own bordered card. */}
              <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '16px', paddingTop: '14px' }}>
                {confirmDelete ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: TONES.red.fg, lineHeight: 1.5 }}>
                      Delete {lead.name} permanently? This cannot be undone.
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: T.faint, fontSize: '12.5px', cursor: 'pointer', padding: 0 }}
                  >
                    <Trash2 style={{ width: '13px', height: '13px' }} /> Delete this lead
                  </button>
                )}
              </div>
            </Card>
          </>
        )}
      >
        {/* Raised from the rail, but rendered here — a three-field form does
            not belong in a 330px column. */}
        {(showHandover || showReject) && (
          <div ref={actionsRef}>
            {showHandover && (
              <Card icon={UserPlus} title={`Move ${lead.name} to Onboarding`} tone="green" description="Creates the onboarding record. The lead stays here for reference.">
                <HandoverPanel lead={lead} teamMembers={teamMembers} onCancel={() => setShowHandover(false)} onConfirm={handleHandover} />
              </Card>
            )}
            {showReject && (
              <Card icon={XCircle} title={`Mark ${lead.name} as not qualified?`} tone="red" description="Closes the lead. You can reopen it from the stage list at any time.">
                <Textarea label="Reason (optional)" span placeholder="e.g. Budget constraints, not a good fit..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ minHeight: '70px' }} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <Button variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                  <Button variant="danger" icon={XCircle} onClick={handleReject}>Confirm</Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ STEP 1 ═══ */}
        {step === 'details' && draft && (
          <Card icon={User} title="Lead details" description="Who owns this lead, and by when." tone="indigo">
            <SubHead icon={Users}>Ownership</SubHead>
            <FormGrid min="280px">
              <Select label="Owner (SPOC)" value={draft.spoc} onChange={(e) => set('spoc', e.target.value)}>
                <option value="">Unassigned</option>
                {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
              </Select>
              <Select label="Lead source" value={draft.source} onChange={(e) => set('source', e.target.value)}>
                <option value="">Not set</option>
                {sourceList.map((sName) => <option key={sName} value={sName}>{sName}</option>)}
              </Select>
            </FormGrid>

            <SubHead icon={Flag} style={{ marginTop: '24px' }}>Priority &amp; timing</SubHead>
            <FormGrid min="280px">
              <Choice label="Priority" options={PRIORITY_CHOICES} value={draft.priority} onChange={(v) => set('priority', v)} />
              <Input
                label="Deadline" type="date" value={draft.deadline} hint={deadlineHint}
                onChange={(e) => set('deadline', e.target.value)} style={{ colorScheme: 'light' }}
              />
              <Input label="Genre" placeholder="e.g. Bollywood Playback" value={draft.genre} onChange={(e) => set('genre', e.target.value)} />
            </FormGrid>

            <SubHead icon={StickyNote} style={{ marginTop: '24px' }}>Notes</SubHead>
            <Textarea
              span placeholder="Anything worth remembering about this lead..."
              value={draft.notes} onChange={(e) => set('notes', e.target.value)}
            />
          </Card>
        )}

        {/* ═══ STEP 2 ═══ */}
        {step === 'call' && draft && (
          <Card icon={Phone} title="First call" description="Answer the one question this step asks, then write down what came of it." tone="blue">
            <ListPanel>
              <DecisionRow
                icon={Phone}
                question="Has the intro call happened?"
                help="Saves the moment you answer. Nothing else on this step needs it."
                value={!!lead.callDone}
                onChange={(v) => patchLead({ callDone: v }, v ? 'Call marked as done' : 'Call marked as not done')}
                facts={[
                  { label: 'Owner', value: lead.spoc || 'Unassigned', tone: lead.spoc ? undefined : 'grey' },
                  { label: 'Notes', value: draft.inquiryNotes ? 'Written' : 'None yet', tone: draft.inquiryNotes ? 'green' : 'grey' },
                ]}
                action={lead.phone && (
                  <a href={`tel:${lead.phone}`} className="sc-tile" style={LINK_BUTTON}>
                    <Phone style={{ width: '15px', height: '15px' }} /> Call
                  </a>
                )}
              />
            </ListPanel>

            <SubHead icon={StickyNote} style={{ marginTop: '24px' }}>What came of it</SubHead>
            <Textarea
              span placeholder="What did they ask for? What did you promise?"
              value={draft.inquiryNotes} onChange={(e) => set('inquiryNotes', e.target.value)}
            />
          </Card>
        )}

        {/* ═══ STEP 3 ═══ */}
        {step === 'meeting' && draft && (
          <Card icon={CalendarCheck} title="Meeting" description="Put the meeting in the diary and record what came out of it." tone="teal">
            <div style={{
              display: 'flex', alignItems: 'center', gap: SP.base, flexWrap: 'wrap',
              background: T.bg, border: `1px solid ${T.border}`, borderRadius: '12px', padding: ROW_PAD,
            }}>
              <DateTile date={draft.meetingDate} tone="teal" />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: T.heading, wordBreak: 'break-word' }}>
                  {meetingHeadline}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '9px' }}>
                  {meetingRel && <Pill tone={meetingRel.tone} icon={Clock}>{meetingRel.label}</Pill>}
                  <PersonChip name={draft.meetingAssignedWith} empty="Nobody assigned yet" />
                </div>
              </div>
              {/* the saved link, never the half-typed one in the draft */}
              {lead.meetingLink && (
                <a href={lead.meetingLink} target="_blank" rel="noreferrer" className="sc-tile" style={LINK_BUTTON}>
                  <Video style={{ width: '15px', height: '15px' }} /> Join meeting
                </a>
              )}
            </div>

            <SubHead icon={CalendarCheck} style={{ marginTop: '24px' }}>The diary entry</SubHead>
            <FormGrid min="280px">
              <Input label="Meeting date" type="date" value={toDateInput(draft.meetingDate) || draft.meetingDate} onChange={(e) => set('meetingDate', e.target.value)} style={{ colorScheme: 'light' }} />
              <Select label="Meeting with" value={draft.meetingAssignedWith} onChange={(e) => set('meetingAssignedWith', e.target.value)}>
                <option value="">Not set</option>
                {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
              </Select>
              <Input label="Meeting link" placeholder="https://meet.google.com/..." value={draft.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} />
            </FormGrid>

            <SubHead icon={StickyNote} style={{ marginTop: '24px' }}>What was agreed</SubHead>
            <Textarea span placeholder="What was agreed?" value={draft.meetingNotes} onChange={(e) => set('meetingNotes', e.target.value)} />
          </Card>
        )}

        {/* ═══ STEP 4 ═══ */}
        {step === 'handover' && (
          <>
            <Card icon={ShieldCheck} title="Final checks" description="Two questions. Answer both and this lead is ready to hand over." tone="green">
              <Summary
                left={<Ring value={checksDone} total={2} tone={checksDone === 2 ? 'green' : 'amber'} caption="checks" />}
                headline={checksDone === 2 ? 'Ready to hand over.' : 'Not ready to hand over yet.'}
                detail={checksDone === 2
                  ? 'Both answers are yes. "Move to Onboarding" is in the Stage panel.'
                  : 'Answer yes once you are satisfied the work behind each one was done.'}
                right={(
                  <div>
                    <div style={{ ...LABEL, marginBottom: '6px' }}>Owner</div>
                    <PersonChip name={lead.spoc} size={26} />
                  </div>
                )}
              />

              <ListPanel>
                <DecisionRow
                  icon={Phone}
                  question="Is the enquiry verified?"
                  help="The intro call happened, and what came of it is written down."
                  value={!!lead.inquiryVerified}
                  onChange={(v) => patchLead({ inquiryVerified: v })}
                  facts={[
                    { label: 'Call', value: lead.callDone ? 'Done' : 'Not done', tone: lead.callDone ? 'green' : 'red' },
                    { label: 'Notes', value: lead.inquiryNotes ? 'Written' : 'None', tone: lead.inquiryNotes ? 'green' : 'grey' },
                  ]}
                />
                <DecisionRow
                  icon={CalendarCheck}
                  question="Is the meeting verified?"
                  help="The meeting is in the diary, with someone attached to it."
                  value={!!lead.meetingVerified}
                  onChange={(v) => patchLead({ meetingVerified: v })}
                  facts={[
                    {
                      label: 'Date',
                      value: fmtDate(lead.meetingDate) || (lead.meetingDate ? String(lead.meetingDate).slice(0, 20) : 'Not set'),
                      tone: lead.meetingDate ? 'green' : 'red',
                    },
                    { label: 'Link', value: lead.meetingLink ? 'Added' : 'None', tone: lead.meetingLink ? 'green' : 'grey' },
                    { label: 'With', value: lead.meetingAssignedWith || 'Nobody', tone: lead.meetingAssignedWith ? 'green' : 'grey' },
                  ]}
                />
              </ListPanel>
            </Card>

            <Card
              icon={CheckSquare} title="Sub-tasks"
              description={subtasks.length ? `${doneTasks} of ${subtasks.length} done` : 'Break the work down if it helps.'}
              tone="indigo"
              actions={<Button variant="ghost" icon={Plus} onClick={() => setAddingTask(true)} style={{ padding: '8px 14px', fontSize: '13px' }}>Add</Button>}
            >
              {subtasks.length > 0 && (
                <div style={{
                  height: '6px', background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: '4px', marginBottom: '16px', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', background: T.accentGradient,
                    width: `${(doneTasks / subtasks.length) * 100}%`, transition: 'width 0.35s ease',
                  }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {subtasks.map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    className="sc-row"
                    onClick={() => toggleSubtask(task._id, !task.done)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '9px 10px',
                    }}
                  >
                    {task.done
                      ? <CheckSquare style={{ width: '17px', height: '17px', color: TONES.green.fg, flexShrink: 0 }} />
                      : <Square style={{ width: '17px', height: '17px', color: T.faint, flexShrink: 0 }} />}
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', color: task.done ? T.faint : T.body, textDecoration: task.done ? 'line-through' : 'none' }}>
                      {task.text}
                    </span>
                    {task.assignee && <PersonChip name={task.assignee} size={20} />}
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
          </>
        )}
      </PageBody>
    </div>
  );
};

export default LeadDetail;
