import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import TraineeLogin from './pages/trainee/Login';
import TraineeHome from './pages/trainee/Home';
import Coach from './pages/trainee/Coach';
import Check from './pages/trainee/Check';
import Certification from './pages/trainee/Certification';

import TrainerLogin from './pages/trainer/Login';
import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerReviews from './pages/trainer/Reviews';
import TrainerReview from './pages/trainer/Review';
import TraineePerformance from './pages/trainer/TraineePerformance';

import AdminDashboard from './pages/admin/Dashboard';

function ProtectedRoute({ role, children }: { role: 'trainee' | 'trainer' | 'admin'; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={role === 'trainee' ? '/' : '/trainer/login'} replace />;
  if (role === 'trainer' && user.role !== 'trainer' && user.role !== 'admin') return <Navigate to="/trainer/login" replace />;
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/trainer/login" replace />;
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
      <Route path="/trainer/reviews" element={<ProtectedRoute role="trainer"><TrainerReviews /></ProtectedRoute>} />
      <Route path="/trainer/review/:evaluationId" element={<ProtectedRoute role="trainer"><TrainerReview /></ProtectedRoute>} />
      <Route path="/trainer/trainees/:traineeId" element={<ProtectedRoute role="trainer"><TraineePerformance /></ProtectedRoute>} />

      <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
