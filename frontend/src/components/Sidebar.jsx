import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  UserPlus,
  Globe,
  Music,
  Users,
  ClipboardList,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  List,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';
import { T, TONES } from '../theme';

/**
 * Eleven links in one flat column told you nothing about how the app is
 * organised, so every visit was a scan of the whole list. They are grouped now,
 * the way the Admin Studio sidebar groups its own — a tiny uppercase caption
 * over two or three related destinations.
 *
 * The order is the work order: look at the business, walk a client through it,
 * register their rights, do the day's jobs, then configure.
 *
 * `badge` says WHY a link is restricted rather than leaving people to wonder
 * why a colleague's sidebar is longer than theirs.
 */
const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Reports', path: '/analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'journey',
    label: 'Client journey',
    items: [
      { name: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
      { name: 'Onboarding', path: '/onboarding', icon: UserPlus },
      { name: 'Members', path: '/members', icon: Users },
    ],
  },
  {
    id: 'rights',
    label: 'Rights',
    items: [
      { name: 'Society Reg.', path: '/society-reg', icon: Globe },
      { name: 'Music Works', path: '/royalty', icon: Music },
    ],
  },
  {
    id: 'work',
    label: 'Day to day',
    items: [
      { name: 'Tracker', path: '/tracker', icon: ClipboardList },
      { name: 'Client Task', path: '/client-chat', icon: MessageSquare },
    ],
  },
  {
    id: 'admin',
    /* not "Admin" — the Picklist link already carries an ADMIN badge, and a
       group captioned with the same word as the badge inside it says it twice */
    label: 'Settings',
    items: [
      { name: 'SPOC Management', path: '/spoc-management', icon: ShieldCheck, fullAccessOnly: true, badge: 'Lead' },
      { name: 'Picklist Manager', path: '/picklists', icon: List, adminOnly: true, badge: 'Admin' },
    ],
  },
];

const COLLAPSE_KEY = 'mrm.sidebar.collapsed';

/* localStorage throws outright in some contexts (private windows, blocked site
   data) and does not exist at all during a server render, so every touch of it
   is guarded and falls back to the expanded sidebar. */
