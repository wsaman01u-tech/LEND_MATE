import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Borrowers from './pages/Borrowers';
import BorrowerForm from './pages/BorrowerForm';
import BorrowerDetails from './pages/BorrowerDetails';
import Payments from './pages/Payments';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SetupRequired from './pages/SetupRequired';
import { isFirebaseConfigured } from './lib/firebase';

export default function App() {
  if (!isFirebaseConfigured) return <SetupRequired />;

  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
      <Route index element={<Dashboard />} />
      <Route path="borrowers" element={<Borrowers />} />
      <Route path="borrowers/new" element={<BorrowerForm />} />
      <Route path="borrowers/:id" element={<BorrowerDetails />} />
      <Route path="borrowers/:id/edit" element={<BorrowerForm />} />
      <Route path="payments" element={<Payments />} />
      <Route path="reminders" element={<Reminders />} />
      <Route path="reports" element={<Reports />} />
      <Route path="settings" element={<Settings />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
