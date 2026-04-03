import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Music, FileText, Shield, Copy, Check,
  ExternalLink, Calendar, User, Globe, Hash, Edit3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/* ─── Helpers ─── */
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ─── Status / KYC badges ─── */
const statusColors = {
  Active: { bg: '#065f46', text: '#34d399' },
  Onboarding: { bg: '#713f12', text: '#fbbf24' },
  Inactive: { bg: '#374151', text: '#9ca3af' },
};
const kycColors = {
  Verified: { bg: '#065f46', text: '#34d399' },
  Pending: { bg: '#7f1d1d', text: '#f87171' },
  Rejected: { bg: '#7f1d1d', text: '#f87171' },
};
const Badge = ({ label, colorMap, fallbackBg = '#374151', fallbackText = '#9ca3af' }) => {
  const c = (colorMap || {})[label] || { bg: fallbackBg, text: fallbackText };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
};

const stageColors = {
  'New Enquiry': { bg: '#1e3a5f', text: '#60a5fa' },
  'Meeting Set': { bg: '#713f12', text: '#fbbf24' },
  'Qualified Lead': { bg: '#065f46', text: '#34d399' },
  'Not Qualified': { bg: '#7f1d1d', text: '#f87171' },
  'Document Submission': { bg: '#1e3a5f', text: '#60a5fa' },
  'KYC Verification': { bg: '#713f12', text: '#fbbf24' },
  'Contract Signing': { bg: '#4c1d95', text: '#c4b5fd' },
  'Active Member': { bg: '#065f46', text: '#34d399' },
  'Contact Made': { bg: '#374151', text: '#9ca3af' },
  Completed: { bg: '#065f46', text: '#34d399' },
  'Under Review': { bg: '#713f12', text: '#fbbf24' },
};

const regStatusColors = {
  Registered: { bg: '#065f46', text: '#34d399' },
  'In Progress': { bg: '#713f12', text: '#fbbf24' },
  Overdue: { bg: '#7f1d1d', text: '#f87171' },
  'Not Started': { bg: '#374151', text: '#9ca3af' },
  'N/A': { bg: '#1f2937', text: '#6b7280' },
};

