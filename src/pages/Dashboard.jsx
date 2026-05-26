import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, IndianRupee, MessageCircle, Phone, Plus, Search, Users, Wallet, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
import { addOne, increment, serverTimestamp, updateOne } from '../lib/data';
import useRealtime from '../hooks/useRealtime';
import EmptyState from '../components/EmptyState';
import { borrowerStatus, fmtDate, money, openWhatsApp, overdueDays, stepDays, todayISO, addDays, whatsappReminder, whatsappReceipt } from '../lib/finance';
import { defaultAvatar } from '../lib/photos';
import { generateReceiptHTML, shareReceiptAsImage } from '../lib/reports';

const isDueToday = (b, todayStr) => {
  if (borrowerStatus(b) === 'Completed') return false;
  if (!b.startDate || Number(b.pendingAmount || 0) <= 0) return false;
  const step = stepDays(b.financeType || 'Daily');
  const duration = Number(b.duration || 0);
  const lastDue = duration > 0 ? addDays(b.startDate, (duration - 1) * step) : b.startDate;
  if (lastDue < todayStr) return true;
  for (let i = 0; i < duration; i++) {
    const d = addDays(b.startDate, i * step);
    if (d === todayStr) return true;
    if (d > todayStr) break;
  }
  return false;
};

const fmtTime = (ts) => {
  const d = ts?.toDate ? ts.toDate() : ts?._t ? new Date(ts._t) : null;
  if (!d) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashTab, setDashTab] = useState('today');
  const [search, setSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [lastQuickCollect, setLastQuickCollect] = useState(null);
  const { data: borrowers, loading } = useRealtime('borrowers', { orderBy: ['createdAt', 'desc'] });
  const { data: rawCollections, loading: collectionsLoading } = useRealtime('collections');
  const collections = useMemo(() => {
    return [...rawCollections].sort((a, b) => {
      const tA = a.paidAt?.seconds || 0;
      const tB = b.paidAt?.seconds || 0;
      return tB - tA;
    });
  }, [rawCollections]);

  const [todayStr, setTodayStr] = useState(todayISO());

  useEffect(() => {
    const updateDate = () => setTodayStr(todayISO());
    window.addEventListener('focus', updateDate);
    window.addEventListener('visibilitychange', updateDate);
    const interval = setInterval(updateDate, 60000);
    return () => {
      window.removeEventListener('focus', updateDate);
      window.removeEventListener('visibilitychange', updateDate);
      clearInterval(interval);
    };
  }, []);

  // Simple quick collect — no slot allocation, just records a payment
  const quickCollect = async (b) => {
    const emi = Number(b.emi || 0);
    const pending = Number(b.pendingAmount || 0);
    if (emi <= 0 || pending <= 0) return;
    const amt = Math.min(emi, pending);
    try {
      await addOne('collections', {
        borrowerId: b.id, borrowerName: b.fullName,
        totalCollected: amt, collectedDate: todayStr,
        collectorName: 'Admin', notes: 'Quick collect',
        paidAt: serverTimestamp(),
      });
      const newPending = Math.max(0, pending - amt);
      await updateOne('borrowers', b.id, {
        paidAmount: increment(amt), pendingAmount: newPending,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Collected ${money(amt)} from ${b.fullName}`);
      setLastQuickCollect({ borrower: b, amt, remaining: newPending, date: todayStr });
    } catch (e) { toast.error(e.message); }
  };

  // Derived data
  const paidTodayIds = useMemo(() => {
    const ids = new Set();
    collections.forEach((c) => {
      const d = c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10);
      if (d === todayStr) ids.add(c.borrowerId);
    });
    return ids;
  }, [collections, todayStr]);

  const todayCollMap = useMemo(() => {
    const m = {};
    collections.forEach((c) => {
      const d = c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10);
      if (d === todayStr) {
        if (!m[c.borrowerId]) m[c.borrowerId] = [];
        m[c.borrowerId].push(c);
      }
    });
    return m;
  }, [collections, todayStr]);

  const activeBorrowers = useMemo(() =>
    borrowers.filter((b) => borrowerStatus(b) !== 'Completed' && borrowerStatus(b) !== 'Overpaid'), [borrowers]);

  const excessBorrowers = useMemo(() =>
    borrowers.filter((b) => borrowerStatus(b) === 'Overpaid')
      .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())),
    [borrowers, search]);

  // Overdue borrowers (repayment period ended but still pending)
  const overdueBorrowers = useMemo(() =>
    borrowers.filter((b) => borrowerStatus(b) === 'Overdue')
      .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())),
    [borrowers, search]);

  const pendingToday = useMemo(() =>
    activeBorrowers.filter((b) => isDueToday(b, todayStr) && !paidTodayIds.has(b.id))
      .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())),
    [activeBorrowers, paidTodayIds, todayStr, search]);

  const paidToday = useMemo(() =>
    activeBorrowers.filter((b) => paidTodayIds.has(b.id))
      .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())),
    [activeBorrowers, paidTodayIds, search]);

  const allRows = useMemo(() => borrowers
    .filter((b) => dashTab === 'all' ? borrowerStatus(b) !== 'Completed' : borrowerStatus(b) === 'Completed')
    .filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())),
    [borrowers, dashTab, search]);

  const collectedToday = collections
    .filter((c) => (c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10)) === todayStr)
    .reduce((s, c) => s + Number(c.totalCollected || 0), 0);
  const activeCount = activeBorrowers.length;
  const totalPending = borrowers.reduce((s, b) => s + Number(b.pendingAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard icon={<Users size={16} />} label="Active" value={activeCount} color="bg-primary-50 text-primary-700" />
        <SummaryCard icon={<IndianRupee size={16} />} label="Total Pending" value={money(totalPending)} color="bg-red-50 text-red-700" />
        <SummaryCard icon={<Wallet size={16} />} label="Collected Today" value={money(collectedToday)} color="bg-green-50 text-green-700" />
        <SummaryCard icon={<Clock size={16} />} label="Pending Today" value={pendingToday.length} color={pendingToday.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'} />
      </div>

      {/* Progress bar */}
      {(pendingToday.length + paidToday.length) > 0 && (
        <div className="card !py-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
            <span>Today's Progress</span>
            <span className="text-green-700">{paidToday.length} / {pendingToday.length + paidToday.length} collected</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-2.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.round((paidToday.length / Math.max(1, pendingToday.length + paidToday.length)) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Search + Tabs */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setDashTab('today')} className={dashTab === 'today' ? 'btn-primary' : 'btn-soft'}>Today</button>
          <button onClick={() => setDashTab('overdue')} className={dashTab === 'overdue' ? 'btn-primary' : 'btn-soft'}>
            Overdue {overdueBorrowers.length > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] font-black text-red-700">{overdueBorrowers.length}</span>}
          </button>
          <button onClick={() => setDashTab('excess')} className={dashTab === 'excess' ? 'btn-primary' : 'btn-soft'}>
            Excess Paid {excessBorrowers.length > 0 && <span className="ml-1 rounded-full bg-green-100 px-1.5 text-[10px] font-black text-green-700">{excessBorrowers.length}</span>}
          </button>
          <button onClick={() => setDashTab('all')} className={dashTab === 'all' ? 'btn-primary' : 'btn-soft'}>All Active</button>
          <button onClick={() => setDashTab('closed')} className={dashTab === 'closed' ? 'btn-primary' : 'btn-soft'}>Closed</button>
          <Link to="/borrowers/new" className="btn-primary ml-auto"><Plus size={15} /> Add</Link>
        </div>
      </div>

      {loading ? <div className="skeleton h-32" /> : (
        <>
          {/* Quick Collect Receipt Banner */}
          {lastQuickCollect && (
            <div className="card border-2 border-green-200 bg-green-50 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-green-800">✓ Collected from {lastQuickCollect.borrower.fullName}</p>
                <button onClick={() => setLastQuickCollect(null)} className="text-green-600"><span className="text-lg leading-none">×</span></button>
              </div>
              <p className="text-xs text-green-700">{money(lastQuickCollect.amt)} • Balance: {money(lastQuickCollect.remaining)} • {lastQuickCollect.borrower.phone}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { const html = generateReceiptHTML({ borrower: lastQuickCollect.borrower, amount: lastQuickCollect.amt, date: fmtDate(lastQuickCollect.date), remaining: lastQuickCollect.remaining, collectorName: 'Admin' }); shareReceiptAsImage(html, lastQuickCollect.borrower.phone, whatsappReceipt({ ...lastQuickCollect.borrower, pendingAmount: lastQuickCollect.remaining }, lastQuickCollect.amt, lastQuickCollect.date)); }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-sm font-black text-white hover:bg-green-700">
                  <MessageCircle size={14} /> WhatsApp Receipt
                </button>
                <button onClick={() => setLastQuickCollect(null)} className="rounded-xl border border-green-200 py-2 text-sm font-bold text-green-700 hover:bg-green-100">Dismiss</button>
              </div>
            </div>
          )}

          {/* TODAY TAB */}
          {dashTab === 'today' && (
            <div className="space-y-4">
              <section>
                <SectionHeader icon={<Clock size={13} />} iconBg="bg-red-100 text-red-700" title="Pending Collections" count={pendingToday.length} countColor={pendingToday.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} />
                {pendingToday.length === 0 ? (
                  <div className="card text-center py-6">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                    <p className="font-black text-green-700">All collected for today!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingToday.map((b) => (
                      <PendingCard key={b.id} b={b} onCollect={() => quickCollect(b)} onOpen={() => navigate(`/borrowers/${b.id}`)} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionHeader icon={<CheckCircle2 size={13} />} iconBg="bg-green-100 text-green-700" title="Paid Today" count={paidToday.length} countColor="bg-green-100 text-green-700" />
                {paidToday.length === 0 ? (
                  <div className="card text-center py-5 text-slate-400 text-sm">No payments collected yet today</div>
                ) : (
                  <div className="space-y-2">
                    {(allExpanded ? paidToday : paidToday.slice(0, 5)).map((b) => (
                      <PaidCard key={b.id} b={b} todayCols={todayCollMap[b.id] || []} onOpen={() => navigate(`/borrowers/${b.id}`)} />
                    ))}
                    {paidToday.length > 5 && (
                      <button onClick={() => setAllExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-slate-500 hover:text-primary-700">
                        {allExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show {paidToday.length - 5} more</>}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* OVERDUE TAB */}
          {dashTab === 'overdue' && (
            <div className="space-y-3">
              <SectionHeader icon={<AlertTriangle size={13} />} iconBg="bg-red-100 text-red-700" title="Repayment Period Over" count={overdueBorrowers.length} countColor="bg-red-100 text-red-700" />
              {overdueBorrowers.length === 0 ? (
                <div className="card text-center py-6 text-slate-400 text-sm">No overdue borrowers</div>
              ) : (
                <div className="space-y-2">
                  {overdueBorrowers.map((b) => (
                    <OverdueCard key={b.id} b={b} onOpen={() => navigate(`/borrowers/${b.id}`)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXCESS PAID TAB */}
          {dashTab === 'excess' && (
            <div className="space-y-3">
              <SectionHeader icon={<CheckCircle2 size={13} />} iconBg="bg-green-100 text-green-700" title="Borrowers with Excess Payments" count={excessBorrowers.length} countColor="bg-green-100 text-green-700" />
              {excessBorrowers.length === 0 ? (
                <div className="card text-center py-6 text-slate-400 text-sm">No borrowers with excess payment</div>
              ) : (
                <div className="space-y-2">
                  {excessBorrowers.map((b) => (
                    <BorrowerCard key={b.id} b={b} paidToday={paidTodayIds.has(b.id)} onCollect={() => quickCollect(b)} onOpen={() => navigate(`/borrowers/${b.id}`)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ALL ACTIVE / CLOSED */}
          {(dashTab === 'all' || dashTab === 'closed') && (
            <div className="space-y-3">
              {allRows.length ? allRows.map((b) => (
                <BorrowerCard key={b.id} b={b} paidToday={paidTodayIds.has(b.id)} onCollect={() => quickCollect(b)} onOpen={() => navigate(`/borrowers/${b.id}`)} />
              )) : <EmptyState title={dashTab === 'all' ? 'No active borrowers' : 'No closed borrowers'} message="Tap + Add to begin." />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ icon, iconBg, title, count, countColor }) {
  return (
    <div className="flex items-center justify-between mb-2 px-0.5">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${iconBg}`}>{icon}</span>
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${countColor}`}>{count}</span>
    </div>
  );
}

function PendingCard({ b, onCollect, onOpen }) {
  const emi = Number(b.emi || 0);
  const pending = Number(b.pendingAmount || 0);
  const amt = Math.min(emi, pending);
  const isOverdue = borrowerStatus(b) === 'Overdue';
  const photo = b.photoUrl || defaultAvatar;
  return (
    <div className={`card border-l-4 ${isOverdue ? 'border-red-500' : 'border-amber-400'} cursor-pointer hover:shadow-md transition`} onClick={onOpen}>
      <div className="flex items-center gap-3">
        <img src={photo} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-slate-900 truncate">{b.fullName}</p>
            {isOverdue && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">Overdue</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span>EMI: <b className="text-slate-700">{money(emi)}</b></span>
            <span>Bal: <b className="text-red-600">{money(pending)}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); openWhatsApp(b.phone, whatsappReminder(b)); }}
            className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100"><MessageCircle size={13} /></button>
          <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Phone size={13} /></a>
          <button onClick={(e) => { e.stopPropagation(); onCollect(); }}
            className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white hover:bg-primary-700 active:scale-95 transition-transform">
            <Zap size={12} /> {money(amt)}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaidCard({ b, todayCols, onOpen }) {
  const totalAmt = todayCols.reduce((s, c) => s + Number(c.totalCollected || 0), 0);
  const latestCol = todayCols[0];
  const time = latestCol ? fmtTime(latestCol.paidAt) : '';
  const photo = b.photoUrl || defaultAvatar;
  return (
    <div className="card border-l-4 border-green-500 cursor-pointer hover:shadow-md transition" onClick={onOpen}>
      <div className="flex items-center gap-3">
        <img src={photo} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 truncate">{b.fullName}</p>
          <p className="text-xs text-slate-500">{b.phone}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Phone size={13} /></a>
          <div className="text-right shrink-0">
            <p className="font-black text-green-700">{money(totalAmt)}</p>
            {time && <p className="text-[11px] text-slate-400">{time}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverdueCard({ b, onOpen }) {
  const pending = Number(b.pendingAmount || 0);
  const paid = Number(b.paidAmount || 0);
  const payable = Number(b.totalPayable ?? b.expectedReturn ?? 0);
  const days = overdueDays(b);
  const photo = b.photoUrl || defaultAvatar;
  return (
    <div className="card border-l-4 border-red-500 cursor-pointer hover:shadow-md transition" onClick={onOpen}>
      <div className="flex items-center gap-3">
        <img src={photo} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 truncate">{b.fullName}</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500">
            <span>Payable: <b className="text-slate-700">{money(payable)}</b></span>
            <span>Paid: <b className="text-green-700">{money(paid)}</b></span>
            <span>Bal: <b className="text-red-600 font-bold">{money(pending)}</b></span>
            <span>Overdue: <b className="text-red-600">{days} days</b></span>
            {b.extensionEmi && (
              <span className="col-span-2 text-primary-700 font-semibold">Extended EMI: {money(b.extensionEmi)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); openWhatsApp(b.phone, whatsappReminder(b)); }}
            className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100"><MessageCircle size={13} /></button>
          <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Phone size={13} /></a>
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700">Extend</button>
        </div>
      </div>
    </div>
  );
}

function BorrowerCard({ b, paidToday, onCollect, onOpen }) {
  const paid = Number(b.paidAmount || 0);
  const pending = Number(b.pendingAmount || 0);
  const emi = Number(b.emi || 0);
  const expected = Number(b.totalPayable ?? b.expectedReturn ?? 0) || 1;
  const progress = Math.min(100, Math.round((paid / expected) * 100));
  const status = borrowerStatus(b);
  const photo = b.photoUrl || defaultAvatar;
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className="card cursor-pointer space-y-3 transition hover:border-primary-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-200">
      <div className="flex items-center gap-3">
        <img src={photo} alt="" className="h-11 w-11 rounded-xl object-cover border border-slate-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate text-base font-black text-slate-900">{b.fullName}</h3>
            {paidToday && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">Paid</span>}
            {status === 'Overdue' && !paidToday && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">Overdue</span>}
          </div>
          <p className="text-xs text-slate-500">{b.phone}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={(e) => { stop(e); openWhatsApp(b.phone, whatsappReminder(b)); }}
            className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100"><MessageCircle size={12} /></button>
          <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Phone size={12} /></a>
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Progress</span><span>{progress}%</span></div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${status === 'Completed' ? 'bg-green-500' : 'bg-primary-600'}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">Paid: <b className="text-green-700">{money(paid)}</b></span>
        <span className="text-slate-600">Balance: <b className={pending > 0 ? 'text-red-600' : 'text-green-600'}>{money(pending)}</b></span>
      </div>
      {emi > 0 && pending > 0 && !paidToday && (
        <button onClick={(e) => { stop(e); onCollect(); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-black text-white hover:bg-primary-700 active:scale-[0.98] transition-transform">
          <Zap size={14} /> Collect {money(Math.min(emi, pending))}
        </button>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className={`card flex items-center gap-3 p-3 ${color}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold opacity-70 truncate">{label}</p>
        <p className="text-base font-black leading-tight">{value}</p>
      </div>
    </div>
  );
}
