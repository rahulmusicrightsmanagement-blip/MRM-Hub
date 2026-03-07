import { useState, useEffect, useRef } from 'react';
import { Plus, X, ArrowRight, Upload, FileText, Eye, Trash2, MessageSquarePlus, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';

/* ─── 12 Collecting Societies ─── */
const SOCIETIES = [
  { key: 'IPRS', name: 'Indian Performing Right Society', flag: '🇮🇳' },
  { key: 'PRS', name: 'PRS for Music', flag: '🇬🇧' },
  { key: 'ASCAP', name: 'American Society of Composers', flag: '🇺🇸' },
  { key: 'PPL(INDIA)', name: 'Phonographic Performance Ltd (India)', flag: '🇮🇳' },
  { key: 'PPL(UK)', name: 'Phonographic Performance Ltd (UK)', flag: '🇬🇧' },
  { key: 'SOUND EXCHANGE', name: 'SoundExchange', flag: '🇺🇸' },
  { key: 'ISAMRA', name: 'Indian Singers & Musicians Rights Association', flag: '🇮🇳' },
  { key: 'BMI', name: 'Broadcast Music Inc.', flag: '🇺🇸' },
  { key: 'GEMA', name: 'Gesellschaft für musikalische Aufführungs', flag: '🇩🇪' },
  { key: 'MLC', name: 'The Mechanical Licensing Collective', flag: '🇺🇸' },
  { key: 'IMRO', name: 'Irish Music Rights Organisation', flag: '🇮🇪' },
  { key: 'SOCAN', name: 'Society of Composers, Authors', flag: '🇨🇦' },
];

/* ─── 10 tracking steps (plus remarks) ─── */
const STEP_DEFINITIONS = [
  { key: 'territoryWithdrawal', label: 'Territory Withdrawal', num: 1 },
  { key: 'nocReceived', label: 'NOC Received', num: 2 },
  { key: 'applicationFiled', label: 'Application Filed', num: 3 },
  { key: 'paymentDone', label: 'Payment Done', num: 4 },
  { key: 'applicationSigned', label: 'Application Signed', num: 5 },
  { key: 'applicationSentToSociety', label: 'Application Sent to Society', num: 6, hasUpload: true },
  { key: 'membershipConfirmation', label: 'Membership Confirmation', num: 7 },
  { key: 'loginDetails', label: 'Login Details', num: 8, hasLogin: true },
  { key: 'thirdPartyAuthorization', label: 'Third Party Authorization Done', num: 9 },
  { key: 'bankMandateUpdate', label: 'Bank Mandate Update', num: 10 },
];

/* ─── Shared styles ─── */
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };
const cardBg = '#161b2e';
const cardBorder = '1px solid #1e2540';
const sectionStyle = { backgroundColor: cardBg, border: cardBorder, borderRadius: '10px', padding: '16px', marginBottom: '10px' };

/* Status badges */
const STATUS = {
  Registered: { bg: '#064e3b', color: '#6ee7b7', text: 'Registered' },
  'In Progress': { bg: '#1e3a5f', color: '#7dd3fc', text: 'In Progress' },
  'Not Started': { bg: '#27272a', color: '#a1a1aa', text: 'Not Started' },
  'N/A': { bg: '#1c1c1e', color: '#52525b', text: 'N/A' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS['N/A'];
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.text}</span>;
};

