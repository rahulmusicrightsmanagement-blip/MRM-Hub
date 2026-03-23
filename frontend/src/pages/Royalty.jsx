import { useState, useEffect, useCallback } from 'react';
import {
  Plus, ChevronDown, ChevronRight, X, Upload, FileText, Trash2, Check,
  Search, DollarSign, Calendar, Users, Pencil, Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { withApiBase } from '../utils/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inputStyle = {
  width: '100%', padding: '10px 14px', background: '#1a1f2e', border: '1px solid #2a3050',
  borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: '#8892b0', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '6px', display: 'block',
};

/* ────────── Month Row ────────── */
const MonthRow = ({ clientId, year, month, data, authFetch, token, onUpdate, addToast }) => {
  const hasFile = !!data?.fileName;
  const hasData = (data?.totalSongs || 0) + (data?.totalBGMMovies || 0) + (data?.totalTVBGM || 0) + (data?.totalTVBGMEpisode || 0) > 0;
  // Summary row only shows when there are actual counts saved; file alone doesn't count
  const hasAnySavedData = hasData;

  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    totalSongs: data?.totalSongs || '',
    totalBGMMovies: data?.totalBGMMovies || '',
    totalTVBGM: data?.totalTVBGM || '',
    totalTVBGMEpisode: data?.totalTVBGMEpisode || '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  // Start in edit mode unless count data is already saved (file upload alone doesn't lock to view)
  const [editing, setEditing] = useState(!hasData);

  useEffect(() => {
    setForm({
      totalSongs: data?.totalSongs || '',
      totalBGMMovies: data?.totalBGMMovies || '',
      totalTVBGM: data?.totalTVBGM || '',
      totalTVBGMEpisode: data?.totalTVBGMEpisode || '',
    });
    // After data updates, only switch to view mode if count data has been saved
    // (file upload alone should not lock the form — user still needs to enter counts)
    const hasCountData = ((data?.totalSongs || 0) + (data?.totalBGMMovies || 0) + (data?.totalTVBGM || 0) + (data?.totalTVBGMEpisode || 0)) > 0;
    if (hasCountData) setEditing(false);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/royalty/${clientId}/months`, {
        method: 'PUT',
        body: JSON.stringify({ year, month, data: {
          totalSongs: Number(form.totalSongs) || 0,
          totalBGMMovies: Number(form.totalBGMMovies) || 0,
          totalTVBGM: Number(form.totalTVBGM) || 0,
          totalTVBGMEpisode: Number(form.totalTVBGMEpisode) || 0,
        } }),
      });
      const json = await res.json();
      if (json.client) onUpdate(json.client);
      addToast(`${month} ${year} data saved`);
    } catch (err) {
      addToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const handleToggleReceived = async (val) => {
    try {
      const res = await authFetch(`/api/royalty/${clientId}/months`, {
        method: 'PUT',
        body: JSON.stringify({ year, month, data: { fileReceived: val } }),
      });
      const json = await res.json();
      if (json.client) onUpdate(json.client);
    } catch (err) {
      addToast('Failed to update', 'error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setStagedFile(file);
    e.target.value = '';
  };

  const handleUploadToDrive = async () => {
    if (!stagedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', stagedFile);
      fd.append('year', String(year));
      fd.append('month', month);
      const res = await fetch(withApiBase(`/api/royalty/${clientId}/upload`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (json.client) {
        onUpdate(json.client);
        // Only exit edit mode if counts have also been saved; otherwise keep editing open
        const updatedYear = json.client.years?.find((y) => y.year === year);
        const updatedMonth = updatedYear?.months?.[month];
        const hasCounts = ((updatedMonth?.totalSongs || 0) + (updatedMonth?.totalBGMMovies || 0) +
          (updatedMonth?.totalTVBGM || 0) + (updatedMonth?.totalTVBGMEpisode || 0)) > 0;
        if (hasCounts) setEditing(false);
        addToast(`File uploaded for ${month} ${year}`);
        setStagedFile(null);
      } else {
        addToast(json.message || 'Upload failed', 'error');
      }
    } catch (err) {
      addToast('Upload failed', 'error');
    }
    setUploading(false);
  };

  return (
    <div style={{ borderBottom: '1px solid #1e2540' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#161b2e'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {expanded ? <ChevronDown size={14} color="#8892b0" /> : <ChevronRight size={14} color="#8892b0" />}
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, width: '40px' }}>{month}</span>
        {/* Upload badge */}
        {data?.fileName && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
            background: '#166534', color: '#86efac',
          }}>
            Uploaded
          </span>
        )}
        {hasAnySavedData && (
          <span style={{ fontSize: '11px', color: '#8892b0', marginLeft: 'auto' }}>
            Songs: {data?.totalSongs || 0} | BGM: {data?.totalBGMMovies || 0} | TVBGM: {data?.totalTVBGM || 0} | Ep: {data?.totalTVBGMEpisode || 0}
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px 16px 40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* File Sending to Client */}
          <div>
            <label style={labelStyle}>File Sending to Client</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Choose file button — only in edit mode */}
              {editing && (
                <label style={{
                  padding: '8px 16px', background: '#2a3050', borderRadius: '8px', color: '#8892b0',
                  fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  border: '1px solid #3a4070', transition: 'all 0.15s',
                }}>
                  <FileText size={14} /> Choose File
                  <input type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
                </label>
              )}

              {/* Staged file preview */}
              {stagedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                    padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)',
                  }}>
                    {stagedFile.name} ({(stagedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    onClick={handleUploadToDrive}
                    disabled={uploading}
                    style={{
                      padding: '8px 16px', background: uploading ? '#1a3a5c' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      opacity: uploading ? 0.7 : 1,
                    }}
                  >
                    <Upload size={14} /> {uploading ? 'Uploading to Drive...' : 'Upload to Drive'}
                  </button>
                  {!uploading && (
                    <button
                      onClick={() => setStagedFile(null)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Already uploaded file */}
              {!stagedFile && data?.fileName && (
                <>
                  <span style={{ fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} /> {data.fileName}
                  </span>
                  <a
                    href={data.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '5px 12px', background: '#1a3a5c', borderRadius: '6px', fontSize: '11px',
                      fontWeight: 600, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                      border: '1px solid #2563eb',
                    }}
                  >
                    <FileText size={12} /> View in Drive
                  </a>
                </>
              )}

              {!stagedFile && !data?.fileName && !editing && (
                <span style={{ fontSize: '12px', color: '#6b7280' }}>No file uploaded</span>
              )}
            </div>
          </div>

          {/* Count fields — same layout, disabled when not editing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Total Songs</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7, cursor: editing ? 'text' : 'default' }}
                value={form.totalSongs} placeholder="0" disabled={!editing}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setForm((p) => ({ ...p, totalSongs: v })); }}
              />
            </div>
            <div>
              <label style={labelStyle}>Total BGM Movies</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7, cursor: editing ? 'text' : 'default' }}
                value={form.totalBGMMovies} placeholder="0" disabled={!editing}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setForm((p) => ({ ...p, totalBGMMovies: v })); }}
              />
            </div>
            <div>
              <label style={labelStyle}>Total TVBGM</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7, cursor: editing ? 'text' : 'default' }}
                value={form.totalTVBGM} placeholder="0" disabled={!editing}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setForm((p) => ({ ...p, totalTVBGM: v })); }}
              />
            </div>
            <div>
              <label style={labelStyle}>Total TVBGM Episode</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7, cursor: editing ? 'text' : 'default' }}
                value={form.totalTVBGMEpisode} placeholder="0" disabled={!editing}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setForm((p) => ({ ...p, totalTVBGMEpisode: v })); }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '8px 20px', background: '#2a3050', border: '1px solid #3a4060', borderRadius: '8px',
                  color: '#60a5fa', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setEditing(false); setStagedFile(null); setForm({ totalSongs: data?.totalSongs || '', totalBGMMovies: data?.totalBGMMovies || '', totalTVBGM: data?.totalTVBGM || '', totalTVBGMEpisode: data?.totalTVBGMEpisode || '' }); }}
                  style={{
                    padding: '8px 20px', background: 'transparent', border: '1px solid #3a4060', borderRadius: '8px',
                    color: '#8892b0', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { await handleSave(); setEditing(false); }}
                  disabled={saving}
                  style={{
                    padding: '8px 20px', background: '#22c55e', border: 'none', borderRadius: '8px',
                    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ────────── Year Section ────────── */
const YearSection = ({ clientId, yearData, authFetch, token, onUpdate, addToast }) => {
  const [expanded, setExpanded] = useState(true);
  const months = yearData.months || {};

  return (
    <div style={{ background: '#141720', border: '1px solid #1e2540', borderRadius: '12px', overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer', background: '#1a1f2e',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {expanded ? <ChevronDown size={16} color="#60a5fa" /> : <ChevronRight size={16} color="#60a5fa" />}
          <Calendar size={16} color="#60a5fa" />
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{yearData.year}</span>
        </div>
      </div>

      {expanded && (
        <div>
          {MONTHS.map((mon) => (
            <MonthRow
              key={mon}
              clientId={clientId}
              year={yearData.year}
              month={mon}
              data={months[mon] || months.get?.(mon) || {}}
              authFetch={authFetch}
              token={token}
              onUpdate={onUpdate}
              addToast={addToast}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ────────── Client Detail Modal ────────── */
const ClientDetailModal = ({ client, onClose, onUpdate, authFetch, token, addToast }) => {
  const [addingYear, setAddingYear] = useState(null); // 'above' | 'below' | null

  const sortedYears = [...(client.years || [])].sort((a, b) => a.year - b.year);
  const minYear = sortedYears.length > 0 ? sortedYears[0].year : new Date().getFullYear();
  const maxYear = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1].year : new Date().getFullYear();

  const handleAddYear = async (year) => {
    try {
      const res = await authFetch(`/api/royalty/${client._id}/years`, {
        method: 'POST',
        body: JSON.stringify({ year }),
      });
      const json = await res.json();
      if (json.client) {
        onUpdate(json.client);
        addToast(`Year ${year} added`);
      } else {
        addToast(json.message || 'Failed to add year', 'error');
      }
    } catch (err) {
      addToast('Failed to add year', 'error');
    }
    setAddingYear(null);
  };

  const setDocumentsReceived = async (val) => {
    try {
      const res = await authFetch(`/api/royalty/${client._id}`, {
        method: 'PUT',
        body: JSON.stringify({ documentsReceived: val }),
      });
      const json = await res.json();
      if (json.client) onUpdate(json.client);
    } catch (err) {
      addToast('Failed to update', 'error');
    }
  };

  const [docUploading, setDocUploading] = useState(false);
  const [stagedDocFile, setStagedDocFile] = useState(null);

  const handleDocFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setStagedDocFile(file);
    e.target.value = '';
  };

  const handleDocUploadToDrive = async () => {
    if (!stagedDocFile) return;
    setDocUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', stagedDocFile);
      const res = await fetch(withApiBase(`/api/royalty/${client._id}/upload-document`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (json.client) {
        onUpdate(json.client);
        addToast('Document uploaded to Drive');
        setStagedDocFile(null);
      } else {
        addToast(json.message || 'Upload failed', 'error');
      }
    } catch (err) {
      addToast('Upload failed', 'error');
    }
    setDocUploading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2235', borderRadius: '16px', width: '800px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#1f2d1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={22} color="#22c55e" />
            </div>
            <div>
              <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 }}>{client.clientName}</h2>
              {client.clientEmail && <p style={{ color: '#8892b0', fontSize: '13px', margin: '2px 0 0' }}>{client.clientEmail}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
        </div>

        {/* Documents Received Yes/No */}
        <div style={{
          padding: '14px 18px', background: '#161b2e', borderRadius: '10px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={16} color="#8892b0" />
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Documents Received from Client</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDocumentsReceived(true)}
                style={{
                  padding: '6px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: client.documentsReceived ? '2px solid #22c55e' : '1px solid #3a4060',
                  background: client.documentsReceived ? 'rgba(34,197,94,0.15)' : 'transparent',
                  color: client.documentsReceived ? '#22c55e' : '#8892b0',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setDocumentsReceived(false)}
                style={{
                  padding: '6px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: !client.documentsReceived ? '2px solid #ef4444' : '1px solid #3a4060',
                  background: !client.documentsReceived ? 'rgba(239,68,68,0.15)' : 'transparent',
                  color: !client.documentsReceived ? '#ef4444' : '#8892b0',
                }}
              >
                No
              </button>
            </div>
          </div>

          {/* Show upload to GDrive when documentsReceived is Yes */}
          {client.documentsReceived && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a3050' }}>
              <label style={labelStyle}>Upload Document to Drive</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Choose file button */}
                <label style={{
                  padding: '8px 16px', background: '#2a3050', borderRadius: '8px', color: '#8892b0',
                  fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  border: '1px solid #3a4070', transition: 'all 0.15s',
                }}>
                  <FileText size={14} /> Choose File
                  <input type="file" style={{ display: 'none' }} onChange={handleDocFileSelect} />
                </label>

                {/* Staged file preview */}
                {stagedDocFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                      padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)',
                    }}>
                      {stagedDocFile.name} ({(stagedDocFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={handleDocUploadToDrive}
                      disabled={docUploading}
                      style={{
                        padding: '8px 16px', background: docUploading ? '#1a3a5c' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600,
                        cursor: docUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        opacity: docUploading ? 0.7 : 1,
                      }}
                    >
                      <Upload size={14} /> {docUploading ? 'Uploading to Drive...' : 'Upload to Drive'}
                    </button>
                    {!docUploading && (
                      <button
                        onClick={() => setStagedDocFile(null)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Already uploaded file */}
                {!stagedDocFile && client.documentFileName && (
                  <>
                    <span style={{ fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> {client.documentFileName}
                    </span>
                    <a
                      href={client.documentFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '5px 12px', background: '#1a3a5c', borderRadius: '6px', fontSize: '11px',
                        fontWeight: 600, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                        border: '1px solid #2563eb',
                      }}
                    >
                      <FileText size={12} /> View in Drive
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Year Above button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <button
            onClick={() => handleAddYear(minYear - 1)}
            style={{
              padding: '6px 18px', background: 'transparent', border: '1px dashed #3a4060', borderRadius: '8px',
              color: '#8892b0', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#60a5fa'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3a4060'; e.currentTarget.style.color = '#8892b0'; }}
          >
            <Plus size={14} /> Add {minYear - 1}
          </button>
        </div>

        {/* Year Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>
          {sortedYears.map((yearData) => (
            <YearSection
              key={yearData.year}
              clientId={client._id}
              yearData={yearData}
              authFetch={authFetch}
              token={token}
              onUpdate={onUpdate}
              addToast={addToast}
            />
          ))}
        </div>

        {/* Add Year Below button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <button
            onClick={() => handleAddYear(maxYear + 1)}
            style={{
              padding: '6px 18px', background: 'transparent', border: '1px dashed #3a4060', borderRadius: '8px',
              color: '#8892b0', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#60a5fa'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3a4060'; e.currentTarget.style.color = '#8892b0'; }}
          >
            <Plus size={14} /> Add {maxYear + 1}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   MAIN ROYALTY PAGE
   ════════════════════════════════════════════ */
const Royalty = () => {
  const { authFetch, token } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [completedOnboarding, setCompletedOnboarding] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      let royaltyClients = [];
      let onboardingEntries = [];

      try {
        const royaltyRes = await authFetch('/api/royalty');
        const royaltyData = await royaltyRes.json();
        royaltyClients = royaltyData.clients || [];
      } catch (e) {
        console.error('Royalty fetch error:', e);
      }

      try {
        const onboardingRes = await authFetch('/api/onboarding');
        const onboardingData = await onboardingRes.json();
        onboardingEntries = onboardingData.entries || [];
      } catch (e) {
        console.error('Onboarding fetch error:', e);
      }

      setClients(royaltyClients);

      // Filter completed onboarding entries not already in music works
      const existingNames = royaltyClients.map((c) => c.clientName.toLowerCase());
      const completed = onboardingEntries.filter(
        (e) => (e.stage === 'Completed' || e.stage === 'Contact Made') && !existingNames.includes(e.name?.toLowerCase())
      );
      setCompletedOnboarding(completed);
    } catch (err) {
      console.error(err);
    }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddClient = async (entry) => {
    try {
      const res = await authFetch('/api/royalty', {
        method: 'POST',
        body: JSON.stringify({
          clientName: entry.name,
          clientEmail: entry.email || '',
          onboardingId: entry._id,
        }),
      });
      const data = await res.json();
      if (data.client) {
        setClients((prev) => [data.client, ...prev]);
        setCompletedOnboarding((prev) => prev.filter((e) => e._id !== entry._id));
        addToast(`${entry.name} added to Music Works`);
        setShowAddModal(false);
      } else {
        addToast(data.message || 'Failed to add', 'error');
      }
    } catch (err) {
      addToast('Failed to add client', 'error');
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      await authFetch(`/api/royalty/${clientId}`, { method: 'DELETE' });
      setClients((prev) => prev.filter((c) => c._id !== clientId));
      if (selectedClient?._id === clientId) setSelectedClient(null);
      addToast('Client removed');
      fetchData();
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  };

  const handleUpdateClient = (updatedClient) => {
    setClients((prev) => prev.map((c) => (c._id === updatedClient._id ? updatedClient : c)));
    if (selectedClient?._id === updatedClient._id) setSelectedClient(updatedClient);
  };

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.clientName.toLowerCase().includes(q) ||
      (c.clientEmail && c.clientEmail.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: '28px 36px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: 0 }}>Music Works</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Manage client music works from completed onboarding
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none',
            borderRadius: '10px', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}
        >
          <Plus size={18} /> Add Client
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px', position: 'relative', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
        <input
          type="text" placeholder="Search clients..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: '38px' }}
        />
      </div>

      {/* Client Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          <DollarSign size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', fontWeight: 600 }}>No clients yet</p>
          <p style={{ fontSize: '13px' }}>Add clients from completed onboarding</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map((client) => {
            const totalYears = client.years?.length || 0;
            return (
              <div
                key={client._id}
                onClick={() => setSelectedClient(client)}
                style={{
                  background: '#161b2e', border: '1px solid #1e2540', borderRadius: '12px',
                  padding: '20px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3a4060'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2540'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#1f2d1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={18} color="#22c55e" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: 0 }}>{client.clientName}</h3>
                    {client.clientEmail && <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>{client.clientEmail}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete this client?')) handleDeleteClient(client._id); }}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#8892b0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {totalYears} year{totalYears !== 1 ? 's' : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} /> Docs: {client.documentsReceived ? (
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>Yes</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>No</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Client Modal — pick from completed onboarding */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#1e2235', borderRadius: '16px', width: '480px', maxHeight: '80vh', overflow: 'auto', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>Add Client from Onboarding</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0' }}><X size={20} /></button>
            </div>

            {completedOnboarding.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                <Users size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px' }}>No completed onboarding entries available</p>
                <p style={{ fontSize: '12px' }}>Clients appear here once their onboarding stage is "Completed"</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedOnboarding.map((entry) => (
                  <div
                    key={entry._id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: '#161b2e', borderRadius: '10px',
                      border: '1px solid #1e2540',
                    }}
                  >
                    <div>
                      <p style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{entry.name}</p>
                      <p style={{ color: '#6b7280', fontSize: '12px' }}>{entry.email}</p>
                    </div>
                    <button
                      onClick={() => handleAddClient(entry)}
                      style={{
                        padding: '6px 16px', background: '#22c55e', border: 'none', borderRadius: '8px',
                        color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={handleUpdateClient}
          authFetch={authFetch}
          token={token}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default Royalty;
