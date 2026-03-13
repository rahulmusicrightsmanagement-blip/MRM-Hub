import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';

const pageTitles = {
  '/': 'Dashboard',
  '/sales-pipeline': 'Sales Pipeline',
  '/onboarding': 'Onboarding',
  '/society-reg': 'Society Reg.',
  '/royalty': 'Music Works',
  '/members': 'Members',
  '/tracker': 'Tracker',
  '/analytics': 'Reports',
  '/spoc-management': 'SPOC Management',
};

const Layout = ({ children }) => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'MRM Hub';

  const today = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${days[today.getDay()]}, ${String(today.getDate()).padStart(2, '0')} ${months[today.getMonth()]} ${today.getFullYear()}`;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0f1117' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 36px',
            borderBottom: '1px solid #1e2540',
            backgroundColor: '#0f1117',
            flexShrink: 0,
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <NotificationPanel />
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>{dateStr}</span>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: '#0f1117' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
