/**
 * Onboarding stage views
 * ─────────────────────────────────────────────────────────────
 * The per-stage panels (documents, KYC, contract, active member, contact made,
 * completed) plus the small controls they share. Lifted out of Onboarding.jsx
 * so both the list page and the stepped detail page can use them.
 *
 * These render inside a Studio `Card`, so they are built from the shared kit
 * and the shared tokens. Two rules do most of the work here:
 *
 *   • **A list, not a stack of boxes.** Five documents drawn as five bordered
 *     cards is five boxes competing for attention; drawn as one `ListPanel`
 *     with hairline-separated rows it is a list, read in one sweep.
 *   • **A border means you can type in it.** Read-only summaries are set as
 *     text and ticks; only controls carry a border.
 *
 * Stages 1 and 2 share one add-document form, and stages 4 and 6 share one
 * summary — they used to hold near-identical copies of each.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Plus, X, CheckCircle, Trash2, Upload, FileText, RefreshCw, Eye, EyeOff,
  Send, FileSignature, Landmark, MessageSquare, Mail, KeyRound, IdCard,
  UserCheck, CalendarCheck, Circle, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { useGuestGuard } from '../hooks/useGuestGuard';
import { withApiBase } from '../utils/api';
import { T, TONES, LABEL, SP, ROW_PAD } from '../theme';
import {
  Button, Pill, Ring, SubHead, ListPanel, ListRow, Collapsible,
  DecisionRow, YesNo, DateTile, Input, Select, Textarea, FormGrid, MultiSelect, Summary,
} from './studio';
import { inputStyle } from './onboardingStyles';

/* ═══════════════════════════════════════════
   SHARED CONTROLS
   ═══════════════════════════════════════════ */

/* Imported records have carried a null `documents`, and `.filter` on null is a
   white screen rather than an empty list. */
const docsOf = (entry) => (Array.isArray(entry.documents) ? entry.documents : []);

/* Kept as a named re-export so the stage panels read the way they always did,
   but there is now exactly one binary control in the app — the same one the
   Sales Pipeline uses. Two switches that look almost alike is the confusion
   NN/g's consistency rule is about. */
export const YesNoToggle = YesNo;

/* ─── Multi-Role Select ─── */
/* The chip picker itself now lives in the kit as `MultiSelect`; this is just
   the onboarding-roles picklist wired into it. Members had a second, older
   copy of the same control — there is one again. */
export const MultiRoleSelect = ({ selected, onChange }) => {
  const { getOptions } = usePicklist();
  return (
    <MultiSelect
      label="Role"
      options={getOptions('onboarding_roles')}
      selected={selected}
      onChange={onChange}
      placeholder="Pick the roles this client is signed for"
    />
  );
};

/* ─── A file that lives on Google Drive ─── */
const DriveLink = ({ name, url }) => {
  if (!name) return null;
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%',
        padding: '7px 11px', borderRadius: '8px', textDecoration: 'none',
        background: TONES.green.bg, border: `1px solid ${TONES.green.bd}`,
        color: TONES.green.fg, fontSize: '12.5px', fontWeight: 600,
      }}
    >
      <FileText style={{ width: '13px', height: '13px', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <ExternalLink style={{ width: '11px', height: '11px', flexShrink: 0, opacity: 0.75 }} />
    </a>
  );
};

/* ─── File Upload Button ─── */
export const FileUploadBtn = ({ onUpload, uploading, existingFile, existingUrl }) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
      {existingFile && <DriveLink name={existingFile} url={existingUrl} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <input ref={ref} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button
          type="button"
          className="sc-tile"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          title={existingFile ? `Pick a file to replace ${existingFile}` : 'Pick a file from this computer'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '9px', cursor: uploading ? 'not-allowed' : 'pointer',
            background: 'transparent', border: `1px dashed ${T.borderHi}`,
            color: T.muted, fontSize: '12.5px', fontWeight: 600, opacity: uploading ? 0.5 : 1,
          }}
        >
          <Upload style={{ width: '13px', height: '13px' }} />
          {existingFile ? 'Replace file' : 'Choose file'}
        </button>
        {localFile && (
          <Button
            icon={Upload}
            onClick={handleUpload}
            disabled={uploading}
            title={`Upload ${localFile.name} to Google Drive`}
            style={{ padding: '8px 14px', fontSize: '12.5px' }}
          >
            {uploading ? 'Uploading...' : 'Upload to Drive'}
          </Button>
        )}
      </div>
      {localFile && !uploading && (
        <span style={{ fontSize: '11.5px', color: T.faint }}>
          Ready to upload: <strong style={{ color: T.body, fontWeight: 600 }}>{localFile.name}</strong> — it is not
          saved until you press Upload.
        </span>
      )}
    </div>
  );
};

/* ─── The readiness strip every working stage opens with ─── */
/* Progress as a shape, then one plain sentence. It replaces the uppercase
   grey slug ("REQUEST DOCUMENTS") that used to head each panel and said
   nothing the card title above it had not already said. */
const Readiness = ({ value, total, tone, caption, headline, detail, right }) => (
  <Summary
    left={<Ring value={value} total={total} tone={tone} caption={caption} />}
    headline={headline}
    detail={detail}
    right={right}
  />
);

