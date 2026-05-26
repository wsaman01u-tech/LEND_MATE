import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import Brand from '../components/Brand';
import { useAuth } from '../state/AuthContext';

const schema = z.object({ name: z.string().min(2), phone: z.string().regex(/^[0-9]{10}$/), email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/) });

export default function Register() {
  const { register: createAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });
  const submit = async (data) => { try { setLoading(true); await createAdmin(data); toast.success('Admin registered'); navigate('/otp'); } catch (e) { toast.error(e.message); } finally { setLoading(false); } };
  return <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-50 to-white p-4"><form onSubmit={form.handleSubmit(submit)} className="card w-full max-w-md space-y-4"><Brand /><h2 className="text-2xl font-black">Admin Registration</h2>{['name','phone','email','password'].map((field) => <div key={field}><label className="label capitalize">{field}</label><input type={field === 'password' ? 'password' : 'text'} className="input" {...form.register(field)} />{form.formState.errors[field] && <p className="text-sm text-red-600">Enter valid {field}. Password needs 8 chars, uppercase and number.</p>}</div>)}<button disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Register'}</button><p className="text-center text-sm">Already registered? <Link className="font-bold text-primary-700" to="/login">Login</Link></p></form></div>;
}
