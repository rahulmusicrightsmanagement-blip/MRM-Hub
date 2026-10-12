import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bell, X, Check, CheckCheck, Trash2, ClipboardList, TrendingUp, UserPlus, Globe,
  Shuffle, FileText, MessageSquare, RefreshCw, CheckCircle2, AlarmClock, BellOff,
} from 'lucide-react';
import { T, toneOf } from '../theme';

/* One tone + icon per notification type, so a list of them can be scanned by
   kind before it is read. */
const TYPE_STYLE = {
  task_assigned: { tone: 'blue', icon: ClipboardList },
  lead_assigned: { tone: 'green', icon: TrendingUp },
  onboarding_assigned: { tone: 'amber', icon: UserPlus },
  society_assigned: { tone: 'teal', icon: Globe },
  stage_changed: { tone: 'indigo', icon: Shuffle },
  document_uploaded: { tone: 'teal', icon: FileText },
  remark_added: { tone: 'amber', icon: MessageSquare },
  status_changed: { tone: 'indigo', icon: RefreshCw },
  task_completed: { tone: 'green', icon: CheckCircle2 },
  deadline_approaching: { tone: 'red', icon: AlarmClock },
  general: { tone: 'grey', icon: Bell },
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

const styleOf = (type) => TYPE_STYLE[type] || TYPE_STYLE.general;

const PANEL_CSS = `
.notif-item { transition: background-color .12s; }
.notif-item:hover { background-color: ${T.page} !important; }
.notif-item .notif-actions { opacity: 0; transition: opacity .12s; }
.notif-item:hover .notif-actions, .notif-item:focus-within .notif-actions { opacity: 1; }
.notif-icon-btn { background: none; border: none; cursor: pointer; padding: 5px; border-radius: 7px; display: flex; color: ${T.faint}; }
.notif-icon-btn:hover { background: ${T.bg}; color: ${T.heading}; }
.notif-icon-btn.is-danger:hover { background: #FFEBEE; color: #B71C1C; }
.notif-tab { border: none; cursor: pointer; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: transparent; color: ${T.muted}; }
.notif-tab.is-active { background: ${T.heading}; color: #FFFFFF; }
.notif-tab:not(.is-active):hover { background: ${T.bg}; color: ${T.heading}; }
`;

const NotificationPanel = () => {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
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

  // Poll unread count every 30s; the first check runs straight after mount.
  useEffect(() => {
    const first = setTimeout(fetchUnreadCount, 0);
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  // The full list is loaded when the bell opens the panel.
  const toggleOpen = () => {
    if (!open) fetchNotifications();
    setOpen(!open);
  };

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


  const visible = onlyUnread ? notifications.filter((n) => !n.read) : notifications;

  const getNotificationRoute = (n) => {
    const key = (n.relatedType || n.type || '').toLowerCase();
    if (key.includes('society')) return '/society-reg';
    if (key.includes('onboarding')) return '/onboarding';
    if (key.includes('lead')) return '/sales-pipeline';
    if (key.includes('client')) return '/client-chat';
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
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={toggleOpen}>
        <Bell style={{ width: '20px', height: '20px', color: T.muted }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              minWidth: '18px',
              height: '18px',
              backgroundColor: '#C62828',
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
            position: 'absolute', top: '36px', right: 0, width: '400px', maxHeight: '520px',
            backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(27, 94, 32, 0.08), 0 24px 48px -12px rgba(27, 94, 32, 0.28)',
            zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <style>{PANEL_CSS}</style>

          {/* Header */}
          <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ color: T.heading, fontSize: '15px', fontWeight: 800, margin: 0 }}>Notifications</h4>
                {unreadCount > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', background: '#C62828', borderRadius: '999px', padding: '1px 8px' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} title="Mark all as read" className="notif-icon-btn">
                    <CheckCheck style={{ width: '16px', height: '16px' }} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} title="Close" className="notif-icon-btn">
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
            <div style={{ display: 'inline-flex', gap: '4px', padding: '3px', background: T.page, border: `1px solid ${T.border}`, borderRadius: '999px' }}>
              <button className={`notif-tab${!onlyUnread ? ' is-active' : ''}`} onClick={() => setOnlyUnread(false)}>All</button>
              <button className={`notif-tab${onlyUnread ? ' is-active' : ''}`} onClick={() => setOnlyUnread(true)}>Unread</button>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                <div style={{ width: '44px', height: '44px', margin: '0 auto 12px', borderRadius: '12px', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BellOff style={{ width: '20px', height: '20px', color: T.faint }} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: T.body }}>
                  {onlyUnread ? 'You are all caught up' : 'No notifications yet'}
                </div>
                <div style={{ fontSize: '12px', color: T.faint, marginTop: '4px' }}>New activity on your work will show up here.</div>
              </div>
            ) : (
              visible.map((n) => {
                const { tone, icon: Icon } = styleOf(n.type);
                const c = toneOf(tone);
                return (
                  <div
                    key={n._id}
                    className="notif-item"
                    onClick={() => openNotification(n)}
                    style={{
                      position: 'relative', display: 'flex', gap: '12px', padding: '12px 14px 12px 16px',
                      borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start', cursor: 'pointer',
                      backgroundColor: n.read ? T.surface : '#F6FBF6',
                    }}
                  >
                    {!n.read && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: c.bd }} />}
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, opacity: n.read ? 0.7 : 1,
                    }}>
                      <Icon style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: n.read ? 500 : 700, color: n.read ? T.body : T.heading, margin: 0, lineHeight: 1.4 }}>
                        {n.title}
                      </p>
                      {n.message && <p style={{ fontSize: '12px', color: T.muted, margin: '3px 0 0', lineHeight: 1.45 }}>{n.message}</p>}
                      <p style={{ fontSize: '11px', color: T.faint, margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C62828' }} />}
                        {n.triggeredBy ? `by ${n.triggeredBy} · ` : ''}{timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <div className="notif-actions" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {!n.read && (
                        <button onClick={(e) => { e.stopPropagation(); markRead(n._id); }} title="Mark as read" className="notif-icon-btn">
                          <Check style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }} title="Delete" className="notif-icon-btn is-danger">
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