/* ─── Add a document (shared by stage 1 and stage 2) ─── */
/* Both stages held their own copy of this, differing only in the button text. */
const AddDocumentForm = ({ suggestions, existing, onAdd, label }) => {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const unused = suggestions.filter((s) => !existing.some((d) => d.label.toLowerCase() === s.toLowerCase()));

  const submit = async () => {
    if (!name.trim()) return;
    const ok = await onAdd(name.trim());
    if (ok) { setName(''); setAdding(false); setShowSuggestions(false); }
  };

  if (!adding) {
    return (
      <button
        type="button"
        className="sc-tile"
        onClick={() => { setAdding(true); setShowSuggestions(true); }}
        title="Put another document on this client's list"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', marginTop: '12px', padding: '12px 16px', borderRadius: '10px',
          background: 'none', border: `1px dashed ${T.borderHi}`,
          color: T.muted, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Plus style={{ width: '14px', height: '14px' }} /> {label}
      </button>
    );
  }

  return (
    <div style={{ marginTop: '12px' }}>
      {showSuggestions && unused.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '11px' }}>
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setName(s); setShowSuggestions(false); }}
              title={`Name this document “${s}”`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '9999px', cursor: 'pointer',
                background: TONES.indigo.bg, border: `1px solid ${TONES.indigo.bd}`,
                color: TONES.indigo.fg, fontSize: '12px', fontWeight: 600,
              }}
            >
              <Plus style={{ width: '11px', height: '11px' }} /> {s}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          autoFocus
          className="sc-control"
          style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }}
          placeholder="Document name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {unused.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => setShowSuggestions((p) => !p)}
            title={`${showSuggestions ? 'Hide' : 'Show'} the ${unused.length} document type${unused.length === 1 ? '' : 's'} not on this list yet`}
            style={{ padding: '10px 14px', fontSize: '13px' }}
          >
            Suggestions
          </Button>
        )}
        <Button
          icon={Plus}
          onClick={submit}
          disabled={!name.trim()}
          title={name.trim() ? `Add “${name.trim()}” to the list` : 'Type a document name first'}
          style={{ padding: '10px 16px', fontSize: '13px' }}
        >
          Add
        </Button>
        <Button variant="ghost" icon={X} onClick={() => { setAdding(false); setName(''); setShowSuggestions(false); }} style={{ padding: '10px 14px', fontSize: '13px' }}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 1 — Document Submission
   ═══════════════════════════════════════════════════════ */
