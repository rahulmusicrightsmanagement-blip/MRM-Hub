import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, ArrowRight, Upload, FileText, Eye, Trash2, MessageSquarePlus, Edit3, Filter, ChevronDown, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useCachedFetch, useDataCache } from '../context/DataCacheContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { withApiBase } from '../utils/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import { useNotificationDeeplink } from '../hooks/useNotificationDeeplink';

// SOCIETIES is now loaded from picklist — see SocietyReg component

/* ─── 10 tracking steps (plus remarks) ─── */
const STEP_DEFINITIONS = [
  { key: 'territoryWithdrawal', label: 'Territory Withdrawal', num: 1 },
  { key: 'nocReceived', label: 'NOC Received', num: 2, hasUpload: true },
  { key: 'applicationFiled', label: 'Application Filed', num: 3 },
  { key: 'paymentDone', label: 'Payment Done', num: 4 },
  { key: 'applicationSigned', label: 'Application Signed', num: 5 },
  { key: 'applicationSentToSociety', label: 'Application Sent to Society', num: 6, hasUpload: true },
  { key: 'membershipConfirmation', label: 'Membership Confirmation', num: 7 },
  { key: 'loginDetails', label: 'Login Details', num: 8, hasLogin: true },
  { key: 'thirdPartyAuthorization', label: 'Third Party Authorization Done', num: 9, hasUpload: true },
  { key: 'bankMandateUpdate', label: 'Bank Mandate Update', num: 10, hasUpload: true },
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
  Overdue: { bg: '#991b1b', color: '#fca5a5', text: 'Overdue' },
};

const StatusBadge = ({ status, isOverdue }) => {
  const s = (isOverdue && status === 'In Progress') ? STATUS.Overdue : (STATUS[status] || STATUS['N/A']);
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.text}</span>;
};

