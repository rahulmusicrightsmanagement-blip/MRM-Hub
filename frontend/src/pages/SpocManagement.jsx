import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Search, Edit2, Trash2, X, Eye, EyeOff, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';

const ROLE_META = {
  admin: { label: 'Admin', bg: 'rgba(27, 94, 32, 0.15)', text: '#256B29', avatar: '#1B5E20' },
  lead: { label: 'Lead', bg: 'rgba(30, 136, 229, 0.15)', text: '#0D47A1', avatar: '#0D47A1' },
  onboarding_manager: { label: 'Onboarding Mgr', bg: 'rgba(67, 160, 71, 0.15)', text: '#2E7D32', avatar: '#2E7D32' },
  society_manager: { label: 'Society Mgr', bg: 'rgba(249, 168, 37, 0.15)', text: '#7A4400', avatar: '#7A4400' },
  music_work_manager: { label: 'Music Work Mgr', bg: 'rgba(216, 27, 96, 0.15)', text: '#AD1457', avatar: '#AD1457' },
  guest: { label: 'Guest', bg: 'rgba(92, 132, 99, 0.15)', text: '#4A6851', avatar: '#5B7362' },
};

const getAvatarColor = (roles) => {
  if (roles.includes('admin')) return '#1B5E20';
  if (roles.includes('lead')) return '#0D47A1';
  return ROLE_META[roles[0]]?.avatar || '#2E7D32';
};