export const DocumentSubmissionView = ({ entry, onUpdate }) => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { blockGuestAction } = useGuestGuard();
  const { getOptions } = usePicklist();
  const docTypeSuggestions = getOptions('document_types');
  const docs = docsOf(entry);
  const requested = docs.filter((d) => d.requested).length;

  const toggleRequested = async (docId, val) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ requested: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update document', 'error');
    } catch (err) { console.error(err); addToast('Failed to update document', 'error'); }
  };

  const addDocument = async (docLabel) => {
    if (blockGuestAction()) return false;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents`, { method: 'POST', body: JSON.stringify({ label: docLabel }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document added'); return true; }
      addToast('Failed to add document', 'error');
      return false;
    } catch (err) { console.error(err); addToast('Failed to add document', 'error'); return false; }
  };

  const removeDocument = async (docId) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document removed'); }
      else addToast('Failed to remove document', 'error');
    } catch (err) { console.error(err); addToast('Failed to remove document', 'error'); }
  };

  return (
    <div>
      <Readiness
        value={requested} total={docs.length}
        tone={docs.length && requested === docs.length ? 'green' : 'amber'}
        caption="asked for"
        headline={docs.length === 0
          ? 'Nothing has been asked for yet.'
          : requested === docs.length
            ? 'Everything on the list has been asked for.'
            : `${docs.length - requested} still to ask for.`}
        detail="Tick a document once you have actually asked the client for it. Each tick saves immediately."
      />

      <ListPanel>
        {docs.map((doc) => (
          <ListRow
            key={doc._id}
            icon={FileText}
            tone={doc.requested ? 'green' : 'grey'}
            title={doc.label}
            muted={!doc.requested}
            right={(
              <>
                <YesNoToggle value={doc.requested} onChange={(val) => toggleRequested(doc._id, val)} />
                {doc.docType !== 'aadhaar' && doc.docType !== 'pan' && (
                  <button
                    type="button"
                    onClick={() => removeDocument(doc._id)}
                    title={`Remove ${doc.label} from the list`}
                    aria-label={`Remove ${doc.label} from the list`}
                    onMouseEnter={(e) => { e.currentTarget.style.color = TONES.red.fg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.faint; }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint, padding: '4px', display: 'inline-flex', transition: 'color 0.15s' }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </>
            )}
          />
        ))}
        {docs.length === 0 && (
          <div style={{ padding: '22px 15px', textAlign: 'center', fontSize: '13.5px', color: T.faint }}>
            No documents on the list. Add the ones this client needs below.
          </div>
        )}
      </ListPanel>

      <AddDocumentForm
        suggestions={docTypeSuggestions}
        existing={docs}
        onAdd={addDocument}
        label="Add more documents"
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 2 — KYC Verification
   ═══════════════════════════════════════════════════════ */
export const KYCVerificationView = ({ entry, onUpdate }) => {
  const [uploading, setUploading] = useState({});
  const [docNumbers, setDocNumbers] = useState({});
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();
  const { blockGuestAction } = useGuestGuard();
  const { getOptions } = usePicklist();
  const docTypeSuggestions = getOptions('document_types');
  const docs = docsOf(entry);
  const received = docs.filter((d) => d.received).length;
  const withFiles = docs.filter((d) => d.fileUrl).length;

  /* initialise local doc-number state from entry */
  useEffect(() => {
    const nums = {};
    (entry.documents || []).forEach((d) => { if (d.docNumber) nums[d._id] = d.docNumber; });
    setDocNumbers(nums);
  }, [entry.documents]);

  const getDocNumberLabel = (doc) => {
    if (doc.docType === 'aadhaar') return 'Aadhaar number';
    if (doc.docType === 'pan') return 'PAN number';
    return `${doc.label} number`;
  };

  /* The label already says which number to type. A placeholder that repeats it
     spends a line saying nothing, so this shows the shape of the value. */
  const getDocNumberHint = (doc) => {
    if (doc.docType === 'aadhaar') return '1234 5678 9012';
    if (doc.docType === 'pan') return 'ABCDE1234F';
    return 'The number printed on the document';
  };

  const saveDocNumber = async (docId) => {
    const val = docNumbers[docId] || '';
    const doc = docs.find((d) => d._id === docId);
    // blurring a field you did not touch is not a save, and should not claim to be
    if (doc && (doc.docNumber || '') === val) return;
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ docNumber: val }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document number saved'); }
      else addToast('Failed to save document number', 'error');
    } catch (err) { console.error(err); addToast('Failed to save document number', 'error'); }
  };

  const toggleReceived = async (docId, val) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'PUT', body: JSON.stringify({ received: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update document', 'error');
    } catch (err) { console.error(err); addToast('Failed to update document', 'error'); }
  };

  const uploadFile = async (docId, file) => {
    if (blockGuestAction()) return;
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

  const addDocument = async (docLabel) => {
    if (blockGuestAction()) return false;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents`, { method: 'POST', body: JSON.stringify({ label: docLabel }) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document added'); return true; }
      addToast('Failed to add document', 'error');
      return false;
    } catch (err) { console.error(err); addToast('Failed to add document', 'error'); return false; }
  };

  const removeDocument = async (docId) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); addToast('Document removed'); }
      else addToast('Failed to remove document', 'error');
    } catch (err) { console.error(err); addToast('Failed to remove document', 'error'); }
  };

  return (
    <div>
      <Readiness
        value={received} total={docs.length}
        tone={docs.length && received === docs.length ? 'green' : 'amber'}
        caption="in hand"
        headline={docs.length === 0
          ? 'Nothing has come in yet.'
          : received === docs.length
            ? 'Every document is in.'
            : `${docs.length - received} still to come in.`}
        detail="Mark a document received, then record its number and put the file on Drive."
        right={<Pill tone={withFiles ? 'green' : 'grey'} icon={Upload}>{withFiles} on Drive</Pill>}
      />

      <ListPanel>
        {docs.map((doc) => (
          <ListRow
            key={doc._id}
            icon={FileText}
            tone={doc.received ? 'green' : doc.requested ? 'amber' : 'grey'}
            title={doc.label}
            muted={!doc.received}
            subtitle={!doc.received && doc.requested ? 'Asked for, not yet received' : undefined}
            right={(
              <>
                <YesNoToggle value={doc.received} onChange={(val) => toggleReceived(doc._id, val)} />
                {doc.docType !== 'aadhaar' && doc.docType !== 'pan' && (
                  <button
                    type="button"
                    onClick={() => removeDocument(doc._id)}
                    title={`Remove ${doc.label} from the list`}
                    aria-label={`Remove ${doc.label} from the list`}
                    onMouseEnter={(e) => { e.currentTarget.style.color = TONES.red.fg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.faint; }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint, padding: '4px', display: 'inline-flex', transition: 'color 0.15s' }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </>
            )}
          >
            {doc.received && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: '6px' }}>{getDocNumberLabel(doc)}</label>
                  <input
                    className="sc-control"
                    aria-label={getDocNumberLabel(doc)}
                    style={{ ...inputStyle, maxWidth: '340px' }}
                    placeholder={getDocNumberHint(doc)}
                    value={docNumbers[doc._id] || ''}
                    onChange={(e) => setDocNumbers((p) => ({ ...p, [doc._id]: e.target.value }))}
                    onBlur={() => saveDocNumber(doc._id)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <div style={{ fontSize: '11.5px', color: T.faint, marginTop: '6px' }}>
                    Saves when you click away.
                  </div>
                </div>
                <FileUploadBtn
                  onUpload={(file) => uploadFile(doc._id, file)}
                  uploading={uploading[doc._id]}
                  existingFile={doc.fileName}
                  existingUrl={doc.fileUrl}
                />
              </div>
            )}
          </ListRow>
        ))}
        {docs.length === 0 && (
          <div style={{ padding: '22px 15px', textAlign: 'center', fontSize: '13.5px', color: T.faint }}>
            No documents on the list — they are added on the Document Submission stage, or below.
          </div>
        )}
      </ListPanel>

      <AddDocumentForm
        suggestions={docTypeSuggestions}
        existing={docs}
        onAdd={addDocument}
        label="Add other documents"
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 3 — Contract Signing
   ═══════════════════════════════════════════════════════ */

/* ─── Society Assign Modal ─── */
export const SocietyAssignModal = ({ society, entryName, teamMembers, onClose, onConfirm }) => {
  const [spoc, setSpoc] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');

  /* Escape closes, and so does the backdrop — the same two exits the Sales
     Pipeline dialog got when its only way out turned out to be a 20px glyph. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(27, 94, 32, 0.28)',
        backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 60, padding: '20px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Register ${entryName} with ${society.key}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: '16px', width: '100%', maxWidth: '460px',
          maxHeight: '88vh', overflowY: 'auto', padding: '26px',
          border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(27, 94, 32, 0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <span style={{
            width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0, fontSize: '19px',
            background: TONES.indigo.bg, border: `1px solid ${TONES.indigo.bd}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {society.flag}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.heading }}>Register with {society.key}</h3>
            <p style={{ fontSize: '12.5px', color: T.faint, marginTop: '2px' }}>{society.name}</p>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: T.muted, margin: '12px 0 20px', lineHeight: 1.5 }}>
          This creates a society registration for <strong style={{ color: T.body }}>{entryName}</strong> on the
          Society Reg. page. Ticking a society cannot be undone here.
        </p>

        <FormGrid min="180px">
          <Select label="Assign SPOC" span hint={`Left blank, this falls to ${entryName}'s onboarding owner.`} value={spoc} onChange={(e) => setSpoc(e.target.value)}>
            <option value="">Same owner as the onboarding</option>
            {teamMembers.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
          </Select>
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ colorScheme: 'light' }} />
          <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ colorScheme: 'light' }} />
          <Textarea label="Notes (optional)" span placeholder="Anything the registration team should know..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: '68px' }} />
        </FormGrid>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          flexWrap: 'wrap', borderTop: `1px solid ${T.border}`, paddingTop: '18px', marginTop: '20px',
        }}>
          <span style={{ fontSize: '12px', color: T.faint }}>Press Esc to cancel.</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              icon={CheckCircle}
              onClick={() => onConfirm({ spoc, notes, startDate, deadline })}
              title={`Tick ${society.key} and create its entry on the Society Reg. page`}
            >
              Assign &amp; register
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContractSigningView = ({ entry, onUpdate, teamMembers }) => {
  const { getOptions, getItems } = usePicklist();
  const renewalOptions = getOptions('renewal_type');
  const SOCIETIES = getItems('societies').map((i) => ({ key: i.value, name: i.label, flag: i.metadata?.flag || '🌍' }));
  const [uploading, setUploading] = useState(false);
  const [startDate, setStartDate] = useState(entry.contractStartDate ? entry.contractStartDate.slice(0, 10) : '');
  const [renewalDate, setRenewalDate] = useState(entry.contractRenewalDate ? entry.contractRenewalDate.slice(0, 10) : '');
  const [renewalType, setRenewalType] = useState(entry.renewalType || '');
  const [renewalRemarks, setRenewalRemarks] = useState(entry.renewalRemarks || '');
  const [assignModalSociety, setAssignModalSociety] = useState(null);
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();
  const { blockGuestAction } = useGuestGuard();

  useEffect(() => {
    setStartDate(entry.contractStartDate ? entry.contractStartDate.slice(0, 10) : '');
  }, [entry.contractStartDate]);
  useEffect(() => {
    setRenewalDate(entry.contractRenewalDate ? entry.contractRenewalDate.slice(0, 10) : '');
  }, [entry.contractRenewalDate]);
  useEffect(() => { setRenewalType(entry.renewalType || ''); }, [entry.renewalType]);
  useEffect(() => { setRenewalRemarks(entry.renewalRemarks || ''); }, [entry.renewalRemarks]);

  const selectedSocieties = entry.selectedSocieties || [];
  const signedOff = [entry.contractSent, entry.contractReceived].filter(Boolean).length;

  /* Every write in this panel goes through here. `onUpdate` takes a whole
     updated entry, never a patch — two fields below used to hand it a patch
     object, which silently wrote nothing anywhere. */
  const saveField = async (fields, failure, success) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify(fields) });
      const data = await res.json();
      if (res.ok) { onUpdate(data.entry); if (success) addToast(success); }
      else addToast(failure, 'error');
    } catch (err) { console.error(err); addToast(failure, 'error'); }
  };

  const toggleField = (field, val) => saveField({ [field]: val }, 'Failed to update contract status');

  const uploadContract = async (file) => {
    if (blockGuestAction()) return;
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

  const saveDate = (field, val, setter) => {
    setter(val);
    return saveField(
      { [field]: val || null },
      'Failed to save date',
      `${field === 'contractStartDate' ? 'Contract start' : 'Contract renewal'} date saved`,
    );
  };

  /* Toggle a society in the checklist — if ticking ON, open the assign modal */
  const handleSocietyToggle = (soc) => {
    if (blockGuestAction()) return;
    if (selectedSocieties.includes(soc.key)) return; // Already assigned — locked
    // Ticking ON — open assign modal
    setAssignModalSociety(soc);
  };

  /* Confirm assign → save society selection + create society registration */
  const handleAssignConfirm = async ({ spoc, notes, startDate: socStart, deadline }) => {
    if (blockGuestAction()) { setAssignModalSociety(null); return; }
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
          startDate: socStart || '',
          deadline: deadline || '',
        }),
      });
      if (regRes.ok) addToast(`${soc.key} registration created for ${entry.name}`);
      else addToast('Society added but registration creation failed', 'error');
    } catch (err) { console.error(err); addToast('Failed to assign society', 'error'); }
  };

  return (
    <div>
      <Readiness
        value={signedOff} total={2}
        tone={signedOff === 2 ? 'green' : 'amber'}
        caption="signed"
        headline={signedOff === 2
          ? 'The contract is out and back.'
          : entry.contractSent
            ? 'Sent — waiting on the signed copy.'
            : 'The contract has not gone out yet.'}
        detail="Both ticks save the moment you press them."
        right={selectedSocieties.length > 0 && (
          <Pill tone="indigo" icon={Landmark}>{selectedSocieties.length} registered</Pill>
        )}
      />

      <ListPanel>
        <DecisionRow
          icon={Send}
          question="Has the contract been sent?"
          help="The agreement has gone out to the client."
          value={!!entry.contractSent}
          onChange={(v) => toggleField('contractSent', v)}
        />
        <DecisionRow
          icon={FileSignature}
          question="Is the signed contract back?"
          help="The signed copy has been returned and filed on Drive."
          value={!!entry.contractReceived}
          onChange={(v) => toggleField('contractReceived', v)}
          facts={[{
            label: 'File',
            value: entry.contractFileName ? 'On Drive' : 'None yet',
            tone: entry.contractFileName ? 'green' : 'grey',
          }]}
        />
      </ListPanel>

      {entry.contractReceived && (
        <div style={{ marginTop: '16px' }}>
          <FileUploadBtn
            onUpload={uploadContract}
            uploading={uploading}
            existingFile={entry.contractFileName}
            existingUrl={entry.contractFileUrl}
          />
        </div>
      )}

      {/* The term, read at a glance before it is read off two date fields. */}
      <SubHead icon={CalendarCheck} style={{ marginTop: '24px' }}>The term</SubHead>
      <div style={{
        display: 'flex', alignItems: 'center', gap: SP.base, flexWrap: 'wrap',
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: '12px',
        padding: ROW_PAD, marginBottom: SP.block,
      }}>
        <DateTile date={startDate} tone="indigo" />
        <div style={{ flex: '0 0 auto', color: T.faint, fontSize: '12px', fontWeight: 700, letterSpacing: '0.6px' }}>TO</div>
        <DateTile date={renewalDate} tone="amber" />
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', color: T.body }}>
            {startDate && renewalDate
              ? 'Contract term recorded.'
              : startDate
                ? 'No renewal date set.'
                : 'No contract dates recorded yet.'}
          </div>
          {renewalType && (
            <div style={{ marginTop: '6px' }}>
              <Pill tone="teal" dot>{renewalType}</Pill>
            </div>
          )}
        </div>
      </div>

      <FormGrid min="215px">
        <Input
          label="Contract start date" type="date" style={{ colorScheme: 'light' }}
          value={startDate}
          onChange={(e) => saveDate('contractStartDate', e.target.value, setStartDate)}
        />
        <Input
          label="Contract renewal date" type="date" style={{ colorScheme: 'light' }}
          value={renewalDate}
          onChange={(e) => saveDate('contractRenewalDate', e.target.value, setRenewalDate)}
        />
        <Select
          label="Renewal type"
          hint="Saves as soon as you pick one."
          value={renewalType}
          onChange={(e) => {
            setRenewalType(e.target.value);
            saveField({ renewalType: e.target.value }, 'Failed to save renewal type', 'Renewal type saved');
          }}
        >
          <option value="">Not set</option>
          {renewalOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Textarea
          label="Renewal remarks" span={false}
          placeholder="e.g. renews yearly unless cancelled 30 days out"
          value={renewalRemarks}
          onChange={(e) => setRenewalRemarks(e.target.value)}
          onBlur={() => {
            if (renewalRemarks === (entry.renewalRemarks || '')) return;
            saveField({ renewalRemarks }, 'Failed to save renewal remarks', 'Renewal remarks saved');
          }}
          style={{ minHeight: '42px' }}
        />
      </FormGrid>

      {/* Society registration — twelve items, so a grid of tiles rather than a
          column of full-width rows you have to scroll past. */}
      <SubHead icon={Landmark} style={{ marginTop: '24px' }}>Society registration</SubHead>
      <p style={{ fontSize: '12.5px', color: T.faint, marginTop: '-6px', marginBottom: '12px' }}>
        Ticking a society creates its registration entry. It cannot be unticked here.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: '10px' }}>
        {SOCIETIES.map((soc) => {
          const checked = selectedSocieties.includes(soc.key);
          return (
            <button
              key={soc.key}
              type="button"
              className={checked ? undefined : 'sc-tile'}
              onClick={() => !checked && handleSocietyToggle(soc)}
              disabled={checked}
              title={checked
                ? `${soc.key} is already registered — manage it on the Society Reg. page`
                : `Register ${soc.key} and create its entry on the Society Reg. page`}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                padding: '11px 13px', borderRadius: '11px', width: '100%', boxSizing: 'border-box',
                cursor: checked ? 'default' : 'pointer',
                background: checked ? TONES.green.bg : T.bg,
                border: `1px solid ${checked ? TONES.green.bd : T.border}`,
              }}
            >
              <span style={{
                width: '19px', height: '19px', borderRadius: '6px', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: checked ? 'none' : `1px solid ${T.borderHi}`,
                /* white, not forest green: the tick sits ON the green fill, and
                   #1B5E20 on #2E7D32 is 1.7:1 — an invisible check mark */
                background: checked ? TONES.green.fg : 'transparent', color: T.surface,
              }}>
                {checked && <CheckCircle style={{ width: '13px', height: '13px' }} />}
              </span>
              <span style={{ fontSize: '17px', flexShrink: 0, lineHeight: 1 }}>{soc.flag}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: checked ? TONES.green.fg : T.heading }}>
                  {soc.key}
                </span>
                <span style={{
                  display: 'block', fontSize: '11.5px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: checked ? TONES.green.fg : T.faint,
                }}>
                  {checked ? 'Registered — see Society Reg.' : soc.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {SOCIETIES.length === 0 && (
        <p style={{ fontSize: '13px', color: T.faint }}>
          No societies in the picklist yet — add them on the Picklist Manager page.
        </p>
      )}

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
   THE SHARED SUMMARY (stages 4 and 6)
   ───────────────────────────────────────────────────────
   "Active Member" reviews the work so far and "Completed" reviews all of it.
   They used to hold two near-identical copies of the same ~250 lines of
   expandable sections; this is the one copy, and which sections it shows is
   the only difference between them.
   ═══════════════════════════════════════════════════════ */

const fmtDay = (d) => {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? '—'
    : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** One line of a summary: done or not, said in words. */
const Tick = ({ on, children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
    {on
      ? <CheckCircle style={{ width: '15px', height: '15px', color: TONES.green.fg, flexShrink: 0 }} />
      : <Circle style={{ width: '15px', height: '15px', color: T.borderHi, flexShrink: 0 }} />}
    <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: on ? T.body : T.faint }}>{children}</span>
    {right}
  </div>
);

/** A "LABEL value" pair for the inside of a summary section. */
const Detail = ({ label, children }) => (
  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '3px 0' }}>
    <span style={{ ...LABEL, fontSize: '9.5px', flexShrink: 0, minWidth: '92px' }}>{label}</span>
    <span style={{ fontSize: '12.5px', color: T.body, wordBreak: 'break-word' }}>{children}</span>
  </div>
);