/* ─── Yes / No / NA Triple Toggle ─── */
const TripleToggle = ({ value, onChange }) => {
  const btnBase = { padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s' };
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={() => onChange('Yes')} style={{ ...btnBase, background: value === 'Yes' ? '#166534' : '#1e2540', color: value === 'Yes' ? '#86efac' : '#6b7280', border: value === 'Yes' ? '1px solid #22c55e' : '1px solid #2d3348' }}>Yes</button>
      <button onClick={() => onChange('No')} style={{ ...btnBase, background: value === 'No' ? '#991b1b' : '#1e2540', color: value === 'No' ? '#fca5a5' : '#6b7280', border: value === 'No' ? '1px solid #ef4444' : '1px solid #2d3348' }}>No</button>
      <button onClick={() => onChange('NA')} style={{ ...btnBase, background: value === 'NA' ? '#854d0e' : '#1e2540', color: value === 'NA' ? '#fde047' : '#6b7280', border: value === 'NA' ? '1px solid #f59e0b' : '1px solid #2d3348' }}>N/A</button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   In-Progress Steps Panel — shown when viewing an "In Progress" society
   ═══════════════════════════════════════════════════════ */
const StepsPanel = ({ regId, societyKey, steps, remarks, onUpdated, authFetch, token, readOnly = false, notAssigned = false }) => {
  const { addToast } = useToast();
  const [localSteps, setLocalSteps] = useState(steps || {});
  const [newRemark, setNewRemark] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRefs = useRef({});
  const dirtyFieldsRef = useRef(new Set());

  useEffect(() => {
    setLocalSteps((prev) => {
      const incoming = steps || {};
      if (dirtyFieldsRef.current.size === 0) return incoming;
      // Preserve locally-modified fields that haven't been saved yet
      const merged = { ...incoming };
      for (const field of dirtyFieldsRef.current) {
        if (prev[field] !== undefined) merged[field] = prev[field];
      }
      return merged;
    });
  }, [steps]);

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
    dirtyFieldsRef.current.delete(field);
    try {
      const res = await authFetch(`/api/societyregs/${regId}/steps`, { method: 'PUT', body: JSON.stringify({ society: societyKey, steps: { [field]: value } }) });
      const data = await res.json();
      if (res.ok) onUpdated(data.registration);
      else addToast('Failed to save', 'error');
    } catch (err) { console.error(err); addToast('Failed to save', 'error'); }
  };

  // Map step keys to file field prefixes
  const FILE_PREFIXES = {
    nocReceived: 'nocReceived',
    applicationSentToSociety: 'applicationSent',
    thirdPartyAuthorization: 'thirdPartyAuth',
    bankMandateUpdate: 'bankMandate',
  };

  const uploadFile = async (file, stepKey) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('society', societyKey);
      fd.append('stepKey', stepKey);
      const res = await fetch(withApiBase(`/api/societyregs/${regId}/upload`), {
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
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: notAssigned ? '8px' : '14px' }}>Registration Progress — {societyKey}</p>
      {notAssigned && (
        <div style={{ marginBottom: '14px', padding: '8px 14px', backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🔒</span>
          <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 500 }}>You are not assigned to this society — view only.</span>
        </div>
      )}

      {/* Steps 1–10 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEP_DEFINITIONS.map((step) => (
          <div key={step.key} style={{ ...sectionStyle, marginBottom: 0, padding: '12px 16px' }}>
            {/* Step row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  background: localSteps[step.key] === 'Yes' ? '#166534' : localSteps[step.key] === 'No' ? '#991b1b' : localSteps[step.key] === 'NA' ? '#854d0e' : '#1e2540',
                  color: localSteps[step.key] === 'Yes' ? '#86efac' : localSteps[step.key] === 'No' ? '#fca5a5' : localSteps[step.key] === 'NA' ? '#fde047' : '#6b7280',
                  border: localSteps[step.key] === 'Yes' ? '1px solid #22c55e' : localSteps[step.key] === 'No' ? '1px solid #ef4444' : localSteps[step.key] === 'NA' ? '1px solid #f59e0b' : '1px solid #2d3348',
                }}>{step.num}</span>
                <span style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>{step.label}</span>
              </div>
              {readOnly ? (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px',
                  background: (localSteps[step.key] || 'NA') === 'Yes' ? '#166534' : (localSteps[step.key] || 'NA') === 'No' ? '#991b1b' : '#854d0e',
                  color: (localSteps[step.key] || 'NA') === 'Yes' ? '#86efac' : (localSteps[step.key] || 'NA') === 'No' ? '#fca5a5' : '#fde047',
                }}>{localSteps[step.key] || 'N/A'}</span>
              ) : (
                <TripleToggle value={localSteps[step.key] || 'NA'} onChange={(val) => saveStep(step.key, val)} />
              )}
            </div>

            {/* Upload document for steps with hasUpload */}
            {step.hasUpload && localSteps[step.key] === 'Yes' && (() => {
              const prefix = FILE_PREFIXES[step.key];
              const fileName = localSteps[`${prefix}FileName`];
              const fileUrl = localSteps[`${prefix}FileUrl`];
              return (
                <div style={{ marginTop: '10px', paddingLeft: '34px' }}>
                  {fileName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText style={{ width: '14px', height: '14px', color: '#10b981' }} />
                      {fileUrl ? (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#818cf8', textDecoration: 'underline' }}>{fileName}</a>
                      ) : (
                        <span style={{ fontSize: '13px', color: '#e5e7eb' }}>{fileName}</span>
                      )}
                    </div>
                  ) : null}
                  {!readOnly && (
                    <>
                      <input type="file" ref={(el) => { fileRefs.current[step.key] = el; }} style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) uploadFile(e.target.files[0], step.key); }} />
                      <button onClick={() => fileRefs.current[step.key]?.click()} disabled={uploading} style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: '1px dashed #3a3f60', background: 'transparent', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                        <Upload style={{ width: '14px', height: '14px' }} /> {uploading ? 'Uploading...' : fileName ? 'Replace Document' : 'Upload Document'}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Step 8: Login details (ID & Password) + CAE & Commission */}
            {step.hasLogin && localSteps[step.key] === 'Yes' && (
              <div style={{ marginTop: '10px', paddingLeft: '34px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Row 1: Primary Login ID & Password */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Primary Login ID</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.loginId || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="Enter primary login ID..."
                        value={localSteps.loginId || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('loginId'); setLocalSteps((p) => ({ ...p, loginId: e.target.value })); }}
                        onBlur={(e) => saveLoginField('loginId', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('loginId', e.target.value)}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Primary Password</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.loginPassword || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="Enter primary password..."
                        value={localSteps.loginPassword || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('loginPassword'); setLocalSteps((p) => ({ ...p, loginPassword: e.target.value })); }}
                        onBlur={(e) => saveLoginField('loginPassword', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('loginPassword', e.target.value)}
                      />
                    )}
                  </div>
                </div>
                {/* Row 2: Secondary Login ID & Password */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Secondary Login ID</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.secondaryLoginId || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="Enter secondary login ID..."
                        value={localSteps.secondaryLoginId || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('secondaryLoginId'); setLocalSteps((p) => ({ ...p, secondaryLoginId: e.target.value })); }}
                        onBlur={(e) => saveLoginField('secondaryLoginId', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('secondaryLoginId', e.target.value)}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Secondary Password</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.secondaryLoginPassword || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="Enter secondary password..."
                        value={localSteps.secondaryLoginPassword || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('secondaryLoginPassword'); setLocalSteps((p) => ({ ...p, secondaryLoginPassword: e.target.value })); }}
                        onBlur={(e) => saveLoginField('secondaryLoginPassword', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('secondaryLoginPassword', e.target.value)}
                      />
                    )}
                  </div>
                </div>
                {/* Row 2: CAE Number & Commission Rate */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>CAE Number</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.caeNumber || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="Enter CAE number..."
                        value={localSteps.caeNumber || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('caeNumber'); setLocalSteps((p) => ({ ...p, caeNumber: e.target.value })); }}
                        onBlur={(e) => saveLoginField('caeNumber', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('caeNumber', e.target.value)}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', fontSize: '10px' }}>Commission Rate</label>
                    {readOnly ? (
                      <p style={{ fontSize: '13px', color: '#e5e7eb', padding: '8px 12px', backgroundColor: '#1a1e2e', borderRadius: '8px', border: '1px solid #2d3348' }}>{localSteps.commissionRate || '—'}</p>
                    ) : (
                      <input style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                        placeholder="e.g. 15%"
                        value={localSteps.commissionRate || ''}
                        onChange={(e) => { dirtyFieldsRef.current.add('commissionRate'); setLocalSteps((p) => ({ ...p, commissionRate: e.target.value })); }}
                        onBlur={(e) => saveLoginField('commissionRate', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveLoginField('commissionRate', e.target.value)}
                      />
                    )}
                  </div>
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
  const { getItems } = usePicklist();
  const SOCIETIES = getItems('societies').map((i) => ({ key: i.value, name: i.label, flag: i.metadata?.flag || '🌍' }));
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
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const { getItems } = usePicklist();
  const SOCIETIES = getItems('societies').map((i) => ({ key: i.value, name: i.label, flag: i.metadata?.flag || '🌍' }));

  const isAssignedToSoc = (socKey) => {
    if (isAdmin) return true;
    const assignee = getAssignee(socKey);
    return assignee && user && assignee.name === user.name;
  };

  const [assigningKey, setAssigningKey] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [editingRegistered, setEditingRegistered] = useState(null); // socKey being edited in Registered state
  const [confirmDone, setConfirmDone] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSoc, setConfirmDeleteSoc] = useState(null); // socKey to confirm delete
  const [assignForm, setAssignForm] = useState({ spoc: '', startDate: '', deadline: '' });
  const [editingDeadline, setEditingDeadline] = useState(null); // socKey being edited

  const fmtDateISO = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const handleUpdateDeadline = async (socKey, deadline) => {
    try {
      const res = await authFetch(`/api/societyregs/${member._id}`, {
        method: 'PUT',
        body: JSON.stringify({ society: socKey, deadline: deadline || null }),
      });
      const data = await res.json();
      if (res.ok) onUpdated(data.registration);
    } catch (err) { console.error(err); }
    setEditingDeadline(null);
  };

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

  const handleAssign = async (socKey) => {
    const tm = teamMembers.find((m) => m.name === assignForm.spoc);
    if (!tm) return;
    setActionLoading(socKey);
    await onAssignAndStart(member._id || member.name, socKey, tm, assignForm.deadline || null, assignForm.startDate || null);
    setAssigningKey(null);
    setAssignForm({ spoc: '', startDate: '', deadline: '' });
    setActionLoading(null);
  };

  const handleDone = async (socKey) => {
    setActionLoading(socKey);
    await onMarkDone(member._id || member.name, socKey);
    setConfirmDone(null);
    setActionLoading(null);
  };

  const handleDeleteSoc = async (socKey) => {
    setActionLoading(socKey);
    try {
      const res = await authFetch(`/api/societyregs/${member._id}/society`, {
        method: 'DELETE',
        body: JSON.stringify({ society: socKey }),
      });
      const data = await res.json();
      if (res.ok) { onUpdated(data.registration); addToast(`${socKey} registration deleted`); }
      else addToast(data.message || 'Failed to delete', 'error');
    } catch (err) { console.error(err); addToast('Failed to delete society', 'error'); }
    setConfirmDeleteSoc(null);
    setActionLoading(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: '0', width: '700px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}>
        <div style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2d3348', position: 'sticky', top: 0, backgroundColor: '#1e2235', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name} — Registrations</h2>
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
              const isEditingRegistered = editingRegistered === soc.key;
              const isConfirmingDone = confirmDone === soc.key;
              const isLoading = actionLoading === soc.key;
              const entryDeadline = socEntry?.deadline;
              const entryStartDate = socEntry?.startDate;

              const fmtDeadline = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
              const getDeadlineColor = (d) => {
                if (!d) return null;
                const now = new Date(); now.setHours(0,0,0,0);
                const dl = new Date(d); dl.setHours(0,0,0,0);
                const diff = (dl - now) / (1000*60*60*24);
                if (diff < 0) return { bg: '#991b1b', color: '#fca5a5', label: 'Overdue' };
                if (diff <= 2) return { bg: '#854d0e', color: '#fde047', label: 'Near Deadline' };
                return { bg: '#166534', color: '#86efac', label: 'On Track' };
              };
              const dlColor = getDeadlineColor(entryDeadline);

              return (
                <div key={soc.key} style={{ backgroundColor: cardBg, border: (status === 'In Progress' && dlColor && dlColor.label === 'Overdue') ? '1px solid #991b1b' : cardBorder, borderRadius: '10px', overflow: 'hidden' }}>
                  {/* Top row — identity + status + actions */}
                  <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{soc.flag}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{soc.key}</p>
                        <p style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soc.name}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <StatusBadge status={status} isOverdue={status === 'In Progress' && dlColor && dlColor.label === 'Overdue'} />

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
                          <button onClick={() => {
                            if (!isAssignedToSoc(soc.key)) { addToast('You are not assigned to this task', 'error'); return; }
                            setConfirmDone(isConfirmingDone ? null : soc.key); setExpandedKey(null); setAssigningKey(null);
                          }} disabled={isLoading}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            Done
                          </button>
                          <button onClick={() => { setConfirmDeleteSoc(confirmDeleteSoc === soc.key ? null : soc.key); setExpandedKey(null); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </>
                      )}

                      {status === 'Registered' && (
                        <>
                          <button onClick={() => { setExpandedKey(isExpanded ? null : soc.key); setEditingRegistered(null); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            {isExpanded && !isEditingRegistered ? 'Close' : 'View'}
                          </button>
                          <button onClick={() => { setExpandedKey(soc.key); setEditingRegistered(isEditingRegistered ? null : soc.key); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: isEditingRegistered ? '#f97316' : '#818cf8', background: isEditingRegistered ? 'rgba(249,115,22,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${isEditingRegistered ? 'rgba(249,115,22,0.3)' : 'rgba(99,102,241,0.3)'}`, borderRadius: '6px', padding: '4px 14px', cursor: 'pointer' }}>
                            {isEditingRegistered ? 'Done Editing' : 'Edit'}
                          </button>
                          <button onClick={() => { setConfirmDeleteSoc(confirmDeleteSoc === soc.key ? null : soc.key); setExpandedKey(null); setAssigningKey(null); setConfirmDone(null); }}
                            style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Meta row — assignee + deadline (only when relevant) */}
                  {(status === 'In Progress' || status === 'Registered' || (assignee && assignee.name)) && (
                    <div style={{ padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: '32px' }}>
                      {assignee && assignee.name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px 3px 3px', borderRadius: '999px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.12)', maxWidth: '200px' }} title={assignee.name}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: assignee.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                            {assignee.initials || assignee.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#c7d2fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {assignee.name}
                          </span>
                        </div>
                      ) : status === 'In Progress' ? (
                        <span style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>Unassigned</span>
                      ) : null}

                      {entryStartDate && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: 'rgba(99,102,241,0.12)', color: '#a5b4fc', whiteSpace: 'nowrap' }}
                          title={`Start: ${fmtDeadline(entryStartDate)}`}>
                          ▶ Start {fmtDeadline(entryStartDate)}
                        </span>
                      )}

                      {status === 'In Progress' && (
                        editingDeadline === soc.key ? (
                          <input
                            type="date"
                            autoFocus
                            defaultValue={fmtDateISO(entryDeadline)}
                            onBlur={(e) => handleUpdateDeadline(soc.key, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateDeadline(soc.key, e.target.value); if (e.key === 'Escape') setEditingDeadline(null); }}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '12px', outline: 'none' }}
                          />
                        ) : entryDeadline ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isAssignedToSoc(soc.key)) { addToast('You are not assigned to this task', 'error'); return; }
                              setEditingDeadline(soc.key);
                            }}
                            style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: dlColor?.bg || '#1e2540', color: dlColor?.color || '#9ca3af', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            title={`Deadline: ${fmtDeadline(entryDeadline)} — ${dlColor?.label || ''} (click to edit)`}
                          >
                            📅 {fmtDeadline(entryDeadline)} — {dlColor?.label}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isAssignedToSoc(soc.key)) { addToast('You are not assigned to this task', 'error'); return; }
                              setEditingDeadline(soc.key);
                            }}
                            style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', background: 'rgba(99,102,241,0.06)', border: '1px dashed #2d3348', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            + Set Deadline
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {/* Assign dropdown */}
                  {isAssigning && (
                    <div style={{ padding: '0 18px 14px', borderTop: '1px solid #1e2540' }}>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '12px 0 8px', fontWeight: 500 }}>Assign team member & set deadline:</p>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select autoFocus value={assignForm.spoc} onChange={(e) => setAssignForm((p) => ({ ...p, spoc: e.target.value }))}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                          <option value="">Select team member...</option>
                          {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Start Date</label>
                          <input type="date" value={assignForm.startDate} onChange={(e) => setAssignForm((p) => ({ ...p, startDate: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Deadline</label>
                          <input type="date" value={assignForm.deadline} onChange={(e) => setAssignForm((p) => ({ ...p, deadline: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                        </div>
                        <button disabled={!assignForm.spoc || isLoading} onClick={() => handleAssign(soc.key)}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: assignForm.spoc ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#2d3348', color: assignForm.spoc ? 'white' : '#6b7280', fontSize: '12px', fontWeight: 600, cursor: assignForm.spoc ? 'pointer' : 'not-allowed', marginTop: '18px' }}>
                          {isLoading ? 'Assigning...' : 'Assign & Start'}
                        </button>
                        <button onClick={() => { setAssigningKey(null); setAssignForm({ spoc: '', startDate: '', deadline: '' }); }} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', marginTop: '18px' }}>Cancel</button>
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
                      readOnly={(status === 'Registered' && !isEditingRegistered) || (status !== 'Registered' && !isAssignedToSoc(soc.key))}
                      notAssigned={status !== 'Registered' && !isAssignedToSoc(soc.key)}
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

                  {/* Delete society confirmation */}
                  {confirmDeleteSoc === soc.key && (
                    <div style={{ padding: '0 18px 14px', borderTop: '1px solid #1e2540' }}>
                      <div style={{ marginTop: '12px', padding: '14px 16px', backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '12px', fontWeight: 500 }}>
                          Delete <strong>{soc.key}</strong> registration for <strong>{member.name}</strong>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setConfirmDeleteSoc(null)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => handleDeleteSoc(soc.key)} disabled={isLoading}
                            style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontSize: '12px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}>
                            {isLoading ? 'Deleting...' : 'Confirm Delete'}
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
  const { getItems } = usePicklist();
  const { setCached } = useDataCache();
  const SOCIETIES = getItems('societies').map((i) => ({ key: i.value, name: i.label, flag: i.metadata?.flag || '🌍' }));
  const [selectedMember, setSelectedMember] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({}); // { 'IPRS': 'In Progress', 'PRS': 'Registered', ... }
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState('login'); // 'login' | 'nocReceived' | 'applicationSentToSociety' | 'thirdPartyAuthorization' | 'bankMandateUpdate'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const regsQ = useCachedFetch('societyregs:list', async () => {
    const r = await authFetch('/api/societyregs');
    const d = await r.json();
    return (d.registrations || []).map((reg) => ({
      ...reg,
      societies: reg.societies || {},
      assignees: reg.assignees || {},
    }));
  });
  const usersQ = useCachedFetch('users:all', async () => {
    const r = await authFetch('/api/users');
    const d = await r.json();
    return d.users || [];
  });
  const allMembersQ = useCachedFetch('members:list', async () => {
    const r = await authFetch('/api/members');
    const d = await r.json();
    return d.members || [];
  });

  const members = regsQ.data || [];
  const teamMembers = usersQ.data || [];
  const allMembers = allMembersQ.data || [];
  const loading = (regsQ.loading && !regsQ.data) || (usersQ.loading && !usersQ.data) || (allMembersQ.loading && !allMembersQ.data);

  const setMembers = (updater) => {
    const current = regsQ.data || [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    setCached('societyregs:list', next);
  };

  useNotificationDeeplink({
    expectedType: ['societyreg', 'society'],
    records: members,
    isReady: !loading,
    onOpen: (m) => setSelectedMember(m),
    onMissing: () => addToast('This society registration is no longer available.', 'error'),
  });

  const getSocStatus = (member, socKey) => {
    const entry = member.societies?.[socKey];
    if (!entry) return 'N/A';
    return typeof entry === 'string' ? entry : entry.status || 'N/A';
  };

  const getSocDeadline = (member, socKey) => {
    const entry = member.societies?.[socKey];
    if (!entry || typeof entry === 'string') return null;
    return entry.deadline || null;
  };

  const getDeadlineInfo = (d) => {
    if (!d) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dl = new Date(d); dl.setHours(0, 0, 0, 0);
    const diff = (dl - now) / (1000 * 60 * 60 * 24);
    const fmt = dl.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (diff < 0) return { bg: '#991b1b', color: '#fca5a5', label: 'Overdue', text: fmt };
    if (diff <= 2) return { bg: '#854d0e', color: '#fde047', label: 'Near Deadline', text: fmt };
    return { bg: '#166534', color: '#86efac', label: 'On Track', text: fmt };
  };

  const isSocOverdue = (member, socKey) => {
    const dl = getSocDeadline(member, socKey);
    if (!dl) return false;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(dl); d.setHours(0, 0, 0, 0);
    return d < now && getSocStatus(member, socKey) === 'In Progress';
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

  const handleAssignAndStart = async (memberId, societyKey, teamMember, deadline, startDate) => {
    try {
      const reg = members.find((m) => m._id === memberId || m.name === memberId);
      if (!reg) return;
      const assignee = {
        name: teamMember.name,
        initials: teamMember.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
        color: '#6366f1',
      };
      const res = await authFetch(`/api/societyregs/${reg._id}`, { method: 'PUT', body: JSON.stringify({ society: societyKey, status: 'In Progress', assignee, deadline: deadline || null, startDate: startDate || null }) });
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

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== 'All').length;

  const filteredMembers = useMemo(() => {
    let result = members;
    // Text search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || (m._id && m._id.toLowerCase().includes(q)));
    }
    // Status filters
    const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== 'All');
    if (activeFilters.length > 0) {
      result = result.filter((m) =>
        activeFilters.every(([socKey, filterVal]) => {
          if (filterVal === 'Overdue') return isSocOverdue(m, socKey);
          return getSocStatus(m, socKey) === filterVal;
        })
      );
    }
    return result;
  }, [members, filters, debouncedQuery]);

  useEffect(() => { setPage(1); }, [debouncedQuery, filters, pageSize]);

  const totalFiltered = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedMembers = useMemo(
    () => filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredMembers, safePage, pageSize]
  );

  const setFilter = (socKey, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value || value === 'All') delete next[socKey];
      else next[socKey] = value;
      return next;
    });
  };

  const clearAllFilters = () => setFilters({});

  const DOC_EXPORT_MODES = {
    nocReceived: { label: 'NOC Received', prefix: 'nocReceived' },
    applicationSentToSociety: { label: 'Application Sent to Society', prefix: 'applicationSent' },
    thirdPartyAuthorization: { label: 'Third Party Authorization Done', prefix: 'thirdPartyAuth' },
    bankMandateUpdate: { label: 'Bank Mandate Update', prefix: 'bankMandate' },
  };

  const handleExportExcel = (mode = 'login') => {
    try {
      const rows = filteredMembers;
      if (rows.length === 0) {
        addToast('No registrations to export', 'error');
        return;
      }

      let aoa;
      let sheetName;
      let fileSuffix;
      let merges = [];
      let colWidths;

      if (mode === 'login') {
        // Row 1: blank | Society name (merged across 2 cols) | ... | blank
        // Row 2: "Client Name" | Primary | Secondary | Primary | Secondary | ...
        // Data rows: client name + Yes/No for primary & secondary per society
        const header1 = ['Client Name'];
        const header2 = [''];
        SOCIETIES.forEach((soc) => {
          header1.push(soc.key, '');
          header2.push('Primary', 'Secondary');
        });
        aoa = [header1, header2];
        rows.forEach((m) => {
          const row = [m.name];
          SOCIETIES.forEach((soc) => {
            const entry = m.societies?.[soc.key];
            const status = getSocStatus(m, soc.key);
            if (!entry || status === 'N/A') {
              row.push('-', '-');
            } else {
              const steps = (typeof entry !== 'string') ? (entry.steps || {}) : {};
              row.push(steps.loginId ? 'Yes' : 'No');
              row.push(steps.secondaryLoginId ? 'Yes' : 'No');
            }
          });
          aoa.push(row);
        });
        merges = SOCIETIES.map((_, i) => {
          const start = 1 + i * 2;
          return { s: { r: 0, c: start }, e: { r: 0, c: start + 1 } };
        });
        colWidths = [{ wch: 28 }, ...SOCIETIES.flatMap(() => [{ wch: 12 }, { wch: 12 }])];
        sheetName = 'Login IDs';
        fileSuffix = 'LoginIDs';
      } else {
        const def = DOC_EXPORT_MODES[mode];
        if (!def) {
          addToast('Invalid export mode', 'error');
          return;
        }
        // Single row header: Client Name | IPRS | PRS | ...
        const header = ['Client Name', ...SOCIETIES.map((s) => s.key)];
        aoa = [header];
        rows.forEach((m) => {
          const row = [m.name];
          SOCIETIES.forEach((soc) => {
            const entry = m.societies?.[soc.key];
            const status = getSocStatus(m, soc.key);
            if (!entry || status === 'N/A') {
              row.push('-');
            } else {
              const steps = (typeof entry !== 'string') ? (entry.steps || {}) : {};
              const fileUrl = steps[`${def.prefix}FileUrl`];
              const fileName = steps[`${def.prefix}FileName`];
              row.push((fileUrl || fileName) ? 'Yes' : 'No');
            }
          });
          aoa.push(row);
        });
        colWidths = [{ wch: 28 }, ...SOCIETIES.map(() => ({ wch: 10 }))];
        sheetName = def.label.slice(0, 31);
        fileSuffix = def.label.replace(/\s+/g, '_');
      }

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      if (merges.length) sheet['!merges'] = merges;
      sheet['!cols'] = colWidths;

      const headerRowCount = mode === 'login' ? 2 : 1;
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let r = 0; r <= range.e.r; r++) {
        for (let c = 0; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!sheet[addr]) continue;
          sheet[addr].s = {
            alignment: { horizontal: c === 0 && r >= headerRowCount ? 'left' : 'center', vertical: 'center' },
            font: r < headerRowCount ? { bold: true } : {},
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Society_${fileSuffix}_${stamp}.xlsx`);
      addToast(`Exported ${rows.length} client${rows.length === 1 ? '' : 's'} to Excel`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export Excel', 'error');
    }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading registrations...</div>;

  return (
    <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white' }}>Collecting Society Registrations</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { setExportMode('login'); setShowExportModal(true); }}
              title="Download all registrations as Excel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
              }}
            >
              <Download size={15} />
              Export Excel
            </button>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '240px', padding: '10px 14px 10px 36px', background: '#141720', border: '1px solid #1e2540', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
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

      {/* Filter Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: showFilters ? '14px' : '0' }}>
          <button
            onClick={() => setShowFilters((p) => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
              border: activeFilterCount > 0 ? '1px solid #6366f1' : '1px solid #2d3348',
              backgroundColor: activeFilterCount > 0 ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: activeFilterCount > 0 ? '#a5b4fc' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Filter style={{ width: '14px', height: '14px' }} />
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <ChevronDown style={{ width: '14px', height: '14px', transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} style={{ fontSize: '12px', fontWeight: 500, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '16px 18px', backgroundColor: cardBg, border: cardBorder, borderRadius: '12px' }}>
            {SOCIETIES.map((soc) => (
              <div key={soc.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {soc.flag} {soc.key}
                </label>
                <select
                  value={filters[soc.key] || 'All'}
                  onChange={(e) => setFilter(soc.key, e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', outline: 'none',
                    border: filters[soc.key] ? '1px solid #6366f1' : '1px solid #2d3348',
                    backgroundColor: filters[soc.key] ? 'rgba(99,102,241,0.08)' : '#1a1e2e',
                    color: filters[soc.key] ? '#c7d2fe' : '#9ca3af',
                  }}
                >
                  <option value="All">All</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Registered">Registered</option>
                  <option value="Overdue">Overdue</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#111525', border: '1px solid #1e2540', borderRadius: '14px', flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {filteredMembers.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>{members.length === 0 ? 'No registrations yet. Click "+ Start Registration" to begin.' : 'No members match the selected filters.'}</p>
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
              {pagedMembers.map((member) => (
                <tr key={member._id || member.name} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#161b2e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => setSelectedMember(member)}>
                  <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 600, color: 'white', borderBottom: '1px solid #1e2540', position: 'sticky', left: 0, backgroundColor: '#111525', zIndex: 1 }}>
                    {member.name}
                  </td>
                  {SOCIETIES.map((soc) => {
                    const status = getSocStatus(member, soc.key);
                    const dl = getSocDeadline(member, soc.key);
                    const dlInfo = getDeadlineInfo(dl);
                    const overdue = isSocOverdue(member, soc.key);
                    return (
                      <td key={soc.key} style={cellStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <StatusBadge status={status} isOverdue={overdue} />
                          {dlInfo && (status === 'In Progress') && (
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: dlInfo.bg, color: dlInfo.color, whiteSpace: 'nowrap' }} title={dlInfo.label}>
                              {dlInfo.text}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filteredMembers.length > 0 && (
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={totalFiltered}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 50, 100]}
        />
      )}

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

      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
          onClick={() => setShowExportModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1e2e', border: '1px solid #2d3348', borderRadius: '14px', width: '460px', maxWidth: '92vw', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: 700 }}>Export to Excel</h2>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '14px' }}>
              Choose what data to export. {Object.keys(filters).length > 0 || searchQuery ? 'Active search/filters will apply.' : 'All registrations included.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {[
                { key: 'login', label: 'Login IDs (Primary / Secondary)', hint: 'Current default — Yes/No per society login' },
                { key: 'nocReceived', label: 'NOC Received', hint: 'Yes/No per society (document in Google Drive)' },
                { key: 'applicationSentToSociety', label: 'Application Sent to Society', hint: 'Yes/No per society (document in Google Drive)' },
                { key: 'thirdPartyAuthorization', label: 'Third Party Authorization Done', hint: 'Yes/No per society (document in Google Drive)' },
                { key: 'bankMandateUpdate', label: 'Bank Mandate Update', hint: 'Yes/No per society (document in Google Drive)' },
              ].map((opt) => {
                const active = exportMode === opt.key;
                return (
                  <button key={opt.key} onClick={() => setExportMode(opt.key)}
                    style={{
                      textAlign: 'left', cursor: 'pointer',
                      padding: '12px 14px', borderRadius: '9px',
                      background: active ? 'rgba(16,185,129,0.12)' : '#141720',
                      border: active ? '1px solid #10b981' : '1px solid #1e2540',
                      color: '#e5e7eb',
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                    }}>
                    <span style={{
                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: active ? '5px solid #10b981' : '2px solid #3a4060',
                      background: active ? '#0b1a1a' : 'transparent',
                    }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#fff' }}>{opt.label}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#8892b0', marginTop: '2px' }}>{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowExportModal(false)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2d3348', background: 'transparent', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { handleExportExcel(exportMode); setShowExportModal(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocietyReg;
