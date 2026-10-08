import { Routes, Route, Navigate } from 'react-router-dom';
import { DesktopShell } from './components/layout/DesktopShell';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { DoctorPatients } from './pages/DoctorPatients';
import { PatientDetail } from './pages/PatientDetail';
import { ReviewQueue } from './pages/ReviewQueue';
import { NewDischarge } from './pages/NewDischarge';
import { AuditLog } from './pages/AuditLog';
import { AIAgent } from './pages/AIAgent';
import { AuthPage } from './pages/AuthPage';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return <AuthPage />;
  }

  if (profile.role !== 'doctor') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">This portal is for doctors only</p>
        </div>
      </div>
    );
  }

  return (
    <DesktopShell>
      <Routes>
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/patients" element={<DoctorPatients />} />
        <Route path="/doctor/patients/:id" element={<PatientDetail />} />
        <Route path="/doctor/agent" element={<AIAgent />} />
        <Route path="/doctor/review" element={<ReviewQueue />} />
        <Route path="/doctor/intake" element={<NewDischarge />} />
        <Route path="/doctor/audit" element={<AuditLog />} />
        <Route path="/" element={<Navigate to="/doctor" replace />} />
      </Routes>
    </DesktopShell>
  );
}

export default App;
