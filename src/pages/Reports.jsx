import { useState } from 'react';
import { Download, MessageCircle, Printer } from 'lucide-react';
import useRealtime from '../hooks/useRealtime';
import { borrowerStatus, fmtDate, money } from '../lib/finance';
import { downloadElementPdf } from '../lib/reports';

export default function Reports() {
  const { data: borrowers, loading: bLoading } = useRealtime('borrowers', { orderBy: ['createdAt', 'desc'] });
  const { data: payments, loading: pLoading } = useRealtime('collections', { orderBy: ['paidAt', 'desc'] });
  const [tab, setTab] = useState('borrowers');

  const totalLoaned = borrowers.reduce((s, b) => s + Number(b.loanAmount || 0), 0);
  const totalCollected = borrowers.reduce((s, b) => s + Number(b.paidAmount || 0), 0);
  const totalPending = borrowers.reduce((s, b) => s + Number(b.pendingAmount || 0), 0);
  const active = borrowers.filter((b) => borrowerStatus(b) === 'Active').length;
  const overdue = borrowers.filter((b) => borrowerStatus(b) === 'Overdue').length;
  const completed = borrowers.filter((b) => borrowerStatus(b) === 'Completed').length;

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
`SGMI LendMate - Finance Report

Total Borrowers: ${borrowers.length}
Active: ${active} | Overdue: ${overdue} | Completed: ${completed}

Total Loaned: ${money(totalLoaned)}
Total Collected: ${money(totalCollected)}
Total Pending: ${money(totalPending)}

Generated: ${new Date().toLocaleDateString('en-IN')}
SGMI LendMate`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Reports</h1>
        <div className="flex gap-2">
          <button onClick={shareWhatsApp} className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-100">
            <MessageCircle size={15} /> Share
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Print
          </button>
          <button onClick={() => downloadElementPdf('report-content', 'SGMI-Report.pdf')} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700">
            <Download size={15} /> PDF
          </button>
        </div>
      </div>

      <div id="report-content" className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Borrowers" value={borrowers.length} color="bg-primary-50 text-primary-700 border-primary-200" />
          <StatCard label="Active" value={active} color="bg-amber-50 text-amber-700 border-amber-200" />
          <StatCard label="Overdue" value={overdue} color="bg-red-50 text-red-700 border-red-200" />
          <StatCard label="Completed" value={completed} color="bg-green-50 text-green-700 border-green-200" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AmountCard label="Total Loaned" value={money(totalLoaned)} sub="Principal disbursed" color="text-slate-800" />
          <AmountCard label="Total Collected" value={money(totalCollected)} sub="Payments received" color="text-green-700" />
          <AmountCard label="Total Pending" value={money(totalPending)} sub="Outstanding balance" color="text-red-600" />
        </div>

        {/* Tabs */}
        <div className="card !p-1">
          <div className="grid grid-cols-2 gap-1">
            {['Borrowers', 'Payments'].map((t) => (
              <button key={t} onClick={() => setTab(t.toLowerCase())}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${tab === t.toLowerCase() ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Borrowers Table */}
        {tab === 'borrowers' && (
          <div className="card overflow-hidden p-0">
            {bLoading ? <div className="p-6 text-center text-sm text-slate-500">Loading...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Loan</th>
                      <th className="p-3">Payable</th>
                      <th className="p-3">Paid</th>
                      <th className="p-3">Pending</th>
                      <th className="p-3">Start</th>
                      <th className="p-3">End</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrowers.map((b) => {
                      const s = borrowerStatus(b);
                      return (
                        <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="p-3 font-bold text-slate-800">{b.fullName}</td>
                          <td className="p-3 text-slate-500">{b.phone}</td>
                          <td className="p-3">{money(b.loanAmount)}</td>
                          <td className="p-3">{money(b.totalPayable ?? b.expectedReturn ?? 0)}</td>
                          <td className="p-3 font-bold text-green-700">{money(b.paidAmount)}</td>
                          <td className={`p-3 font-bold ${Number(b.pendingAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>{money(b.pendingAmount)}</td>
                          <td className="p-3 text-slate-500">{fmtDate(b.startDate)}</td>
                          <td className="p-3 text-slate-500">{fmtDate(b.endDate)}</td>
                          <td className="p-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                              s === 'Completed' ? 'bg-green-100 text-green-700' :
                              s === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {borrowers.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No borrowers found.</p>}
              </div>
            )}
          </div>
        )}

        {/* Payments Table */}
        {tab === 'payments' && (
          <div className="card overflow-hidden p-0">
            {pLoading ? <div className="p-6 text-center text-sm text-slate-500">Loading...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Borrower</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Collector</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 50).map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="p-3 text-slate-500">{fmtDate(p.collectedDate || p.paidAt)}</td>
                        <td className="p-3 font-bold text-slate-800">{p.borrowerName || '-'}</td>
                        <td className="p-3 font-bold text-green-700">{money(p.totalCollected)}</td>
                        <td className="p-3 text-slate-500">{p.collectorName || 'Admin'}</td>
                        <td className="p-3 text-slate-400 italic">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payments.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No payments found.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`card border text-center ${color}`}>
      <b className="block text-2xl">{value}</b>
      <p className="text-xs font-semibold mt-0.5">{label}</p>
    </div>
  );
}

function AmountCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <b className={`block text-xl mt-0.5 ${color}`}>{value}</b>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
