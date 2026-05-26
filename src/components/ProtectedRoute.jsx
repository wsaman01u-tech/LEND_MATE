import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}