const readCollapsed = () => {
  try {
    return globalThis.localStorage?.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const WIDE = 232;
const NARROW = 76;

/** A tiny uppercase caption over a run of links — the Studio grouping device. */
const GroupLabel = ({ children }) => (
  <div style={{
    padding: '16px 16px 7px', fontSize: '9.5px', fontWeight: 700,
    letterSpacing: '1.1px', textTransform: 'uppercase', color: T.faint,
  }}>
    {children}
  </div>
);

const Sidebar = () => {
  const location = useLocation();
  const { user, logout, isFullAccess, isGuest, hasRole } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { globalThis.localStorage?.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* not worth recovering from */ }
      return next;
    });
  }, []);

  const canSee = useCallback((item) => {
    if (isGuest) return true; // guests can view all pages
    if (item.fullAccessOnly) return isFullAccess;
    if (item.adminOnly) return hasRole('admin');
    return true;
  }, [isGuest, isFullAccess, hasRole]);

  /* Filter the items first, then drop any group left with nothing in it — a
     caption over an empty run is a heading for content that is not there. */
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const initials = user
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  /* Role is the one thing that changes what you can do here, so it earns a
     colour. Blue and grey are the only non-green tones in play, which is
     exactly why they still read as meaning something. */
  const avatarColor = isGuest
    ? T.faint
    : hasRole('admin') ? T.accent
      : user?.roles?.includes('lead') ? TONES.blue.fg : TONES.green.fg;

  /* "Admin, Lead, Society_manager, Onboarding_manager, Music_work_manager"
     wrapped onto five lines and swallowed the footer. One role, a count, and
     the full list on hover. */
  const roles = user?.roles || [];
  const roleLabel = roles.length
    ? `${roles[0].replace(/_/g, ' ')}${roles.length > 1 ? ` +${roles.length - 1}` : ''}`
    : 'member';

  return (
    <aside
      style={{
        width: `${collapsed ? NARROW : WIDE}px`,
        minWidth: `${collapsed ? NARROW : WIDE}px`,
        height: '100vh',
        backgroundColor: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.18s ease, min-width 0.18s ease',
      }}
    >
      {/* Brand — the mark alone when narrow, the full lockup wording when wide */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: collapsed ? '20px 0 16px' : '22px 16px 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <img
          src="/mrm-mark.png"
          alt=""
          width={36}
          height={36}
          style={{ width: '36px', height: '36px', flexShrink: 0, objectFit: 'contain' }}
        />
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ color: T.heading, fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>
              MRM Hub
            </h1>
            <p style={{ color: T.faint, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '1.8px', marginTop: '1px' }}>
              Artist Portal
            </p>
          </div>
        )}
      </div>

      {/* Collapse — the pin control Studio puts at the head of its nav */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}
        aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}
        aria-pressed={collapsed}
        className="mrm-nav"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          margin: collapsed ? '0 12px 4px' : '0 12px 4px',
          padding: '7px 10px', borderRadius: '9px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px',
          textTransform: 'uppercase',
        }}
      >
        {collapsed
          ? <PanelLeftOpen style={{ width: '16px', height: '16px' }} />
          : <><PanelLeftClose style={{ width: '16px', height: '16px' }} /> Collapse</>}
      </button>

      {/* Navigation — scrolls, because five captions plus eleven links is
          taller than a 768px screen once the footer has had its share */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 12px 8px' }}>
        {groups.map((group, gi) => (
          <div key={group.id}>
            {collapsed
              ? gi > 0 && <div style={{ height: '1px', background: T.border, margin: '10px 6px' }} />
              : <GroupLabel>{group.label}</GroupLabel>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {group.items.map((item) => {
                const active = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    title={collapsed ? item.name : undefined}
                    className="mrm-nav"
                    /* Inline only for the ACTIVE state, so the hover rule in
                       index.css still governs every resting link — a style
                       attribute outranks any class rule. */
                    style={active ? {
                      backgroundColor: T.bg,
                      color: T.heading,
                      fontWeight: 600,
                    } : undefined}
                  >
                    {/* Every link reserves the same 28px slot, so the label
                        never shifts when the chip appears on the active one. */}
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? T.accentGradient : 'transparent',
                      color: active ? T.surface : 'currentColor',
                      transition: 'background 0.15s ease',
                    }}>
                      <Icon style={{ width: '17px', height: '17px' }} />
                    </span>
                    {!collapsed && (
                      <>
                        <span style={{
                          flex: 1, minWidth: 0, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span style={{
                            flexShrink: 0, padding: '2px 6px', borderRadius: '5px',
                            background: TONES.grey.bg, border: `1px solid ${TONES.grey.bd}`,
                            color: TONES.grey.fg, fontSize: '8.5px', fontWeight: 700,
                            letterSpacing: '0.5px', textTransform: 'uppercase',
                          }}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {isGuest && (
        <div
          title="You are signed in as a guest — every page is readable, nothing is editable."
          style={{
            margin: '0 12px 8px',
            padding: collapsed ? '8px 0' : '8px 11px',
            background: TONES.amber.bg,
            border: `1px solid ${TONES.amber.bd}`,
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
          }}
        >
          <Eye style={{ width: '14px', height: '14px', flexShrink: 0, color: TONES.amber.fg }} />
          {!collapsed && (
            <span style={{ fontSize: '11px', color: TONES.amber.fg, fontWeight: 700 }}>
              View-only access
            </span>
          )}
        </div>
      )}

      {/* Who is signed in */}
      <div style={{
        padding: collapsed ? '12px 0' : '13px 16px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '10px',
      }}>
        <span
          title={user?.name || 'User'}
          style={{
            width: '34px', height: '34px', borderRadius: '11px', flexShrink: 0,
            backgroundColor: avatarColor, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            color: T.surface, fontSize: '12px', fontWeight: 700,
          }}
        >
          {initials}
        </span>
        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13.5px', fontWeight: 600, color: T.heading, lineHeight: 1.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.name || 'User'}
              </p>
              <p
                title={roles.join(', ') || 'member'}
                style={{
                  fontSize: '11.5px', color: T.faint, textTransform: 'capitalize',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {roleLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="mrm-icon-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '8px', display: 'inline-flex',
                alignItems: 'center', flexShrink: 0,
              }}
            >
              <LogOut style={{ width: '16px', height: '16px' }} />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '0 16px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: '10.5px', color: T.faint, letterSpacing: '0.4px' }}>
            version-{APP_VERSION}
          </span>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
