import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  TrendingUp,
  UserPlus,
  Globe,
  ArrowRight,
  CheckCircle2,
  Clock,
  Activity,
} from 'lucide-react';

/* ─── Shared styles ─── */
const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(165, 214, 167, 0.55)',
  borderRadius: '14px',
  padding: '24px',
};

const ViewAllBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '13px',
      color: '#256B29',
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
    totalWorks: 0, registeredCount: 0, inProgressCount: 0, overdueCount: 0, societyTotalCount: 0, totalMembers: 0,
  });
  const [pipelineData, setPipelineData] = useState([]);
  const [onboardingData, setOnboardingData] = useState([]);
  const [societyCounts, setSocietyCounts] = useState([]);
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
          setSocietyCounts(data.societyCounts || []);
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
    { title: 'TOTAL MEMBERS', value: stats.totalMembers, icon: Users, iconBg: '#E3F2FD', iconColor: '#0D47A1', route: '/members' },
    { title: 'PIPELINE LEADS', value: stats.totalLeads, icon: TrendingUp, iconBg: '#C8E6C9', iconColor: '#256B29', route: '/sales-pipeline' },
    { title: 'ONBOARDING', value: stats.onboardingCount, icon: UserPlus, iconBg: '#FFF8E1', iconColor: '#7A4400', route: '/onboarding' },
    { title: 'REGISTERED', value: stats.registeredCount, icon: Globe, iconBg: '#E8F5E9', iconColor: '#2E7D32', route: '/society-reg' },
  ];

  const maxPipeline = Math.max(...pipelineData.map((d) => d.count), 1);
  const maxOnboarding = Math.max(...onboardingData.map((d) => d.count), 1);

  const stageBadge = (stage) => {
    const colors = {
      'New Enquiry': { bg: 'rgba(30, 136, 229, 0.15)', color: '#0D47A1' },
      'Meeting Set': { bg: 'rgba(46, 125, 50, 0.15)', color: '#256B29' },
      'Qualified Lead': { bg: 'rgba(67, 160, 71, 0.15)', color: '#2E7D32' },
    };
    const c = colors[stage] || { bg: '#F1F6F1', color: '#4A6851' };
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', backgroundColor: c.bg, color: c.color }}>
        {stage}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#4A6851' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh' }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1B5E20', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '14px', color: '#4A6851' }}>Overview of your sales, onboarding, and society registrations</p>
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
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4A6851'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#5B7362'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#4A6851', letterSpacing: '0.5px' }}>{card.title}</p>
                <div style={{ width: '38px', height: '38px', backgroundColor: card.iconBg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: '18px', height: '18px', color: card.iconColor }} />
                </div>
              </div>
              <p style={{ fontSize: '30px', fontWeight: 800, color: '#1B5E20', lineHeight: '1' }}>{card.value}</p>
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
              <TrendingUp style={{ width: '18px', height: '18px', color: '#256B29' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B5E20' }}>Sales Pipeline</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/sales-pipeline')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pipelineData.map((item) => (
              <div key={item.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '13px', color: '#2F4A36' }}>{item.stage}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1B5E20' }}>{item.count}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#F1F6F1', borderRadius: '4px', overflow: 'hidden', marginLeft: '18px' }}>
                  <div style={{ height: '100%', width: `${(item.count / maxPipeline) * 100}%`, backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
            {pipelineData.length === 0 && (
              <p style={{ fontSize: '13px', color: '#5B7362', textAlign: 'center', padding: '20px 0' }}>No pipeline data</p>
            )}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: 'rgba(46, 125, 50, 0.06)', borderRadius: '8px', border: '1px solid rgba(46, 125, 50, 0.12)' }}>
            <p style={{ fontSize: '12px', color: '#4A6851' }}>
              Total leads: <span style={{ color: '#1B5E20', fontWeight: 600 }}>{stats.totalLeads}</span>
            </p>
          </div>
        </div>

        {/* Onboarding Progress */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus style={{ width: '18px', height: '18px', color: '#7A4400' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B5E20' }}>Onboarding Progress</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/onboarding')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {onboardingData.map((item) => (
              <div key={item.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '13px', color: '#2F4A36' }}>{item.stage}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1B5E20' }}>{item.count}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#F1F6F1', borderRadius: '4px', overflow: 'hidden', marginLeft: '18px' }}>
                  <div style={{ height: '100%', width: `${(item.count / maxOnboarding) * 100}%`, backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
            {onboardingData.length === 0 && (
              <p style={{ fontSize: '13px', color: '#5B7362', textAlign: 'center', padding: '20px 0' }}>No onboarding data</p>
            )}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: 'rgba(249, 168, 37, 0.06)', borderRadius: '8px', border: '1px solid rgba(249, 168, 37, 0.12)' }}>
            <p style={{ fontSize: '12px', color: '#4A6851' }}>
              In onboarding: <span style={{ color: '#1B5E20', fontWeight: 600 }}>{stats.onboardingCount}</span>
              {' · '}Active members: <span style={{ color: '#2E7D32', fontWeight: 600 }}>{stats.activeMembers}</span>
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
              <Globe style={{ width: '18px', height: '18px', color: '#2E7D32' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B5E20' }}>Society Registrations</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/society-reg')} />
          </div>

          <div
            onClick={() => navigate('/society-reg')}
            style={{ border: '1px solid rgba(165, 214, 167, 0.55)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(165, 214, 167, 0.55)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#5B7362', letterSpacing: '0.4px' }}>Society</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '11px', color: '#5B7362', letterSpacing: '0.4px' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '11px', color: '#5B7362', letterSpacing: '0.4px' }}>Completed</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '11px', color: '#5B7362', letterSpacing: '0.4px' }}>In Progress</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '11px', color: '#5B7362', letterSpacing: '0.4px' }}>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {societyCounts.map((item, index) => (
                  <tr key={item.society} style={{ borderBottom: index < societyCounts.length - 1 ? '1px solid rgba(165, 214, 167, 0.55)' : 'none' }}>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#2F4A36', fontWeight: 600 }}>{item.society}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '13px', color: '#0D47A1', fontWeight: 700 }}>{item.total}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '13px', color: '#2E7D32', fontWeight: 700 }}>{item.completed}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '13px', color: '#7A4400', fontWeight: 700 }}>{item.inProgress}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', color: '#B71C1C', fontWeight: 700 }}>{item.overdue}</td>
                  </tr>
                ))}
                {societyCounts.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '16px 14px', textAlign: 'center', fontSize: '13px', color: '#5B7362' }}>
                      No society data
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
              <Activity style={{ width: '18px', height: '18px', color: '#0D47A1' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1B5E20' }}>Recent Leads</h2>
            </div>
            <ViewAllBtn onClick={() => navigate('/sales-pipeline')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentLeads.map((lead, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => navigate('/sales-pipeline')}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1B5E20'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#1B5E20', marginBottom: '3px' }}>{lead.name}</p>
                  <p style={{ fontSize: '11px', color: '#5B7362' }}>{lead.email}</p>
                </div>
                <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                  {stageBadge(lead.stage)}
                </div>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <p style={{ fontSize: '13px', color: '#5B7362', textAlign: 'center', padding: '30px 0' }}>No leads yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
