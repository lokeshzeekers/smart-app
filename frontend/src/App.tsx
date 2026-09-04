import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import TraineeLogin from './pages/trainee/Login';
import TraineeHome from './pages/trainee/Home';
import Coach from './pages/trainee/Coach';
import Check from './pages/trainee/Check';
import Certification from './pages/trainee/Certification';

import TrainerLogin from './pages/trainer/Login';
import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerReview from './pages/trainer/Review';

function ProtectedRoute({ role, children }: { role: 'trainee' | 'trainer'; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={role === 'trainer' ? '/trainer/login' : '/'} replace />;
  if (role === 'trainer' && user.role !== 'trainer' && user.role !== 'admin') return <Navigate to="/trainer/login" replace />;
  if (role === 'trainee' && user.role !== 'trainee') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TraineeLogin />} />
      <Route path="/trainer/login" element={<TrainerLogin />} />

      <Route path="/trainee/home" element={<ProtectedRoute role="trainee"><TraineeHome /></ProtectedRoute>} />
      <Route path="/trainee/coach" element={<ProtectedRoute role="trainee"><Coach /></ProtectedRoute>} />
      <Route path="/trainee/check" element={<ProtectedRoute role="trainee"><Check /></ProtectedRoute>} />
      <Route path="/trainee/certification" element={<ProtectedRoute role="trainee"><Certification /></ProtectedRoute>} />

      <Route path="/trainer/dashboard" element={<ProtectedRoute role="trainer"><TrainerDashboard /></ProtectedRoute>} />
      <Route path="/trainer/review/:evaluationId" element={<ProtectedRoute role="trainer"><TrainerReview /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