const buildSections = (entry) => {
  const docs = docsOf(entry);
  const societies = entry.selectedSocieties || [];
  const requested = docs.filter((d) => d.requested).length;
  const received = docs.filter((d) => d.received).length;
  const contractDone = [entry.contractSent, entry.contractReceived].filter(Boolean).length;
  const contactDone = [entry.addedToWhatsApp, entry.emailCreated].filter(Boolean).length;

  return {
    docs: {
      icon: FileText,
      title: 'Document Submission',
      meta: `${requested}/${docs.length} requested`,
      done: docs.length > 0 && requested === docs.length,
      started: requested > 0,
      body: docs.length === 0
        ? <p style={{ fontSize: '13px', color: T.faint }}>No documents were put on the list.</p>
        : docs.map((d) => (
          <Tick key={d._id} on={d.requested}>{d.label}{d.requested ? '' : ' — not requested'}</Tick>
        )),
    },
    kyc: {
      icon: ShieldCheck,
      title: 'KYC Verification',
      meta: `${received}/${docs.length} received`,
      done: docs.length > 0 && received === docs.length,
      started: received > 0,
      body: docs.length === 0
        ? <p style={{ fontSize: '13px', color: T.faint }}>No documents were put on the list.</p>
        : docs.map((d) => (
          <Tick key={d._id} on={d.received} right={<DriveLink name={d.fileName} url={d.fileUrl} />}>
            {d.label}{d.received ? '' : ' — not received'}
          </Tick>
        )),
    },
    contract: {
      icon: FileSignature,
      title: 'Contract Signing',
      meta: `${contractDone}/2 done`,
      done: contractDone === 2,
      started: contractDone > 0,
      body: (
        <>
          <Tick on={entry.contractSent}>Contract sent</Tick>
          <Tick on={entry.contractReceived} right={<DriveLink name={entry.contractFileName} url={entry.contractFileUrl} />}>
            Signed contract received
          </Tick>
          {(entry.contractStartDate || entry.contractRenewalDate) && (
            <div style={{ marginTop: '9px' }}>
              {entry.contractStartDate && <Detail label="Start">{fmtDay(entry.contractStartDate)}</Detail>}
              {entry.contractRenewalDate && <Detail label="Renewal">{fmtDay(entry.contractRenewalDate)}</Detail>}
            </div>
          )}
          {(entry.renewalType || entry.renewalRemarks) && (
            <div style={{ marginTop: '4px' }}>
              {entry.renewalType && <Detail label="Renewal type">{entry.renewalType}</Detail>}
              {entry.renewalRemarks && <Detail label="Remarks">{entry.renewalRemarks}</Detail>}
            </div>
          )}
          {societies.length > 0 && (
            <div style={{ marginTop: '11px' }}>
              <div style={{ ...LABEL, fontSize: '9.5px', marginBottom: '6px' }}>Societies registered</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {societies.map((s) => <Pill key={s} tone="indigo">{s}</Pill>)}
              </div>
            </div>
          )}
        </>
      ),
    },
    active: {
      icon: UserCheck,
      title: 'Active Member',
      meta: null,
      done: true,
      started: true,
      body: <p style={{ fontSize: '13px', color: T.muted }}>The member was activated and this summary was reviewed.</p>,
    },
    contact: {
      icon: MessageSquare,
      title: 'Contact Made',
      meta: `${contactDone}/2 done`,
      done: contactDone === 2,
      started: contactDone > 0,
      body: (
        <>
          <Tick on={entry.addedToWhatsApp}>
            WhatsApp group{entry.whatsAppGroupName ? ` — ${entry.whatsAppGroupName}` : ''}
          </Tick>
          <Tick on={entry.emailCreated}>Email account created</Tick>
          {entry.emailCreated && entry.createdEmailAddress && (
            <div style={{ marginTop: '6px' }}>
              <Detail label="Email">{entry.createdEmailAddress}</Detail>
              {entry.createdEmailPassword && <Detail label="Password">{entry.createdEmailPassword}</Detail>}
            </div>
          )}
          {entry.clientNumber && (
            <div style={{ marginTop: '4px' }}><Detail label="MRM ID">{entry.clientNumber}</Detail></div>
          )}
        </>
      ),
    },
  };
};

