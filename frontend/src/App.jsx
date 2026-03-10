import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SalesPipeline from './pages/SalesPipeline';
import Onboarding from './pages/Onboarding';
import SocietyReg from './pages/SocietyReg';
// import MusicalWorks from './pages/MusicalWorks';
import Royalty from './pages/Royalty';
import Members from './pages/Members';
import MemberProfile from './pages/MemberProfile';
import Tracker from './pages/Tracker';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import SpocManagement from './pages/SpocManagement';

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '16px' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sales-pipeline" element={<SalesPipeline />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/society-reg" element={<SocietyReg />} />
        {/* <Route path="/musical-works" element={<MusicalWorks />} /> */}
        <Route path="/royalty" element={<Royalty />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberProfile />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/spoc-management" element={<SpocManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

const LoginGuard = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
