import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import useRealtime from '../hooks/useRealtime';
import EmptyState from '../components/EmptyState';
import { fmtDate, money } from '../lib/finance';

export default function Payments() {
  const { data, loading } = useRealtime('collections', { orderBy: ['paidAt', 'desc'] });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Collection History</h1>
      {loading ? <div className="skeleton h-72" /> : data.length
        ? <div className="space-y-3">{data.map((c) => <CollRow key={c.id} c={c} />)}</div>
        : <EmptyState title="No collections yet" />}
    </div>
  );
}

function CollRow({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="font-black text-slate-800">{money(c.totalCollected)} — {c.borrowerName}</p>
          <p className="text-xs text-slate-500">Collected on {fmtDate(c.collectedDate)} &nbsp;•&nbsp; {c.allocations?.length || 0} EMIs covered &nbsp;•&nbsp; {c.collectorName}</p>
        </div>
        {open ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>
      {open && c.allocations?.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {c.allocations.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">EMI #{a.slotIndex + 1} &nbsp; Due: {fmtDate(a.dueDate)}</span>
              <div className="flex items-center gap-2">
                <b>{money(a.allocated)}</b>
                <span className={`badge text-[10px] px-1.5 py-0 ${a.paymentType === 'Advance' ? 'bg-blue-50 text-blue-700' : a.paymentType === 'Partial' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                  {a.paymentType}
                </span>
              </div>
            </div>
          ))}
          {c.notes && <p className="text-xs italic text-slate-400 pt-1">{c.notes}</p>}
        </div>
      )}
    </div>
  );
}