/* ─── Reusable card styles ─── */
const card = { background: '#141720', border: '1px solid #1e2540', borderRadius: '12px', padding: '20px' };
const sectionTitle = { color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' };
const infoBox = { background: '#161b2e', borderRadius: '10px', padding: '14px 16px' };
const infoLabel = { fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' };
const infoVal = { color: '#fff', fontSize: '14px', fontWeight: 500 };
const emptyState = { color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '32px 0' };

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales Pipeline' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'society', label: 'Society Reg.' },
  { key: 'royalty', label: 'Royalty' },
];

/* ────────────── MAIN COMPONENT ────────────── */
const MemberProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [leads, setLeads] = useState([]);
  const [onboarding, setOnboarding] = useState([]);
  const [societyRegs, setSocietyRegs] = useState([]);
  const [royalties, setRoyalties] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/members/${id}/profile`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setMember(data.member);
        setLeads(data.leads || []);
        setOnboarding(data.onboarding || []);
        setSocietyRegs(data.societyRegs || []);
        setRoyalties(data.royalties || []);
      } catch (err) {
        console.error(err);
        addToast('Failed to load member profile', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, authFetch, addToast]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 1500);
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading profile...</div>;
  if (!member) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Member not found.</div>;

  /* ─── Counts for tabs ─── */
  const counts = {
    sales: leads.length,
    onboarding: onboarding.length,
    society: societyRegs.length,
    royalty: royalties.length,
  };

  /* ─────── RENDERERS ─────── */
  /* ─── Helpers for overview aggregation ─── */
  const allSpocs = (() => {
    const spocs = [];
    if (member.spoc) spocs.push({ page: 'Member', name: member.spoc });
    leads.forEach((l) => { if (l.spoc) spocs.push({ page: 'Sales Pipeline', name: l.spoc }); });
    onboarding.forEach((o) => { if (o.spoc) spocs.push({ page: 'Onboarding', name: o.spoc }); });
    societyRegs.forEach((reg) => {
      if (reg.societies) {
        const entries = reg.societies instanceof Map ? Object.fromEntries(reg.societies) : reg.societies;
        Object.entries(entries).forEach(([soc, data]) => {
          if (data && data.assignee && data.assignee.name) spocs.push({ page: `Society Reg — ${soc}`, name: data.assignee.name });
        });
      }
      // Also check top-level assignees map
      if (reg.assignees) {
        const assigneeEntries = reg.assignees instanceof Map ? Object.fromEntries(reg.assignees) : reg.assignees;
        Object.entries(assigneeEntries).forEach(([soc, asg]) => {
          if (asg && asg.name) spocs.push({ page: `Society Reg — ${soc}`, name: asg.name });
        });
      }
    });
    // Deduplicate by name+page
    const seen = new Set();
    return spocs.filter((s) => {
      const key = `${s.name}::${s.page}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const allSocietyEntries = (() => {
    const result = [];
    societyRegs.forEach((reg) => {
      if (reg.societies) {
        const entries = reg.societies instanceof Map ? Object.fromEntries(reg.societies) : reg.societies;
        Object.entries(entries).forEach(([soc, data]) => {
          result.push({ society: soc, data });
        });
      }
    });
    return result;
  })();

  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Basic Info */}
      <div style={card}>
        <div style={sectionTitle}><User size={16} /> Basic Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={infoBox}><div style={infoLabel}>MRM Membership ID</div><div style={infoVal}>{member.clientNumber || (onboarding.length > 0 && onboarding[0].clientNumber) || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Email</div><div style={{ ...infoVal, display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={13} color="#8892b0" />{member.email || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Phone</div><div style={{ ...infoVal, display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} color="#8892b0" />{member.phone || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Role</div><div style={infoVal}>{Array.isArray(member.role) ? member.role.join(', ') : member.role || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Genre</div><div style={infoVal}>{member.genre || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Languages</div><div style={infoVal}>{member.languages || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Join Date</div><div style={infoVal}>{member.joinDate || '—'}</div></div>
        </div>
        {member.bio && (
          <div style={{ ...infoBox, marginTop: '12px' }}><div style={infoLabel}>Bio</div><div style={infoVal}>{member.bio}</div></div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '12px' }}>
          <div style={infoBox}><div style={infoLabel}>Referred</div><div style={{ ...infoVal, color: member.isReferred ? '#34d399' : '#9ca3af' }}>{member.isReferred ? 'Yes' : 'No'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Referred By</div><div style={infoVal}>{member.referredBy || '—'}</div></div>
          <div style={infoBox}><div style={infoLabel}>Referral Commission</div><div style={infoVal}>{member.referralCommission || '—'}</div></div>
        </div>

        {/* Renewal Details & Notes from Onboarding */}
        {onboarding.length > 0 && (onboarding[0].renewalType || onboarding[0].renewalRemarks || onboarding[0].contractStartDate || onboarding[0].contractRenewalDate || onboarding[0].notes) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '12px' }}>
            {onboarding[0].contractType && <div style={infoBox}><div style={infoLabel}>Contract Type</div><div style={infoVal}>{onboarding[0].contractType}</div></div>}
            {onboarding[0].contractStartDate && <div style={infoBox}><div style={infoLabel}>Contract Start</div><div style={infoVal}>{fmtDate(onboarding[0].contractStartDate)}</div></div>}
            {onboarding[0].contractRenewalDate && <div style={infoBox}><div style={infoLabel}>Contract Renewal</div><div style={infoVal}>{fmtDate(onboarding[0].contractRenewalDate)}</div></div>}
            {onboarding[0].renewalType && <div style={infoBox}><div style={infoLabel}>Renewal Type</div><div style={{ ...infoVal, color: '#c4b5fd' }}>{onboarding[0].renewalType}</div></div>}
            {onboarding[0].renewalRemarks && <div style={infoBox}><div style={infoLabel}>Renewal Remarks</div><div style={infoVal}>{onboarding[0].renewalRemarks}</div></div>}
            {onboarding[0].notes && <div style={infoBox}><div style={infoLabel}>Notes</div><div style={infoVal}>{onboarding[0].notes}</div></div>}
          </div>
        )}
      </div>

      {/* SPOC Summary */}
      {allSpocs.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><User size={16} /> Assigned SPOCs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {allSpocs.map((s, i) => (
              <div key={i} style={{ ...infoBox, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={infoVal}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#8892b0' }}>{s.page}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Society Registration Overview */}
      {allSocietyEntries.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}><Globe size={16} /> Society Registrations Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {allSocietyEntries.map(({ society, data }) => {
              const steps = data.steps || {};
              const stepEntries = [
                steps.territoryWithdrawal, steps.nocReceived, steps.applicationFiled,
                steps.paymentDone, steps.applicationSigned, steps.applicationSentToSociety,
                steps.membershipConfirmation, steps.loginDetails, steps.thirdPartyAuthorization, steps.bankMandateUpdate,
              ];
              const completedSteps = stepEntries.filter((v) => v === 'Yes').length;
              const isOverdue = data.status === 'In Progress' && data.deadline && new Date(data.deadline) < new Date(new Date().toDateString());
              const displayStatus = isOverdue ? 'Overdue' : (data.status || 'N/A');
              const deadlineStr = data.deadline ? new Date(data.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
              return (
                <div key={society} style={{ background: '#161b2e', borderRadius: '10px', padding: '14px 16px', border: isOverdue ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{society}</div>
                    <Badge label={displayStatus} colorMap={regStatusColors} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '6px' }}>{completedSteps}/10 steps</div>
                  <div style={{ height: '3px', background: '#1e2540', borderRadius: '3px', marginBottom: '8px' }}>
                    <div style={{ height: '100%', width: `${(completedSteps / 10) * 100}%`, background: isOverdue ? '#ef4444' : '#22c55e', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  {deadlineStr && (
                    <div style={{ fontSize: '11px', color: isOverdue ? '#f87171' : '#8892b0', marginBottom: '4px' }}>
                      📅 {deadlineStr}{isOverdue ? ' — Overdue' : ''}
                    </div>
                  )}
                  {(steps.caeNumber || steps.commissionRate) && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {steps.caeNumber && (
                        <div style={{ fontSize: '11px' }}>
                          <span style={{ color: '#8892b0' }}>CAE: </span><span style={{ color: '#fff', fontFamily: 'monospace' }}>{steps.caeNumber}</span>
                        </div>
                      )}
                      {steps.commissionRate && (
                        <div style={{ fontSize: '11px' }}>
                          <span style={{ color: '#8892b0' }}>Commission: </span><span style={{ color: '#fff', fontFamily: 'monospace' }}>{steps.commissionRate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KYC & Onboarding Status */}
      <div style={card}>
        <div style={sectionTitle}><Shield size={16} /> KYC Information</div>

        {/* KYC Status + Onboarding Stage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#8892b0', fontSize: '13px', fontWeight: 600 }}>KYC Status:</span>
            <Badge label={member.kycStatus} colorMap={kycColors} />
          </div>
          {onboarding.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#8892b0', fontSize: '13px', fontWeight: 600 }}>Onboarding Stage:</span>
              <Badge label={onboarding[0].stage} colorMap={stageColors} />
            </div>
          )}
        </div>

        {/* Onboarding Stage Progress */}
        {onboarding.length > 0 && (() => {
          const OB_STAGES = ['Document Submission', 'KYC Verification', 'Contract Signing', 'Active Member', 'Contact Made', 'Completed'];
          const currentIdx = OB_STAGES.indexOf(onboarding[0].stage);
          return (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                {OB_STAGES.map((s, i) => (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: i <= currentIdx ? '#6366f1' : '#1e2540' }} />
                    <span style={{ fontSize: '9px', color: i <= currentIdx ? '#c4b5fd' : '#4b5563', textAlign: 'center', lineHeight: 1.2 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Documents from Onboarding */}
        {(() => {
          // Merge PAN/Aadhaar from onboarding documents with member-level data
          const obDocs = onboarding.length > 0 && onboarding[0].documents ? onboarding[0].documents : [];
          const panDoc = obDocs.find(d => d.docType === 'pan');
          const aadhaarDoc = obDocs.find(d => d.docType === 'aadhaar');
          const otherDocs = obDocs.filter(d => d.docType !== 'pan' && d.docType !== 'aadhaar');
          const panValue = member.panCard || (panDoc && panDoc.docNumber) || '';
          const aadhaarValue = member.aadhaar || (aadhaarDoc && aadhaarDoc.docNumber) || '';
          const panReceived = panDoc ? panDoc.received : member.panVerified;
          const aadhaarReceived = aadhaarDoc ? aadhaarDoc.received : member.aadhaarVerified;

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: otherDocs.length > 0 ? '12px' : '0' }}>
                {[
                  { label: 'PAN Card', value: panValue, verified: panReceived, requested: panDoc?.requested, key: 'pan' },
                  { label: 'Aadhaar', value: aadhaarValue, verified: aadhaarReceived, requested: aadhaarDoc?.requested, key: 'aadhaar' },
                ].map(({ label, value, verified, requested, key }) => (
                  <div key={key} style={{ ...infoBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={infoLabel}>{label}</div>
                      <div style={{ ...infoVal, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{value || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {verified ? (
                        <Badge label="Received" colorMap={{ Received: { bg: '#065f46', text: '#34d399' } }} />
                      ) : requested ? (
                        <Badge label="Requested" colorMap={{ Requested: { bg: '#713f12', text: '#fbbf24' } }} />
                      ) : (
                        <Badge label="Pending" colorMap={{ Pending: { bg: '#7f1d1d', text: '#f87171' } }} />
                      )}
                      {value && (
                        <button onClick={() => copyToClipboard(value, key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === key ? '#22c55e' : '#8892b0', padding: '4px' }}>
                          {copiedField === key ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Other onboarding documents */}
              {otherDocs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                  {otherDocs.map((doc, i) => (
                    <div key={i} style={{ ...infoBox, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={infoLabel}>{doc.label}</div>
                        <div style={{ ...infoVal, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{doc.docNumber || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {doc.received ? (
                          <Badge label="Received" colorMap={{ Received: { bg: '#065f46', text: '#34d399' } }} />
                        ) : doc.requested ? (
                          <Badge label="Requested" colorMap={{ Requested: { bg: '#713f12', text: '#fbbf24' } }} />
                        ) : (
                          <Badge label="Pending" colorMap={{ Pending: { bg: '#7f1d1d', text: '#f87171' } }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Onboarding checklist */}
              {onboarding.length > 0 && onboarding[0].checklist && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '14px', padding: '12px 16px', background: '#161b2e', borderRadius: '8px' }}>
                  {[
                    { key: 'docs_submitted', label: 'Docs Submitted' },
                    { key: 'kyc_verified', label: 'KYC Verified' },
                    { key: 'contract_signed', label: 'Contract Signed' },
                    { key: 'review_complete', label: 'Review Complete' },
                    { key: 'member_activated', label: 'Member Activated' },
                  ].map(({ key, label }) => (
                    <span key={key} style={{ color: onboarding[0].checklist[key] ? '#34d399' : '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      {onboarding[0].checklist[key] ? <Check size={12} /> : '○'} {label}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Sub-Tasks */}
      {member.subTasks && member.subTasks.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Sub-Tasks ({member.subTasks.filter(t => t.done).length}/{member.subTasks.length})</div>
          <div style={{ height: '4px', background: '#1e2540', borderRadius: '4px', marginBottom: '12px' }}>
            <div style={{ height: '100%', width: `${member.subTasks.length > 0 ? (member.subTasks.filter(t => t.done).length / member.subTasks.length) * 100 : 0}%`, background: '#22c55e', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {member.subTasks.map((task, i) => (
              <div key={task._id || i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#161b2e', borderRadius: '8px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '6px', border: task.done ? 'none' : '2px solid #3a4060', background: task.done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {task.done && <Check size={12} color="#fff" />}
                </span>
                <span style={{ flex: 1, color: task.done ? '#6b7280' : '#fff', fontSize: '13px', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
                {task.assignee && <span style={{ color: '#8892b0', fontSize: '11px' }}>{task.assignee}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSales = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {leads.length === 0 ? (
        <div style={{ ...card, ...emptyState }}>No sales pipeline entries found for this member.</div>
      ) : leads.map((lead) => (
        <div key={lead._id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: lead.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff' }}>{lead.initials}</div>
              <div>
                <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{lead.name}</div>
                <div style={{ color: '#8892b0', fontSize: '12px' }}>{lead.email}</div>
              </div>
            </div>
            <Badge label={lead.stage} colorMap={stageColors} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div style={infoBox}><div style={infoLabel}>Source</div><div style={infoVal}>{lead.source || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>Priority</div><div style={infoVal}><span style={{ textTransform: 'capitalize' }}>{lead.priority}</span></div></div>
            <div style={infoBox}><div style={infoLabel}>Phone</div><div style={infoVal}>{lead.phone || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>SPOC</div><div style={infoVal}>{lead.spoc || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>Created</div><div style={infoVal}>{fmtDate(lead.createdAt)}</div></div>
          </div>

          {/* Stage-specific details */}
          {lead.stage === 'New Enquiry' && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>New Enquiry Details</div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                <span>Call Done: <strong style={{ color: lead.callDone ? '#34d399' : '#f87171' }}>{lead.callDone ? 'Yes' : 'No'}</strong></span>
              </div>
              {lead.inquiryNotes && <div style={{ color: '#8892b0', fontSize: '12px', marginTop: '6px' }}>Notes: {lead.inquiryNotes}</div>}
            </div>
          )}

          {lead.stage === 'Meeting Set' && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>Meeting Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                <span>Date: {lead.meetingDate || '—'}</span>
                <span>With: {lead.meetingAssignedWith || '—'}</span>
                {lead.meetingLink && <span style={{ gridColumn: '1/3' }}>Link: <a href={lead.meetingLink} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{lead.meetingLink}</a></span>}
              </div>
              {lead.meetingNotes && <div style={{ color: '#8892b0', fontSize: '12px', marginTop: '6px' }}>Notes: {lead.meetingNotes}</div>}
            </div>
          )}

          {lead.stage === 'Qualified Lead' && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>Qualification</div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                <span>Inquiry Verified: <strong style={{ color: lead.inquiryVerified ? '#34d399' : '#f87171' }}>{lead.inquiryVerified ? 'Yes' : 'No'}</strong></span>
                <span>Meeting Verified: <strong style={{ color: lead.meetingVerified ? '#34d399' : '#f87171' }}>{lead.meetingVerified ? 'Yes' : 'No'}</strong></span>
              </div>
            </div>
          )}

          {lead.movedToOnboarding && (
            <div style={{ padding: '10px 16px', background: '#065f4620', borderRadius: '8px', border: '1px solid #065f46', fontSize: '13px', color: '#34d399' }}>
              ✓ Moved to Onboarding {lead.onboardedAt ? `on ${fmtDate(lead.onboardedAt)}` : ''} {lead.onboardingSpoc ? `— SPOC: ${lead.onboardingSpoc}` : ''}
            </div>
          )}

          {lead.notes && (
            <div style={{ fontSize: '12px', color: '#8892b0', marginTop: '8px' }}>Notes: {lead.notes}</div>
          )}
        </div>
      ))}
    </div>
  );

  const renderOnboarding = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {onboarding.length === 0 ? (
        <div style={{ ...card, ...emptyState }}>No onboarding entries found for this member.</div>
      ) : onboarding.map((entry) => (
        <div key={entry._id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{entry.name}</div>
              <div style={{ color: '#8892b0', fontSize: '12px' }}>{entry.email} · {entry.contractType}</div>
            </div>
            <Badge label={entry.stage} colorMap={stageColors} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div style={infoBox}><div style={infoLabel}>Role</div><div style={infoVal}>{Array.isArray(entry.role) ? entry.role.join(', ') : entry.role || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>Phone</div><div style={infoVal}>{entry.phone || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>SPOC</div><div style={infoVal}>{entry.spoc || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>Priority</div><div style={{ ...infoVal, textTransform: 'capitalize' }}>{entry.priority || '—'}</div></div>
            <div style={infoBox}><div style={infoLabel}>Created</div><div style={infoVal}>{fmtDate(entry.createdAt)}</div></div>
          </div>

          {/* Documents */}
          {entry.documents && entry.documents.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ ...infoLabel, marginBottom: '8px' }}>Documents</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {entry.documents.map((doc, i) => (
                  <div key={i} style={{ padding: '8px 14px', background: '#161b2e', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={13} color="#8892b0" />
                    <span style={{ color: '#fff', fontWeight: 500 }}>{doc.label}</span>
                    <span style={{ color: doc.received ? '#34d399' : doc.requested ? '#fbbf24' : '#6b7280', fontSize: '11px' }}>
                      {doc.received ? '✓ Received' : doc.requested ? '● Requested' : '○ Not Requested'}
                    </span>
                    {doc.docNumber && <span style={{ color: '#8892b0', fontSize: '11px', fontFamily: 'monospace' }}>{doc.docNumber}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contract Details */}
          {(entry.contractSent || entry.contractReceived || entry.contractStartDate) && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>Contract</div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                <span>Sent: <strong style={{ color: entry.contractSent ? '#34d399' : '#f87171' }}>{entry.contractSent ? 'Yes' : 'No'}</strong></span>
                <span>Received: <strong style={{ color: entry.contractReceived ? '#34d399' : '#f87171' }}>{entry.contractReceived ? 'Yes' : 'No'}</strong></span>
                {entry.contractStartDate && <span>Start: {fmtDate(entry.contractStartDate)}</span>}
                {entry.contractRenewalDate && <span>Renewal: {fmtDate(entry.contractRenewalDate)}</span>}
              </div>
              {entry.contractFileName && <div style={{ color: '#60a5fa', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {entry.contractFileName}</div>}
              {(entry.renewalType || entry.renewalRemarks) && (
                <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                  {entry.renewalType && <span>Renewal Type: <strong style={{ color: '#c4b5fd' }}>{entry.renewalType}</strong></span>}
                  {entry.renewalRemarks && <span>Remarks: <strong style={{ color: '#9ca3af' }}>{entry.renewalRemarks}</strong></span>}
                </div>
              )}
            </div>
          )}

          {/* Selected Societies */}
          {entry.selectedSocieties && entry.selectedSocieties.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>Selected Societies</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {entry.selectedSocieties.map((s) => (
                  <span key={s} style={{ padding: '3px 10px', background: '#4c1d95', color: '#c4b5fd', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Contact Made */}
          {(entry.addedToWhatsApp || entry.emailCreated) && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px', marginBottom: '10px' }}>
              <div style={infoLabel}>Contact Made</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '13px', color: '#fff' }}>
                {entry.addedToWhatsApp && <span>✓ Added to WhatsApp {entry.whatsAppGroupName ? `(${entry.whatsAppGroupName})` : ''}</span>}
                {entry.emailCreated && <span>✓ Email Created: {entry.createdEmailAddress || '—'}</span>}
                {entry.clientNumber && <span>MRM Membership ID: <strong>{entry.clientNumber}</strong></span>}
              </div>
            </div>
          )}

          {/* Checklist */}
          {entry.checklist && (
            <div style={{ padding: '12px 16px', background: '#161b2e', borderRadius: '8px' }}>
              <div style={infoLabel}>Checklist</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px', fontSize: '12px' }}>
                {[
                  { key: 'docs_submitted', label: 'Docs Submitted' },
                  { key: 'kyc_verified', label: 'KYC Verified' },
                  { key: 'contract_signed', label: 'Contract Signed' },
                  { key: 'review_complete', label: 'Review Complete' },
                  { key: 'member_activated', label: 'Member Activated' },
                ].map(({ key, label }) => (
                  <span key={key} style={{ color: entry.checklist[key] ? '#34d399' : '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {entry.checklist[key] ? <Check size={12} /> : '○'} {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderSociety = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {societyRegs.length === 0 ? (
        <div style={{ ...card, ...emptyState }}>No society registration entries found for this member.</div>
      ) : societyRegs.map((reg) => (
        <div key={reg._id} style={card}>
          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>{reg.name}</div>

          {/* Society grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {reg.societies && Object.entries(
              reg.societies instanceof Map ? Object.fromEntries(reg.societies) : reg.societies
            ).map(([society, data]) => (
              <SocietyCard key={society} society={society} data={data} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderRoyalty = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {royalties.length === 0 ? (
        <div style={{ ...card, ...emptyState }}>No royalty entries found for this member.</div>
      ) : royalties.map((royalty) => (
        <div key={royalty._id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{royalty.clientName}</div>
              <div style={{ color: '#8892b0', fontSize: '12px' }}>{royalty.clientEmail || '—'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: royalty.documentsReceived ? '#34d399' : '#f87171' }}>
              <FileText size={13} /> {royalty.documentsReceived ? 'Documents Received' : 'Documents Pending'}
            </div>
          </div>

          {royalty.documentFileName && (
            <div style={{ fontSize: '12px', color: '#60a5fa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> {royalty.documentFileName}</div>
          )}

          {/* Year-wise data */}
          {royalty.years && royalty.years.length > 0 && royalty.years.map((yearData, yi) => (
            <RoyaltyYearCard key={yi} yearData={yearData} />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/members')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: '13px', marginBottom: '20px', padding: 0 }}
      >
        <ArrowLeft size={16} /> Back to Members
      </button>

      {/* Profile Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '24px 28px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {member.initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 }}>{member.name}</h1>
            <Badge label={member.status} colorMap={statusColors} />
            <Badge label={`KYC: ${member.kycStatus}`} colorMap={{ 'KYC: Verified': kycColors.Verified, 'KYC: Pending': kycColors.Pending, 'KYC: Rejected': kycColors.Rejected }} />
          </div>
          <div style={{ color: '#8892b0', fontSize: '14px' }}>
            {Array.isArray(member.role) ? member.role.join(', ') : member.role} {member.genre ? `· ${member.genre}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '8px', fontSize: '13px', color: '#8892b0' }}>
            {member.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={13} /> {member.email}</span>}
            {member.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={13} /> {member.phone}</span>}
            {member.spoc && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={13} /> SPOC: {member.spoc}</span>}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '4px', background: '#141720', borderRadius: '10px', padding: '4px', marginBottom: '24px', overflowX: 'auto' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              background: activeTab === tab.key ? '#1e2540' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#8892b0',
              transition: 'all 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {tab.label}
            {counts[tab.key] !== undefined && (
              <span style={{
                background: activeTab === tab.key ? '#3b82f6' : '#2a3050',
                color: activeTab === tab.key ? '#fff' : '#8892b0',
                padding: '1px 7px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, minWidth: '20px', textAlign: 'center',
              }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'sales' && renderSales()}
      {activeTab === 'onboarding' && renderOnboarding()}
      {activeTab === 'society' && renderSociety()}
      {activeTab === 'royalty' && renderRoyalty()}
    </div>
  );
};

/* ─── Society Card sub-component ─── */
const SocietyCard = ({ society, data }) => {
  const [expanded, setExpanded] = useState(false);
  const steps = data.steps || {};
  const stepEntries = [
    ['Territory Withdrawal', steps.territoryWithdrawal],
    ['NOC Received', steps.nocReceived],
    ['Application Filed', steps.applicationFiled],
    ['Payment Done', steps.paymentDone],
    ['Application Signed', steps.applicationSigned],
    ['Sent to Society', steps.applicationSentToSociety],
    ['Membership Confirmed', steps.membershipConfirmation],
    ['Login Details', steps.loginDetails],
    ['3rd Party Auth', steps.thirdPartyAuthorization],
    ['Bank Mandate', steps.bankMandateUpdate],
  ];
  const completedSteps = stepEntries.filter(([, v]) => v === 'Yes').length;

  const stepColor = (val) => {
    if (val === 'Yes') return '#34d399';
    if (val === 'No') return '#f87171';
    return '#6b7280';
  };

  return (
    <div style={{ background: '#161b2e', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{society}</div>
          <div style={{ fontSize: '11px', color: '#8892b0', marginTop: '2px' }}>{completedSteps}/{stepEntries.length} steps</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge label={data.status || 'N/A'} colorMap={regStatusColors} />
          {expanded ? <ChevronUp size={14} color="#8892b0" /> : <ChevronDown size={14} color="#8892b0" />}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: '#1e2540', borderRadius: '3px', marginTop: '8px' }}>
        <div style={{ height: '100%', width: `${stepEntries.length > 0 ? (completedSteps / stepEntries.length) * 100 : 0}%`, background: '#22c55e', borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {stepEntries.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
              <span style={{ color: '#8892b0' }}>{label}</span>
              <span style={{ color: stepColor(val), fontWeight: 600 }}>{val || 'NA'}</span>
            </div>
          ))}
          {steps.loginId && (
            <div style={{ marginTop: '4px', padding: '8px 10px', background: '#1a1f2e', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#8892b0' }}>Login: </span><span style={{ color: '#fff', fontFamily: 'monospace' }}>{steps.loginId}</span>
            </div>
          )}
          {steps.caeNumber && (
            <div style={{ marginTop: '4px', padding: '8px 10px', background: '#1a1f2e', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#8892b0' }}>CAE Number: </span><span style={{ color: '#fff', fontFamily: 'monospace' }}>{steps.caeNumber}</span>
            </div>
          )}
          {steps.commissionRate && (
            <div style={{ marginTop: '4px', padding: '8px 10px', background: '#1a1f2e', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#8892b0' }}>Commission Rate: </span><span style={{ color: '#fff', fontFamily: 'monospace' }}>{steps.commissionRate}</span>
            </div>
          )}
          {data.assignee && data.assignee.name && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#8892b0' }}>Assigned to: <span style={{ color: '#fff' }}>{data.assignee.name}</span></div>
          )}
          {data.remarks && data.remarks.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '4px' }}>Remarks</div>
              {data.remarks.map((r, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#cbd5e1', padding: '2px 0' }}>• {r.text} <span style={{ color: '#6b7280' }}>({fmtDate(r.createdAt)})</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Royalty Year Card sub-component ─── */
const RoyaltyYearCard = ({ yearData }) => {
  const [expanded, setExpanded] = useState(false);
  const months = yearData.months
    ? (yearData.months instanceof Map ? Object.fromEntries(yearData.months) : (typeof yearData.months === 'object' ? yearData.months : {}))
    : {};
  const monthKeys = Object.keys(months);

  return (
    <div style={{ background: '#161b2e', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}><Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />{yearData.year}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#8892b0' }}>{monthKeys.filter(m => months[m]?.fileReceived).length} / {monthKeys.length} months received</span>
          {expanded ? <ChevronUp size={14} color="#8892b0" /> : <ChevronDown size={14} color="#8892b0" />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {monthKeys.map((mon) => {
            const md = months[mon] || {};
            return (
              <div key={mon} style={{ padding: '10px', background: '#1a1f2e', borderRadius: '8px', borderLeft: `3px solid ${md.fileReceived ? '#22c55e' : '#374151'}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{mon}</div>
                <div style={{ fontSize: '11px', color: md.fileReceived ? '#34d399' : '#6b7280' }}>{md.fileReceived ? '✓ Received' : '○ Pending'}</div>
                {(md.totalSongs > 0 || md.totalBGMMovies > 0 || md.totalTVBGM > 0) && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#8892b0' }}>
                    {md.totalSongs > 0 && <div>Songs: {md.totalSongs}</div>}
                    {md.totalBGMMovies > 0 && <div>BGM Movies: {md.totalBGMMovies}</div>}
                    {md.totalTVBGM > 0 && <div>TV BGM: {md.totalTVBGM}</div>}
                    {md.totalTVBGMEpisode > 0 && <div>TV Episodes: {md.totalTVBGMEpisode}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemberProfile;
