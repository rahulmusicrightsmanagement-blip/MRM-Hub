import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Search, Edit2, Trash2, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

const ROLE_META = {
  admin: { label: 'Admin', bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', avatar: '#7c3aed' },
  lead: { label: 'Lead', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', avatar: '#2563eb' },
  onboarding_manager: { label: 'Onboarding Mgr', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', avatar: '#059669' },
  society_manager: { label: 'Society Mgr', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', avatar: '#d97706' },
  music_work_manager: { label: 'Music Work Mgr', bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', avatar: '#db2777' },
};

const getAvatarColor = (roles) => {
  if (roles.includes('admin')) return '#7c3aed';
  if (roles.includes('lead')) return '#2563eb';
  return ROLE_META[roles[0]]?.avatar || '#059669';
};

const SpocManagement = () => {
  const { authFetch, isFullAccess, user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (!isFullAccess) {
    return (
      <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center', fontSize: '16px' }}>
        Access denied. Admin or Lead only.
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>SPOC Management</h2>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => {
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
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
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
        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, role, department..."
          style={{
            width: '100%',
            padding: '10px 14px 10px 36px',
            backgroundColor: '#141720',
            border: '1px solid #1e2540',
            borderRadius: '8px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Members', value: users.length, color: '#60a5fa' },
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
              backgroundColor: '#141720',
              borderRadius: '12px',
              border: '1px solid #1e2540',
            }}
          >
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{s.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No members found.</p>
      ) : (
        <div
          style={{
            backgroundColor: '#141720',
            borderRadius: '12px',
            border: '1px solid #1e2540',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2540' }}>
                {['Name', 'Email', 'Roles', 'Department', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '14px 18px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
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
                  <tr key={u._id} style={{ borderBottom: '1px solid #1e2540' }}>
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
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{u.name}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#9ca3af' }}>{u.email}</td>
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
                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#9ca3af' }}>{u.department || '—'}</td>
                    {/* Status */}
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: u.isActive ? '#34d399' : '#f87171',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: u.isActive ? '#34d399' : '#f87171',
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
                              border: '1px solid #1e2540',
                              backgroundColor: 'transparent',
                              color: '#60a5fa',
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
                                border: '1px solid #1e2540',
                                backgroundColor: 'transparent',
                                color: '#f87171',
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
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>—</span>
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
              backgroundColor: '#141720',
              borderRadius: '14px',
              border: '1px solid #1e2540',
            }}
          >
            <h3 style={{ color: 'white', fontSize: '17px', fontWeight: 700, marginBottom: '10px' }}>Delete Member</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
              Are you sure you want to delete <strong style={{ color: 'white' }}>{deleteConfirm.name}</strong>? They will lose all access immediately.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #1e2540',
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
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
                  backgroundColor: '#ef4444',
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

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const toggleRole = (role) => {
    setForm((p) => {
      const has = p.roles.includes(role);
      const next = has ? p.roles.filter((r) => r !== role) : [...p.roles, role];
      return { ...p, roles: next.length > 0 ? next : p.roles }; // keep at least 1
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name && !form.email) {
      setError('Please enter the member\'s name and email address.');
      return;
    }
    if (!form.name) {
      setError('Please enter the member\'s full name.');
      return;
    }
    if (!form.email) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isEdit && !form.password) {
      setError('Please set a password for the new member.');
      return;
    }
    if (form.roles.length === 0) {
      setError('Please select at least one role for the member.');
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
      onClose();
    } catch (err) {
      setError(err.message);
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#0f1117',
    border: '1px solid #1e2540',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

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
          backgroundColor: '#141720',
          borderRadius: '14px',
          border: '1px solid #1e2540',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '17px', fontWeight: 700 }}>{isEdit ? 'Edit Member' : 'Add New Member'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', marginBottom: '16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '13px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>Full Name *</label>
            <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Enter full name" style={inputStyle} />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="name@mrmhub.com" style={inputStyle} />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>
              Password {isEdit ? '(leave blank to keep current)' : '*'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Enter password'}
                style={{ ...inputStyle, paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
              >
                {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
              </button>
            </div>
          </div>

          {/* Roles (multi-select checkboxes) */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '8px' }}>Roles *</label>
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
                      border: `1px solid ${selected ? meta.text : '#1e2540'}`,
                      backgroundColor: selected ? meta.bg : 'transparent',
                      color: selected ? meta.text : '#6b7280',
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
          </div>

          {/* Department */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>Department</label>
            <input value={form.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="e.g. Rights Mgmt" style={inputStyle} />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginBottom: '6px' }}>Phone</label>
            <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" style={inputStyle} />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af' }}>Active</label>
              <button
                type="button"
                onClick={() => handleChange('isActive', !form.isActive)}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: form.isActive ? '#059669' : '#374151',
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
              <span style={{ fontSize: '13px', color: form.isActive ? '#34d399' : '#f87171' }}>
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
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
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
      </div>
    </div>
  );
};

export default SpocManagement;
