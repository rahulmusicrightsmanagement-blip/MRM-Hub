import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mail, Phone, FileText, Shield, ExternalLink, Calendar, User, Globe,
  RefreshCw, Trash2, IdCard, Music, TrendingUp, UserPlus, CheckCircle2,
  AlertTriangle, X, Landmark, ListChecks, Sparkles, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { useUrlState } from '../hooks/useUrlState';
import { journeyStages } from '../components/onboardingStyles';
import { T, TONES, LABEL } from '../theme';
import {
  PageHeader, Button, Card, Pill, Banner, Segmented, EmptyState, Avatar,
  ContactRow, Field, FieldGrid, SubHead, ListPanel, ListRow, Collapsible,
  ProgressBar, Ring, MicroFacts, PageBody, Input, Summary,
} from '../components/studio';

/* Imported records carry junk dates, so this never renders "Invalid Date". */
const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_TONES = { Active: 'green', Onboarding: 'amber', Inactive: 'grey' };
const KYC_TONES = { Verified: 'green', Pending: 'amber', Rejected: 'red' };
const STAGE_TONES = {
  'New Enquiry': 'blue', 'Meeting Set': 'amber', 'Qualified Lead': 'green', 'Not Qualified': 'red',
  'Document Submission': 'blue', 'KYC Verification': 'amber', 'Contract Signing': 'purple',
  'Active Member': 'green', 'Contact Made': 'teal', Completed: 'green',
};
const REG_TONES = {
  Registered: 'green', 'In Progress': 'amber', Overdue: 'red', 'Not Started': 'grey', 'N/A': 'grey',
};

const VIEW_DEFAULTS = { tab: 'overview' };

const roleText = (r) => {
  const list = Array.isArray(r) ? r : (r ? [r] : []);
  return list.filter(Boolean).join(', ');
};

/* ─── A file that lives on Drive ─── */
const DocLink = ({ url, name, label = 'Open' }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={name ? `Open ${name}` : label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0,
        padding: '3px 9px', borderRadius: '7px', textDecoration: 'none',
        background: TONES.blue.bg, border: `1px solid ${TONES.blue.bd}`,
        color: TONES.blue.fg, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      }}
    >
      <ExternalLink style={{ width: '11px', height: '11px' }} /> File
    </a>
  );
};

/* ─── "Go to the record this came from" ─── */
/* The label used to read "Open Onboarding Modal". Those modals were replaced by
   real pages a while back, so it named a thing that no longer exists — and it
   routed through the notification deeplink rather than straight to the record.
   Sales and Onboarding have their own routes now; Society and Music Works do
   not, so those two still deeplink. */
const RecordLink = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '6px 11px', borderRadius: '8px', whiteSpace: 'nowrap',
      border: `1px solid ${T.border}`, background: T.surface,
      color: T.body, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    }}
  >
    <ExternalLink style={{ width: '12px', height: '12px' }} /> {label}
  </button>
);

/**
 * What has actually been done on an onboarding entry.
 *
 * This used to read `entry.checklist`, which the model itself labels "legacy
 * (backward compat)" — nothing in the app has written it for a long time, so
 * every member showed five empty circles no matter how far along they were.
 * A record marked *Completed*, with every document ticked Received and the
 * contract signed, still reported nothing done. It is computed from the same
 * fields the Onboarding page writes, so the two pages can never disagree.
 */
const progressOf = (entry, stages) => {
  const docs = Array.isArray(entry.documents) ? entry.documents : [];
  const here = stages.indexOf(entry.stage);
  const reached = (stage) => here >= 0 && here >= stages.indexOf(stage);
  return [
    { label: 'Documents requested', done: docs.length > 0 && docs.every((d) => d.requested) },
    { label: 'Documents received', done: docs.length > 0 && docs.every((d) => d.received) },
    { label: 'Contract signed', done: !!(entry.contractSent && entry.contractReceived) },
    { label: 'Reviewed', done: reached('Active Member') },
    { label: 'Client set up', done: !!(entry.addedToWhatsApp && entry.emailCreated) },
  ];
};

/** One derived tick, said in words. */
const Tick = ({ done, children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontSize: '12.5px', fontWeight: 600,
    color: done ? TONES.green.fg : T.faint,
  }}>
    <span style={{
      width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: done ? TONES.green.fg : 'transparent',
      border: done ? 'none' : `1.5px solid ${T.borderHi}`,
      color: T.surface, fontSize: '9px', fontWeight: 900, lineHeight: 1,
    }}>
      {done ? '✓' : ''}
    </span>
    {children}
  </span>
);

const DerivedChecklist = ({ entry, stages }) => {
  const items = progressOf(entry, stages);
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <SubHead icon={ListChecks}>Progress · {done} of {items.length}</SubHead>
      <div style={{ marginBottom: '12px' }}>
        <ProgressBar value={done} total={items.length} tone={done === items.length ? 'green' : 'indigo'} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
        {items.map((i) => <Tick key={i.label} done={i.done}>{i.label}</Tick>)}
      </div>
    </div>
  );
};

