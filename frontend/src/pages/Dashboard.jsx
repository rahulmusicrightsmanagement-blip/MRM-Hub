import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  TrendingUp,
  UserPlus,
  Music,
  Globe,
  ArrowRight,
  CheckCircle2,
  Clock,
  Circle,
  Minus,
  Activity,
} from 'lucide-react';

/* ─── Shared styles ─── */
const cardStyle = {
  backgroundColor: '#161b2e',
  border: '1px solid #1e2540',
  borderRadius: '14px',
  padding: '24px',
};

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'done':
      return <CheckCircle2 style={{ width: '16px', height: '16px', color: '#34d399' }} />;
    case 'pending':
      return <Clock style={{ width: '16px', height: '16px', color: '#eab308' }} />;
    case 'not-started':
      return <Circle style={{ width: '16px', height: '16px', color: '#6b7280' }} />;
    default:
      return <Minus style={{ width: '16px', height: '16px', color: '#374151' }} />;
  }
};

const ViewAllBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '13px',
      color: '#818cf8',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 0',
    }}
  >
    View All <ArrowRight style={{ width: '14px', height: '14px' }} />
  </button>
);

/* ═══════════════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════════════ */
const Dashboard = () => {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeMembers: 0, totalLeads: 0, onboardingCount: 0,
    totalWorks: 0, registeredCount: 0, inProgressCount: 0, totalMembers: 0,
  });
  const [pipelineData, setPipelineData] = useState([]);
  const [onboardingData, setOnboardingData] = useState([]);
  const [societyData, setSocietyData] = useState([]);
  const [societyFlags, setSocietyFlags] = useState({});
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await authFetch('/api/dashboard/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setPipelineData(data.pipelineData || []);
          setOnboardingData(data.onboardingData || []);
          setSocietyData(data.societyData || []);
          setSocietyFlags(data.societyFlags || {});
          setRecentLeads(data.recentLeads || []);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [authFetch]);

  const statsCards = [
    { title: 'TOTAL MEMBERS', value: stats.totalMembers, icon: Users, iconBg: '#1e3a5f', iconColor: '#60a5fa', route: '/members' },
    { title: 'PIPELINE LEADS', value: stats.totalLeads, icon: TrendingUp, iconBg: '#2d1f5e', iconColor: '#a78bfa', route: '/sales-pipeline' },
    { title: 'ONBOARDING', value: stats.onboardingCount, icon: UserPlus, iconBg: '#3d2f1a', iconColor: '#fbbf24', route: '/onboarding' },
    // { title: 'MUSICAL WORKS', value: stats.totalWorks, icon: Music, iconBg: '#3d1f35', iconColor: '#f472b6', route: '/musical-works' },
    { title: 'REGISTERED', value: stats.registeredCount, icon: Globe, iconBg: '#1a3d2f', iconColor: '#34d399', route: '/society-reg' },
  ];

  const maxPipeline = Math.max(...pipelineData.map((d) => d.count), 1);
  const maxOnboarding = Math.max(...onboardingData.map((d) => d.count), 1);

  const stageBadge = (stage) => {
    const colors = {
      'New Enquiry': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
      'Meeting Set': { bg: 'rgba(99,102,241,0.15)', color: '#a78bfa' },
      'Qualified Lead': { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    };
    const c = colors[stage] || { bg: '#1e2540', color: '#9ca3af' };
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', backgroundColor: c.bg, color: c.color }}>
        {stage}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#8892b0' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Overview of your sales, onboarding, and society registrations</p>
      </div>

      {/* ─── Stats Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => navigate(card.route)}
              style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3a3f60'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2540'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px' }}>{card.title}</p>
                <div style={{ width: '38px', height: '38px', backgroundColor: card.iconBg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: '18px', height: '18px', color: card.iconColor }} />
                </div>
              </div>
              <p style={{ fontSize: '30px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* ─── Row 1: Sales Pipeline + Onboarding ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Sales Pipeline */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp style={{ width: '18px', height: '18px', color: '#a78bfa' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Sales Pipeline</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/sales-pipeline')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pipelineData.map((item) => (
              <div key={item.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '13px', color: '#d1d5db' }}>{item.stage}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{item.count}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#1e2540', borderRadius: '4px', overflow: 'hidden', marginLeft: '18px' }}>
                  <div style={{ height: '100%', width: `${(item.count / maxPipeline) * 100}%`, backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
            {pipelineData.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>No pipeline data</p>
            )}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.12)' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              Total leads: <span style={{ color: 'white', fontWeight: 600 }}>{stats.totalLeads}</span>
            </p>
          </div>
        </div>

        {/* Onboarding Progress */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus style={{ width: '18px', height: '18px', color: '#fbbf24' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Onboarding Progress</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/onboarding')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {onboardingData.map((item) => (
              <div key={item.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '13px', color: '#d1d5db' }}>{item.stage}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{item.count}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#1e2540', borderRadius: '4px', overflow: 'hidden', marginLeft: '18px' }}>
                  <div style={{ height: '100%', width: `${(item.count / maxOnboarding) * 100}%`, backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
            {onboardingData.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>No onboarding data</p>
            )}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.12)' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              In onboarding: <span style={{ color: 'white', fontWeight: 600 }}>{stats.onboardingCount}</span>
              {' · '}Active members: <span style={{ color: '#34d399', fontWeight: 600 }}>{stats.activeMembers}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Row 2: Society Registration + Recent Leads ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }}>
        {/* Society Registration Status */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Globe style={{ width: '18px', height: '18px', color: '#34d399' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Society Registrations</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/society-reg')} />
          </div>

          {/* Summary badges */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <CheckCircle2 style={{ width: '14px', height: '14px', color: '#34d399' }} />
              <span style={{ color: '#9ca3af' }}>Registered:</span>
              <span style={{ color: 'white', fontWeight: 600 }}>{stats.registeredCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <Clock style={{ width: '14px', height: '14px', color: '#eab308' }} />
              <span style={{ color: '#9ca3af' }}>In Progress:</span>
              <span style={{ color: 'white', fontWeight: 600 }}>{stats.inProgressCount}</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2540' }}>
                  <th style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', paddingBottom: '12px', paddingRight: '12px' }}>Member</th>
                  {Object.keys(societyFlags).map((soc) => (
                    <th key={soc} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 600, color: '#6b7280', paddingBottom: '12px', paddingLeft: '3px', paddingRight: '3px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '13px' }}>{societyFlags[soc]}</span>
                        <span>{soc}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {societyData.map((row, idx) => (
                  <tr key={row.member} style={{ borderBottom: idx < societyData.length - 1 ? '1px solid #1a1f35' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate('/society-reg')}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1f35'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', color: '#e5e7eb', fontWeight: 500, whiteSpace: 'nowrap' }}>{row.member}</td>
                    {Object.keys(societyFlags).map((soc) => (
                      <td key={soc} style={{ padding: '10px 3px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <StatusIcon status={row.societies[soc]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {societyData.length === 0 && (
                  <tr>
                    <td colSpan={Object.keys(societyFlags).length + 1} style={{ padding: '30px 0', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                      No registrations yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Leads */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity style={{ width: '18px', height: '18px', color: '#60a5fa' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Recent Leads</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/sales-pipeline')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentLeads.map((lead, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => navigate('/sales-pipeline')}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1f35'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '3px' }}>{lead.name}</p>
                  <p style={{ fontSize: '11px', color: '#6b7280' }}>{lead.email}</p>
                </div>
                <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                  {stageBadge(lead.stage)}
                </div>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '30px 0' }}>No leads yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
