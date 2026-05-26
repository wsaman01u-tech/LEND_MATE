import { MessageCircle, Printer, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import { buildSchedule, fmtDate, money, openWhatsApp, whatsappLoanSummary } from '../lib/finance';
import { generateScoreHTML, printReceipt, shareReceiptAsImage } from '../lib/reports';

function computeScore(schedule) {
  if (!schedule || schedule.length === 0) return { score: 70, level: 'Average', levelColor: 'text-amber-600', levelDesc: 'Not enough data', onTime: 0, advance: 0, partial: 0, missed: 0, streak: 0, trend: 'Neutral', insights: ['Not enough payment history yet'] };
  let score = 70, onTime = 0, partial = 0, missed = 0, streak = 0, curStreak = 0;
  for (const slot of schedule) {
    if (slot.state === 'pending' || slot.state === 'today') continue;
    if (slot.state === 'paid') { score += 2; onTime++; curStreak++; streak = Math.max(streak, curStreak); }
    else if (slot.state === 'partial') { score -= 2; partial++; curStreak = 0; }
    else if (slot.state === 'overdue') { score -= 5; missed++; curStreak = 0; }
  }
  score = Math.max(0, Math.min(100, score));
  let level, levelDesc;
  if (score >= 90) { level = 'Excellent'; levelDesc = 'Reliable borrower'; }
  else if (score >= 75) { level = 'Good'; levelDesc = 'Consistent payments'; }
  else if (score >= 60) { level = 'Average'; levelDesc = 'Generally pays on time'; }
  else if (score >= 40) { level = 'Risky'; levelDesc = 'Frequent delays detected'; }
  else { level = 'High Risk'; levelDesc = 'Poor repayment history'; }
  const insights = [];
  if (missed === 0 && onTime > 2) insights.push('No missed EMIs');
  if (missed > 0) insights.push(`${missed} missed EMI${missed > 1 ? 's' : ''}`);
  if (partial > 0) insights.push(`${partial} partial payment${partial > 1 ? 's' : ''}`);
  if (streak >= 3) insights.push(`Streak: ${streak} consecutive`);
  if (insights.length === 0) insights.push('Not enough history');
  const trend = 'Neutral';
  return { score, level, levelDesc, onTime, advance: 0, partial, missed, streak, trend, insights };
}

export default function PerformanceTracker({ borrower, payments: slotRecords, onClose, inline = false }) {
  const schedule = buildSchedule(borrower, slotRecords);
  const cs = computeScore(schedule);

  const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
  const totalPaid = Number(borrower.paidAmount || 0);
  const pending = Number(borrower.pendingAmount || 0);
  const progressPct = totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 0;

  const inner = (
    <div className={inline ? 'w-full' : 'w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:rounded-2xl'} style={inline ? {} : { maxHeight: '92dvh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Borrower Score</h2>
            <p className="text-xs text-slate-500">Credit performance report</p>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <button onClick={() => { const html = generateScoreHTML({ borrower, score: cs.score, level: cs.level, levelDesc: cs.levelDesc, onTime: cs.onTime, partial: cs.partial, missed: cs.missed, streak: cs.streak, trend: cs.trend, insights: cs.insights, paid: money(totalPaid), pending: money(pending), progress: progressPct }); printReceipt(html); }} title="Print Score" className="rounded-full p-1.5 hover:bg-slate-100"><Printer size={17} /></button>
            <button onClick={() => openWhatsApp(borrower.phone, whatsappLoanSummary(borrower))} title="WhatsApp" className="rounded-full p-1.5 text-green-600 hover:bg-green-50"><MessageCircle size={17} /></button>
            {onClose && <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={18} /></button>}
          </div>
        </div>

        <div className="space-y-4 p-4">

          {/* Borrower name */}
          <div className="text-center">
            <p className="text-base font-black text-slate-900">{borrower.fullName}</p>
            <p className="text-sm text-slate-500">{borrower.phone}</p>
          </div>

          {/* ── Credit Score Card ── */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Credit Score</p>
              <TrendIcon trend={cs.trend} />
            </div>

            {/* Circular meter */}
            <div className="flex flex-col items-center">
              <CircularScore score={cs.score} level={cs.level} />
              <div className="mt-3 text-center">
                <span className={`inline-block rounded-full px-4 py-1 text-sm font-black ${levelBg(cs.level)}`}>{cs.level}</span>
                <p className="mt-2 text-xs text-slate-500 text-center max-w-[240px] mx-auto">{cs.levelDesc}</p>
              </div>
            </div>

            {/* Score bar breakdown */}
            <div className="mt-4">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                {cs.onTime + cs.advance > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${((cs.onTime + cs.advance) / Math.max(1, cs.onTime + cs.advance + cs.partial + cs.missed)) * 100}%` }} />}
                {cs.partial > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(cs.partial / Math.max(1, cs.onTime + cs.advance + cs.partial + cs.missed)) * 100}%` }} />}
                {cs.missed > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(cs.missed / Math.max(1, cs.onTime + cs.advance + cs.partial + cs.missed)) * 100}%` }} />}
              </div>
              <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold">
                <LegendDot color="bg-emerald-500" label={`On-Time (${cs.onTime})`} />
                <LegendDot color="bg-blue-500" label={`Advance (${cs.advance})`} />
                <LegendDot color="bg-amber-400" label={`Partial (${cs.partial})`} />
                <LegendDot color="bg-red-500" label={`Missed (${cs.missed})`} />
              </div>
            </div>
          </div>

          {/* ── Payment Analytics ── */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Payment Analytics</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="On-Time" val={cs.onTime} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard label="Advance" val={cs.advance} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard label="Partial" val={cs.partial} color="bg-amber-50 text-amber-700 border-amber-200" />
              <StatCard label="Missed" val={cs.missed} color="bg-red-50 text-red-700 border-red-200" />
              <StatCard label="Streak" val={cs.streak} color="bg-primary-50 text-primary-700 border-primary-200" suffix="✓" />
              <StatCard label="Trend" val={cs.trend} color={cs.trend === 'Improving' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : cs.trend === 'Declining' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'} isText />
            </div>
          </div>

          {/* ── Insights ── */}
          {cs.insights.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Insights</p>
              {cs.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                  {ins}
                </div>
              ))}
            </div>
          )}

          {/* ── Loan Summary ── */}
          <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loan Summary</p>
            <Row k="Loan Amount" v={money(borrower.loanAmount)} />
            <Row k="Net Given" v={money(borrower.netAmountGiven ?? borrower.loanAmount)} />
            <Row k="Total Payable" v={money(totalPayable)} />
            <Row k="Start" v={fmtDate(borrower.startDate)} />
            <Row k="End" v={fmtDate(borrower.endDate)} />
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Paid</span>
                <b className="text-emerald-700">{money(totalPaid)}</b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pending</span>
                <b className={pending > 0 ? 'text-amber-600' : 'text-emerald-600'}>{money(pending)}</b>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Completion</span><span>{progressPct}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all ${progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-primary-500' : 'bg-amber-400'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
    </div>
  );

  if (inline) return inner;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      {inner}
    </div>
  );
}

// ── Circular Score Meter ──────────────────────────────────────────────────────
function CircularScore({ score, level }) {
  const R = 52;
  const circ = 2 * Math.PI * R;
  const dash = (score / 100) * circ;
  const strokeColor =
    score >= 90 ? '#10b981' : score >= 75 ? '#22c55e' :
    score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke={strokeColor} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black text-slate-900 leading-none">{score}</span>
        <span className="text-xs font-bold text-slate-400">/100</span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function TrendIcon({ trend }) {
  if (trend === 'Improving') return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5"><TrendingUp size={13} /> Improving</span>;
  if (trend === 'Declining') return <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5"><TrendingDown size={13} /> Declining</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5"><Minus size={13} /> {trend}</span>;
}

function StatCard({ label, val, color, suffix = '', isText = false }) {
  return (
    <div className={`rounded-xl border p-2.5 text-center ${color}`}>
      <p className="text-[10px] font-semibold opacity-70 mb-0.5">{label}</p>
      <b className={isText ? 'text-xs' : 'text-xl'}>{val}{suffix}</b>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1 text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} />{label}
    </span>
  );
}

function levelBg(level) {
  return level === 'Excellent' ? 'bg-emerald-100 text-emerald-800'
    : level === 'Good'      ? 'bg-green-100 text-green-800'
    : level === 'Average'   ? 'bg-amber-100 text-amber-800'
    : level === 'Risky'     ? 'bg-orange-100 text-orange-800'
    : 'bg-red-100 text-red-800';
}

function Row({ k, v }) {
  return <div className="flex justify-between py-0.5 text-sm"><span className="text-slate-500">{k}</span><b className="text-slate-800">{v}</b></div>;
}
