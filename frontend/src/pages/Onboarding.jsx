import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, ArrowRight, CheckCircle, Clock, Trash2, Edit3, Upload, FileText, Eye, RefreshCw, ChevronDown, ChevronUp, Save, XCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { withApiBase } from '../utils/api';
import SearchableSelect from '../components/SearchableSelect';

/* ─── Constants ─── */
const STAGES = ['Document Submission', 'KYC Verification', 'Contract Signing', 'Active Member', 'Contact Made', 'Completed'];
const stageDotColors = { 'Document Submission': '#3b82f6', 'KYC Verification': '#f97316', 'Contract Signing': '#a855f7', 'Active Member': '#10b981', 'Contact Made': '#06b6d4', 'Completed': '#22c55e' };
const ROLE_OPTIONS = ['Singer-Songwriter', 'Music Composer', 'Lyricist', 'Producer', 'Publisher', 'Artist Manager'];
const contractTypes = ['Retailer', 'Royalty', 'Work-Based'];

const fmtDateISO = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const getDeadlineStatus = (deadline) => {
  if (!deadline) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline); dl.setHours(0, 0, 0, 0);
  const diffDays = (dl - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  if (diffDays <= 2) return 'yellow';
  return 'green';
};
const DEADLINE_COLORS = {
  green: { bg: '#166534', color: '#86efac', border: '#22c55e', label: 'On Track' },
  yellow: { bg: '#854d0e', color: '#fde047', border: '#f59e0b', label: 'Near Deadline' },
  red: { bg: '#991b1b', color: '#fca5a5', border: '#ef4444', label: 'Overdue' },
};

