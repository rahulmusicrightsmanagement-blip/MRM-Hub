import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Ring Chart Component ── */
const RingChart = ({ value, color, size = 72 }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(value, 1);
  const offset = circumference * (1 - value / total);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2540" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={value === 0 ? circumference : circumference * 0.15} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
};

/* ── Main ── */
const Analytics = () => {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboards');
  const tabs = ['Dashboards', 'Reports', 'Notifications'];

  const [pipelineData, setPipelineData] = useState([]);
  const [societyData, setSocietyData] = useState([]);
  // const [worksStatusData, setWorksStatusData] = useState([]);
  const [onboardingData, setOnboardingData] = useState([]);
  const [loading, setLoading] = useState(true);

  const reportsData = [
    { name: 'Monthly Royalty Summary', date: 'Feb 2026', type: 'Royalties' },
    { name: 'Society Registration Status', date: 'Feb 2026', type: 'Registration' },
    { name: 'Pipeline Conversion Report', date: 'Jan 2026', type: 'Sales' },
    { name: 'KYC Compliance Report', date: 'Jan 2026', type: 'Compliance' },
    { name: 'Quarterly Works Audit', date: 'Q4 2025', type: 'Audit' },
  ];

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await authFetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setPipelineData(data.pipelineData || []);
          setSocietyData(data.societyData || []);
          // setWorksStatusData(data.worksStatusData || []);
          setOnboardingData(data.onboardingData || []);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [authFetch]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const maxOnboarding = Math.max(...onboardingData.map((d) => d.value), 1);

  const cardStyle = {
    background: '#141720',
    border: '1px solid #1e2540',
    borderRadius: '12px',
    padding: '24px',
  };

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 }}>Analytics</h1>
        <p style={{ color: '#8892b0', fontSize: '14px', margin: '4px 0 0' }}>Dashboards, reports, and notifications</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#141720', borderRadius: '8px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 18px', borderRadius: '6px', border: 'none',
              background: activeTab === t ? '#1e2540' : 'transparent',
              color: activeTab === t ? '#fff' : '#8892b0',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            {t}
            {t === 'Notifications' && unreadCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '1px 7px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Dashboards Tab */}
      {activeTab === 'Dashboards' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Pipeline Conversion Funnel */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 24px' }}>Pipeline Conversion Funnel</h3>
            {pipelineData.length === 0 && !loading ? (
              <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No pipeline data yet</p>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '140px', paddingBottom: '0' }}>
                {pipelineData.map((d) => {
                  const maxVal = Math.max(...pipelineData.map((x) => x.value), 1);
                  const barH = (d.value / maxVal) * 100;
                  return (
                    <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100px' }}>
                        <div style={{ width: '40px', height: `${barH}%`, background: d.color, borderRadius: '4px 4px 0 0', minHeight: '8px', transition: 'height 0.3s' }} />
                      </div>
                      <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{d.value}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Registrations by Society */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 24px' }}>Registrations by Society</h3>
            {societyData.length === 0 && !loading ? (
              <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No registration data yet</p>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '140px' }}>
                {societyData.map((d) => {
                  const maxVal = Math.max(...societyData.map((x) => x.value), 1);
                  const barH = (d.value / maxVal) * 100;
                  return (
                    <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100px' }}>
                        <div style={{ width: '36px', height: `${barH}%`, background: d.color, borderRadius: '4px 4px 0 0', minHeight: '8px', transition: 'height 0.3s' }} />
                      </div>
                      <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{d.value}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Musical Works by Status (commented out — Musical Works disabled)
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 32px' }}>Musical Works by Status</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              {worksStatusData.length === 0 && !loading ? (
                <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No works data yet</p>
              ) : (
                worksStatusData.map((d) => (
                  <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <RingChart value={d.value} color={d.ring} />
                    <span style={{ color: '#8892b0', fontSize: '13px' }}>{d.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          */}

          {/* Monthly Onboarding Trend */}
          <div style={cardStyle}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 24px' }}>Monthly Onboarding Trend</h3>
            {onboardingData.length === 0 && !loading ? (
              <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No onboarding data yet</p>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '140px' }}>
                {onboardingData.map((d) => {
                  const barH = maxOnboarding > 0 ? (d.value / maxOnboarding) * 100 : 0;
                  return (
                    <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100px' }}>
                        <div style={{ width: '36px', height: `${barH}%`, background: 'linear-gradient(180deg, #c084fc, #ec4899)', borderRadius: '4px 4px 0 0', minHeight: '8px', transition: 'height 0.3s' }} />
                      </div>
                      <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{d.value}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'Reports' && (
        <div style={{ background: '#141720', border: '1px solid #1e2540', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #1e2540' }}>
            {['Report Name', 'Period', 'Type'].map((h) => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {reportsData.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid #1e2540', alignItems: 'center', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1f30')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{r.name}</span>
              <span style={{ color: '#8892b0', fontSize: '13px' }}>{r.date}</span>
              <span style={{ background: '#1e2540', color: '#8892b0', padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, width: 'fit-content' }}>{r.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'Notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '48px 0' }}>No notifications.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} style={{ background: '#141720', border: '1px solid #1e2540', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: '14px', fontWeight: 500, margin: 0 }}>{n.text}</p>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{n.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Analytics;
