import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';

const NotificationPanel = () => {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await authFetch('/api/notifications/unread-count');
      const data = await res.json();
      if (res.ok) setUnreadCount(data.count);
    } catch { /* ignore */ }
  };

  const fetchNotifications = async () => {
    try {
      const res = await authFetch('/api/notifications');
      const data = await res.json();
      if (res.ok) setNotifications(data.notifications);
    } catch { /* ignore */ }
  };

  // Poll unread count every 15s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // When opening, fetch full list
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id) => {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((p) => Math.max(0, p - 1));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await authFetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const deleteNotif = async (id) => {
    try {
      await authFetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchUnreadCount();
    } catch { /* ignore */ }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const typeColors = {
    task_assigned: '#60a5fa',
    lead_assigned: '#34d399',
    onboarding_assigned: '#fbbf24',
    society_assigned: '#f472b6',
    stage_changed: '#a78bfa',
    document_uploaded: '#2dd4bf',
    remark_added: '#fb923c',
    status_changed: '#e879f9',
    task_completed: '#4ade80',
    deadline_approaching: '#f87171',
    general: '#9ca3af',
  };

  const getNotificationRoute = (n) => {
    const key = (n.relatedType || n.type || '').toLowerCase();
    if (key.includes('society')) return '/society-reg';
    if (key.includes('onboarding')) return '/onboarding';
    if (key.includes('lead')) return '/sales-pipeline';
    if (key.includes('task')) return '/tracker';
    if (key.includes('royalty') || key.includes('music')) return '/royalty';
    if (key.includes('member')) return '/members';
    return '/';
  };

  const openNotification = async (n) => {
    if (!n.read) await markRead(n._id);
    setOpen(false);

    const route = getNotificationRoute(n);
    if (n.relatedId) {
      const type = encodeURIComponent(n.relatedType || n.type || 'general');
      const id = encodeURIComponent(n.relatedId);
      navigate(`${route}?notifType=${type}&notifId=${id}`);
      return;
    }
    navigate(route);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Icon */}
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Bell style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              minWidth: '18px',
              height: '18px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              padding: '0 4px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {/* Dropdown Panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '36px',
            right: 0,
            width: '380px',
            maxHeight: '480px',
            backgroundColor: '#141720',
            border: '1px solid #1e2540',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #1e2540' }}>
            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: 0 }}>Notifications</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} title="Mark all read" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                  <CheckCheck style={{ width: '16px', height: '16px' }} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => openNotification(n)}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 16px',
                    borderBottom: '1px solid #1e2540',
                    backgroundColor: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  {/* Dot */}
                  <div style={{ marginTop: '6px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: n.read ? '#374151' : (typeColors[n.type] || '#9ca3af'), flexShrink: 0 }} />
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: n.read ? 400 : 600, color: n.read ? '#9ca3af' : 'white', margin: 0, lineHeight: 1.4 }}>
                      {n.title}
                    </p>
                    {n.message && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0', lineHeight: 1.3 }}>{n.message}</p>}
                    <p style={{ fontSize: '11px', color: '#4b5563', margin: '4px 0 0' }}>
                      {n.triggeredBy ? `by ${n.triggeredBy} · ` : ''}{timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {!n.read && (
                      <button onClick={(e) => { e.stopPropagation(); markRead(n._id); }} title="Mark read" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <Check style={{ width: '14px', height: '14px' }} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }} title="Delete" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