/* ─── Shared styles ─── */
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: '#1a1e2e', color: '#e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' };
const cardBg = '#161b2e';
const cardBorder = '1px solid #1e2540';
const sectionStyle = { backgroundColor: cardBg, border: cardBorder, borderRadius: '10px', padding: '16px', marginBottom: '16px' };
const toggleBtnBase = { padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s' };

/* ─── Toggle Button (Yes/No) ─── */
const YesNoToggle = ({ value, onChange, disabled }) => (
  <div style={{ display: 'flex', gap: '6px' }}>
    <button
      onClick={() => !disabled && onChange(true)}
      style={{ ...toggleBtnBase, background: value ? '#166534' : '#1e2540', color: value ? '#86efac' : '#6b7280', border: value ? '1px solid #22c55e' : '1px solid #2d3348', opacity: disabled ? 0.5 : 1 }}
    >Yes</button>
    <button
      onClick={() => !disabled && onChange(false)}
      style={{ ...toggleBtnBase, background: !value ? '#991b1b' : '#1e2540', color: !value ? '#fca5a5' : '#6b7280', border: !value ? '1px solid #ef4444' : '1px solid #2d3348', opacity: disabled ? 0.5 : 1 }}
    >No</button>
  </div>
);

/* ─── Priority Badge ─── */
const PriorityBadge = ({ priority }) => {
  const colors = { high: { bg: '#991b1b', color: '#fca5a5' }, medium: { bg: '#854d0e', color: '#fde047' }, low: { bg: '#166534', color: '#86efac' } };
  const c = colors[priority] || colors.medium;
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', backgroundColor: c.bg, color: c.color }}>{priority}</span>;
};

/* ─── Multi-Role Select ─── */
const MultiRoleSelect = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toggle = (role) => onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <label style={labelStyle}>Role</label>
      <div onClick={() => setOpen(!open)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '42px', flexWrap: 'wrap', gap: '4px' }}>
        {selected.length === 0 ? <span style={{ color: '#6b7280' }}>Select roles...</span> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {selected.map((r) => (
              <span key={r} style={{ background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {r}
                <span onClick={(e) => { e.stopPropagation(); toggle(r); }} style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>&times;</span>
              </span>
            ))}
          </div>
        )}
        <span style={{ color: '#6b7280', fontSize: '12px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1e2e', border: '1px solid #2d3348', borderRadius: '8px', marginTop: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
          {ROLE_OPTIONS.map((role) => (
            <div key={role} onClick={() => toggle(role)} style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#e5e7eb', fontSize: '13px', background: selected.includes(role) ? '#2d3348' : 'transparent' }}
              onMouseEnter={(e) => { if (!selected.includes(role)) e.currentTarget.style.background = '#1e2540'; }}
              onMouseLeave={(e) => { if (!selected.includes(role)) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: selected.includes(role) ? 'none' : '2px solid #3a3f60', background: selected.includes(role) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', flexShrink: 0 }}>
                {selected.includes(role) && '✓'}
              </span>
              {role}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── File Upload Button ─── */
const FileUploadBtn = ({ onUpload, uploading, existingFile, existingUrl }) => {
  const ref = useRef(null);
  const [localFile, setLocalFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLocalFile(file);
  };

  const handleUpload = () => {
    if (localFile) {
      onUpload(localFile);
      setLocalFile(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input ref={ref} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button onClick={() => ref.current?.click()} disabled={uploading} style={{ ...toggleBtnBase, background: '#1e2540', color: '#93c5fd', border: '1px solid #2d3a5a', display: 'flex', alignItems: 'center', gap: '4px', opacity: uploading ? 0.5 : 1 }}>
          <Upload style={{ width: '12px', height: '12px' }} /> Choose File
        </button>
        {localFile && (
          <button onClick={handleUpload} disabled={uploading} style={{ ...toggleBtnBase, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', opacity: uploading ? 0.5 : 1 }}>
            <Upload style={{ width: '12px', height: '12px' }} /> {uploading ? 'Uploading...' : 'Upload to Drive'}
          </button>
        )}
      </div>
      {localFile && !uploading && (
        <span style={{ fontSize: '11px', color: '#9ca3af', paddingLeft: '2px' }}>Selected: {localFile.name}</span>
      )}
      {existingFile && (
        <a href={existingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <FileText style={{ width: '12px', height: '12px', flexShrink: 0 }} /> {existingFile}
        </a>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 1 — Document Submission
   ═══════════════════════════════════════════════════════ */
const DocumentSubmissionView = ({ entry, onUpdate }) => {
  const [newDocName, setNewDocName] = useState('');
  const [adding, setAdding] = useState(false);
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const docs = entry.documents || [];

  const toggleRequested = async (docId, val) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ requested: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update document', 'error');
    } catch (err) { console.error(err); addToast('Failed to update document', 'error'); }
  };

  const addDocument = async () => {
    if (!newDocName.trim()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents`, { method: 'POST', body: JSON.stringify({ label: newDocName.trim() }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); setNewDocName(''); setAdding(false); addToast('Document added'); }
      else addToast('Failed to add document', 'error');
    } catch (err) { console.error(err); addToast('Failed to add document', 'error'); }
  };

  const removeDocument = async (docId) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document removed'); }
      else addToast('Failed to remove document', 'error');
    } catch (err) { console.error(err); addToast('Failed to remove document', 'error'); }
  };

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Request Documents</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {docs.map((doc) => (
          <div key={doc._id} style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText style={{ width: '16px', height: '16px', color: '#6366f1' }} />
              <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>{doc.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', marginRight: '4px' }}>Requested:</span>
              <YesNoToggle value={doc.requested} onChange={(val) => toggleRequested(doc._id, val)} />
              {doc.docType !== 'aadhaar' && doc.docType !== 'pan' && (
                <button onClick={() => removeDocument(doc._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input autoFocus style={{ ...inputStyle, flex: 1 }} placeholder="Document name..." value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDocument()} />
          <button onClick={addDocument} style={{ ...toggleBtnBase, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '8px 16px' }}>Add</button>
          <button onClick={() => { setAdding(false); setNewDocName(''); }} style={{ ...toggleBtnBase, background: 'transparent', color: '#9ca3af', border: '1px solid #2d3348', padding: '8px 16px' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: 'none', border: '1px dashed #3a3f60', borderRadius: '8px', padding: '10px 16px', color: '#6366f1', fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus style={{ width: '14px', height: '14px' }} /> Add More Documents
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 2 — KYC Verification
   ═══════════════════════════════════════════════════════ */
const KYCVerificationView = ({ entry, onUpdate }) => {
  const [uploading, setUploading] = useState({});
  const [newDocName, setNewDocName] = useState('');
  const [adding, setAdding] = useState(false);
  const [docNumbers, setDocNumbers] = useState({});
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();
  const docs = entry.documents || [];

  /* initialise local doc-number state from entry */
  useEffect(() => {
    const nums = {};
    (entry.documents || []).forEach((d) => { if (d.docNumber) nums[d._id] = d.docNumber; });
    setDocNumbers(nums);
  }, [entry.documents]);

  const getDocNumberLabel = (doc) => {
    if (doc.docType === 'aadhaar') return 'Aadhaar Number';
    if (doc.docType === 'pan') return 'PAN Number';
    return `${doc.label} Number`;
  };

  const saveDocNumber = async (docId) => {
    const val = docNumbers[docId] || '';
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ docNumber: val }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document number saved'); }
      else addToast('Failed to save document number', 'error');
    } catch (err) { console.error(err); addToast('Failed to save document number', 'error'); }
  };

  const toggleReceived = async (docId, val) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ received: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update document', 'error');
    } catch (err) { console.error(err); addToast('Failed to update document', 'error'); }
  };

  const uploadFile = async (docId, file) => {
    setUploading((p) => ({ ...p, [docId]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(withApiBase(`/api/onboarding/${entry._id}/documents/${docId}/upload`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('File uploaded to Google Drive'); }
      else addToast('File upload failed', 'error');
    } catch (err) { console.error(err); addToast('File upload failed', 'error'); }
    finally { setUploading((p) => ({ ...p, [docId]: false })); }
  };

  const addDocument = async () => {
    if (!newDocName.trim()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents`, { method: 'POST', body: JSON.stringify({ label: newDocName.trim() }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); setNewDocName(''); setAdding(false); addToast('Document added'); }
      else addToast('Failed to add document', 'error');
    } catch (err) { console.error(err); addToast('Failed to add document', 'error'); }
  };

  const removeDocument = async (docId) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document removed'); }
      else addToast('Failed to remove document', 'error');
    } catch (err) { console.error(err); addToast('Failed to remove document', 'error'); }
  };

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Verify & Upload Documents</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {docs.map((doc) => (
          <div key={doc._id} style={{ ...sectionStyle, marginBottom: 0, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: doc.received ? '10px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText style={{ width: '16px', height: '16px', color: doc.received ? '#10b981' : '#f97316' }} />
                <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>{doc.label}</span>
                {doc.requested && <span style={{ fontSize: '10px', color: '#6366f1', background: '#1e1b4b', padding: '2px 6px', borderRadius: '4px' }}>Requested</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280', marginRight: '4px' }}>Received:</span>
                <YesNoToggle value={doc.received} onChange={(val) => toggleReceived(doc._id, val)} />
                {doc.docType !== 'aadhaar' && doc.docType !== 'pan' && (
                  <button onClick={() => removeDocument(doc._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </div>
            </div>
            {doc.received && (
              <div style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Document Number */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: '4px' }}>{getDocNumberLabel(doc)}</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder={`Enter ${getDocNumberLabel(doc)}...`}
                      value={docNumbers[doc._id] || ''}
                      onChange={(e) => setDocNumbers((p) => ({ ...p, [doc._id]: e.target.value }))}
                      onBlur={() => saveDocNumber(doc._id)}
                      onKeyDown={(e) => e.key === 'Enter' && saveDocNumber(doc._id)}
                    />
                  </div>
                </div>
                {/* File Upload */}
                <FileUploadBtn
                  onUpload={(file) => uploadFile(doc._id, file)}
                  uploading={uploading[doc._id]}
                  existingFile={doc.fileName}
                  existingUrl={doc.fileUrl}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input autoFocus style={{ ...inputStyle, flex: 1 }} placeholder="Document name..." value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDocument()} />
          <button onClick={addDocument} style={{ ...toggleBtnBase, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '8px 16px' }}>Add</button>
          <button onClick={() => { setAdding(false); setNewDocName(''); }} style={{ ...toggleBtnBase, background: 'transparent', color: '#9ca3af', border: '1px solid #2d3348', padding: '8px 16px' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: 'none', border: '1px dashed #3a3f60', borderRadius: '8px', padding: '10px 16px', color: '#6366f1', fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus style={{ width: '14px', height: '14px' }} /> Add Other Documents
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 3 — Contract Signing
   ═══════════════════════════════════════════════════════ */

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

/* ─── Society Assign Modal ─── */
const SocietyAssignModal = ({ society, entryName, teamMembers, onClose, onConfirm }) => {
  const [spoc, setSpoc] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#1e2235', borderRadius: '14px', padding: '28px', width: '420px', border: '1px solid #2d3348' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Assign Society Registration</h3>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
          Register <span style={{ color: '#818cf8', fontWeight: 600 }}>{entryName}</span> for <span style={{ color: '#818cf8', fontWeight: 600 }}>{society.flag} {society.key}</span>
        </p>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Assign SPOC</label>
          <select value={spoc} onChange={(e) => setSpoc(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Select SPOC...</option>
            {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            min="2000-01-01" max="2099-12-31"
            style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'dark' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this registration..."
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #2d3348', paddingTop: '18px', marginTop: '4px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #2d3348', background: 'transparent', color: '#9ca3af', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm({ spoc, notes, deadline })}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle style={{ width: '15px', height: '15px' }} /> Assign & Register
          </button>
        </div>
      </div>
    </div>
  );
};

const ContractSigningView = ({ entry, onUpdate, teamMembers }) => {
  const [uploading, setUploading] = useState(false);
  const [startDate, setStartDate] = useState(entry.contractStartDate ? entry.contractStartDate.slice(0, 10) : '');
  const [renewalDate, setRenewalDate] = useState(entry.contractRenewalDate ? entry.contractRenewalDate.slice(0, 10) : '');
  const [assignModalSociety, setAssignModalSociety] = useState(null);
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    setStartDate(entry.contractStartDate ? entry.contractStartDate.slice(0, 10) : '');
  }, [entry.contractStartDate]);
  useEffect(() => {
    setRenewalDate(entry.contractRenewalDate ? entry.contractRenewalDate.slice(0, 10) : '');
  }, [entry.contractRenewalDate]);

  const selectedSocieties = entry.selectedSocieties || [];

  const toggleField = async (field, val) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update contract status', 'error');
    } catch (err) { console.error(err); addToast('Failed to update contract status', 'error'); }
  };

  const uploadContract = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(withApiBase(`/api/onboarding/${entry._id}/contract/upload`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Contract uploaded to Google Drive'); }
      else addToast('Contract upload failed', 'error');
    } catch (err) { console.error(err); addToast('Contract upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const saveDate = async (field, val, setter) => {
    setter(val);
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val || null }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast(`${field === 'contractStartDate' ? 'Contract start' : 'Contract renewal'} date saved`); }
      else addToast('Failed to save date', 'error');
    } catch (err) { console.error(err); addToast('Failed to save date', 'error'); }
  };

  /* Toggle a society in the checklist — if ticking ON, open the assign modal */
  const handleSocietyToggle = (soc) => {
    if (selectedSocieties.includes(soc.key)) return; // Already assigned — locked
    // Ticking ON — open assign modal
    setAssignModalSociety(soc);
  };

  /* Confirm assign → save society selection + create society registration */
  const handleAssignConfirm = async ({ spoc, notes, deadline }) => {
    const soc = assignModalSociety;
    setAssignModalSociety(null);
    try {
      // 1. Add society to selectedSocieties
      const updated = [...selectedSocieties, soc.key];
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ selectedSocieties: updated }) });
      const data = await res.json();
      if (data.entry) onUpdate(data.entry);

      // 2. Create a society registration entry
      const regRes = await authFetch('/api/societyregs', {
        method: 'POST',
        body: JSON.stringify({
          member: entry.name,
          society: soc.key,
          spoc: spoc || entry.spoc || '',
          notes: notes || '',
          deadline: deadline || '',
        }),
      });
      if (regRes.ok) addToast(`${soc.key} registration created for ${entry.name}`);
      else addToast('Society added but registration creation failed', 'error');
    } catch (err) { console.error(err); addToast('Failed to assign society', 'error'); }
  };

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Contract Signing</p>

      {/* Contract Sent */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText style={{ width: '16px', height: '16px', color: entry.contractSent ? '#10b981' : '#a855f7' }} />
          <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>Contract Sent</span>
        </div>
        <YesNoToggle value={entry.contractSent} onChange={(val) => toggleField('contractSent', val)} />
      </div>

      {/* Contract Received */}
      <div style={{ ...sectionStyle, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: entry.contractReceived ? '10px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText style={{ width: '16px', height: '16px', color: entry.contractReceived ? '#10b981' : '#a855f7' }} />
            <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>Contract Signing Received</span>
          </div>
          <YesNoToggle value={entry.contractReceived} onChange={(val) => toggleField('contractReceived', val)} />
        </div>
        {entry.contractReceived && (
          <div style={{ paddingLeft: '26px' }}>
            <FileUploadBtn
              onUpload={uploadContract}
              uploading={uploading}
              existingFile={entry.contractFileName}
              existingUrl={entry.contractFileUrl}
            />
          </div>
        )}
      </div>

      {/* Contract Start & Renewal Dates — side by side */}
      <div style={{ ...sectionStyle, padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Contract Start Date</label>
            <input
              type="date"
              min="2000-01-01" max="2099-12-31"
              style={{ ...inputStyle, colorScheme: 'dark' }}
              value={startDate}
              onChange={(e) => saveDate('contractStartDate', e.target.value, setStartDate)}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Contract Renewal Date</label>
            <input
              type="date"
              min="2000-01-01" max="2099-12-31"
              style={{ ...inputStyle, colorScheme: 'dark' }}
              value={renewalDate}
              onChange={(e) => saveDate('contractRenewalDate', e.target.value, setRenewalDate)}
            />
          </div>
        </div>
      </div>

      {/* Society Registration Checklist */}
      <div style={{ ...sectionStyle, padding: '16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Society Registration
        </p>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>
          Tick a society to assign and auto-create the registration entry.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SOCIETIES.map((soc) => {
            const checked = selectedSocieties.includes(soc.key);
            return (
              <div
                key={soc.key}
                onClick={() => !checked && handleSocietyToggle(soc)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '8px',
                  cursor: checked ? 'default' : 'pointer',
                  background: checked ? 'rgba(16,185,129,0.06)' : '#1a1e2e',
                  border: checked ? '1px solid #10b981' : '1px solid #2d3348',
                  opacity: checked ? 0.85 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { if (!checked) e.currentTarget.style.borderColor = '#3a3f60'; }}
                onMouseLeave={(e) => { if (!checked) e.currentTarget.style.borderColor = '#2d3348'; }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                  border: checked ? 'none' : '2px solid #4b5563',
                  background: checked ? '#6366f1' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                }}>
                  {checked && '✓'}
                </div>
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{soc.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: checked ? '#a5b4fc' : '#e5e7eb' }}>{soc.key}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>{soc.name}</span>
                </div>
                {checked && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>Registered</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Society Assign Modal */}
      {assignModalSociety && (
        <SocietyAssignModal
          society={assignModalSociety}
          entryName={entry.name}
          teamMembers={teamMembers}
          onClose={() => setAssignModalSociety(null)}
          onConfirm={handleAssignConfirm}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 4 — Active Member (summary of all steps)
   ═══════════════════════════════════════════════════════ */
const ActiveMemberView = ({ entry }) => {
  const [expanded, setExpanded] = useState({});
  const docs = entry.documents || [];

  const toggleSection = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const allDocsRequested = docs.filter((d) => d.requested).length;
  const allDocsReceived = docs.filter((d) => d.received).length;
  const allDocsUploaded = docs.filter((d) => d.fileUrl).length;

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
        <Eye style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
        Onboarding Summary
      </p>

      {/* Step 1 Summary */}
      <div style={{ ...sectionStyle, cursor: 'pointer' }} onClick={() => toggleSection('s1')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: allDocsRequested > 0 ? '#10b981' : '#6b7280' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>Step 1: Document Submission</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{allDocsRequested}/{docs.length} requested</span>
            {expanded.s1 ? <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />}
          </div>
        </div>
        {expanded.s1 && (
          <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
            {docs.map((d) => (
              <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                {d.requested ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
                <span style={{ fontSize: '13px', color: d.requested ? '#e5e7eb' : '#6b7280' }}>{d.label} — {d.requested ? 'Requested' : 'Not requested'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 Summary */}
      <div style={{ ...sectionStyle, cursor: 'pointer' }} onClick={() => toggleSection('s2')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: allDocsReceived > 0 ? '#10b981' : '#6b7280' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>Step 2: KYC Verification</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{allDocsReceived}/{docs.length} received, {allDocsUploaded} files</span>
            {expanded.s2 ? <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />}
          </div>
        </div>
        {expanded.s2 && (
          <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
            {docs.map((d) => (
              <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {d.received ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
                  <span style={{ fontSize: '13px', color: d.received ? '#e5e7eb' : '#6b7280' }}>{d.label} — {d.received ? 'Received' : 'Not received'}</span>
                </div>
                {d.fileName && (
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'underline' }}>{d.fileName}</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 3 Summary */}
      <div style={{ ...sectionStyle, cursor: 'pointer' }} onClick={() => toggleSection('s3')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: (entry.contractSent && entry.contractReceived) ? '#10b981' : '#6b7280' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>Step 3: Contract Signing</span>
          </div>
          {expanded.s3 ? <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />}
        </div>
        {expanded.s3 && (
          <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              {entry.contractSent ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
              <span style={{ fontSize: '13px', color: entry.contractSent ? '#e5e7eb' : '#6b7280' }}>Contract Sent — {entry.contractSent ? 'Yes' : 'No'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {entry.contractReceived ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
                <span style={{ fontSize: '13px', color: entry.contractReceived ? '#e5e7eb' : '#6b7280' }}>Contract Received — {entry.contractReceived ? 'Yes' : 'No'}</span>
              </div>
              {entry.contractFileName && (
                <a href={entry.contractFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'underline' }}>{entry.contractFileName}</a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recheck hint */}
      <div style={{ padding: '8px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          <RefreshCw style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          To recheck any step, move the entry back to the relevant stage using "Move to Stage" below.
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 5 — Contact Made
   ═══════════════════════════════════════════════════════ */
const ContactMadeView = ({ entry, onUpdate }) => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [groupName, setGroupName] = useState(entry.whatsAppGroupName || '');
  const [emailAddr, setEmailAddr] = useState(entry.createdEmailAddress || '');
  const [emailPass, setEmailPass] = useState(entry.createdEmailPassword || '');

  useEffect(() => { setGroupName(entry.whatsAppGroupName || ''); }, [entry.whatsAppGroupName]);
  useEffect(() => { setEmailAddr(entry.createdEmailAddress || ''); }, [entry.createdEmailAddress]);
  useEffect(() => { setEmailPass(entry.createdEmailPassword || ''); }, [entry.createdEmailPassword]);

  const toggleField = async (field, val) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update', 'error');
    } catch (err) { console.error(err); addToast('Failed to update', 'error'); }
  };

  const saveText = async (field, val) => {
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to save', 'error');
    } catch (err) { console.error(err); addToast('Failed to save', 'error'); }
  };

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Contact Made</p>

      <div style={{ ...sectionStyle, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>Added in WhatsApp Group</span>
          <YesNoToggle value={entry.addedToWhatsApp} onChange={(val) => toggleField('addedToWhatsApp', val)} />
        </div>
        {entry.addedToWhatsApp && (
          <div style={{ marginTop: '10px' }}>
            <label style={labelStyle}>WhatsApp Group Name</label>
            <input
              style={inputStyle}
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onBlur={() => saveText('whatsAppGroupName', groupName)}
            />
          </div>
        )}
      </div>

      <div style={{ ...sectionStyle, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>Created Email</span>
          <YesNoToggle value={entry.emailCreated} onChange={(val) => toggleField('emailCreated', val)} />
        </div>
        {entry.emailCreated && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                style={inputStyle}
                placeholder="Enter email address..."
                value={emailAddr}
                onChange={(e) => setEmailAddr(e.target.value)}
                onBlur={() => saveText('createdEmailAddress', emailAddr)}
              />
            </div>
            <div>
              <label style={labelStyle}>Email Password</label>
              <input
                style={inputStyle}
                placeholder="Enter email password..."
                value={emailPass}
                onChange={(e) => setEmailPass(e.target.value)}
                onBlur={() => saveText('createdEmailPassword', emailPass)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 6 — Completed (read-only summary of all stages)
   ═══════════════════════════════════════════════════════ */
const CompletedView = ({ entry }) => {
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const docs = entry.documents || [];
  const selectedSocieties = entry.selectedSocieties || [];

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const stepHeader = (key, icon, label, rightText, isGreen) => (
    <div style={{ ...sectionStyle, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => toggle(key)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3a3f60'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2540'; }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle style={{ width: '16px', height: '16px', color: isGreen ? '#10b981' : '#6b7280' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightText && <span style={{ fontSize: '12px', color: '#6b7280' }}>{rightText}</span>}
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: isGreen ? 'rgba(16,185,129,0.14)' : 'rgba(107,114,128,0.14)', color: isGreen ? '#10b981' : '#6b7280' }}>
            {isGreen ? 'Done' : 'Pending'}
          </span>
          {expanded[key] ? <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />}
        </div>
      </div>
      {expanded[key] && icon}
    </div>
  );

  const allDocsRequested = docs.filter((d) => d.requested).length;
  const allDocsReceived = docs.filter((d) => d.received).length;

  return (
    <div>
      {/* Completed banner */}
      <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #166534', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CheckCircle style={{ width: '22px', height: '22px', color: '#22c55e' }} />
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#22c55e' }}>Onboarding Completed</p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>All stages have been completed for this member.</p>
        </div>
      </div>

      {/* Step 1: Document Submission */}
      {stepHeader('s1', (
        <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
          {docs.map((d) => (
            <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              {d.requested ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
              <span style={{ fontSize: '13px', color: d.requested ? '#e5e7eb' : '#6b7280' }}>{d.label} — {d.requested ? 'Requested' : 'Not requested'}</span>
            </div>
          ))}
        </div>
      ), 'Document Submission', `${allDocsRequested}/${docs.length} requested`, allDocsRequested > 0)}

      {/* Step 2: KYC Verification */}
      {stepHeader('s2', (
        <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
          {docs.map((d) => (
            <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {d.received ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
                <span style={{ fontSize: '13px', color: d.received ? '#e5e7eb' : '#6b7280' }}>{d.label} — {d.received ? 'Received' : 'Not received'}</span>
              </div>
              {d.fileName && <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'underline' }}>{d.fileName}</a>}
            </div>
          ))}
        </div>
      ), 'KYC Verification', `${allDocsReceived}/${docs.length} received`, allDocsReceived > 0)}

      {/* Step 3: Contract Signing */}
      {stepHeader('s3', (
        <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            {entry.contractSent ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
            <span style={{ fontSize: '13px', color: entry.contractSent ? '#e5e7eb' : '#6b7280' }}>Contract Sent — {entry.contractSent ? 'Yes' : 'No'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {entry.contractReceived ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
              <span style={{ fontSize: '13px', color: entry.contractReceived ? '#e5e7eb' : '#6b7280' }}>Contract Received — {entry.contractReceived ? 'Yes' : 'No'}</span>
            </div>
            {entry.contractFileName && <a href={entry.contractFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'underline' }}>{entry.contractFileName}</a>}
          </div>
          {(entry.contractStartDate || entry.contractRenewalDate) && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', paddingLeft: '22px' }}>
              {entry.contractStartDate && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Start: <strong style={{ color: '#e5e7eb' }}>{fmtDate(entry.contractStartDate)}</strong></span>}
              {entry.contractRenewalDate && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Renewal: <strong style={{ color: '#e5e7eb' }}>{fmtDate(entry.contractRenewalDate)}</strong></span>}
            </div>
          )}
          {selectedSocieties.length > 0 && (
            <div style={{ marginTop: '10px', paddingLeft: '22px' }}>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Societies Registered</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedSocieties.map((s) => (
                  <span key={s} style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', background: 'rgba(99,102,241,0.14)', color: '#a5b4fc' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ), 'Contract Signing', `${[entry.contractSent, entry.contractReceived].filter(Boolean).length}/2 done`, entry.contractSent && entry.contractReceived)}

      {/* Step 4: Active Member */}
      {stepHeader('s4', (
        <div style={{ marginTop: '12px', paddingLeft: '26px', fontSize: '13px', color: '#9ca3af' }} onClick={(e) => e.stopPropagation()}>
          <p>Member has been activated and onboarding summary was reviewed.</p>
        </div>
      ), 'Active Member', null, true)}

      {/* Step 5: Contact Made */}
      {stepHeader('s5', (
        <div style={{ marginTop: '12px', paddingLeft: '26px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            {entry.addedToWhatsApp ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
            <span style={{ fontSize: '13px', color: entry.addedToWhatsApp ? '#e5e7eb' : '#6b7280' }}>WhatsApp Group — {entry.addedToWhatsApp ? (entry.whatsAppGroupName || 'Added') : 'No'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            {entry.emailCreated ? <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #3a3f60' }} />}
            <span style={{ fontSize: '13px', color: entry.emailCreated ? '#e5e7eb' : '#6b7280' }}>Email Created — {entry.emailCreated ? 'Yes' : 'No'}</span>
          </div>
          {entry.emailCreated && entry.createdEmailAddress && (
            <div style={{ marginTop: '6px', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Email: <strong style={{ color: '#e5e7eb' }}>{entry.createdEmailAddress}</strong></span>
              {entry.createdEmailPassword && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Password: <strong style={{ color: '#e5e7eb' }}>{entry.createdEmailPassword}</strong></span>}
            </div>
          )}
        </div>
      ), 'Contact Made', `${[entry.addedToWhatsApp, entry.emailCreated].filter(Boolean).length}/2 done`, entry.addedToWhatsApp && entry.emailCreated)}

      {/* Recheck hint */}
      <div style={{ padding: '8px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          <RefreshCw style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          To edit any step, move the entry back to the relevant stage using "Move to Stage" below.
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Stage View Renderer
   ═══════════════════════════════════════════════════════ */
const StageContent = ({ entry, onUpdate, teamMembers }) => {
  switch (entry.stage) {
    case 'Document Submission': return <DocumentSubmissionView entry={entry} onUpdate={onUpdate} />;
    case 'KYC Verification': return <KYCVerificationView entry={entry} onUpdate={onUpdate} />;
    case 'Contract Signing': return <ContractSigningView entry={entry} onUpdate={onUpdate} teamMembers={teamMembers || []} />;
    case 'Active Member': return <ActiveMemberView entry={entry} onUpdate={onUpdate} />;
    case 'Contact Made': return <ContactMadeView entry={entry} onUpdate={onUpdate} />;
    case 'Completed': return <CompletedView entry={entry} />;
    default: return <p style={{ color: '#6b7280', fontSize: '13px' }}>Unknown stage</p>;
  }
};

/* ═══════════════════════════════════════════════════════
   Add / Edit Modal
   ═══════════════════════════════════════════════════════ */
const AddOnboardingModal = ({ onClose, onAdd, teamMembers, members, initialData }) => {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    initialData
      ? { ...initialData, deadline: initialData.deadline ? fmtDateISO(new Date(initialData.deadline)) : '' }
      : { name: '', role: [], email: '', phone: '', contractType: 'Retailer', spoc: '', notes: '', priority: 'medium', deadline: '' },
  );

  const handleMemberSelect = (memberName) => {
    if (!memberName) { setForm({ ...form, name: '', role: [], email: '', phone: '' }); return; }
    const m = members.find((x) => x.name === memberName);
    if (m) setForm({ ...form, name: m.name, role: Array.isArray(m.role) ? m.role : (m.role ? [m.role] : []), email: m.email || '', phone: m.phone || '' });
  };

  const handleSubmit = () => {
    if (!form.name || !form.email) return;
    onAdd(form);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: '32px', width: '560px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{isEdit ? 'Edit Onboarding' : 'Start New Onboarding'}</h2>
          <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
        </div>

        {!isEdit && (
          <div style={{ backgroundColor: '#1a2440', border: '1px solid #2d3a5a', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', color: '#93a3c0', lineHeight: '1.5' }}>This will create a new onboarding pipeline entry starting at <strong style={{ color: '#e5e7eb' }}>Document Submission</strong>.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <SearchableSelect label="Select Member" required options={members} value={form.name} onChange={handleMemberSelect} placeholder="Search member..." emptyMessage="No members found. Add members first." />
          </div>
          <MultiRoleSelect selected={form.role} onChange={(v) => setForm({ ...form, role: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div><label style={labelStyle}>Email *</label><input style={inputStyle} placeholder="email@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} placeholder="+91 98xxx xxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Contract Type</label><select style={{ ...inputStyle, cursor: 'pointer' }} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>{contractTypes.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Assign SPOC</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.spoc} onChange={(e) => setForm({ ...form, spoc: e.target.value })}>
            <option value="">Select a team member...</option>
            {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Deadline</label>
          <input style={inputStyle} type="date" min="2000-01-01" max="2099-12-31" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </div>
        <div style={{ marginBottom: '28px' }}><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} placeholder="Add any initial onboarding notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #2d3348', paddingTop: '20px', marginTop: '4px' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#e5e7eb', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isEdit ? <><Edit3 style={{ width: '16px', height: '16px' }} /> Save Changes</> : <><ArrowRight style={{ width: '16px', height: '16px' }} /> Start Onboarding</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Detail Modal
   ═══════════════════════════════════════════════════════ */
const OnboardingDetailModal = ({ member, onClose, onUpdate, onDelete, onEdit, onMoveStage, onNotQualified, teamMembers }) => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMoveStage, setShowMoveStage] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showNotQualifiedConfirm, setShowNotQualifiedConfirm] = useState(false);
  const [notQualifiedReason, setNotQualifiedReason] = useState('');
  const currentStageIdx = STAGES.indexOf(member.stage);
  const isCompleted = member.stage === 'Completed';
  const canAdvance = currentStageIdx >= 0 && currentStageIdx < STAGES.length - 2 && !isCompleted;

  const saveProgress = async () => {
    try {
      const res = await authFetch(`/api/onboarding/${member._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          contractSent: member.contractSent,
          contractReceived: member.contractReceived,
          addedToWhatsApp: member.addedToWhatsApp,
          whatsAppGroupName: member.whatsAppGroupName,
          emailCreated: member.emailCreated,
          createdEmailAddress: member.createdEmailAddress,
          notes: member.notes,
          spoc: member.spoc,
          priority: member.priority,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data.entry);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
        addToast('Progress saved successfully');
      } else addToast('Failed to save progress', 'error');
    } catch (err) { console.error('Save progress error:', err); addToast('Failed to save progress', 'error'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: '#1e2235', borderRadius: '16px', padding: 0, width: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2d3348' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>Onboarding Details</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => onEdit(member)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><Edit3 style={{ width: '18px', height: '18px' }} /></button>
            <button onClick={() => setConfirmDelete(true)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 style={{ width: '18px', height: '18px' }} /></button>
            <X style={{ width: '20px', height: '20px', color: '#9ca3af', cursor: 'pointer' }} onClick={onClose} />
          </div>
        </div>

        {/* Confirm delete */}
        {confirmDelete && (
          <div style={{ padding: '0 28px', marginTop: '12px' }}>
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#fca5a5' }}>Delete this entry permanently?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { onDelete(member._id); onClose(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Member info */}
        <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: member.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
            {member.initials || member.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>{member.name}</h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>{member.email}</p>
          </div>
          <PriorityBadge priority={member.priority} />
        </div>

        {/* Stage progress bar */}
        <div style={{ padding: '0 28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {STAGES.map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: i <= currentStageIdx ? (stageDotColors[STAGES[currentStageIdx]] || '#6366f1') : '#2d3348' }} />
                <span style={{ fontSize: '9px', color: i <= currentStageIdx ? '#e5e7eb' : '#6b7280', fontWeight: i === currentStageIdx ? 700 : 400, textAlign: 'center', lineHeight: '1.2' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current stage badge */}
        <div style={{ padding: '0 28px', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#1a2440', border: '1px solid #2d3a5a', borderRadius: '8px', padding: '8px 14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stageDotColors[member.stage] || '#6366f1' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>Current Stage: {member.stage}</span>
          </div>
          {member.spoc && (
            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#9ca3af' }}>
              SPOC: <strong style={{ color: '#e5e7eb' }}>{member.spoc}</strong>
              {member.assignedDate && (
                <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                  (assigned {new Date(member.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                </span>
              )}
            </span>
          )}
          {member.deadline && (() => {
            const dlStatus = getDeadlineStatus(member.deadline);
            const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;
            return (
              <span style={{ marginLeft: '12px', fontSize: '12px', color: '#9ca3af' }}>
                Deadline: <strong style={{ color: '#e5e7eb' }}>{new Date(member.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                {dlColor && (
                  <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: dlColor.bg, color: dlColor.color }}>
                    {dlColor.label}
                  </span>
                )}
              </span>
            );
          })()}
        </div>

        {/* Stage-specific content */}
        <div style={{ padding: '0 28px', marginBottom: '24px' }}>
          <StageContent entry={member} onUpdate={onUpdate} teamMembers={teamMembers} />
        </div>

        {/* Notes */}
        {member.notes && (
          <div style={{ padding: '0 28px', marginBottom: '16px' }}>
            <div style={{ ...sectionStyle }}>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Notes</p>
              <p style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{member.notes}</p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #2d3348', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Not Qualified confirmation panel */}
          {showNotQualifiedConfirm && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #991b1b', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                ⚠ Confirm: Mark as Not Qualified
              </p>
              <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                This will remove the onboarding entry and move the lead to "Not Qualified" in the Sales Pipeline.
              </p>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Reason (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Budget constraints, not a good fit..."
                  value={notQualifiedReason}
                  onChange={(e) => setNotQualifiedReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#1a1f2e', border: '1px solid #991b1b', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowNotQualifiedConfirm(false); setNotQualifiedReason(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #2d3348', background: 'transparent', color: '#9ca3af', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={() => { onNotQualified(member._id, notQualifiedReason); setShowNotQualifiedConfirm(false); setNotQualifiedReason(''); }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <XCircle style={{ width: '14px', height: '14px' }} /> Confirm Not Qualified
                </button>
              </div>
            </div>
          )}

          {/* Row 1 — secondary: Move to Stage + Not Qualified */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMoveStage(!showMoveStage)} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #2d3348', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Move to Stage <ChevronDown style={{ width: '14px', height: '14px' }} />
              </button>
              {showMoveStage && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', background: '#1a1e2e', border: '1px solid #2d3348', borderRadius: '8px', overflow: 'hidden', zIndex: 20, minWidth: '200px' }}>
                  {STAGES.filter((s) => s !== member.stage).map((s) => (
                    <div key={s} onClick={() => { onMoveStage(member._id, s); setShowMoveStage(false); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#e5e7eb', fontSize: '13px' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1e2540')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stageDotColors[s] }} />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!isCompleted && (
              <button onClick={() => setShowNotQualifiedConfirm(true)} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #991b1b', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <XCircle style={{ width: '15px', height: '15px' }} /> Not Qualified
              </button>
            )}
          </div>

          {/* Row 2 — primary: Save + Advance/Complete */}
          {!isCompleted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={saveProgress} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: savedFlash ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #374151, #4b5563)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.3s' }}>
                {savedFlash ? <><CheckCircle style={{ width: '16px', height: '16px' }} /> Saved!</> : <><Save style={{ width: '16px', height: '16px' }} /> Save Progress</>}
              </button>
              {canAdvance && (
                <button onClick={() => { onMoveStage(member._id, STAGES[currentStageIdx + 1]); }}
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Advance Stage <ArrowRight style={{ width: '16px', height: '16px' }} />
                </button>
              )}
              {!canAdvance && currentStageIdx === STAGES.indexOf('Contact Made') && (
                <button onClick={() => { onMoveStage(member._id, 'Completed'); }} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle style={{ width: '16px', height: '16px' }} /> Onboarding Complete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Member Card
   ═══════════════════════════════════════════════════════ */
const MemberCard = ({ member, onClick }) => {
  const date = member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const docs = member.documents || [];
  const progress = member.stage === 'Document Submission'
    ? `${docs.filter((d) => d.requested).length}/${docs.length} requested`
    : member.stage === 'KYC Verification'
    ? `${docs.filter((d) => d.received).length}/${docs.length} received`
    : member.stage === 'Contract Signing'
    ? `${[member.contractSent, member.contractReceived].filter(Boolean).length}/2 done`
    : member.stage === 'Contact Made'
    ? `${[member.addedToWhatsApp, member.emailCreated].filter(Boolean).length}/2 done`
    : member.stage === 'Completed'
    ? '✓ Completed'
    : 'Review all steps';
  const dlStatus = member.stage !== 'Completed' ? getDeadlineStatus(member.deadline) : null;
  const dlColor = dlStatus ? DEADLINE_COLORS[dlStatus] : null;

  return (
    <div onClick={() => onClick(member)} style={{ backgroundColor: '#161b2e', border: `1px solid ${dlColor ? dlColor.border : '#1e2540'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = dlColor ? dlColor.border : '#3a3f60')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = dlColor ? dlColor.border : '#1e2540')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'white', margin: 0 }}>{member.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {dlColor && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: dlColor.bg, color: dlColor.color }}>{dlColor.label}</span>}
          <PriorityBadge priority={member.priority} />
        </div>
      </div>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>{progress}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Clock style={{ width: '12px', height: '12px', color: '#6b7280' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>{date}</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */
const Onboarding = () => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [members, setMembers] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [entriesRes, usersRes, membersRes] = await Promise.all([authFetch('/api/onboarding'), authFetch('/api/users/team'), authFetch('/api/members')]);
        const entriesData = await entriesRes.json();
        const usersData = await usersRes.json();
        const membersData = await membersRes.json();
        setEntries(entriesData.entries || []);
        setTeamMembers(usersData.users || []);
        setMembers(membersData.members || []);
      } catch (err) { console.error('Failed to fetch:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [authFetch]);

  /* CRUD helpers */
  const handleAddEntry = async (form) => {
    try {
      const res = await authFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setEntries((p) => [data.entry, ...p]); addToast('Onboarding started'); }
      else addToast('Failed to start onboarding', 'error');
    } catch (err) { console.error('Failed to add entry:', err); addToast('Failed to start onboarding', 'error'); }
  };

  const handleEditEntry = (entry) => {
    setSelectedMember(null);
    setEditingEntry({
      _id: entry._id, name: entry.name, role: Array.isArray(entry.role) ? entry.role : [], email: entry.email,
      phone: entry.phone || '', contractType: entry.contractType || 'Retailer', spoc: entry.spoc || '',
      notes: entry.notes || '', priority: entry.priority || 'medium',
    });
  };

  const handleEditSubmit = async (form) => {
    if (!editingEntry) return;
    try {
      const res = await authFetch(`/api/onboarding/${editingEntry._id}`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { setEntries((p) => p.map((e) => (e._id === editingEntry._id ? data.entry : e))); addToast('Entry updated'); }
      else addToast('Failed to update entry', 'error');
    } catch (err) { console.error('Failed to edit entry:', err); addToast('Failed to update entry', 'error'); }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      const res = await authFetch(`/api/onboarding/${entryId}`, { method: 'DELETE' });
      if (res.ok) { setEntries((p) => p.filter((e) => e._id !== entryId)); addToast('Entry deleted'); }
      else addToast('Failed to delete entry', 'error');
    } catch (err) { console.error('Failed to delete entry:', err); addToast('Failed to delete entry', 'error'); }
  };

  const handleMoveStage = async (entryId, newStage) => {
    try {
      const res = await authFetch(`/api/onboarding/${entryId}`, { method: 'PUT', body: JSON.stringify({ stage: newStage }) });
      const data = await res.json();
      if (res.ok) {
        setEntries((p) => p.map((e) => (e._id === entryId ? data.entry : e)));
        setSelectedMember((prev) => (prev && prev._id === entryId ? data.entry : prev));
        addToast(`Moved to ${newStage}`);
      } else addToast('Failed to move stage', 'error');
    } catch (err) { console.error('Failed to move stage:', err); addToast('Failed to move stage', 'error'); }
  };

  const handleNotQualified = async (entryId, reason) => {
    try {
      const res = await authFetch(`/api/onboarding/${entryId}/not-qualified`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || '' }),
      });
      if (res.ok) {
        setEntries((p) => p.filter((e) => e._id !== entryId));
        setSelectedMember(null);
        addToast('Moved to Sales Pipeline — Not Qualified');
      } else addToast('Failed to mark not qualified', 'error');
    } catch (err) { console.error(err); addToast('Failed to mark not qualified', 'error'); }
  };

  /* Live update for detail modal (called from stage views) */
  const handleEntryUpdate = (updatedEntry) => {
    setEntries((p) => p.map((e) => (e._id === updatedEntry._id ? updatedEntry : e)));
    setSelectedMember((prev) => (prev && prev._id === updatedEntry._id ? updatedEntry : prev));
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      (e.email && e.email.toLowerCase().includes(q)) ||
      (e.phone && e.phone.includes(q)) ||
      (e.spoc && e.spoc.toLowerCase().includes(q)) ||
      (e.contractType && e.contractType.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading onboarding...</div>;

  return (
    <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white' }}>Onboarding</h1>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              placeholder="Search by name, email, SPOC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '260px', padding: '10px 14px 10px 36px', background: '#141720', border: '1px solid #1e2540', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Track client onboarding from document submission to active membership</p>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: '20px', flex: 1, minHeight: 0 }}>
        {STAGES.map((stage) => {
          const stageEntries = filteredEntries.filter((e) => e.stage === stage);
          return (
            <div key={stage} style={{ backgroundColor: '#111525', border: '1px solid #1e2540', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: stageDotColors[stage] }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{stage}</span>
                </div>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1e2540', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>{stageEntries.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                {stageEntries.map((entry) => <MemberCard key={entry._id} member={entry} onClick={setSelectedMember} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {editingEntry && <AddOnboardingModal onClose={() => setEditingEntry(null)} onAdd={handleEditSubmit} teamMembers={teamMembers} members={members} initialData={editingEntry} />}
      {selectedMember && (
        <OnboardingDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onUpdate={handleEntryUpdate}
          onDelete={handleDeleteEntry}
          onEdit={handleEditEntry}
          onMoveStage={handleMoveStage}
          onNotQualified={handleNotQualified}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
};

export default Onboarding;
