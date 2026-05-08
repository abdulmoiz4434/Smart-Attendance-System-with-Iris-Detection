import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleGuard({ allowedRoles, children }) {
  const { userProfile, loading } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!userProfile) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(userProfile.role)) return <Navigate to="/login" replace />;

  return children;
}