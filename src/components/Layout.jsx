import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard, FileText, Home, LogOut, Menu, Settings, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Brand from './Brand';
import { useAuth } from '../state/AuthContext';

const links = [
  ['/', Home, 'Dashboard'], ['/borrowers', Users, 'Borrowers'], ['/payments', CreditCard, 'Payments'], ['/reports', FileText, 'Reports'], ['/settings', Settings, 'Settings']
];

export default function Layout() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const doLogout = async () => { await logout(); toast.success('Logged out'); navigate('/login'); };
  return <div className="min-h-screen bg-slate-50 lg:flex">
    <aside className="no-print hidden w-72 flex-col border-r border-slate-100 bg-white p-5 lg:flex"><Brand /><nav className="mt-8 space-y-2">{links.map(([to, Icon, label]) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} />{label}</NavLink>)}</nav><button onClick={doLogout} className="btn-danger mt-auto"><LogOut size={18} /> Logout</button></aside>
    <main className="min-w-0 flex-1"><header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 p-4 backdrop-blur"><div className="lg:hidden"><Brand compact /></div><div className="hidden lg:block"><p className="text-sm text-slate-500">Welcome back</p><h2 className="font-bold">{profile?.name || 'Admin'}</h2></div><button className="btn-soft lg:hidden"><Menu size={18} /></button></header><div className="p-4 pb-24 lg:p-8"><Outlet /></div><nav className="no-print fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-100 bg-white p-2 lg:hidden">{links.map(([to, Icon, label]) => <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-semibold ${isActive ? 'text-primary-700' : 'text-slate-500'}`}><Icon size={18} />{label}</NavLink>)}</nav></main>
  </div>;
}
