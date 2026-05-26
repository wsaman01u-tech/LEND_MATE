import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import Brand from '../components/Brand';
import { useAuth } from '../state/AuthContext';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const submit = async (data) => { try { setLoading(true); await login(data.email, data.password); toast.success('Login successful'); navigate('/'); } catch (e) { toast.error(e.message); } finally { setLoading(false); } };
  const forgot = async () => { const email = watch('email'); if (!email) return toast.error('Enter email first'); try { await resetPassword(email); toast.success('Password reset email sent'); } catch (e) { toast.error(e.message); } };
  return <AuthCard><form onSubmit={handleSubmit(submit)} className="card w-full max-w-md space-y-4"><Brand /><h2 className="text-2xl font-black">Admin Login</h2><div><label className="label">Email</label><input className="input" {...register('email')} />{errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}</div><div><label className="label">Password</label><input type="password" className="input" {...register('password')} />{errors.password && <p className="text-sm text-red-600">Minimum 6 characters</p>}</div><button disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button><button type="button" onClick={forgot} className="w-full text-sm font-semibold text-primary-700">Forgot password?</button><p className="text-center text-sm">New admin? <Link className="font-bold text-primary-700" to="/register">Register</Link></p></form></AuthCard>;
}
function AuthCard({ children }) { return <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-50 to-white p-4">{children}</div>; }
