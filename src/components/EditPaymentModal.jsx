import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { deleteOne, increment, serverTimestamp, updateOne } from '../lib/data';
import { fmtDate, money } from '../lib/finance';

export default function EditPaymentModal({ payment, borrowerId, onClose, onSaved }) {
  const resolveDate = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v?.toDate?.()?.toISOString?.()?.slice(0, 10) || '';
  };

  const [amount, setAmount] = useState(String(payment.amount || payment.paidAmount || ''));
  const [collectedDate, setCollectedDate] = useState(resolveDate(payment.collectedDate || payment.actualCollectionDate || payment.paidDate || payment.paidAt));
  const [emiDueDate, setEmiDueDate] = useState(resolveDate(payment.emiDueDate || payment.dueDate));
  const [notes, setNotes] = useState(payment.notes || '');
  const [busy, setBusy] = useState(false);

  const isAdvance = collectedDate && emiDueDate && collectedDate < emiDueDate;

  const save = async () => {
    const newAmount = Number(amount);
    if (!newAmount || newAmount <= 0) return toast.error('Enter valid amount');
    if (!emiDueDate) return toast.error('EMI Due Date is required');
    if (!collectedDate) return toast.error('Collection Date is required');
    
    try {
      setBusy(true);
      const delta = newAmount - Number(payment.amount || payment.paidAmount || 0);
      await updateOne('payments', payment.id, {
        amount: newAmount,
        paidAmount: newAmount,
        collectedDate,
        actualCollectionDate: collectedDate,
        emiDueDate,
        dueDate: emiDueDate,
        paidDate: collectedDate,
        paymentType: isAdvance ? 'Advance' : (payment.paymentType || 'Normal'),
        notes,
        updatedAt: serverTimestamp(),
      });
      if (delta !== 0) await updateOne('borrowers', borrowerId, {
        paidAmount: increment(delta),
        pendingAmount: increment(-delta),
        updatedAt: serverTimestamp(),
      });
      toast.success('Payment updated');
      onSaved?.();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Delete this payment? Borrower balance will be adjusted.')) return;
    try {
      setBusy(true);
      await deleteOne('payments', payment.id);
      await updateOne('borrowers', borrowerId, {
        paidAmount: increment(-Number(payment.amount || payment.paidAmount || 0)),
        pendingAmount: increment(Number(payment.amount || payment.paidAmount || 0)),
        paymentCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      toast.success('Payment deleted');
      onSaved?.();
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-black">Edit Payment</h2>
            <p className="text-xs text-slate-500">
              Originally: <b>{money(payment.amount || payment.paidAmount || 0)}</b>
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-3 p-4">
          {/* EMI Due date (editable) */}
          <div>
            <label className="label">EMI Due Date *</label>
            <input type="date" className="input" value={emiDueDate} onChange={(e) => setEmiDueDate(e.target.value)} required />
            <p className="mt-1 text-xs text-slate-500">Which EMI installment this payment is for</p>
          </div>

          <div>
            <label className="label">Amount Paid (₹)</label>
            <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div>
            <label className="label">Actual Collection Date *</label>
            <input type="date" className="input" value={collectedDate} onChange={(e) => setCollectedDate(e.target.value)} required />
            <p className="mt-1 text-xs text-slate-500">Date when payment was actually collected</p>
            {isAdvance && (
              <p className="mt-1 text-xs font-semibold text-blue-600">✓ Advance payment — collected before EMI due date</p>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={remove} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100">
              <Trash2 size={16} /> Delete
            </button>
            <button onClick={save} disabled={busy} className="btn-primary flex-1">
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