const SpocManagement = () => {
  const { authFetch, isFullAccess, isGuest, user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const blockGuestAction = () => {
    if (!isGuest) return false;
    addToast('Guest users have view-only access', 'error');
    return true;
  };

  const fetchUsers = async () => {
    try {
      const res = await authFetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch {
      /* session expired handled by authFetch */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.roles || []).some((r) => r.toLowerCase().includes(search.toLowerCase())) ||
      (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (blockGuestAction()) return;
    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u._id !== id));
        setDeleteConfirm(null);
        addToast('Team member deleted');
      } else {
        const data = await res.json();
        addToast(data.message || 'Failed to delete', 'error');
      }
    } catch {
      addToast('Failed to delete team member', 'error');
    }
  };

  if (!isFullAccess && !isGuest) {
    return (
      <div style={{ padding: '40px', color: '#5B7362', textAlign: 'center', fontSize: '16px' }}>
        Access denied. Admin or Lead only.
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1B5E20', marginBottom: '4px' }}>SPOC Management</h2>
          <p style={{ fontSize: '13px', color: '#5B7362' }}>{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => {
            if (blockGuestAction()) return;
            setEditUser(null);
            setShowModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #1565C0, #1B5E20)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          Add Member
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#5B7362' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, role, department..."
          style={{
            width: '100%',
            padding: '10px 14px 10px 36px',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(165, 214, 167, 0.55)',
            borderRadius: '8px',
            color: '#1B5E20',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Members', value: users.length, color: '#0D47A1' },
          ...Object.entries(ROLE_META).map(([key, meta]) => ({
            label: meta.label + 's',
            value: users.filter((u) => (u.roles || []).includes(key)).length,
            color: meta.text,
          })),
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '18px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid rgba(165, 214, 167, 0.55)',
            }}
          >
            <p style={{ fontSize: '12px', color: '#5B7362', marginBottom: '4px' }}>{s.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#5B7362', textAlign: 'center', padding: '40px' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#5B7362', textAlign: 'center', padding: '40px' }}>No members found.</p>
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid rgba(165, 214, 167, 0.55)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }}>
                {['Name', 'Email', 'Roles', 'Department', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '14px 18px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#5B7362',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const userRoles = u.roles || ['lead'];
                const initials = u.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }}>
                    {/* Name */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: getAvatarColor(userRoles),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#1B5E20' }}>{u.name}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#4A6851' }}>{u.email}</td>
                    {/* Roles */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {userRoles.map((r) => {
                          const meta = ROLE_META[r] || ROLE_META.lead;
                          return (
                            <span key={r} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: meta.bg, color: meta.text, whiteSpace: 'nowrap' }}>
                              {meta.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {/* Department */}
                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#4A6851' }}>{u.department || '—'}</td>
                    {/* Status */}
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: u.isActive ? '#2E7D32' : '#B71C1C',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: u.isActive ? '#E8F5E9' : '#FFEBEE',
                          }}
                        />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '14px 18px' }}>
                      {isFullAccess ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditUser(u);
                              setShowModal(true);
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(165, 214, 167, 0.55)',
                              backgroundColor: 'transparent',
                              color: '#0D47A1',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Edit2 style={{ width: '14px', height: '14px' }} />
                          </button>
                          {u._id !== currentUser?._id && (
                            <button
                              onClick={() => setDeleteConfirm(u)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(165, 214, 167, 0.55)',
                                backgroundColor: 'transparent',
                                color: '#B71C1C',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#5B7362' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && <UserModal user={editUser} onClose={() => setShowModal(false)} onSaved={fetchUsers} authFetch={authFetch} />}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              padding: '30px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid rgba(165, 214, 167, 0.55)',
            }}
          >
            <h3 style={{ color: '#1B5E20', fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>Delete Member</h3>
            <p style={{ color: '#4A6851', fontSize: '14px', marginBottom: '24px' }}>
              Are you sure you want to delete <strong style={{ color: '#1B5E20' }}>{deleteConfirm.name}</strong>? They will lose all access immediately.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(165, 214, 167, 0.55)',
                  backgroundColor: 'transparent',
                  color: '#4A6851',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#C62828',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───── Add / Edit Modal Component ───── */
const UserModal = ({ user, onClose, onSaved, authFetch }) => {
  const { addToast } = useToast();
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    roles: user?.roles || ['lead'],
    phone: user?.phone || '',
    department: user?.department || '',
    isActive: user?.isActive ?? true,
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [qrData, setQrData] = useState(null);
  const [manualSecret, setManualSecret] = useState('');
  const [resettingTotp, setResettingTotp] = useState(false);

  const handleChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: '' }));
  };

  const toggleRole = (role) => {
    setForm((p) => {
      const has = p.roles.includes(role);
      const next = has ? p.roles.filter((r) => r !== role) : [...p.roles, role];
      return { ...p, roles: next.length > 0 ? next : p.roles };
    });
    setFieldErrors((p) => ({ ...p, roles: '' }));
  };

  const validateForm = () => {
    const errs = {};
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName) {
      errs.name = 'Full name is required.';
    } else if (trimmedName.length < 2) {
      errs.name = 'Name must be at least 2 characters.';
    }

    if (!trimmedEmail) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Enter a valid email address.';
    }

    if (!isEdit && !form.password) {
      errs.password = 'Password is required for new members.';
    } else if (form.password && form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (form.roles.length === 0) {
      errs.roles = 'Select at least one role.';
    }

    if (form.phone && !/^[+]?[\d\s\-()]{7,15}$/.test(form.phone.trim())) {
      errs.phone = 'Enter a valid phone number.';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validateForm();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      const body = { ...form };
      if (isEdit && !body.password) delete body.password;

      const url = isEdit ? `/api/users/${user._id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      await onSaved();
      addToast(isEdit ? 'Team member updated' : 'Team member added');

      // Show QR code for new member
      if (!isEdit && data.totpQr) {
        setQrData(data.totpQr);
        setManualSecret(data.totpSecret || '');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTotp = async () => {
    setResettingTotp(true);
    try {
      const res = await authFetch(`/api/users/${user._id}/reset-totp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset');
      setQrData(data.qrDataUrl);
      setManualSecret(data.totpSecret || '');
      addToast('2FA reset — share new QR with team member');
    } catch (err) {
      addToast(err.message || 'Failed to reset 2FA', 'error');
    } finally {
      setResettingTotp(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#E8F5E9',
    border: `1px solid ${fieldErrors[field] ? '#FFCDD2' : 'rgba(165, 214, 167, 0.55)'}`,
    borderRadius: '8px',
    color: '#1B5E20',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  });

  const fieldErrorStyle = { fontSize: '12px', color: '#B71C1C', marginTop: '4px' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '30px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid rgba(165, 214, 167, 0.55)',
        }}
      >
        {/* QR Code View (shown after creating a new member or resetting 2FA) */}
        {qrData ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ color: '#1B5E20', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck style={{ width: '22px', height: '22px', color: '#2E7D32' }} />
                {isEdit ? 'Reset 2FA' : 'Setup Authenticator'}
              </h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5B7362', cursor: 'pointer', padding: '4px' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Description */}
            <p style={{ color: '#4A6851', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              Ask the team member to scan this QR code with their authenticator app
              <br /><span style={{ color: '#5B7362', fontSize: '12px' }}>(Google Authenticator, Microsoft Authenticator, etc.)</span>
            </p>

            {/* QR Code */}
            <div style={{ display: 'inline-block', padding: '20px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
              <img src={qrData} alt="TOTP QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>

            {/* Manual Secret */}
            {manualSecret && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#5B7362', fontSize: '12px', marginBottom: '8px' }}>Or enter this code manually:</p>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#E8F5E9',
                  border: '1px solid rgba(165, 214, 167, 0.55)',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  <code style={{
                    color: '#0D47A1',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                    wordBreak: 'break-all',
                    whiteSpace: 'normal',
                  }}>{manualSecret}</code>
                </div>
              </div>
            )}

            {/* Warning */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(249, 168, 37, 0.08)',
              border: '1px solid rgba(249, 168, 37, 0.2)',
              borderRadius: '10px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'left',
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', color: '#7A4400', flexShrink: 0 }} />
              <p style={{ color: '#7A4400', fontSize: '12px', fontWeight: 500, lineHeight: 1.5 }}>
                This QR code will not be shown again. Make sure it is scanned before closing.
              </p>
            </div>

            {/* Done Button */}
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2E7D32, #2E7D32)',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.target.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
            >
              Done — QR Code Scanned
            </button>
          </div>
        ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#1B5E20', fontSize: '17px', fontWeight: 700 }}>{isEdit ? 'Edit Member' : 'Add New Member'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5B7362', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', marginBottom: '16px', borderRadius: '8px', backgroundColor: 'rgba(229, 57, 53, 0.12)', border: '1px solid rgba(229, 57, 53, 0.25)', fontSize: '13px', color: '#B71C1C', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: fieldErrors.name ? '#B71C1C' : '#4A6851', marginBottom: '6px' }}>Full Name *</label>
            <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Enter full name" style={inputStyle('name')} />
            {fieldErrors.name && <p style={fieldErrorStyle}>{fieldErrors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: fieldErrors.email ? '#B71C1C' : '#4A6851', marginBottom: '6px' }}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="name@mrmhub.com" style={inputStyle('email')} />
            {fieldErrors.email && <p style={fieldErrorStyle}>{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: fieldErrors.password ? '#B71C1C' : '#4A6851', marginBottom: '6px' }}>
              Password {isEdit ? '(leave blank to keep current)' : '*'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Enter password'}
                style={{ ...inputStyle('password'), paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5B7362', cursor: 'pointer' }}
              >
                {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
              </button>
            </div>
            {fieldErrors.password && <p style={fieldErrorStyle}>{fieldErrors.password}</p>}
          </div>

          {/* Roles (multi-select checkboxes) */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: fieldErrors.roles ? '#B71C1C' : '#4A6851', marginBottom: '8px' }}>Roles *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(ROLE_META).map(([key, meta]) => {
                const selected = form.roles.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleRole(key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${selected ? meta.text : '#5B7362'}`,
                      backgroundColor: selected ? meta.bg : 'transparent',
                      color: selected ? meta.text : '#5B7362',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.roles && <p style={fieldErrorStyle}>{fieldErrors.roles}</p>}
          </div>

          {/* Department */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4A6851', marginBottom: '6px' }}>Department</label>
            <input value={form.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="e.g. Rights Mgmt" style={inputStyle('department')} />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: fieldErrors.phone ? '#B71C1C' : '#4A6851', marginBottom: '6px' }}>Phone</label>
            <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" style={inputStyle('phone')} />
            {fieldErrors.phone && <p style={fieldErrorStyle}>{fieldErrors.phone}</p>}
          </div>

          {/* Reset 2FA (edit only) */}
          {isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4A6851', marginBottom: '6px' }}>Two-Factor Authentication</label>
              <button
                type="button"
                onClick={handleResetTotp}
                disabled={resettingTotp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(249, 168, 37, 0.3)',
                  backgroundColor: 'rgba(249, 168, 37, 0.08)',
                  color: '#7A4400',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: resettingTotp ? 'not-allowed' : 'pointer',
                  opacity: resettingTotp ? 0.6 : 1,
                }}
              >
                <RefreshCw style={{ width: '14px', height: '14px' }} />
                {resettingTotp ? 'Resetting...' : 'Reset 2FA / Show New QR'}
              </button>
            </div>
          )}

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#4A6851' }}>Active</label>
              <button
                type="button"
                onClick={() => handleChange('isActive', !form.isActive)}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: form.isActive ? '#2E7D32' : '#F1F6F1',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: form.isActive ? '21px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
              <span style={{ fontSize: '13px', color: form.isActive ? '#2E7D32' : '#B71C1C' }}>
                {form.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #1565C0, #1B5E20)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              marginTop: '6px',
            }}
          >
            {saving ? 'Saving...' : isEdit ? 'Update Member' : 'Add Member'}
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

export default SpocManagement;