/* ─── Yes / No / NA Triple Toggle ─── */
const TripleToggle = ({ value, onChange }) => {
  const btnBase = { padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s' };
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={() => onChange('Yes')} style={{ ...btnBase, background: value === 'Yes' ? '#166534' : '#1e2540', color: value === 'Yes' ? '#86efac' : '#6b7280', border: value === 'Yes' ? '1px solid #22c55e' : '1px solid #2d3348' }}>Yes</button>
      <button onClick={() => onChange('No')} style={{ ...btnBase, background: value === 'No' ? '#991b1b' : '#1e2540', color: value === 'No' ? '#fca5a5' : '#6b7280', border: value === 'No' ? '1px solid #ef4444' : '1px solid #2d3348' }}>No</button>
      <button onClick={() => onChange('NA')} style={{ ...btnBase, background: value === 'NA' ? '#374151' : '#1e2540', color: value === 'NA' ? '#d1d5db' : '#6b7280', border: value === 'NA' ? '1px solid #6b7280' : '1px solid #2d3348' }}>N/A</button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   In-Progress Steps Panel — shown when viewing an "In Progress" society
   ═══════════════════════════════════════════════════════ */
const StepsPanel = ({ regId, societyKey, steps, remarks, onUpdated, authFetch, token, readOnly = false }) => {
  const { addToast } = useToast();
  const [localSteps, setLocalSteps] = useState(steps || {});
  const [newRemark, setNewRemark] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { setLocalSteps(steps || {}); }, [steps]);

  const saveStep = async (key, value) => {
    const updated = { ...localSteps, [key]: value };
    setLocalSteps(updated);
    try {
      const res = await authFetch(`/api/societyregs/${regId}/steps`, { method: 'PUT', body: JSON.stringify({ society: societyKey, steps: { [key]: value } }) });
      const data = await res.json();
      if (res.ok) { onUpdated(data.registration); addToast('Step updated'); }
      else addToast('Failed to update step', 'error');
    } catch (err) { console.error(err); addToast('Failed to update step', 'error'); }
  };

  const saveLoginField = async (field, value) => {
    const updated = { ...localSteps, [field]: value };
    setLocalSteps(updated);
    try {
      const res = await authFetch(`/api/societyregs/${regId}/steps`, { method: 'PUT', body: JSON.stringify({ society: societyKey, steps: { [field]: value } }) });
      const data = await res.json();
      if (res.ok) onUpdated(data.registration);
      else addToast('Failed to save', 'error');
    } catch (err) { console.error(err); addToast('Failed to save', 'error'); }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('society', societyKey);
      const res = await fetch(`/api/societyregs/${regId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) { onUpdated(data.registration); addToast('Document uploaded to Google Drive'); }
      else addToast('Upload failed', 'error');
    } catch (err) { console.error(err); addToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const addRemark = async () => {
    if (!newRemark.trim()) return;
    try {
      const res = await authFetch(`/api/societyregs/${regId}/remarks`, { method: 'POST', body: JSON.stringify({ society: societyKey, text: newRemark.trim() }) });
      const data = await res.json();
      if (res.ok) { onUpdated(data.registration); setNewRemark(''); addToast('Remark added'); }
      else addToast('Failed to add remark', 'error');
    } catch (err) { console.error(err); addToast('Failed to add remark', 'error'); }
  };

  const deleteRemark = async (remarkId) => {
    try {
      const res = await authFetch(`/api/societyregs/${regId}/remarks`, {
        method: 'DELETE',
        body: JSON.stringify({ society: societyKey, remarkId }),
      });
      const data = await res.json();
      if (res.ok) { onUpdated(data.registration); addToast('Remark removed'); }
      else addToast('Failed to remove remark', 'error');
    } catch (err) { console.error(err); addToast('Failed to remove remark', 'error'); }
  };

  return (
    <div style={{ padding: '16px 18px', borderTop: '1px solid #1e2540' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Registration Progress — {societyKey}</p>

      {/* Steps 1–10 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEP_DEFINITIONS.map((step) => (
          <div key={step.key} style={{ ...sectionStyle, marginBottom: 0, padding: '12px 16px' }}>
            {/* Step row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  background: localSteps[step.key] === 'Yes' ? '#166534' : localSteps[step.key] === 'No' ? '#991b1b' : '#1e2540',
                  color: localSteps[step.key] === 'Yes' ? '#86efac' : localSteps[step.key] === 'No' ? '#fca5a5' : '#6b7280',
                  border: localSteps[step.key] === 'Yes' ? '1px solid #22c55e' : localSteps[step.key] === 'No' ? '1px solid #ef4444' : '1px solid #2d3348',
                }}>{step.num}</span>
                <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>{step.label}</span>
              </div>
              {readOnly ? (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px',
                  background: (localSteps[step.key] || 'NA') === 'Yes' ? '#166534' : (localSteps[step.key] || 'NA') === 'No' ? '#991b1b' : '#374151',
                  color: (localSteps[step.key] || 'NA') === 'Yes' ? '#86efac' : (localSteps[step.key] || 'NA') === 'No' ? '#fca5a5' : '#d1d5db',
                }}>{localSteps[step.key] || 'N/A'}</span>
              ) : (
                <TripleToggle value={localSteps[step.key] || 'NA'} onChange={(val) => saveStep(step.key, val)} />
              )}
            </div>

            {/* Step 6: Upload document */}
            {step.hasUpload && localSteps[step.key] === 'Yes' && (
              <div style={{ marginTop: '10px', paddingLeft: '34px' }}>
                {localSteps.applicationSentFileName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText style={{ width: '14px', height: '14px', color: '#10b981' }} />
                    {localSteps.applicationSentFileUrl ? (
                      <a href={localSteps.applicationSentFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#818cf8', textDecoration: 'underline' }}>{localSteps.applicationSentFileName}</a>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#e5e7eb' }}>{localSteps.applicationSentFileName}</span>
                    )}
                  </div>
                ) : null}
                {!readOnly && (
                  <>
                    <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) uploadFile(e.target.files[0]); }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: '1px dashed #3a3f60', background: 'transparent', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                      <Upload style={{ width: '14px', height: '14px' }} /> {uploading ? 'Uploading...' : localSteps.applicationSentFileName ? 'Replace Document' : 'Upload Document'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Step 8: Login details (ID & Password) */}
            {step.hasLogin && localSteps[step.key] === 'Yes' && (
              <div style={{ marginTop: '10px', paddingLeft: '34px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Login ID</label>
                  {readOnly ? (
                    <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.loginId || '—'}</p>
                  ) : (
                    <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                      placeholder="Enter login ID..."
                      value={localSteps.loginId || ''}
                      onChange={(e) => setLocalSteps((p) => ({ ...p, loginId: e.target.value }))}
                      onBlur={(e) => saveLoginField('loginId', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveLoginField('loginId', e.target.value)}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Password</label>
                  {readOnly ? (
                    <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.loginPassword || '—'}</p>
                  ) : (
                    <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                      placeholder="Enter password..."
                      value={localSteps.loginPassword || ''}
                      onChange={(e) => setLocalSteps((p) => ({ ...p, loginPassword: e.target.value }))}
                      onBlur={(e) => saveLoginField('loginPassword', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveLoginField('loginPassword', e.target.value)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step 11: Remarks */}
      <div style={{ ...sectionStyle, marginTop: '8px', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, background: '#1e2540', color: '#6b7280', border: '1px solid #2d3348' }}>11</span>
          <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>Remarks</span>
        </div>

        {/* Existing remarks */}
        {(remarks || []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', paddingLeft: '34px' }}>
            {remarks.map((r) => (
              <div key={r._id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '6px', border: '1px solid #2d3348' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: '1.4' }}>{r.text}</p>
                  <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</p>
                </div>
                {!readOnly && <button onClick={() => deleteRemark(r._id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                  <Trash2 style={{ width: '12px', height: '12px' }} />
                </button>}
              </div>
            ))}
          </div>
        )}

        {/* Add new remark */}
        {!readOnly && (
          <div style={{ paddingLeft: '34px', display: 'flex', gap: '8px' }}>
            <input style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: '13px' }}
              placeholder="Add a remark..."
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRemark()}
            />
            <button onClick={addRemark} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <MessageSquarePlus style={{ width: '14px', height: '14px' }} /> Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Start Registration Modal
   ═══════════════════════════════════════════════════════ */
const StartRegModal = ({ members, teamMembers, onClose, onStart }) => {
  const [form, setForm] = useState({ member: '', society: '', ipi: '', spoc: '', notes: '' });

  const handleSubmit = () => {
    if (!form.member || !form.society) return;
    onStart(form);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: '32px', width: '560px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>Start Society Registration</h2>
          <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
        </div>

        <div style={{ backgroundColor: '#1a2440', border: '1px solid #2d3a5a', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: '#93a3c0', lineHeight: '1.5' }}>
            Select a member and a collecting society to initiate the registration process.
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <SearchableSelect label="Member" required options={members} value={form.member} onChange={(name) => setForm({ ...form, member: name })} placeholder="Search member..." emptyMessage="No members found." />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Collecting Society *</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.society} onChange={(e) => setForm({ ...form, society: e.target.value })}>
            <option value="">Select...</option>
            {SOCIETIES.map((s) => <option key={s.key} value={s.key}>{s.flag} {s.key} — {s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>IPI Number</label>
          <input style={inputStyle} placeholder="e.g. OO987654321" value={form.ipi} onChange={(e) => setForm({ ...form, ipi: e.target.value })} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Assign SPOC</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.spoc} onChange={(e) => setForm({ ...form, spoc: e.target.value })}>
            <option value="">Select a team member...</option>
            {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} placeholder="Any additional notes for the registration..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowRight style={{ width: '16px', height: '16px' }} /> Start Registration
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Member Detail Modal — shows all 12 societies with expand for steps
   ═══════════════════════════════════════════════════════ */
const MemberDetailModal = ({ member, onClose, onAssignAndStart, onMarkDone, onUpdated, onDelete, onRename, teamMembers, authFetch, token }) => {
  const [assigningKey, setAssigningKey] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [confirmDone, setConfirmDone] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(member.name || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const getSocietyEntry = (socKey) => {
    if (member.societies instanceof Map) return member.societies.get(socKey) || null;
    if (member.societies && typeof member.societies === 'object') return member.societies[socKey] || null;
    return null;
  };

  const getSocietyStatus = (socKey) => {
    const entry = getSocietyEntry(socKey);
    if (!entry) return 'N/A';
    return typeof entry === 'string' ? entry : entry.status || 'N/A';
  };

  const getAssignee = (socKey) => {
    if (member.assignees instanceof Map) return member.assignees.get(socKey) || null;
    if (member.assignees && typeof member.assignees === 'object') return member.assignees[socKey] || null;
    return null;
  };

  const handleAssign = async (socKey, tm) => {
    setActionLoading(socKey);
    await onAssignAndStart(member._id || member.name, socKey, tm);
    setAssigningKey(null);
    setActionLoading(null);
  };

  const handleDone = async (socKey) => {
    setActionLoading(socKey);
    await onMarkDone(member._id || member.name, socKey);
    setConfirmDone(null);
    setActionLoading(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: '0', width: '700px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}>
        <div style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2d3348', position: 'sticky', top: 0, backgroundColor: '#1e2235', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      setSaving(true);
                      await onRename(member._id, editName.trim());
                      setIsEditing(false);
                      setSaving(false);
                    } else if (e.key === 'Escape') {
                      setEditName(member.name);
                      setIsEditing(false);
                    }
                  }}
                  style={{ ...inputStyle, fontSize: '18px', fontWeight: 700, padding: '4px 10px', flex: 1 }}
                />
                <button disabled={saving || !editName.trim()} onClick={async () => {
                  setSaving(true);
                  await onRename(member._id, editName.trim());
                  setIsEditing(false);
                  setSaving(false);
                }} style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setEditName(member.name); setIsEditing(false); }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #2d3348', background: 'transparent', color: '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name} — Registrations</h2>
                <Edit3 style={{ width: '16px', height: '16px', color: '#6b7280', cursor: 'pointer', flexShrink: 0 }} onClick={() => setIsEditing(true)} title="Edit name" />
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
            {!confirmDelete ? (
              <Trash2 style={{ width: '18px', height: '18px', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }} onClick={() => setConfirmDelete(true)} title="Delete registration" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#fca5a5' }}>Delete?</span>
                <button onClick={() => { onDelete(member._id); onClose(); }} style={{ padding: '3px 12px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Yes</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #2d3348', background: 'transparent', color: '#9ca3af', fontSize: '11px', cursor: 'pointer' }}>No</button>
              </div>
            )}
            <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {SOCIETIES.map((soc) => {
              const status = getSocietyStatus(soc.key);
              const assignee = getAssignee(soc.key);
              const socEntry = getSocietyEntry(soc.key);
              const isAssigning = assigningKey === soc.key;
              const isExpanded = expandedKey === soc.key;
              const isConfirmingDone = confirmDone === soc.key;
              const isLoading = actionLoading === soc.key;

              return (
                <div key={soc.key} style={{ backgroundColor: cardBg, border: cardBorder, borderRadius: '10px', overflow: 'hidden' }}>
                  {/* Main row */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{soc.flag}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{soc.key}</p>
                        <p style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soc.name}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {assignee && assignee.name && (
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: assignee.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 700, flexShrink: 0 }} title={assignee.name}>
                          {assignee.initials || assignee.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <StatusBadge status={status} />

                      {(status === 'Not Started' || status === 'N/A') && (
                        <button onClick={() => { setAssigningKey(isAssigning ? null : soc.key); setExpandedKey(null); setConfirmDone(null); }} disabled={isLoading}
                          style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                          Assign
                        </button>
                      )}

                      {status === 'In Progress' && (
                        <>
                          <button onClick={() => { setExpandedKey(isExpanded ? null : soc.key); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            {isExpanded ? 'Close' : 'View'}
                          </button>
                          <button onClick={() => { setConfirmDone(isConfirmingDone ? null : soc.key); setExpandedKey(null); setAssigningKey(null); }} disabled={isLoading}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            Done
                          </button>
                        </>
                      )}

                      {status === 'Registered' && (
                        <>
                          <button onClick={() => { setExpandedKey(isExpanded ? null : soc.key); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            {isExpanded ? 'Close' : 'View'}
                          </button>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>✓</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Assign dropdown */}
                  {isAssigning && (
                    <div style={{ padding: '0 18px 14px', borderTop: '1px solid #1e2540' }}>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '12px 0 8px', fontWeight: 500 }}>Select team member to assign & start:</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select autoFocus defaultValue="" onChange={(e) => { const tm = teamMembers.find((m) => m.name === e.target.value); if (tm) handleAssign(soc.key, tm); }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                          <option value="">Select team member...</option>
                          {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
                        </select>
                        <button onClick={() => setAssigningKey(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Steps panel — shown when expanded for In Progress or Registered (read-only) */}
                  {isExpanded && (status === 'In Progress' || status === 'Registered') && (
                    <StepsPanel
                      regId={member._id}
                      societyKey={soc.key}
                      steps={socEntry?.steps || {}}
                      remarks={socEntry?.remarks || []}
                      onUpdated={onUpdated}
                      authFetch={authFetch}
                      token={token}
                      readOnly={status === 'Registered'}
                    />
                  )}

                  {/* Done confirmation */}
                  {isConfirmingDone && (
                    <div style={{ padding: '0 18px 14px', borderTop: '1px solid #1e2540' }}>
                      <div style={{ marginTop: '12px', padding: '14px 16px', backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p style={{ fontSize: '13px', color: '#a7f3d0', marginBottom: '12px', fontWeight: 500 }}>
                          Confirm that <strong>{soc.key}</strong> registration for <strong>{member.name}</strong> is completed?
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setConfirmDone(null)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => handleDone(soc.key)} disabled={isLoading}
                            style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '12px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}>
                            {isLoading ? 'Saving...' : 'Confirm Done'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Main Society Registration Page
   ═══════════════════════════════════════════════════════ */
const SocietyReg = () => {
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regsRes, usersRes, membersRes] = await Promise.all([
          authFetch('/api/societyregs'),
          authFetch('/api/users'),
          authFetch('/api/members'),
        ]);
        const regsData = await regsRes.json();
        const usersData = await usersRes.json();
        const membersData = await membersRes.json();

        const regs = (regsData.registrations || []).map((reg) => ({
          ...reg,
          societies: reg.societies || {},
          assignees: reg.assignees || {},
        }));

        setMembers(regs);
        setTeamMembers(usersData.users || []);
        setAllMembers(membersData.members || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authFetch]);

  const getSocStatus = (member, socKey) => {
    const entry = member.societies?.[socKey];
    if (!entry) return 'N/A';
    return typeof entry === 'string' ? entry : entry.status || 'N/A';
  };

  const allStatuses = members.flatMap((m) =>
    SOCIETIES.map((s) => getSocStatus(m, s.key)).filter((s) => s !== 'N/A')
  );
  const registeredCount = allStatuses.filter((s) => s === 'Registered').length;
  const inProgressCount = allStatuses.filter((s) => s === 'In Progress').length;
  const notStartedCount = allStatuses.filter((s) => s === 'Not Started').length;

  const refreshReg = (updated) => {
    const norm = { ...updated, societies: updated.societies || {}, assignees: updated.assignees || {} };
    setMembers((prev) => prev.map((m) => (m._id === norm._id ? norm : m)));
    setSelectedMember((prev) => (prev && prev._id === norm._id ? norm : prev));
  };

  const handleStartRegistration = async (form) => {
    try {
      const res = await authFetch('/api/societyregs', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        const regsRes = await authFetch('/api/societyregs');
        const regsData = await regsRes.json();
        setMembers((regsData.registrations || []).map((reg) => ({
          ...reg, societies: reg.societies || {}, assignees: reg.assignees || {},
        })));
        addToast('Registration started');
      } else addToast('Failed to start registration', 'error');
    } catch (err) { console.error(err); addToast('Failed to start registration', 'error'); }
  };

  const handleAssignAndStart = async (memberId, societyKey, teamMember) => {
    try {
      const reg = members.find((m) => m._id === memberId || m.name === memberId);
      if (!reg) return;
      const assignee = {
        name: teamMember.name,
        initials: teamMember.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
        color: '#6366f1',
      };
      const res = await authFetch(`/api/societyregs/${reg._id}`, { method: 'PUT', body: JSON.stringify({ society: societyKey, status: 'In Progress', assignee }) });
      const data = await res.json();
      if (res.ok) { refreshReg(data.registration); addToast(`Assigned to ${teamMember.name}`); }
      else addToast('Failed to assign registration', 'error');
    } catch (err) { console.error(err); addToast('Failed to assign registration', 'error'); }
  };

  const handleMarkDone = async (memberId, societyKey) => {
    try {
      const reg = members.find((m) => m._id === memberId || m.name === memberId);
      if (!reg) return;
      const res = await authFetch(`/api/societyregs/${reg._id}`, { method: 'PUT', body: JSON.stringify({ society: societyKey, status: 'Registered' }) });
      const data = await res.json();
      if (res.ok) { refreshReg(data.registration); addToast(`${societyKey} marked as Registered`); }
      else addToast('Failed to update registration', 'error');
    } catch (err) { console.error(err); addToast('Failed to update registration', 'error'); }
  };

  const handleDeleteMember = async (id) => {
    try {
      const res = await authFetch(`/api/societyregs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m._id !== id));
        setSelectedMember(null);
        addToast('Registration deleted');
      } else addToast('Failed to delete registration', 'error');
    } catch (err) { console.error(err); addToast('Failed to delete registration', 'error'); }
  };

  const handleRenameMember = async (id, newName) => {
    try {
      const res = await authFetch(`/api/societyregs/${id}/rename`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      const data = await res.json();
      if (res.ok) { refreshReg(data.registration); addToast('Name updated'); }
      else addToast('Failed to rename', 'error');
    } catch (err) { console.error(err); addToast('Failed to rename', 'error'); }
  };

  const statCardStyle = { backgroundColor: cardBg, border: cardBorder, borderRadius: '12px', padding: '20px 24px', minWidth: '140px' };
  const cellStyle = { padding: '14px 6px', textAlign: 'center', borderBottom: '1px solid #1e2540', fontSize: '11px' };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading registrations...</div>;

  return (
    <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white' }}>Collecting Society Registrations</h1>
          <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> Start Registration
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Manage member registrations across 12 collecting societies</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px' }}>
        <div style={statCardStyle}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Registered</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>{registeredCount}</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>In Progress</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#f97316' }}>{inProgressCount}</p>
        </div>
        <div style={statCardStyle}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Not Started</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#9ca3af' }}>{notStartedCount}</p>
        </div>
      </div>

      <div style={{ backgroundColor: '#111525', border: '1px solid #1e2540', borderRadius: '14px', flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {members.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>No registrations yet. Click "+ Start Registration" to begin.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2540' }}>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#9ca3af', position: 'sticky', left: 0, backgroundColor: '#111525', zIndex: 1 }}>Member</th>
                {SOCIETIES.map((soc) => (
                  <th key={soc.key} style={{ padding: '10px 4px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontSize: '16px' }}>{soc.flag}</span>
                      <span style={{ lineHeight: 1.2 }}>{soc.key}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member._id || member.name} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#161b2e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => setSelectedMember(member)}>
                  <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 600, color: 'white', borderBottom: '1px solid #1e2540', position: 'sticky', left: 0, backgroundColor: '#111525', zIndex: 1 }}>
                    {member.name}
                  </td>
                  {SOCIETIES.map((soc) => (
                    <td key={soc.key} style={cellStyle}>
                      <StatusBadge status={getSocStatus(member, soc.key)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && <StartRegModal members={allMembers} teamMembers={teamMembers} onClose={() => setShowAddModal(false)} onStart={handleStartRegistration} />}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onAssignAndStart={handleAssignAndStart}
          onMarkDone={handleMarkDone}
          onUpdated={refreshReg}
          onDelete={handleDeleteMember}
          onRename={handleRenameMember}
          teamMembers={teamMembers}
          authFetch={authFetch}
          token={token}
        />
      )}
    </div>
  );
};

export default SocietyReg;
