import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { CalendarDays, X } from 'lucide-react';
import { addOne, getCurrentUserId, getOne, serverTimestamp, updateOne } from '../lib/data';
import { addDays, calculateLoan, fmtDate, money, todayISO } from '../lib/finance';

const schema = z.object({
  fullName: z.string().min(2, 'Name required'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Enter 10 digit phone'),
  alternatePhone: z.string().optional().or(z.literal('')),
  address: z.string().min(3, 'Address required'),
  financeType: z.enum(['Daily', 'Weekly', 'Monthly']),
  assignedAgent: z.string().optional().or(z.literal('')),
  loanAmount: z.coerce.number().positive('Loan amount required'),
  totalInterest: z.coerce.number().min(0, 'Interest amount required'),
  deductedAmount: z.coerce.number().min(0).optional(),
  durationMode: z.enum(['Manual', '30', '60', '90', '120']),
  duration: z.coerce.number().positive('Duration required'),
  startDate: z.string().min(1, 'Start date required'),
  existingLoan: z.boolean().optional(),
  notes: z.string().optional()
});

const PRESETS = { '30': 30, '60': 60, '90': 90, '120': 120 };

export default function BorrowerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      financeType: 'Daily', durationMode: 'Manual', startDate: todayISO(),
      existingLoan: false,
      deductedAmount: 0, totalInterest: 0, notes: '', alternatePhone: '', assignedAgent: ''
    }
  });
  const v = form.watch();

  useEffect(() => {
    if (v.durationMode && v.durationMode !== 'Manual') form.setValue('duration', PRESETS[v.durationMode]);
  }, [v.durationMode]);

  const calc = calculateLoan(v);
  const endDateISO = v.startDate && v.duration ? addDays(v.startDate, calc.durationDaysValue) : '';

  useEffect(() => {
    if (!id) return;
    getOne('borrowers', id).then((b) => {
      if (!b) return;
      form.reset({
        ...form.getValues(), ...b,
        totalInterest: b.interest ?? b.totalInterest ?? 0,
        durationMode: b.durationMode || 'Manual'
      });
    });
  }, [id]);

  const submit = async (data) => {
    try {
      setLoading(true);
      const c = calculateLoan(data);
      const paid = Number(data.paidAmount || 0);
      const payload = {
        ...data,
        interest: c.interest,
        totalInterest: c.interest,
        interestRate: c.interestRate,
        totalPayable: c.totalPayable,
        expectedReturn: c.totalPayable,
        netAmountGiven: c.netAmountGiven,
        emi: c.emi,
        endDate: data.startDate ? addDays(data.startDate, c.durationDaysValue) : '',
        paidAmount: paid,
        pendingAmount: c.totalPayable - paid,
        paymentCount: Number(data.paymentCount || 0),
        updatedAt: serverTimestamp()
      };
      if (id) await updateOne('borrowers', id, payload);
      else await addOne('borrowers', { ...payload, createdAt: serverTimestamp(), loanHistory: [], userId: getCurrentUserId() });
      toast.success(id ? 'Borrower updated' : 'Borrower added');
      navigate('/');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const err = (k) => form.formState.errors[k]?.message;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="mx-auto max-w-2xl space-y-4">
      <div className="card flex items-center justify-between">
        <h1 className="text-xl font-black">{id ? 'Edit Borrower' : 'Add New Borrower'}</h1>
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-slate-100"><X size={18} /></button>
      </div>

      {/* Borrower Info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Borrower Information</h2>
        <Field label="Full Name" error={err('fullName')}><input className="input" placeholder="e.g. Ramesh Kumar" {...form.register('fullName')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone Number" error={err('phone')}><input inputMode="numeric" className="input" placeholder="10 digit" {...form.register('phone')} /></Field>
          <Field label="Alternate Phone"><input inputMode="numeric" className="input" placeholder="Optional" {...form.register('alternatePhone')} /></Field>
        </div>
        <Field label="Address" error={err('address')}><textarea className="input" rows="2" placeholder="Full address" {...form.register('address')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Finance Type"><select className="input" {...form.register('financeType')}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></Field>
          <Field label="Assign to Agent"><select className="input" {...form.register('assignedAgent')}><option value="">Optional</option><option>Admin</option><option>Agent 1</option><option>Agent 2</option></select></Field>
        </div>
      </div>

      {/* Loan Details */}
      <div className="card space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Loan Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loan Amount (₹)" error={err('loanAmount')}><input inputMode="numeric" placeholder="e.g. 10000" className="input" {...form.register('loanAmount')} /></Field>
          <Field label="Total Interest Amount (₹)" error={err('totalInterest')}><input inputMode="numeric" placeholder="e.g. 1500" className="input" {...form.register('totalInterest')} /></Field>
        </div>
        <Field label="Deducted Amount (₹)"><input inputMode="numeric" placeholder="Amount kept as security/fee" className="input" {...form.register('deductedAmount')} /></Field>

        <Field label="Repayment Duration">
          <select className="input mb-2" {...form.register('durationMode')}>
            <option value="Manual">Manual (Enter Days)</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="120">120 Days</option>
          </select>
          <input inputMode="numeric" placeholder="Total days" className="input" disabled={v.durationMode !== 'Manual'} {...form.register('duration')} />
          {err('duration') && <p className="mt-1 text-sm text-red-600">{err('duration')}</p>}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" error={err('startDate')}><input type="date" className="input" {...form.register('startDate')} /></Field>
          <Field label="End Date (Auto)">
            <div className="input flex items-center gap-2 bg-slate-50 text-slate-700">
              <CalendarDays size={15} className="shrink-0 text-slate-400" />
              <span>{endDateISO ? fmtDate(endDateISO) : 'Auto-calculated'}</span>
            </div>
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-600" {...form.register('existingLoan')} />
          <span className="text-sm text-slate-700">This is an existing loan (manage past payments after saving)</span>
        </label>
      </div>

      {/* EMI Summary Card */}
      {calc.totalPayable > 0 && (
        <div className="overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white shadow-lg">
          <p className="mb-4 text-sm font-black uppercase tracking-widest opacity-80">Loan Summary</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryItem label="Loan Amount" value={money(v.loanAmount || 0)} />
            <SummaryItem label="Total Interest" value={money(calc.interest)} />
            <SummaryItem label="Total Payable" value={money(calc.totalPayable)} highlight />
            <SummaryItem label="EMI Per Day" value={money(calc.emi)} highlight />
            <SummaryItem label="Duration" value={`${calc.durationDaysValue || 0} days`} />
            <SummaryItem label="Net Given" value={money(calc.netAmountGiven)} />
          </div>
          {endDateISO && (
            <div className="mt-4 flex items-center gap-4 border-t border-white/20 pt-4 text-sm">
              <span className="opacity-75">Start: <b>{fmtDate(v.startDate)}</b></span>
              <span className="opacity-75">End: <b>{fmtDate(endDateISO)}</b></span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-soft flex-1">Cancel</button>
        <button disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : (id ? 'Save Changes' : 'Add Borrower')}</button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return <div>{label && <label className="label">{label}</label>}{children}{error && <p className="mt-1 text-sm text-red-600">{error}</p>}</div>;
}

function SummaryItem({ label, value, highlight }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${highlight ? 'bg-white/20' : 'bg-white/10'}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className={`text-base font-black ${highlight ? 'text-white' : 'text-white/90'}`}>{value}</p>
    </div>
  );
}
