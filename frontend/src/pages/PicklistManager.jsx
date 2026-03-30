import { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, List, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePicklist } from '../context/PicklistContext';
import { withApiBase } from '../utils/api';

const SUPER_ADMIN_EMAIL = 'rahuljadhav0417@gmail.com';

const CARD = {
  backgroundColor: '#141720',
  border: '1px solid #1e2235',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '16px',
};

const INPUT = {
  width: '100%',
  padding: '9px 13px',
  borderRadius: '8px',
  border: '1px solid #2d3348',
  backgroundColor: '#1a1e2e',
  color: '#e5e7eb',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const BTN = (bg = '#3b82f6', hover) => ({
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: bg,
  color: 'white',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

const CATEGORIES = [
  { key: 'lead_stage', label: 'Lead Stage' },
  { key: 'lead_source', label: 'Lead Source' },
  { key: 'member_roles', label: 'Member Roles' },
  { key: 'onboarding_stage', label: 'Onboarding Stage' },
  { key: 'onboarding_roles', label: 'Onboarding Roles' },
  { key: 'contract_type', label: 'Contract Type' },
  { key: 'renewal_type', label: 'Renewal Type' },
  { key: 'task_category', label: 'Task Category' },
  { key: 'document_types', label: 'Document Types' },
  { key: 'societies', label: 'Societies' },
];

const CategorySection = ({ categoryKey, categoryLabel, isSuperAdmin, token, onRefresh }) => {
  const { getItems } = usePicklist();
  const { addToast } = useToast();
  const items = getItems(categoryKey);

  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(withApiBase('/api/picklists'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: categoryKey, categoryLabel, value: newValue.trim(), label: newValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      addToast('Item added', 'success');
      setNewValue('');
      setAdding(false);
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to add item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id) => {
    if (!editValue.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(withApiBase(`/api/picklists/${id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ value: editValue.trim(), label: editValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      addToast('Item updated', 'success');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to update item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (index, direction) => {
    const dbItems = items.filter((i) => i._id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= dbItems.length) return;

    const current = dbItems[index];
    const target = dbItems[targetIndex];
    if (!current._id || !target._id) return;

    setLoading(true);
    try {
      await Promise.all([
        fetch(withApiBase(`/api/picklists/${current._id}`), {
          method: 'PUT', headers,
          body: JSON.stringify({ order: targetIndex }),
        }),
        fetch(withApiBase(`/api/picklists/${target._id}`), {
          method: 'PUT', headers,
          body: JSON.stringify({ order: index }),
        }),
      ]);
      onRefresh();
    } catch {
      addToast('Failed to reorder', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, value) => {
    if (!window.confirm(`Delete "${value}" from ${categoryLabel}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(withApiBase(`/api/picklists/${id}`), {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      addToast('Item deleted', 'success');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to delete item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm(`Initialize default values for "${categoryLabel}"? Existing items will not be replaced.`)) return;
    setLoading(true);
    try {
      const res = await fetch(withApiBase('/api/picklists/seed-defaults'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: categoryKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      addToast(data.message, 'success');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to seed defaults', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Items that actually exist in DB (have _id)
  const dbItems = items.filter((i) => i._id);

  return (
    <div style={CARD}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <List style={{ width: '16px', height: '16px', color: '#6366f1' }} />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>{categoryLabel}</span>
          <span
            style={{
              fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
              backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600,
            }}
          >
            {items.length} items
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button style={{ ...BTN('#1a1e2e'), border: '1px solid #2d3348', fontSize: '12px', padding: '6px 12px' }} onClick={handleSeedDefaults} disabled={loading}>
            <RefreshCw style={{ width: '13px', height: '13px' }} /> Init Defaults
          </button>
          <button style={{ ...BTN('#3b82f6'), fontSize: '12px', padding: '6px 12px' }} onClick={() => { setAdding(true); setExpanded(true); }}>
            <Plus style={{ width: '13px', height: '13px' }} /> Add
          </button>
          <span style={{ color: '#6b7280' }}>
            {expanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
          </span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ marginTop: '16px' }}>
          {/* Add form */}
          {adding && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                style={INPUT}
                placeholder="Enter new value..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewValue(''); } }}
                autoFocus
              />
              <button style={BTN('#10b981')} onClick={handleAdd} disabled={loading}>
                <Save style={{ width: '14px', height: '14px' }} />
              </button>
              <button style={{ ...BTN('#374151'), padding: '8px 12px' }} onClick={() => { setAdding(false); setNewValue(''); }}>
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )}

          {/* Items list */}
          {items.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
              No items yet. Click "Init Defaults" or "Add" to get started.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map((item, idx) => {
                const dbItems = items.filter((i) => i._id);
                const dbIdx = dbItems.findIndex((i) => i._id === item._id);
                return (
                <div
                  key={item._id || idx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#0f1117', border: '1px solid #1e2235',
                  }}
                >
                  {editingId === item._id ? (
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      <input
                        style={{ ...INPUT, flex: 1 }}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(item._id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                      />
                      <button style={{ ...BTN('#10b981'), padding: '6px 10px' }} onClick={() => handleEdit(item._id)} disabled={loading}>
                        <Save style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button style={{ ...BTN('#374151'), padding: '6px 10px' }} onClick={() => setEditingId(null)}>
                        <X style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: '14px', color: '#e5e7eb' }}>
                        {item.metadata?.flag && <span style={{ marginRight: '6px' }}>{item.metadata.flag}</span>}
                        {item.label || item.value}
                        {item.label && item.label !== item.value && (
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>({item.value})</span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {item._id && (
                          <>
                            <button
                              style={{ background: 'none', border: 'none', color: dbIdx === 0 ? '#2d3348' : '#6b7280', cursor: dbIdx === 0 ? 'default' : 'pointer', padding: '4px' }}
                              onClick={() => dbIdx > 0 && handleMove(dbIdx, -1)}
                              title="Move up"
                              disabled={loading || dbIdx === 0}
                            >
                              <ArrowUp style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: dbIdx === dbItems.length - 1 ? '#2d3348' : '#6b7280', cursor: dbIdx === dbItems.length - 1 ? 'default' : 'pointer', padding: '4px' }}
                              onClick={() => dbIdx < dbItems.length - 1 && handleMove(dbIdx, 1)}
                              title="Move down"
                              disabled={loading || dbIdx === dbItems.length - 1}
                            >
                              <ArrowDown style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}
                              onClick={() => { setEditingId(item._id); setEditValue(item.value); }}
                              title="Edit"
                            >
                              <Edit3 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </>
                        )}
                        {isSuperAdmin && item._id && (
                          <button
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            onClick={() => handleDelete(item._id, item.value)}
                            title="Delete"
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        )}
                        {!item._id && (
                          <span style={{ fontSize: '11px', color: '#4b5563', fontStyle: 'italic' }}>default</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PicklistManager = () => {
  const { user, token } = useAuth();
  const { fetchPicklists, loading } = usePicklist();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  return (
    <div style={{ padding: '28px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>
          Picklist Manager
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Manage dropdown options used across the app. Admins can add and edit items.
          {isSuperAdmin
            ? ' You can also delete items.'
            : ' Contact the super admin to delete items.'}
        </p>
      </div>

      {/* Refresh button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          style={{ ...BTN('#1a1e2e'), border: '1px solid #2d3348' }}
          onClick={fetchPicklists}
          disabled={loading}
        >
          <RefreshCw style={{ width: '14px', height: '14px' }} />
          {loading ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          categoryKey={cat.key}
          categoryLabel={cat.label}
          isSuperAdmin={isSuperAdmin}
          token={token}
          onRefresh={fetchPicklists}
        />
      ))}
    </div>
  );
};

export default PicklistManager;