const StageSummary = ({ entry, keys, whenComplete, detail }) => {
  const all = buildSections(entry);
  const sections = keys.map((k) => ({ key: k, ...all[k] })).filter((s) => s.title);
  const doneCount = sections.filter((s) => s.done).length;
  const short = sections.length - doneCount;

  /* Worked out rather than passed in: a client can be marked Completed with a
     stage still part-ticked, and a headline reading "every stage is done"
     above a ring reading 3/5 is the page arguing with itself. */
  const headline = short === 0
    ? whenComplete
    : `${short} stage${short === 1 ? '' : 's'} ${short === 1 ? 'was' : 'were'} never fully ticked off.`;

  return (
    <div>
      <Readiness
        value={doneCount} total={sections.length}
        tone={doneCount === sections.length ? 'green' : 'amber'}
        caption="stages"
        headline={headline}
        detail={detail}
      />

      <ListPanel>
        {sections.map((s) => (
          <Collapsible
            key={s.key}
            icon={s.icon}
            tone={s.done ? 'green' : s.started ? 'amber' : 'grey'}
            title={s.title}
            meta={s.meta}
            pill={<Pill tone={s.done ? 'green' : s.started ? 'amber' : 'grey'} dot>
              {s.done ? 'Done' : s.started ? 'Part done' : 'Not started'}
            </Pill>}
          >
            {s.body}
          </Collapsible>
        ))}
      </ListPanel>

      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', color: T.faint, marginTop: '16px' }}>
        <RefreshCw style={{ width: '13px', height: '13px', flexShrink: 0 }} />
        To change any of this, open that stage in the steps above — every stage stays editable.
      </p>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 4 — Active Member (review everything so far)
   ═══════════════════════════════════════════════════════ */
export const ActiveMemberView = ({ entry }) => (
  <StageSummary
    entry={entry}
    keys={['docs', 'kyc', 'contract']}
    whenComplete="Everything behind this stage is collected."
    detail="Check the three stages behind this one before the client goes live."
  />
);

/* ═══════════════════════════════════════════════════════
   STAGE 5 — Contact Made
   ═══════════════════════════════════════════════════════ */

/* The four text fields this stage owns. Everything else on it is a tick. */
const SETUP_FIELDS = ['whatsAppGroupName', 'createdEmailAddress', 'createdEmailPassword', 'clientNumber'];
const setupFrom = (entry) => {
  const out = {};
  SETUP_FIELDS.forEach((k) => { out[k] = entry[k] || ''; });
  return out;
};
export const ContactMadeView = ({ entry, onUpdate }) => {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { blockGuestAction } = useGuestGuard();
  const [form, setForm] = useState(() => setupFrom(entry));
  const [synced, setSynced] = useState(() => setupFrom(entry));
  const [showPass, setShowPass] = useState(false);
  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  /* Adopt a field the server changed; leave alone one that is being typed in.
     This was four `useEffect`s calling setState, which renders the stale value
     once and then immediately renders again. Done here instead, keyed on the
     last server values, so the same per-field behaviour costs no extra pass —
     and `form` starts from a real object, never null, so the render that
     schedules the update still has something to read. */
  const latest = setupFrom(entry);
  if (SETUP_FIELDS.some((k) => latest[k] !== synced[k])) {
    setSynced(latest);
    setForm((prev) => {
      const next = { ...prev };
      SETUP_FIELDS.forEach((k) => { if (latest[k] !== synced[k]) next[k] = latest[k]; });
      return next;
    });
  }

  const done = [entry.addedToWhatsApp, entry.emailCreated].filter(Boolean).length;

  const toggleField = async (field, val) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast('Failed to update', 'error');
    } catch (err) { console.error(err); addToast('Failed to update', 'error'); }
  };

  /* On blur, so it only writes when the value actually moved — otherwise
     tabbing through this panel fires a PUT per field. */
  const saveText = async (field, val) => {
    if ((entry[field] || '') === val) return;
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      const data = await res.json();
      if (res.ok) onUpdate(data.entry);
      else addToast(data.message || 'Failed to save', 'error');
    } catch (err) { console.error(err); addToast('Failed to save', 'error'); }
  };

  return (
    <div>
      <Readiness
        value={done} total={2}
        tone={done === 2 ? 'green' : 'amber'}
        caption="set up"
        headline={done === 2 ? 'The client is set up and reachable.' : 'Still setting the client up.'}
        detail="Each tick saves straight away; the fields underneath save when you click away."
        right={entry.clientNumber && <Pill tone="purple" icon={IdCard}>MRM {entry.clientNumber}</Pill>}
      />

      <ListPanel style={{ marginBottom: '12px' }}>
        <DecisionRow
          icon={MessageSquare}
          question="Are they in the WhatsApp group?"
          help="The client is in the group and can reach the team."
          value={!!entry.addedToWhatsApp}
          onChange={(v) => toggleField('addedToWhatsApp', v)}
          facts={[{
            label: 'Group',
            value: entry.whatsAppGroupName || 'Not named',
            tone: entry.whatsAppGroupName ? 'green' : 'grey',
          }]}
        />
        <DecisionRow
          icon={Mail}
          question="Has their work email been created?"
          help="An MRM address exists for this client."
          value={!!entry.emailCreated}
          onChange={(v) => toggleField('emailCreated', v)}
          facts={[{
            label: 'Address',
            value: entry.createdEmailAddress || 'Not set',
            tone: entry.createdEmailAddress ? 'green' : 'grey',
          }]}
        />
      </ListPanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {entry.addedToWhatsApp && (
          <div style={{ paddingLeft: '4px' }}>
            <Input
              label="WhatsApp group name"
              placeholder="e.g. MRM × Arijit Singh"
              hint="Saves when you click away."
              value={form.whatsAppGroupName}
              onChange={(e) => set('whatsAppGroupName', e.target.value)}
              onBlur={() => saveText('whatsAppGroupName', form.whatsAppGroupName)}
            />
          </div>
        )}

        {entry.emailCreated && (
          <div style={{ paddingLeft: '4px' }}>
            <FormGrid min="215px">
              <Input
                label="Email address"
                placeholder="name@musicrightsmanagement.in"
                value={form.createdEmailAddress}
                onChange={(e) => set('createdEmailAddress', e.target.value)}
                onBlur={() => saveText('createdEmailAddress', form.createdEmailAddress)}
              />
              <div>
                <label style={{ ...LABEL, display: 'block', marginBottom: '6px' }}>Email password</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="sc-control"
                    /* hidden by default: this sits on a shared screen and the
                       password was previously always in plain sight */
                    type={showPass ? 'text' : 'password'}
                    aria-label="Email password"
                    style={{ ...inputStyle, flex: 1, width: 'auto' }}
                    placeholder="Set the mailbox password"
                    value={form.createdEmailPassword}
                    onChange={(e) => set('createdEmailPassword', e.target.value)}
                    onBlur={() => saveText('createdEmailPassword', form.createdEmailPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    title={showPass ? 'Hide password' : 'Show password'}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '42px', flexShrink: 0, borderRadius: '9px', cursor: 'pointer',
                      background: T.bg, border: `1px solid ${T.border}`, color: T.muted,
                    }}
                  >
                    {showPass
                      ? <EyeOff style={{ width: '15px', height: '15px' }} />
                      : <Eye style={{ width: '15px', height: '15px' }} />}
                  </button>
                </div>
              </div>
            </FormGrid>
          </div>
        )}
      </div>

      <SubHead icon={KeyRound} style={{ marginTop: '24px' }}>Membership</SubHead>
      <div style={{ maxWidth: '340px' }}>
        <Input
          label="MRM membership ID"
          placeholder="e.g. MRM-0142"
          value={form.clientNumber}
          onChange={(e) => set('clientNumber', e.target.value)}
          hint="Written through to the client's Member record when you save it."
          onBlur={async () => {
            const prev = entry.clientNumber || '';
            const next = form.clientNumber;
            if (prev === next) return;
            if (blockGuestAction()) { set('clientNumber', prev); return; }
            try {
              const res = await authFetch(`/api/onboarding/${entry._id}`, { method: 'PUT', body: JSON.stringify({ clientNumber: next }) });
              const data = await res.json();
              // the backend rejects an id another client already holds, so put the old one back
              if (res.ok) { onUpdate(data.entry); addToast('MRM ID saved'); }
              else { addToast(data.message || 'Failed to save', 'error'); set('clientNumber', prev); }
            } catch (err) { console.error(err); addToast('Failed to save', 'error'); set('clientNumber', prev); }
          }}
        />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   STAGE 6 — Completed (read-only review of every stage)
   ═══════════════════════════════════════════════════════ */
/* No "Onboarding Completed" banner here any more: the page already carries
   one directly above the rail, and saying it twice was the duplication this
   app has been pulling out everywhere. */
export const CompletedView = ({ entry }) => (
  <StageSummary
    entry={entry}
    keys={['docs', 'kyc', 'contract', 'active', 'contact']}
    whenComplete="Every stage was completed in full."
    detail="Open any stage below to see exactly what was collected and when."
  />
);

/* ═══════════════════════════════════════════════════════
   Stage View Renderer
   ═══════════════════════════════════════════════════════ */
/**
 * Renders one stage's panel. `stage` defaults to the entry's own stage, but can
 * be overridden so the stepped detail page can show any stage's panel while the
 * entry itself sits somewhere else in the journey.
 */
export const StageContent = ({ entry, onUpdate, teamMembers, stage }) => {
  switch (stage || entry.stage) {
    case 'Document Submission': return <DocumentSubmissionView entry={entry} onUpdate={onUpdate} />;
    case 'KYC Verification': return <KYCVerificationView entry={entry} onUpdate={onUpdate} />;
    case 'Contract Signing': return <ContractSigningView entry={entry} onUpdate={onUpdate} teamMembers={teamMembers || []} />;
    case 'Active Member': return <ActiveMemberView entry={entry} onUpdate={onUpdate} />;
    case 'Contact Made': return <ContactMadeView entry={entry} onUpdate={onUpdate} />;
    case 'Completed': return <CompletedView entry={entry} />;
    default: return <p style={{ color: T.faint, fontSize: '13px' }}>Nothing to show for this stage.</p>;
  }
};
