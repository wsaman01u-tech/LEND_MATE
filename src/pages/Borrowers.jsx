import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Bell, Eye, MessageCircle, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { deleteOne } from '../lib/data';
import useRealtime from '../hooks/useRealtime';
import EmptyState from '../components/EmptyState';
import { borrowerStatus, money, openWhatsApp, whatsappReminder } from '../lib/finance';
import { defaultAvatar } from '../lib/photos';
import PaymentReminder from '../components/PaymentReminder';

const statusStyle = (s) => s === 'Completed' ? 'bg-green-50 text-green-700' : s === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';

export default function Borrowers() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const { data, loading } = useRealtime('borrowers', { orderBy: ['createdAt', 'desc'] });
  const rows = useMemo(() => data
    .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase()))
    .filter((b) => filter === 'All' || borrowerStatus(b) === filter), [data, search, filter]);
  const remove = async (id) => { if (!confirm('Delete this borrower?')) return; await deleteOne('borrowers', id); toast.success('Borrower deleted'); };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black">Borrowers</h1>
      <Link className="btn-primary" to="/borrowers/new"><Plus size={16} /> Add Borrower</Link>
    </div>

    <div className="card grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={16} className="text-slate-400" /><input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search borrower or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>{['All', 'Active', 'Completed', 'Overdue'].map((x) => <option key={x}>{x}</option>)}</select>
    </div>

    {loading ? <div className="skeleton h-64" /> : rows.length ? <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">{rows.map((b) => {
        const s = borrowerStatus(b);
        const photo = b.photoUrl || defaultAvatar;
        const pending = Number(b.pendingAmount || 0);
        return <div key={b.id} className="card space-y-3">
          <div className="flex items-center gap-3">
            <img src={photo} alt="" className="h-11 w-11 rounded-xl object-cover border border-slate-200 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link to={`/borrowers/${b.id}`} className="text-base font-black hover:text-primary-700 truncate">{b.fullName}</Link>
                <span className={`badge shrink-0 text-[10px] ${statusStyle(s)}`}>{s}</span>
              </div>
              <p className="text-xs text-slate-500">{b.phone}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openWhatsApp(b.phone, whatsappReminder(b))} className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100"><MessageCircle size={14} /></button>
              <a href={`tel:${b.phone}`} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Phone size={14} /></a>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span>Loan: <b>{money(b.loanAmount)}</b></span>
            <span>Balance: <b className={pending > 0 ? 'text-red-600' : 'text-green-600'}>{money(pending)}</b></span>
          </div>
          <ActionButtons id={b.id} phone={b.phone} borrower={b} onDelete={() => remove(b.id)} />
        </div>;
      })}</div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="p-3">Borrower</th><th className="p-3">Phone</th><th className="p-3">Loan</th><th className="p-3">Balance</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>{rows.map((b) => {
              const s = borrowerStatus(b);
              const photo = b.photoUrl || defaultAvatar;
              const pending = Number(b.pendingAmount || 0);
              return <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img src={photo} alt="" className="h-8 w-8 rounded-lg object-cover border border-slate-200" />
                    <Link to={`/borrowers/${b.id}`} className="font-bold hover:text-primary-700">{b.fullName}</Link>
                  </div>
                </td>
                <td className="p-3 text-slate-600">{b.phone}</td>
                <td className="p-3">{money(b.loanAmount)}</td>
                <td className={`p-3 font-bold ${pending > 0 ? 'text-red-600' : 'text-green-600'}`}>{money(pending)}</td>
                <td className="p-3"><span className={`badge ${statusStyle(s)}`}>{s}</span></td>
                <td className="p-3"><div className="flex justify-end"><ActionButtons id={b.id} phone={b.phone} borrower={b} onDelete={() => remove(b.id)} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>
    </> : <EmptyState title="No borrowers found" message="Try a different search or add a new borrower." />}
  </div>;
}

function ActionButtons({ id, phone, borrower, onDelete }) {
  const [showReminder, setShowReminder] = useState(false);
  const base = 'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition';
  return <>
    <div className="flex flex-wrap items-center gap-2">
      <Link to={`/borrowers/${id}`} title="View" className={`${base} bg-primary-50 text-primary-700 hover:bg-primary-100`}><Eye size={14} /> View</Link>
      <button onClick={() => setShowReminder(true)} title="Set Reminder" className={`${base} bg-amber-50 text-amber-700 hover:bg-amber-100`}><Bell size={14} /> Remind</button>
      <button onClick={() => openWhatsApp(phone, whatsappReminder(borrower))} title="WhatsApp" className={`${base} bg-green-50 text-green-700 hover:bg-green-100`}><MessageCircle size={14} /> WhatsApp</button>
      <Link to={`/borrowers/${id}/edit`} title="Edit" className={`${base} bg-slate-100 text-slate-700 hover:bg-slate-200`}><Pencil size={14} /> Edit</Link>
      <button onClick={onDelete} title="Delete" className={`${base} bg-red-50 text-red-600 hover:bg-red-100`}><Trash2 size={14} /> Delete</button>
    </div>
    {showReminder && <PaymentReminder borrower={borrower} onClose={() => setShowReminder(false)} />}
  </>;
}
