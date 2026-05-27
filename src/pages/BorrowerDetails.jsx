import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BarChart2, Bell, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Edit2, Image, MessageCircle, Pencil, Phone, Printer, Trash2, X, XCircle, Zap } from 'lucide-react';
import PerformanceTracker from '../components/PerformanceTracker';
import EditPaymentModal from '../components/EditPaymentModal';
import PaymentReminder from '../components/PaymentReminder';
import { toast } from 'react-toastify';
import { addOne, deleteOne, getOne, increment, serverTimestamp, setOne, updateOne } from '../lib/data';
import useRealtime from '../hooks/useRealtime';
import EmptyState from '../components/EmptyState';
import { addDays, borrowerStatus, buildSchedule, fmtDate, generateExtensionSchedule, missedPayments, money, openWhatsApp, overdueDays, scheduleAnalytics, stepDays, todayISO, whatsappLoanSummary, whatsappOverdueReminder, whatsappReceipt, whatsappReminder } from '../lib/finance';
import { generateReceiptHTML, generateLoanSummaryHTML, generateScoreHTML, printReceipt, shareReceiptAsImage, generatePaymentHistoryHTML } from '../lib/reports';
import { defaultAvatar, uploadBorrowerPhoto } from '../lib/photos';

export default function BorrowerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState(null);
  const [tab, setTab] = useState('collect');
  const [amount, setAmount] = useState('');
  const [collectedDate, setCollectedDate] = useState(todayISO());
  const [emiDueDate, setEmiDueDate] = useState('');
  const [collectorName, setCollectorName] = useState('Admin');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extType, setExtType] = useState('Monthly');
  const [extDuration, setExtDuration] = useState('3');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [editCollection, setEditCollection] = useState(null);
  const [lastCollected, setLastCollected] = useState(null);
  const [showReminder, setShowReminder] = useState(false);

  const { data: slotRecords } = useRealtime('payments', { where: ['borrowerId', '==', id], orderBy: ['slotIndex', 'asc'] });
  const { data: collections } = useRealtime('collections', { where: ['borrowerId', '==', id], orderBy: ['paidAt', 'desc'] });

  const load = () => getOne('borrowers', id).then((b) => setBorrower(b));
  
  useEffect(() => { 
    load(); 
  }, [id]);
  
  // Auto-reload borrower when collections or slotRecords change (real-time refresh)
  // Use JSON.stringify to detect actual data changes, not just length changes
  useEffect(() => {
    if (collections.length > 0 || slotRecords.length > 0) {
      load();
    }
  }, [JSON.stringify(collections.map(c => c.id + c.totalCollected + c.collectedDate)), 
      JSON.stringify(slotRecords.map(s => s.id + s.paidAmount + s.collectedDate))]);

  if (!borrower) return <div className="skeleton h-96" />;

  const status = borrowerStatus(borrower);
  const totalPaid = Number(borrower.paidAmount || 0);
  const totalPending = Number(borrower.pendingAmount || 0);
  const emi = Number(borrower.emi || 0);
  const today = todayISO();
  const schedule = buildSchedule(borrower, slotRecords);
  const analytics = scheduleAnalytics(schedule);
  const missed = missedPayments(schedule);
  const overdue = overdueDays(borrower);
  const photoUrl = borrower.photoUrl || defaultAvatar;

  // ── Collect Payment ──
  const collectPayment = async () => {
    const amt = Math.round(Number(amount));
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    
    // Validate EMI Due Date is selected
    if (!emiDueDate) return toast.error('Please select EMI Due Date');
    
    // Block collection before loan start date
    if (borrower.startDate && collectedDate < borrower.startDate)
      return toast.error(`Cannot collect before loan start date (${fmtDate(borrower.startDate)})`);
    
    if (busy) return;
    setBusy(true);
    
    try {
      // Reload to get latest collections
      await load();
      
      // Check for duplicate payment on same EMI due date (not collection date)
      const sameDueDatePayment = slotRecords.some((s) => s.dueDate === emiDueDate && s.paidAmount > 0);
      if (sameDueDatePayment) {
        toast.error(`Payment already recorded for EMI due on ${fmtDate(emiDueDate)}. Choose a different EMI date.`);
        setBusy(false);
        return;
      }
      
      // Find the slot by matching the selected EMI due date
      const targetSlot = schedule.find((s) => s.dueDate === emiDueDate);
      
      if (!targetSlot) {
        toast.error(`No EMI slot found for due date ${fmtDate(emiDueDate)}`);
        setBusy(false);
        return;
      }
      
      // Record the collection with both dates
      await addOne('collections', {
        borrowerId: id, borrowerName: borrower.fullName,
        totalCollected: amt, 
        collectedDate: collectedDate, // Actual collection date (today)
        emiDueDate: emiDueDate, // EMI due date (can be future)
        collectorName,
        notes: notes || '', 
        paidAt: serverTimestamp(),
      });
      
      // Create/update payment record for the selected slot
      await setOne('payments', `${id}_slot_${targetSlot.slotIndex}`, {
        borrowerId: id, borrowerName: borrower.fullName,
        slotIndex: targetSlot.slotIndex,
        dueDate: emiDueDate, // EMI due date
        emiAmount: targetSlot.emiAmount,
        paidAmount: amt, // Store payment amount
        collectedDate: collectedDate, // Actual collection date
        actualCollectionDate: collectedDate, // Store separately for clarity
        paymentType: amt >= targetSlot.emiAmount ? 'Paid' : 'Partial',
        notes: notes || '',
        paidAt: serverTimestamp(),
      });
      
      // Update borrower totals
      const newPending = totalPending - amt;
      const newStatus = newPending < 0 ? 'Overpaid' : borrower.status || 'Active';
      await updateOne('borrowers', id, {
        paidAmount: increment(amt), pendingAmount: newPending,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      toast.success(`Collected ${money(amt)} for EMI due ${fmtDate(emiDueDate)}`);
      setLastCollected({ amt, date: collectedDate, emiDueDate, remaining: newPending });
      setAmount(''); setNotes(''); setCollectedDate(todayISO()); setEmiDueDate('');
      // No need to call load() - useEffect will auto-refresh when collections update
    } catch (e) { 
      console.error('Collection error:', e);
      toast.error(e.message); 
    }
    
    setBusy(false);
  };

  // ── Manual Extend ──
  const applyExtension = async () => {
    const dur = Number(extDuration);
    if (!dur || dur <= 0) return toast.error('Enter valid duration');
    if (totalPending <= 0) return toast.error('No pending balance to extend');

    // Recalculate EMI using TOTAL PAYABLE AMOUNT again based on extension duration
    const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
    const newEmi = Math.ceil(totalPayable / dur);
    const extStepDays = stepDays(extType);

    // Save Extension History entry
    const newHistoryEntry = {
      originalDuration: Number(borrower.duration || 0),
      extendedDuration: dur,
      extensionDate: today,
      newEmi,
      extensionType: extType,
    };
    const updatedHistory = borrower.extensionHistory ? [...borrower.extensionHistory, newHistoryEntry] : [newHistoryEntry];

    // Generate slots from today, dur slots apart by extStepDays
    const baseIdx = Number(borrower.duration || 0);
    const slots = [];
    for (let i = 0; i < dur; i++) {
      slots.push({
        slotIndex: baseIdx + i,
        dueDate: addDays(today, (i + 1) * extStepDays),
        emiAmount: newEmi,
      });
    }
    const newEndDate = slots[slots.length - 1]?.dueDate || today;

    try {
      for (const slot of slots) {
        await setOne('payments', `${id}_slot_${slot.slotIndex}`, {
          borrowerId: id, borrowerName: borrower.fullName,
          slotIndex: slot.slotIndex, dueDate: slot.dueDate,
          emiAmount: slot.emiAmount, paidAmount: 0,
          collectedDate: null, paymentType: 'Pending',
          notes: 'Extension EMI', paidAt: serverTimestamp(),
        });
      }
      await updateOne('borrowers', id, {
        extensionType: extType, extensionDuration: dur,
        extensionEmi: newEmi, extensionEndDate: newEndDate,
        endDate: newEndDate, emi: newEmi,
        duration: baseIdx + dur,
        extensionHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Extended by ${dur} ${extType === 'Monthly' ? 'months' : 'days'} — new EMI: ${money(newEmi)}`);
      setShowExtend(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  // ── Photo Upload ──
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    setPhotoUploading(true);
    try {
      const url = await uploadBorrowerPhoto(id, file);
      await updateOne('borrowers', id, { photoUrl: url, updatedAt: serverTimestamp() });
      toast.success('Photo updated successfully');
      load();
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error(err.message || 'Photo upload failed. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this borrower and all their data?')) return;
    await deleteOne('borrowers', id);
    toast.success('Borrower deleted'); navigate('/');
  };

  return (
    <div className="space-y-4">
      {/* Header with photo */}
      <div className="card space-y-3">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img 
              src={photoUrl} 
              alt={borrower.fullName} 
              className="h-14 w-14 rounded-2xl object-cover border border-slate-200"
              onError={(e) => {
                // Fallback to default avatar if image fails to load
                if (e.target.src !== defaultAvatar) {
                  e.target.src = defaultAvatar;
                }
              }}
            />
            <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-700">
              <Image size={11} />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black truncate">{borrower.fullName}</h1>
              <span className={`badge shrink-0 ${status === 'Overdue' ? 'bg-red-50 text-red-700' : status === 'Completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <a href={`tel:${borrower.phone}`} className="flex items-center gap-1 text-sm text-primary-700"><Phone size={13} /> {borrower.phone}</a>
              <button onClick={() => setShowReminder(true)} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                <Bell size={12} /> Remind
              </button>
              <button onClick={() => openWhatsApp(borrower.phone, whatsappReminder(borrower))} className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700 hover:bg-green-100">
                <MessageCircle size={12} /> WhatsApp
              </button>
            </div>
          </div>
          <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-slate-100 shrink-0"><X size={18} /></button>
        </div>

        {/* Balance strip */}
        <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center">
          <div><p className="text-[10px] text-slate-500">Loan</p><b className="text-xs">{money(borrower.loanAmount)}</b></div>
          <div><p className="text-[10px] text-slate-500">Paid</p><b className="text-xs text-green-700">{money(totalPaid)}</b></div>
          <div><p className="text-[10px] text-slate-500">Remaining</p><b className={`text-xs ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>{money(totalPending)}</b></div>
          <div><p className="text-[10px] text-slate-500">Missed</p><b className={`text-xs ${missed > 0 ? 'text-red-600' : 'text-slate-700'}`}>{missed}</b></div>
        </div>

        {/* Overdue alert */}
        {status === 'Overdue' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-sm font-black text-red-700">Repayment Overdue</p>
            </div>
            <p className="text-xs text-red-600">Repayment duration completed but borrower still has pending payment.</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white p-1.5"><p className="text-[10px] text-slate-500">Balance</p><b className="text-xs text-red-700">{money(totalPending)}</b></div>
              <div className="rounded-lg bg-white p-1.5"><p className="text-[10px] text-slate-500">Overdue</p><b className="text-xs text-red-700">{overdue} days</b></div>
              <div className="rounded-lg bg-white p-1.5"><p className="text-[10px] text-slate-500">Missed</p><b className="text-xs text-red-700">{missed}</b></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowExtend(true)} className="rounded-xl bg-red-600 py-2.5 text-sm font-black text-white hover:bg-red-700">
                Extend Repayment
              </button>
              <button onClick={() => openWhatsApp(borrower.phone, whatsappOverdueReminder(borrower))} className="flex items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 text-sm font-black text-white hover:bg-green-700">
                <MessageCircle size={14} /> Remind
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card !p-1">
        <div className="grid grid-cols-5 gap-1">
          {['Collect', 'Schedule', 'Details', 'History', 'Score'].map((l) => (
            <TabBtn key={l} active={tab === l.toLowerCase()} onClick={() => setTab(l.toLowerCase())} label={l} />
          ))}
        </div>
      </div>

      {/* ── COLLECT TAB ── */}
      {tab === 'collect' && (
        <div className="space-y-3">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-slate-800">Collect Payment</b>
              <span className="bg-primary-50 text-primary-700 rounded-lg px-2 py-1 text-xs font-bold">EMI {money(emi)}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[[`1×`, emi], [`2×`, emi*2], [`5×`, emi*5], ['Full', totalPending]].map(([label, v]) => (
                <button key={label} type="button" onClick={() => setAmount(String(v))}
                  className={`rounded-xl border px-2 py-2 text-center text-xs font-bold transition ${
                    Number(amount) === v ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-primary-300'}`}>
                  {label}<br /><span className="font-normal text-[10px] text-slate-400">{money(v)}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="label">Amount (₹)</label>
              <input className="input" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">EMI Due Date *</label>
              <select className="input" value={emiDueDate} onChange={(e) => setEmiDueDate(e.target.value)} required>
                <option value="">Select EMI Due Date</option>
                {schedule.filter(s => !s.isFullyPaid).map((s) => (
                  <option key={s.slotIndex} value={s.dueDate}>
                    {fmtDate(s.dueDate)} - EMI #{s.no} ({s.paidAmount > 0 ? `Partial: ${money(s.paidAmount)}/${money(s.emiAmount)}` : money(s.emiAmount)})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Select which EMI installment this payment is for</p>
            </div>
            <div>
              <label className="label">Actual Collection Date</label>
              <input type="date" className="input" value={collectedDate} onChange={(e) => setCollectedDate(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Date when payment was actually collected (today: {fmtDate(todayISO())})</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Notes</label><input className="input" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div><label className="label">Collector</label><input className="input" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} /></div>
            </div>

            <button onClick={collectPayment} disabled={!amount || busy || borrower.status === 'Completed' || borrower.status === 'Closed'} className="btn-primary w-full disabled:opacity-40">
              {busy ? 'Processing...' : <><Zap size={15} /> Collect {money(Number(amount) || 0)}</>}
            </button>

            {/* WhatsApp receipt after collecting */}
            {lastCollected && (
              <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-green-800">✓ Payment Collected!</p>
                  <button onClick={() => setLastCollected(null)} className="text-green-600 hover:text-green-800"><X size={14} /></button>
                </div>
                <div className="space-y-1 text-xs text-green-700">
                  <p><span className="font-semibold">Amount:</span> ₹{lastCollected.amt.toLocaleString('en-IN')}</p>
                  <p><span className="font-semibold">Collected on:</span> {fmtDate(lastCollected.date)}</p>
                  <p><span className="font-semibold">EMI Due Date:</span> {fmtDate(lastCollected.emiDueDate)}</p>
                  <p><span className="font-semibold">Balance:</span> ₹{lastCollected.remaining.toLocaleString('en-IN')}</p>
                  <p><span className="font-semibold">Phone:</span> {borrower.phone}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const html = generateReceiptHTML({ borrower, amount: lastCollected.amt, date: fmtDate(lastCollected.date), remaining: lastCollected.remaining, collectorName });
                      shareReceiptAsImage(html, borrower.phone, whatsappReceipt({ ...borrower, pendingAmount: lastCollected.remaining }, lastCollected.amt, lastCollected.date));
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-black text-white hover:bg-green-700">
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button
                    onClick={() => { const html = generateReceiptHTML({ borrower, amount: lastCollected.amt, date: fmtDate(lastCollected.date), remaining: lastCollected.remaining, collectorName }); printReceipt(html); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-white border border-green-200 py-2.5 text-sm font-black text-green-700 hover:bg-green-50">
                    <Printer size={14} /> Print
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Remaining balance card */}
          <div className="card">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-500">Total Payable</p><b className="text-base">{money(borrower.totalPayable ?? borrower.expectedReturn)}</b></div>
              <div><p className="text-xs text-slate-500">Total Paid</p><b className="text-base text-green-700">{money(totalPaid)}</b></div>
              <div>
                <p className="text-xs text-slate-500">{totalPending < 0 ? 'Excess Paid' : 'Remaining Balance'}</p>
                <b className={`text-base ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalPending < 0 ? `+${money(Math.abs(totalPending))}` : money(totalPending)}
                </b>
              </div>
              <div><p className="text-xs text-slate-500">Overdue Days</p><b className={`text-base ${overdue > 0 ? 'text-red-600' : 'text-slate-700'}`}>{overdue}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Paid', val: analytics.paid, color: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Partial', val: analytics.partial, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Missed', val: analytics.missed, color: 'bg-red-50 text-red-700 border-red-200' },
              { label: 'Pending', val: analytics.upcoming + analytics.todayDue, color: 'bg-slate-50 text-slate-600 border-slate-200' },
            ].map(({ label, val, color }) => (
              <div key={label} className={`rounded-xl border p-2 text-center ${color}`}>
                <b className="block text-xl leading-tight">{val}</b>
                <span className="text-[10px] font-semibold">{label}</span>
              </div>
            ))}
          </div>

          {/* Extend button — always show when pending > 0 */}
          {totalPending > 0 && (
            <button onClick={() => setShowExtend(true)}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition ${
                status === 'Overdue'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border-2 border-dashed border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}>
              <Calendar size={15} /> {status === 'Overdue' ? '⚠ Extend Overdue Repayment' : 'Extend Repayment Schedule'}
            </button>
          )}

          {/* Schedule cards */}
          <div className="space-y-2">
            {schedule.length ? schedule.map((s) => (
              <SlotCard key={s.slotIndex} slot={s} borrowerId={id} borrower={borrower} onRefresh={load} />
            )) : <EmptyState title="No schedule generated yet" message="Loan must have a start date and duration." />}
          </div>
        </div>
      )}

      {/* ── DETAILS TAB ── */}
      {tab === 'details' && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <Row k="Phone" v={<a href={`tel:${borrower.phone}`} className="text-primary-700">{borrower.phone}</a>} />
            {borrower.alternatePhone && <Row k="Alt Phone" v={borrower.alternatePhone} />}
            <Row k="Address" v={borrower.address} />
          </div>
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <b>Loan Details</b>
              <Link to={`/borrowers/${id}/edit`} className="flex items-center gap-1 text-sm font-bold text-primary-700"><Edit2 size={14} /> Edit</Link>
            </div>
            <Row k="Finance Type" v={borrower.financeType || 'Daily'} />
            <Row k="Duration" v={`${borrower.duration || 0} installments`} />
            <Row k="Loan Amount" v={money(borrower.loanAmount)} />
            <Row k="Total Interest" v={money(borrower.totalInterest ?? borrower.interest ?? 0)} />
            <Row k="Deducted" v={money(borrower.deductedAmount || 0)} />
            <Row k="Net Given" v={<b className="text-primary-700">{money(borrower.netAmountGiven ?? borrower.loanAmount)}</b>} />
            <Row k="Total Payable" v={<b className="text-primary-700">{money(borrower.totalPayable ?? borrower.expectedReturn)}</b>} />
            <Row k="EMI" v={<b className="text-primary-700">{money(emi)} / {borrower.financeType === 'Weekly' ? 'week' : borrower.financeType === 'Monthly' ? 'month' : 'day'}</b>} />
            <Row k="Start" v={fmtDate(borrower.startDate)} />
            <Row k="End" v={fmtDate(borrower.endDate)} />
          </div>
          {/* Close/Reopen manual action */}
          <div className="card space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loan Actions</p>
            {borrower.status === 'Completed' || borrower.status === 'Closed' ? (
              <button
                onClick={async () => {
                  try {
                    await updateOne('borrowers', id, { status: 'Active', updatedAt: serverTimestamp() });
                    toast.success('Loan marked as Active');
                    load();
                  } catch (e) { toast.error(e.message); }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-3 text-sm font-black text-white hover:bg-amber-600 transition">
                Reopen Loan (Mark Active)
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (totalPending > 0 && !confirm('Borrower still has pending balance. Force close anyway?')) return;
                  try {
                    await updateOne('borrowers', id, { status: 'Completed', updatedAt: serverTimestamp() });
                    toast.success('Loan manually Closed successfully');
                    load();
                  } catch (e) { toast.error(e.message); }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 py-3 text-sm font-black text-white hover:bg-green-700 transition">
                Close Loan (Mark Completed)
              </button>
            )}
          </div>

          {/* Extension History Card */}
          {borrower.extensionHistory && borrower.extensionHistory.length > 0 && (
            <div className="card space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Repayment Extension History</p>
              <div className="divide-y divide-slate-100">
                {borrower.extensionHistory.map((h, i) => (
                  <div key={i} className="py-2 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Extension #{i + 1} ({h.extensionType})</span>
                      <span className="text-primary-600">{fmtDate(h.extensionDate)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-slate-500">
                      <span>Orig: {h.originalDuration} EMIs</span>
                      <span>Ext: +{h.extendedDuration} EMIs</span>
                      <span className="text-right">EMI: <b>{money(h.newEmi)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card flex flex-wrap gap-2">
            <button onClick={() => { const html = generateLoanSummaryHTML(borrower); printReceipt(html); }} className="btn-soft flex-1"><Printer size={15} /> Print</button>
            <button onClick={() => openWhatsApp(borrower.phone, whatsappLoanSummary(borrower))} className="btn-soft flex-1 !text-green-700 !bg-green-50"><MessageCircle size={15} /> Share Summary</button>
            <button onClick={() => openWhatsApp(borrower.phone, whatsappReminder(borrower))} className="btn-soft flex-1 !text-green-700 !bg-green-50"><MessageCircle size={15} /> Remind</button>
          </div>
          <button onClick={remove} className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-red-600"><Trash2 size={15} /> Delete Borrower</button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-slate-800">Payment History</b>
            <span className="text-xs text-slate-500">{collections.length} records</span>
          </div>

          {/* Ledger Statement actions */}
          {collections.length > 0 && (
            <div className="card flex gap-2 !py-2.5 bg-primary-50/50 border border-primary-100">
              <button
                onClick={() => {
                  const html = generatePaymentHistoryHTML(borrower, collections);
                  printReceipt(html);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-primary-200 py-2 text-xs font-black text-primary-700 hover:bg-primary-50 shadow-sm transition">
                <Printer size={13} /> Print Statement
              </button>
              <button
                onClick={() => {
                  const html = generatePaymentHistoryHTML(borrower, collections);
                  shareReceiptAsImage(html, borrower.phone, `Hi *${borrower.fullName}*, sharing your full payment history and transaction ledger ledger statement.`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-xs font-black text-white hover:bg-green-700 shadow-sm transition">
                <MessageCircle size={13} /> WhatsApp Statement
              </button>
            </div>
          )}

          {collections.length ? collections.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-base">{money(c.totalCollected)}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold">Collected on:</span> {fmtDate(c.collectedDate)}
                    </p>
                    {c.emiDueDate && (
                      <p className="text-xs text-primary-600">
                        <span className="font-semibold">EMI Due Date:</span> {fmtDate(c.emiDueDate)}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{c.collectorName || 'Admin'}</p>
                  </div>
                  {c.notes && <p className="text-xs italic text-slate-400 mt-1">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { const html = generateReceiptHTML({ borrower, amount: c.totalCollected, date: fmtDate(c.collectedDate), remaining: Math.max(0, totalPending), collectorName: c.collectorName }); printReceipt(html); }}
                    title="Print" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Printer size={14} /></button>
                  <button onClick={() => { const html = generateReceiptHTML({ borrower, amount: c.totalCollected, date: fmtDate(c.collectedDate), remaining: Math.max(0, totalPending), collectorName: c.collectorName }); shareReceiptAsImage(html, borrower.phone, whatsappReceipt(borrower, c.totalCollected, c.collectedDate)); }}
                    title="WhatsApp" className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100"><MessageCircle size={14} /></button>
                </div>
              </div>
            </div>
          )) : <EmptyState title="No payments yet" message="Collect a payment to see history." />}
        </div>
      )}

      {/* ── SCORE TAB ── */}
      {tab === 'score' && (
        <PerformanceTracker borrower={borrower} payments={slotRecords} onClose={() => setTab('collect')} inline />
      )}

      {/* ── Edit Collection Modal ── */}
      {editCollection && (
        <EditCollectionModal
          collection={editCollection}
          borrowerId={id}
          onClose={() => setEditCollection(null)}
          onSaved={() => { setEditCollection(null); load(); }}
        />
      )}

      {/* ── Extension Modal ── */}
      {showExtend && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h2 className="text-base font-black">Extend Repayment</h2>
                <p className="text-xs text-slate-500">Total pending: <b className="text-red-600">{money(totalPending)}</b></p>
              </div>
              <button onClick={() => setShowExtend(false)} className="rounded-full p-1.5 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-4 p-4">
              {/* EMI Type selector */}
              <div>
                <label className="label">EMI Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Daily', 'Monthly'].map((t) => (
                    <button key={t} type="button" onClick={() => setExtType(t)}
                      className={`rounded-xl border-2 py-3 text-sm font-black transition ${
                        extType === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-primary-200'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              {/* Duration */}
              <div>
                <label className="label">Duration ({extType === 'Monthly' ? 'months' : 'days'})</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(extType === 'Monthly' ? [1,2,3,6] : [7,14,30,60]).map((v) => (
                    <button key={v} type="button" onClick={() => setExtDuration(String(v))}
                      className={`rounded-xl border py-2 text-sm font-bold ${
                        extDuration === String(v) ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-primary-200'
                      }`}>{v}</button>
                  ))}
                </div>
                <input className="input" inputMode="numeric" placeholder="Or enter custom..." value={extDuration} onChange={(e) => setExtDuration(e.target.value)} />
              </div>
              {/* Preview */}
              {Number(extDuration) > 0 && (() => {
                const dur = Number(extDuration);
                const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
                const extStepDays = stepDays(extType);
                const newEmi = Math.ceil(totalPayable / dur);
                const newEndDate = fmtDate(addDays(today, dur * extStepDays));
                return (
                  <div className="rounded-2xl border-2 border-primary-200 bg-primary-50 p-4 space-y-2">
                    <p className="text-sm font-black text-primary-800">Extension Preview</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-slate-500">Total Payable</p><b className="text-slate-800">{money(totalPayable)}</b></div>
                      <div><p className="text-xs text-slate-500">Duration</p><b>{dur} {extType === 'Monthly' ? 'month(s)' : 'day(s)'}</b></div>
                      <div><p className="text-xs text-slate-500">New EMI ({extType})</p><b className="text-primary-700 text-base">{money(newEmi)}</b></div>
                      <div><p className="text-xs text-slate-500">Remaining Balance</p><b className="text-red-600">{money(totalPending)}</b></div>
                      <div className="col-span-2"><p className="text-xs text-slate-500">New End Date</p><b className="text-primary-700">{newEndDate}</b></div>
                    </div>
                  </div>
                );
              })()}
              <button onClick={applyExtension} disabled={!extDuration || Number(extDuration) <= 0} className="btn-primary w-full disabled:opacity-40">
                Apply Extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Reminder Modal ── */}
      {showReminder && <PaymentReminder borrower={borrower} onClose={() => setShowReminder(false)} />}
    </div>
  );
}

function SlotCard({ slot, borrowerId, borrower, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [editPaid, setEditPaid] = useState(String(slot.paidAmount || ''));
  const [editDate, setEditDate] = useState(slot.collectedDate || todayISO());
  const [editNotes, setEditNotes] = useState(slot.record?.notes || '');
  const [saving, setSaving] = useState(false);

  const cfgMap = {
    paid:    { border: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700', label: 'Paid' },
    partial: { border: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'Partial' },
    today:   { border: 'border-primary-400 bg-primary-50 ring-1 ring-primary-200', badge: 'bg-primary-100 text-primary-700', label: 'Due Today' },
    overdue: { border: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Overdue' },
    pending: { border: 'border-slate-200 bg-white', badge: 'bg-slate-100 text-slate-500', label: 'Pending' },
  };
  const cfg = cfgMap[slot.state] || cfgMap.pending;
  const pct = slot.emiAmount > 0 ? Math.min(100, Math.round((slot.paidAmount / slot.emiAmount) * 100)) : 0;

  const saveEdit = async () => {
    const newPaid = Math.round(Number(editPaid));
    if (isNaN(newPaid) || newPaid < 0) return toast.error('Enter valid amount');
    if (newPaid > slot.emiAmount) return toast.error(`Max is ${money(slot.emiAmount)}`);
    setSaving(true);
    try {
      const delta = newPaid - (slot.paidAmount || 0);
      await setOne('payments', `${borrowerId}_slot_${slot.slotIndex}`, {
        borrowerId, borrowerName: borrower.fullName,
        slotIndex: slot.slotIndex, dueDate: slot.dueDate,
        emiAmount: slot.emiAmount, paidAmount: newPaid,
        collectedDate: editDate,
        paymentType: newPaid >= slot.emiAmount ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending',
        notes: editNotes || '', paidAt: serverTimestamp(),
      });
      if (delta !== 0) {
        await updateOne('borrowers', borrowerId, {
          paidAmount: increment(delta),
          pendingAmount: increment(-delta),
          updatedAt: serverTimestamp(),
        });
      }
      toast.success('Slot updated');
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className={`rounded-2xl border p-3 text-sm transition ${cfg.border}`}>
      {/* Slot header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400">#{slot.no}</span>
          {slot.isExtended && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">Ext</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-slate-600">{fmtDate(slot.dueDate)}</span>
          <button onClick={() => setEditing(!editing)}
            className="ml-1 rounded-lg bg-slate-100 p-1 text-slate-500 hover:bg-primary-50 hover:text-primary-700">
            <Pencil size={12} />
          </button>
        </div>
      </div>

      {/* Amount + progress */}
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-slate-600">EMI: <b>{money(slot.emiAmount)}</b></span>
        <span className="text-slate-600">Paid: <b className={slot.isFullyPaid ? 'text-green-700' : slot.paidAmount > 0 ? 'text-amber-600' : 'text-slate-400'}>{money(slot.paidAmount)}</b></span>
        {slot.pendingAmount > 0 && <span className="text-red-600 font-bold">Due: {money(slot.pendingAmount)}</span>}
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${slot.isFullyPaid ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
          style={{ width: `${pct}%` }} />
      </div>
      {slot.collectedDate && (
        <div className="mt-1 space-y-0.5">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold">EMI Due:</span> {fmtDate(slot.dueDate)}
          </p>
          <p className="text-[11px] text-green-600 font-semibold">
            <span className="font-semibold">Collected:</span> {fmtDate(slot.collectedDate)}
          </p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Paid Amount</label>
              <input className="input !py-1.5 text-sm" inputMode="numeric"
                value={editPaid} onChange={(e) => setEditPaid(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Collected Date</label>
              <input type="date" className="input !py-1.5 text-sm"
                value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Notes</label>
            <input className="input !py-1.5 text-sm" placeholder="Optional"
              value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary !py-2 text-xs">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-2 py-2.5 text-xs font-bold leading-tight transition ${
      active ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
      {label}
    </button>
  );
}
function Row({ k, v }) {
  return <div className="flex items-center justify-between py-1 text-sm"><span className="text-slate-500">{k}</span><span className="text-right font-semibold text-slate-800">{v}</span></div>;
}

function EditCollectionModal({ collection: c, borrowerId, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(c.totalCollected || ''));
  const [date, setDate] = useState(c.collectedDate || '');
  const [notes, setNotes] = useState(c.notes || '');
  const [collector, setCollector] = useState(c.collectorName || 'Admin');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const newAmt = Math.round(Number(amount));
    if (!newAmt || newAmt <= 0) return toast.error('Enter valid amount');
    setBusy(true);
    try {
      const delta = newAmt - Number(c.totalCollected || 0);
      await updateOne('collections', c.id, {
        totalCollected: newAmt, collectedDate: date,
        collectorName: collector, notes, updatedAt: serverTimestamp(),
      });
      if (delta !== 0) await updateOne('borrowers', borrowerId, {
        paidAmount: increment(delta),
        pendingAmount: increment(-delta),
        updatedAt: serverTimestamp(),
      });
      toast.success('Payment updated');
      onSaved();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm('Delete this payment record? Borrower balance will be adjusted.')) return;
    setBusy(true);
    try {
      const amt = Number(c.totalCollected || 0);
      await deleteOne('collections', c.id);
      await updateOne('borrowers', borrowerId, {
        paidAmount: increment(-amt),
        pendingAmount: increment(amt),
        updatedAt: serverTimestamp(),
      });
      toast.success('Payment deleted');
      onSaved();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-base font-black">Edit Payment Record</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="space-y-3 p-4">
          <div><label className="label">Amount (₹)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="label">Collection Date</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">Collector</label><input className="input" value={collector} onChange={(e) => setCollector(e.target.value)} /></div>
          <div><label className="label">Notes</label><input className="input" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={remove} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100"><Trash2 size={15} /> Delete</button>
            <button onClick={save} disabled={busy} className="btn-primary flex-1">{busy ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