/* ─── Sync name, as a dialog rather than a browser prompt ─── */
const SyncNameDialog = ({ name, busy, onClose, onConfirm }) => {
  const [previousName, setPreviousName] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div
      onClick={() => !busy && onClose()}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(27, 94, 32, 0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 60, padding: '24px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sync ${name} across the app`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: '16px', width: '100%', maxWidth: '460px',
          border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(27, 94, 32, 0.18)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{
            width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: TONES.indigo.bg, border: `1px solid ${TONES.indigo.bd}`, color: TONES.indigo.fg,
          }}>
            <RefreshCw style={{ width: '17px', height: '17px' }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.heading }}>Sync this name everywhere</h3>
            <p style={{ fontSize: '12.5px', color: T.faint, marginTop: '2px' }}>
              Sales Pipeline, Onboarding, Society Reg., Music Works and Client Tasks.
            </p>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: T.muted, lineHeight: 1.5, margin: '4px 0 16px' }}>
          Records that still name <strong style={{ color: T.body }}>{name}</strong> will be left alone —
          they already match. Fill the box below only if some records still carry an <em>older</em> name.
        </p>
        <Input
          label="Previous name (optional)"
          placeholder="e.g. Rahul Jadhav"
          hint="Leave blank to sync on the current name only."
          value={previousName}
          onChange={(e) => setPreviousName(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button icon={RefreshCw} onClick={() => onConfirm(previousName.trim())} disabled={busy}>
            {busy ? 'Syncing...' : 'Sync name'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN PROFILE PAGE
   ═══════════════════════════════════════════ */
const MemberProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch, isGuest } = useAuth();
  const { addToast } = useToast();
  const { getOptions } = usePicklist();
  const { setCached, invalidate } = useDataCache();

  /* Every other page loads through the shared cache; this one had its own
     effect-into-local-state, so the whole profile was refetched on every visit
     and nothing outside the component could see or refresh it. */
  const cacheKey = `members:profile:${id}`;
  const profileQ = useCachedFetch(cacheKey, async () => {
    const res = await authFetch(`/api/members/${id}/profile`);
    if (!res.ok) throw new Error('Failed to load');
    return res.json();
  });

  const profile = profileQ.data || {};
  const loading = profileQ.loading && !profileQ.data;
  const member = profile.member || null;
  const leads = useMemo(() => profile.leads || [], [profile.leads]);
  const onboarding = useMemo(() => profile.onboarding || [], [profile.onboarding]);
  const societyRegs = useMemo(() => profile.societyRegs || [], [profile.societyRegs]);
  const royalties = useMemo(() => profile.royalties || [], [profile.royalties]);
  /* Which tab is open is view state, so it lives in the query string — the
     Society Reg. tab of a member is now a link you can send somebody. */
  const [view, setView] = useUrlState(VIEW_DEFAULTS);
  const activeTab = view.tab;
  const setActiveTab = (tab) => setView({ tab });
  const [syncing, setSyncing] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [confirmRoyalty, setConfirmRoyalty] = useState(null);

  const STAGES = useMemo(() => journeyStages(getOptions('onboarding_stage')), [getOptions]);

  const blockGuestAction = useCallback(() => {
    if (!isGuest) return false;
    addToast('Guest users have view-only access', 'error');
    return true;
  }, [isGuest, addToast]);

  const handleSyncName = async (previousName) => {
    if (blockGuestAction()) return;
    setSyncing(true);
    try {
      const res = await authFetch(`/api/members/${id}/sync-name`, {
        method: 'POST', body: JSON.stringify({ previousName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sync failed');
      const s = data.synced || {};
      const total = (s.leads || 0) + (s.onboarding || 0) + (s.societyRegs || 0) + (s.royalties || 0) + (s.clientMessages || 0);
      const breakdown = `Sales ${s.leads || 0} · Onboarding ${s.onboarding || 0} · Society ${s.societyRegs || 0} · Music Works ${s.royalties || 0} · Tasks ${s.clientMessages || 0}`;
      addToast(total > 0 ? `Synced ${total} record${total === 1 ? '' : 's'} — ${breakdown}` : `Nothing needed changing — ${breakdown}`, total > 0 ? 'success' : 'info');
      if (total > 0) {
        const refreshed = await authFetch(`/api/members/${id}/profile`);
        setCached(cacheKey, await refreshed.json());
        ['leads:list', 'onboarding:list', 'societyregs:list', 'royalty:list', 'members:list'].forEach(invalidate);
      }
      setShowSync(false);
    } catch (err) {
      console.error(err);
      addToast('Failed to sync name', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRoyalty = async (royaltyId) => {
    if (blockGuestAction()) return;
    setConfirmRoyalty(null);
    try {
      const res = await authFetch(`/api/royalty/${royaltyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete');
      }
      setCached(cacheKey, { ...profile, royalties: royalties.filter((r) => r._id !== royaltyId) });
      invalidate('royalty:list');
      addToast('Music Works entry deleted');
    } catch (err) {
      console.error(err);
      addToast('Failed to delete Music Works entry', 'error');
    }
  };

  const deeplink = (path, type, recordId) => {
    if (!recordId) return;
    navigate(`${path}?notifType=${type}&notifId=${recordId}`);
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: T.muted }}>Loading profile...</div>;
  }

  if (!member) {
    return (
      <div style={{ padding: '26px 30px', maxWidth: '1560px', margin: '0 auto' }}>
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', to: '/' }, { label: 'Members', to: '/members' }, { label: 'Not found' }]}
          title="Member not found"
        />
        <Card>
          <EmptyState icon={X} title="This member is no longer available">
            It may have been deleted.{' '}
            <button
              type="button"
              onClick={() => navigate('/members')}
              style={{ background: 'none', border: 'none', color: T.accent, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Back to Members
            </button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  const ob = onboarding[0] || null;
  const counts = { sales: leads.length, onboarding: onboarding.length, society: societyRegs.length, royalty: royalties.length };
  const TABS = [
    { value: 'overview', label: 'Overview' },
    { value: 'sales', label: 'Sales Pipeline', count: counts.sales },
    { value: 'onboarding', label: 'Onboarding', count: counts.onboarding },
    { value: 'society', label: 'Society Reg.', count: counts.society },
    { value: 'royalty', label: 'Music Works', count: counts.royalty },
  ];

  /* Every person who owns a piece of this member's journey, gathered from the
     four record types that each carry their own assignee. */
  const allSpocs = (() => {
    const out = [];
    if (member.spoc) out.push({ page: 'Member', name: member.spoc });
    leads.forEach((l) => { if (l.spoc) out.push({ page: 'Sales Pipeline', name: l.spoc }); });
    onboarding.forEach((o) => { if (o.spoc) out.push({ page: 'Onboarding', name: o.spoc }); });
    societyRegs.forEach((reg) => {
      const asMap = (v) => (v instanceof Map ? Object.fromEntries(v) : v || {});
      Object.entries(asMap(reg.societies)).forEach(([soc, data]) => {
        if (data && data.assignee && data.assignee.name) out.push({ page: `Society — ${soc}`, name: data.assignee.name });
      });
      Object.entries(asMap(reg.assignees)).forEach(([soc, asg]) => {
        if (asg && asg.name) out.push({ page: `Society — ${soc}`, name: asg.name });
      });
    });
    const seen = new Set();
    return out.filter((s) => {
      const key = `${s.name}::${s.page}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const allSocietyEntries = (() => {
    const result = [];
    societyRegs.forEach((reg) => {
      const entries = reg.societies instanceof Map ? Object.fromEntries(reg.societies) : (reg.societies || {});
      Object.entries(entries).forEach(([society, data]) => result.push({ society, data }));
    });
    return result;
  })();

  /* ── Where this member stands, in one sentence ── */
  const journey = (() => {
    if (member.status === 'Inactive') return { tone: 'grey', icon: User, text: 'This member is inactive.' };
    if (ob && ob.stage === 'Completed') return { tone: 'green', icon: CheckCircle2, text: 'Onboarding is complete. This member is fully set up.' };
    if (ob) {
      const i = STAGES.indexOf(ob.stage);
      return {
        tone: 'amber', icon: UserPlus,
        text: i >= 0
          ? `Onboarding is under way — step ${i + 1} of ${STAGES.length}, ${ob.stage}.`
          : `Onboarding is at the “${ob.stage}” stage.`,
      };
    }
    if (leads.length > 0) return { tone: 'blue', icon: TrendingUp, text: 'Still in the Sales Pipeline — no onboarding has started.' };
    return { tone: 'grey', icon: User, text: 'No pipeline or onboarding record is attached to this member yet.' };
  })();

  /* ═════ OVERVIEW ═════ */
  const renderOverview = () => (
    <>
      <Card icon={User} title="About this artist" description="What the roster record itself holds." tone="purple">
        <FieldGrid min="200px">
          <Field icon={IdCard} label="MRM membership ID">{member.clientNumber || 'Not set'}</Field>
          <Field icon={Music} label="Roles">{roleText(member.role) || 'None set'}</Field>
          <Field icon={Sparkles} label="Genre">{member.genre || 'Not set'}</Field>
          <Field icon={Globe} label="Languages">{member.languages || 'Not set'}</Field>
          <Field icon={Calendar} label="Joined">{member.joinDate || fmtDate(member.createdAt) || 'Unknown'}</Field>
          <Field icon={Sparkles} label="Lead source">{member.leadSource || 'Not set'}</Field>
        </FieldGrid>

        {member.bio && (
          <>
            <SubHead icon={FileText} style={{ marginTop: '24px' }}>Bio</SubHead>
            <p style={{ fontSize: '13.5px', color: T.body, lineHeight: 1.6 }}>{member.bio}</p>
          </>
        )}

        {member.isReferred && (
          <>
            <SubHead icon={User} style={{ marginTop: '24px' }}>Referral</SubHead>
            <MicroFacts items={[
              { label: 'Referred by', value: member.referredBy || 'Not recorded' },
              { label: 'Commission', value: member.referralCommission || 'Not recorded' },
            ]} />
          </>
        )}
      </Card>

      <Card icon={Shield} title="KYC" description="Identity documents, pulled together from the member record and the onboarding entry." tone="teal">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <Pill tone={KYC_TONES[member.kycStatus] || 'grey'} dot>KYC {member.kycStatus || 'unknown'}</Pill>
          {ob && <Pill tone={STAGE_TONES[ob.stage] || 'grey'} dot>{ob.stage}</Pill>}
        </div>

        {(() => {
          const obDocs = ob && Array.isArray(ob.documents) ? ob.documents : [];
          const panDoc = obDocs.find((d) => d.docType === 'pan');
          const aadhaarDoc = obDocs.find((d) => d.docType === 'aadhaar');
          const others = obDocs.filter((d) => d.docType !== 'pan' && d.docType !== 'aadhaar');
          const rows = [
            { key: 'pan', label: 'PAN', value: member.panCard || panDoc?.docNumber || '', doc: panDoc, fallbackDone: member.panVerified },
            { key: 'aadhaar', label: 'Aadhaar', value: member.aadhaar || aadhaarDoc?.docNumber || '', doc: aadhaarDoc, fallbackDone: member.aadhaarVerified },
            ...others.map((d) => ({ key: d._id || d.label, label: d.label, value: d.docNumber || '', doc: d })),
          ];
          return (
            <ListPanel>
              {rows.map((r) => {
                const received = r.doc ? r.doc.received : r.fallbackDone;
                const requested = r.doc ? r.doc.requested : false;
                return (
                  <ListRow
                    key={r.key}
                    icon={FileText}
                    tone={received ? 'green' : requested ? 'amber' : 'grey'}
                    title={r.label}
                    subtitle={r.value || 'No number recorded'}
                    muted={!received}
                    right={(
                      <>
                        <DocLink url={r.doc?.fileUrl} name={r.doc?.fileName} />
                        <Pill tone={received ? 'green' : requested ? 'amber' : 'grey'} dot>
                          {received ? 'Received' : requested ? 'Asked for' : 'Not started'}
                        </Pill>
                      </>
                    )}
                  />
                );
              })}
            </ListPanel>
          );
        })()}

        {ob && (
          <div style={{ marginTop: '22px' }}>
            <DerivedChecklist entry={ob} stages={STAGES} />
          </div>
        )}
      </Card>

      {allSpocs.length > 0 && (
        <Card icon={User} title="Who looks after this member" description="Every record that names an owner." tone="indigo">
          <FieldGrid min="220px">
            {allSpocs.map((s) => (
              <div key={`${s.name}-${s.page}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Avatar name={s.name} size={32} tone="auto" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: T.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ ...LABEL, fontSize: '9.5px' }}>{s.page}</div>
                </div>
              </div>
            ))}
          </FieldGrid>
        </Card>
      )}

      {allSocietyEntries.length > 0 && (
        <Card icon={Landmark} title="Society registrations at a glance" description="One line per society; the full detail is on the Society Reg. tab." tone="amber">
          <ListPanel>
            {allSocietyEntries.map(({ society, data }) => {
              const steps = data.steps || {};
              const done = [
                steps.territoryWithdrawal, steps.nocReceived, steps.applicationFiled,
                steps.paymentDone, steps.applicationSigned, steps.applicationSentToSociety,
                steps.membershipConfirmation, steps.loginDetails, steps.thirdPartyAuthorization, steps.bankMandateUpdate,
              ].filter((v) => v === 'Yes').length;
              const overdue = data.status === 'In Progress' && data.deadline && new Date(data.deadline) < new Date(new Date().toDateString());
              const status = overdue ? 'Overdue' : (data.status || 'N/A');
              return (
                <ListRow
                  key={society}
                  icon={Landmark}
                  tone={REG_TONES[status] || 'grey'}
                  title={society}
                  subtitle={`${done} of 10 steps${data.deadline ? ` · due ${fmtDate(data.deadline)}` : ''}`}
                  right={<Pill tone={REG_TONES[status] || 'grey'} dot>{status}</Pill>}
                >
                  <ProgressBar value={done} total={10} tone={overdue ? 'red' : done === 10 ? 'green' : 'indigo'} />
                </ListRow>
              );
            })}
          </ListPanel>
        </Card>
      )}

      {member.subTasks && member.subTasks.length > 0 && (
        <Card
          icon={ClipboardList}
          title="Sub-tasks"
          description={`${member.subTasks.filter((t) => t.done).length} of ${member.subTasks.length} done.`}
          tone="indigo"
        >
          <div style={{ marginBottom: '12px' }}>
            <ProgressBar
              value={member.subTasks.filter((t) => t.done).length}
              total={member.subTasks.length}
              tone={member.subTasks.every((t) => t.done) ? 'green' : 'indigo'}
            />
          </div>
          <ListPanel>
            {member.subTasks.map((task, i) => (
              <ListRow
                key={task._id || i}
                icon={task.done ? CheckCircle2 : ClipboardList}
                tone={task.done ? 'green' : 'grey'}
                title={task.text}
                muted={task.done}
                right={task.assignee ? <Pill tone="indigo">{task.assignee}</Pill> : null}
              />
            ))}
          </ListPanel>
        </Card>
      )}
    </>
  );

  /* ═════ SALES PIPELINE ═════ */
  const renderSales = () => (
    leads.length === 0 ? (
      <Card><EmptyState icon={TrendingUp} title="No pipeline record">This member has never been a lead.</EmptyState></Card>
    ) : leads.map((lead) => (
      <Card
        key={lead._id}
        icon={TrendingUp}
        tone="blue"
        title={lead.name || 'Unnamed lead'}
        description={lead.email || 'No email on the lead'}
        actions={(
          <>
            <Pill tone={STAGE_TONES[lead.stage] || 'grey'} dot>{lead.stage}</Pill>
            <RecordLink label="Open in Sales Pipeline" onClick={() => navigate(`/sales-pipeline/${lead._id}`)} />
          </>
        )}
      >
        <FieldGrid min="180px">
          <Field label="Source">{lead.source || 'Not set'}</Field>
          <Field label="Priority"><span style={{ textTransform: 'capitalize' }}>{lead.priority || 'medium'}</span></Field>
          <Field label="Phone">{lead.phone || 'Not recorded'}</Field>
          <Field label="Owner">{lead.spoc || 'Nobody yet'}</Field>
          <Field label="Created">{fmtDate(lead.createdAt) || 'Unknown'}</Field>
        </FieldGrid>

        {lead.stage === 'New Enquiry' && (
          <>
            <SubHead icon={Phone} style={{ marginTop: '24px' }}>First call</SubHead>
            <MicroFacts items={[{ label: 'Call done', value: lead.callDone ? 'Yes' : 'Not yet', tone: lead.callDone ? 'green' : 'grey' }]} />
            {lead.inquiryNotes && <p style={{ fontSize: '13px', color: T.muted, marginTop: '10px', lineHeight: 1.55 }}>{lead.inquiryNotes}</p>}
          </>
        )}

        {lead.stage === 'Meeting Set' && (
          <>
            <SubHead icon={Calendar} style={{ marginTop: '24px' }}>Meeting</SubHead>
            <MicroFacts items={[
              { label: 'Date', value: lead.meetingDate || 'Not set' },
              { label: 'With', value: lead.meetingAssignedWith || 'Not set' },
            ]} />
            {lead.meetingLink && (
              <a href={lead.meetingLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', color: TONES.blue.fg }}>
                {lead.meetingLink}
              </a>
            )}
            {lead.meetingNotes && <p style={{ fontSize: '13px', color: T.muted, marginTop: '10px', lineHeight: 1.55 }}>{lead.meetingNotes}</p>}
          </>
        )}

        {lead.stage === 'Qualified Lead' && (
          <>
            <SubHead icon={CheckCircle2} style={{ marginTop: '24px' }}>Qualification</SubHead>
            <MicroFacts items={[
              { label: 'Enquiry verified', value: lead.inquiryVerified ? 'Yes' : 'Not yet', tone: lead.inquiryVerified ? 'green' : 'grey' },
              { label: 'Meeting verified', value: lead.meetingVerified ? 'Yes' : 'Not yet', tone: lead.meetingVerified ? 'green' : 'grey' },
            ]} />
          </>
        )}

        {lead.movedToOnboarding && (
          <div style={{ marginTop: '16px' }}>
            {/* this strip used to be white text on a near-white tint — a
                leftover from the dark theme, and completely unreadable */}
            <Banner tone="green" icon={CheckCircle2}>
              Handed over to onboarding{lead.onboardedAt ? ` on ${fmtDate(lead.onboardedAt)}` : ''}
              {lead.onboardingSpoc ? `, owned by ${lead.onboardingSpoc}` : ''}.
            </Banner>
          </div>
        )}

        {lead.notes && (
          <>
            <SubHead icon={FileText} style={{ marginTop: '24px' }}>Notes</SubHead>
            <p style={{ fontSize: '13px', color: T.muted, lineHeight: 1.55 }}>{lead.notes}</p>
          </>
        )}
      </Card>
    ))
  );

  /* ═════ ONBOARDING ═════ */
  const renderOnboarding = () => (
    onboarding.length === 0 ? (
      <Card><EmptyState icon={UserPlus} title="No onboarding record">This member has not been handed over from the pipeline.</EmptyState></Card>
    ) : onboarding.map((entry) => {
      const docs = Array.isArray(entry.documents) ? entry.documents : [];
      const received = docs.filter((d) => d.received).length;
      return (
        <Card
          key={entry._id}
          icon={UserPlus}
          tone={entry.stage === 'Completed' ? 'green' : 'amber'}
          title={entry.name || member.name}
          description={[entry.email, entry.contractType].filter(Boolean).join('  ·  ') || 'No contract type set'}
          actions={(
            <>
              <Pill tone={STAGE_TONES[entry.stage] || 'grey'} dot>{entry.stage}</Pill>
              <RecordLink label="Open in Onboarding" onClick={() => navigate(`/onboarding/${entry._id}`)} />
            </>
          )}
        >
          <Summary
            left={<Ring value={received} total={docs.length} tone={docs.length && received === docs.length ? 'green' : 'amber'} caption="in hand" />}
            headline={<DerivedChecklist entry={entry} stages={STAGES} />}
          />

          <FieldGrid min="180px">
            <Field label="Roles">{roleText(entry.role) || 'None set'}</Field>
            <Field label="Phone">{entry.phone || 'Not recorded'}</Field>
            <Field label="Owner">{entry.spoc || 'Nobody yet'}</Field>
            <Field label="Priority"><span style={{ textTransform: 'capitalize' }}>{entry.priority || 'medium'}</span></Field>
            <Field label="Created">{fmtDate(entry.createdAt) || 'Unknown'}</Field>
          </FieldGrid>

          {docs.length > 0 && (
            <>
              <SubHead icon={FileText} style={{ marginTop: '24px' }}>Documents</SubHead>
              <ListPanel>
                {docs.map((doc, i) => (
                  <ListRow
                    key={doc._id || i}
                    icon={FileText}
                    tone={doc.received ? 'green' : doc.requested ? 'amber' : 'grey'}
                    title={doc.label}
                    subtitle={doc.docNumber || undefined}
                    muted={!doc.received}
                    right={(
                      <>
                        <DocLink url={doc.fileUrl} name={doc.fileName} />
                        <Pill tone={doc.received ? 'green' : doc.requested ? 'amber' : 'grey'} dot>
                          {doc.received ? 'Received' : doc.requested ? 'Asked for' : 'Not started'}
                        </Pill>
                      </>
                    )}
                  />
                ))}
              </ListPanel>
            </>
          )}

          {(entry.contractSent || entry.contractReceived || entry.contractStartDate) && (
            <>
              <SubHead icon={FileText} style={{ marginTop: '24px' }}>Contract</SubHead>
              <MicroFacts items={[
                { label: 'Sent', value: entry.contractSent ? 'Yes' : 'Not yet', tone: entry.contractSent ? 'green' : 'grey' },
                { label: 'Signed copy back', value: entry.contractReceived ? 'Yes' : 'Not yet', tone: entry.contractReceived ? 'green' : 'grey' },
                entry.contractStartDate && { label: 'Start', value: fmtDate(entry.contractStartDate) },
                entry.contractRenewalDate && { label: 'Renewal', value: fmtDate(entry.contractRenewalDate) },
                entry.renewalType && { label: 'Renewal type', value: entry.renewalType },
              ].filter(Boolean)} />
              {entry.renewalRemarks && (
                <p style={{ fontSize: '13px', color: T.muted, marginTop: '10px', lineHeight: 1.55 }}>{entry.renewalRemarks}</p>
              )}
              {entry.contractFileUrl && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: T.body }}>{entry.contractFileName || 'Contract'}</span>
                  <DocLink url={entry.contractFileUrl} name={entry.contractFileName} />
                </div>
              )}
            </>
          )}

          {entry.selectedSocieties && entry.selectedSocieties.length > 0 && (
            <>
              <SubHead icon={Landmark} style={{ marginTop: '24px' }}>Societies registered</SubHead>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {entry.selectedSocieties.map((s) => <Pill key={s} tone="indigo">{s}</Pill>)}
              </div>
            </>
          )}

          {(entry.addedToWhatsApp || entry.emailCreated || entry.clientNumber) && (
            <>
              <SubHead icon={Mail} style={{ marginTop: '24px' }}>Set-up</SubHead>
              <MicroFacts items={[
                { label: 'WhatsApp group', value: entry.addedToWhatsApp ? (entry.whatsAppGroupName || 'Added') : 'Not added', tone: entry.addedToWhatsApp ? 'green' : 'grey' },
                { label: 'Work email', value: entry.emailCreated ? (entry.createdEmailAddress || 'Created') : 'Not created', tone: entry.emailCreated ? 'green' : 'grey' },
                entry.clientNumber && { label: 'MRM ID', value: entry.clientNumber },
              ].filter(Boolean)} />
            </>
          )}

          {entry.notes && (
            <>
              <SubHead icon={FileText} style={{ marginTop: '24px' }}>Notes</SubHead>
              <p style={{ fontSize: '13px', color: T.muted, lineHeight: 1.55 }}>{entry.notes}</p>
            </>
          )}
        </Card>
      );
    })
  );

  /* ═════ SOCIETY REG. ═════ */
  const renderSociety = () => (
    societyRegs.length === 0 ? (
      <Card><EmptyState icon={Landmark} title="No society registrations">Nothing has been filed for this member yet.</EmptyState></Card>
    ) : societyRegs.map((reg) => {
      const entries = reg.societies instanceof Map ? Object.fromEntries(reg.societies) : (reg.societies || {});
      return (
        <Card
          key={reg._id}
          icon={Landmark}
          tone="amber"
          title={reg.name || member.name}
          description={`${Object.keys(entries).length} society registration${Object.keys(entries).length === 1 ? '' : 's'}.`}
          actions={<RecordLink label="Open in Society Reg." onClick={() => deeplink('/society-reg', 'societyreg', reg._id)} />}
        >
          <ListPanel>
            {Object.entries(entries).map(([society, data]) => (
              <SocietyRow key={society} society={society} data={data} />
            ))}
          </ListPanel>
        </Card>
      );
    })
  );

  /* ═════ MUSIC WORKS ═════ */
  const renderRoyalty = () => (
    royalties.length === 0 ? (
      <Card><EmptyState icon={Music} title="No Music Works record">No royalty statements have been logged for this member.</EmptyState></Card>
    ) : royalties.map((royalty) => (
      <Card
        key={royalty._id}
        icon={Music}
        tone="teal"
        title={royalty.clientName || member.name}
        description={royalty.clientEmail || 'No email on the record'}
        actions={(
          <>
            <Pill tone={royalty.documentsReceived ? 'green' : 'grey'} dot>
              {royalty.documentsReceived ? 'Documents received' : 'Documents pending'}
            </Pill>
            <RecordLink label="Open in Music Works" onClick={() => deeplink('/royalty', 'royalty', royalty._id)} />
          </>
        )}
      >
        {royalty.documentFileUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: T.body }}>{royalty.documentFileName || 'Document'}</span>
            <DocLink url={royalty.documentFileUrl} name={royalty.documentFileName} />
          </div>
        )}

        {royalty.years && royalty.years.length > 0 ? (
          <ListPanel>
            {royalty.years.map((yearData, yi) => <RoyaltyYearRow key={yi} yearData={yearData} />)}
          </ListPanel>
        ) : (
          <p style={{ fontSize: '13px', color: T.faint }}>No yearly statements recorded yet.</p>
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '16px', paddingTop: '14px' }}>
          {confirmRoyalty === royalty._id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <AlertTriangle style={{ width: '15px', height: '15px', color: TONES.red.fg, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: '200px', fontSize: '12.5px', color: TONES.red.fg }}>
                Delete this Music Works entry and every statement on it? This cannot be undone.
              </span>
              <Button variant="ghost" onClick={() => setConfirmRoyalty(null)} style={{ padding: '7px 13px', fontSize: '12.5px' }}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={() => handleDeleteRoyalty(royalty._id)} style={{ padding: '7px 13px', fontSize: '12.5px' }}>
                Yes, delete
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { if (!blockGuestAction()) setConfirmRoyalty(royalty._id); }}
              title="Delete this Music Works entry"
              className="mrm-icon-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '4px 6px' }}
            >
              <Trash2 style={{ width: '13px', height: '13px' }} /> Delete this Music Works entry
            </button>
          )}
        </div>
      </Card>
    ))
  );

  return (
    <div style={{ padding: '26px 30px 50px', maxWidth: '1560px', margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', to: '/' },
          { label: 'Members', to: '/members' },
          { label: member.name || 'Member' },
        ]}
        title={member.name || 'Unnamed member'}
        subtitle={[roleText(member.role), member.genre].filter(Boolean).join('  ·  ') || 'No roles or genre recorded'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/members')} title="Back to the members list">Back</Button>
            <Button
              icon={RefreshCw}
              onClick={() => { if (!blockGuestAction()) setShowSync(true); }}
              disabled={syncing}
              title="Rewrite this member's name across every record that still carries an older one"
            >
              {syncing ? 'Syncing...' : 'Sync name'}
            </Button>
          </>
        }
      />

      <Banner
        tone={journey.tone}
        icon={journey.icon}
        action={<>
          <Pill tone={STATUS_TONES[member.status] || 'grey'} dot>{member.status || 'Unknown'}</Pill>
          <Pill tone={KYC_TONES[member.kycStatus] || 'grey'} dot>KYC {member.kycStatus || 'unknown'}</Pill>
        </>}
      >
        {journey.text}
      </Banner>

      <div style={{ marginBottom: '16px' }}>
        <Segmented options={TABS} value={activeTab} onChange={setActiveTab} tone="purple" />
      </div>

      <PageBody
        rail={(
          <Card icon={User} title="Who this is" tone="purple" bodyStyle={{ padding: '15px 17px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Avatar name={member.name} size={42} tone="auto" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: T.heading, lineHeight: 1.25, wordBreak: 'break-word' }}>
                  {member.name || 'Unnamed member'}
                </div>
                <div style={{ fontSize: '12px', color: T.faint, marginTop: '2px' }}>
                  {member.clientNumber ? `MRM ${member.clientNumber}` : 'No MRM ID yet'}
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '2px' }}>
              <ContactRow icon={Mail} label="Email" tone="blue" empty="No email" value={member.email} href={member.email ? `mailto:${member.email}` : undefined} />
              <ContactRow icon={Phone} label="Phone" tone="teal" empty="No phone" value={member.phone} href={member.phone ? `tel:${member.phone}` : undefined} />
              <ContactRow icon={User} label="Owner" tone="grey" empty="Nobody yet" copyable={false} value={member.spoc} />
              <ContactRow icon={Calendar} label="Added on" tone="grey" empty="Unknown" copyable={false} value={fmtDate(member.createdAt)} />
            </div>
            <p style={{ fontSize: '11px', color: T.faint, marginTop: '10px', lineHeight: 1.5 }}>
              Edit these on the Members list, so every record that names them follows.
            </p>
          </Card>
        )}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'sales' && renderSales()}
        {activeTab === 'onboarding' && renderOnboarding()}
        {activeTab === 'society' && renderSociety()}
        {activeTab === 'royalty' && renderRoyalty()}
      </PageBody>

      {showSync && (
        <SyncNameDialog
          name={member.name}
          busy={syncing}
          onClose={() => setShowSync(false)}
          onConfirm={handleSyncName}
        />
      )}
    </div>
  );
};

/* ─── One society inside a registration ─── */
const SOCIETY_STEPS = [
  ['Territory withdrawal', 'territoryWithdrawal'],
  ['NOC received', 'nocReceived'],
  ['Application filed', 'applicationFiled'],
  ['Payment done', 'paymentDone'],
  ['Application signed', 'applicationSigned'],
  ['Sent to society', 'applicationSentToSociety'],
  ['Membership confirmed', 'membershipConfirmation'],
  ['Login details', 'loginDetails'],
  ['3rd party authorisation', 'thirdPartyAuthorization'],
  ['Bank mandate', 'bankMandateUpdate'],
];

const STEP_FILES = {
  nocReceived: ['nocReceivedFileUrl', 'nocReceivedFileName'],
  applicationSentToSociety: ['applicationSentFileUrl', 'applicationSentFileName'],
  thirdPartyAuthorization: ['thirdPartyAuthFileUrl', 'thirdPartyAuthFileName'],
  bankMandateUpdate: ['bankMandateFileUrl', 'bankMandateFileName'],
};

const SocietyRow = ({ society, data }) => {
  const steps = data.steps || {};
  const done = SOCIETY_STEPS.filter(([, key]) => steps[key] === 'Yes').length;
  const overdue = data.status === 'In Progress' && data.deadline && new Date(data.deadline) < new Date(new Date().toDateString());
  const status = overdue ? 'Overdue' : (data.status || 'N/A');

  return (
    <Collapsible
      icon={Landmark}
      tone={REG_TONES[status] || 'grey'}
      title={society}
      meta={`${done}/${SOCIETY_STEPS.length} steps`}
      pill={<Pill tone={REG_TONES[status] || 'grey'} dot>{status}</Pill>}
    >
      <div style={{ marginBottom: '12px' }}>
        <ProgressBar value={done} total={SOCIETY_STEPS.length} tone={overdue ? 'red' : done === SOCIETY_STEPS.length ? 'green' : 'indigo'} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {SOCIETY_STEPS.map(([label, key]) => {
          const val = steps[key];
          const [urlKey, nameKey] = STEP_FILES[key] || [];
          const stepTone = val === 'Yes' ? TONES.green.fg : val === 'No' ? TONES.red.fg : T.faint;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '5px 0', fontSize: '12.5px' }}>
              <span style={{ color: T.muted, minWidth: 0 }}>{label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {urlKey && <DocLink url={steps[urlKey]} name={steps[nameKey]} />}
                <span style={{ color: stepTone, fontWeight: 700 }}>{val || 'Not set'}</span>
              </span>
            </div>
          );
        })}
      </div>

      {(steps.loginId || steps.caeNumber || steps.commissionRate || (data.assignee && data.assignee.name) || data.deadline) && (
        <div style={{ marginTop: '12px' }}>
          <MicroFacts items={[
            data.assignee && data.assignee.name && { label: 'Assigned to', value: data.assignee.name },
            data.deadline && { label: 'Deadline', value: fmtDate(data.deadline), tone: overdue ? 'red' : undefined },
            steps.loginId && { label: 'Login', value: steps.loginId },
            steps.caeNumber && { label: 'CAE', value: steps.caeNumber },
            steps.commissionRate && { label: 'Commission', value: steps.commissionRate },
          ].filter(Boolean)} />
        </div>
      )}

      {data.remarks && data.remarks.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ ...LABEL, fontSize: '9.5px', marginBottom: '6px' }}>Remarks</div>
          {data.remarks.map((r, i) => (
            <div key={i} style={{ fontSize: '12.5px', color: T.body, padding: '3px 0', lineHeight: 1.5 }}>
              {r.text} <span style={{ color: T.faint }}>({fmtDate(r.createdAt) || 'undated'})</span>
            </div>
          ))}
        </div>
      )}
    </Collapsible>
  );
};

/* ─── One year of royalty statements ─── */
const RoyaltyYearRow = ({ yearData }) => {
  const months = yearData.months instanceof Map
    ? Object.fromEntries(yearData.months)
    : (yearData.months && typeof yearData.months === 'object' ? yearData.months : {});
  const monthKeys = Object.keys(months);
  const received = monthKeys.filter((m) => months[m]?.fileReceived).length;

  return (
    <Collapsible
      icon={Calendar}
      tone={monthKeys.length > 0 && received === monthKeys.length ? 'green' : 'grey'}
      title={String(yearData.year)}
      meta={`${received}/${monthKeys.length} months in`}
    >
      <div style={{ marginBottom: '12px' }}>
        <ProgressBar value={received} total={monthKeys.length} tone={received === monthKeys.length && monthKeys.length > 0 ? 'green' : 'indigo'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
        {monthKeys.map((mon) => {
          const md = months[mon] || {};
          return (
            <div
              key={mon}
              style={{
                padding: '10px 12px', borderRadius: '10px',
                background: md.fileReceived ? TONES.green.bg : T.bg,
                border: `1px solid ${md.fileReceived ? TONES.green.bd : T.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.heading }}>{mon}</span>
                <DocLink url={md.fileUrl} name={md.fileName} />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: md.fileReceived ? TONES.green.fg : T.faint }}>
                {md.fileReceived ? 'Received' : 'Pending'}
              </div>
              {(md.totalSongs > 0 || md.totalBGMMovies > 0 || md.totalTVBGM > 0 || md.totalTVBGMEpisode > 0) && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: T.muted, lineHeight: 1.5 }}>
                  {md.totalSongs > 0 && <div>Songs: {md.totalSongs}</div>}
                  {md.totalBGMMovies > 0 && <div>BGM films: {md.totalBGMMovies}</div>}
                  {md.totalTVBGM > 0 && <div>TV BGM: {md.totalTVBGM}</div>}
                  {md.totalTVBGMEpisode > 0 && <div>TV episodes: {md.totalTVBGMEpisode}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Collapsible>
  );
};

export default MemberProfile;
