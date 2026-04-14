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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
  { name: 'Onboarding', path: '/onboarding', icon: UserPlus },
  { name: 'Society Reg.', path: '/society-reg', icon: Globe },
  { name: 'Music Works', path: '/royalty', icon: Music },
  { name: 'Members', path: '/members', icon: Users },
  { name: 'Tracker', path: '/tracker', icon: ClipboardList },
  { name: 'Client Chat', path: '/client-chat', icon: MessageSquare },
  { name: 'Reports', path: '/analytics', icon: BarChart3 },
  { name: 'SPOC Management', path: '/spoc-management', icon: ShieldCheck, fullAccessOnly: true },
  { name: 'Picklist Manager', path: '/picklists', icon: List, adminOnly: true },
];

const Sidebar = () => {
  const location = useLocation();
  const { user, logout, isFullAccess, hasRole } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (item.fullAccessOnly) return isFullAccess;
    if (item.adminOnly) return hasRole('admin');
    return true;
  });

  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const avatarColor =
    user?.roles?.includes('admin') ? '#7c3aed' : user?.roles?.includes('lead') ? '#2563eb' : '#059669';

  return (
    <aside
      style={{
        width: '220px',
        minWidth: '220px',
        height: '100vh',
        backgroundColor: '#141720',
        borderRight: '1px solid #1e2235',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Music style={{ width: '20px', height: '20px', color: 'white' }} />
        </div>
        <div>
          <h1 style={{ color: 'white', fontWeight: 700, fontSize: '16px', lineHeight: '1.2' }}>
            MRM Hub
          </h1>
          <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Artist Portal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {visibleItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.2s',
                color: isActive ? '#60a5fa' : '#9ca3af',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
              }}
            >
              <Icon
                style={{
                  width: '18px',
                  height: '18px',
                  color: isActive ? '#60a5fa' : '#6b7280',
                }}
              />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile + Logout */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #1e2235',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: avatarColor,
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'white', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name || 'User'}
          </p>
          <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>{user?.roles?.join(', ') || 'member'}</p>
        </div>
        <button
          onClick={logout}
          title="Logout"
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <LogOut style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
