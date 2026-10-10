import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';
import { T } from '../theme';

/* This bar used to repeat the page name, which the sidebar highlights and every
   page prints as its own heading — three copies of the same word on screen at
   once. It is a utility bar now: notifications and the date, nothing else. */
const Layout = ({ children }) => {
  const today = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${days[today.getDay()]}, ${String(today.getDate()).padStart(2, '0')} ${months[today.getMonth()]} ${today.getFullYear()}`;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: T.page }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '14px 30px',
            borderBottom: `1px solid ${T.border}`,
            backgroundColor: T.page,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <NotificationPanel />
            <span style={{ fontSize: '14px', color: T.muted }}>{dateStr}</span>
          </div>
        </header>
        {/* the canvas: near-white, so a white card reads as raised and a mint
            control reads as inset. It was the same mint as both of them. */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: T.page }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
