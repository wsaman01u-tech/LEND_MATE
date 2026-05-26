export const money = (value = 0) => {
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN');
};
export const todayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};
export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};
export const fmtDate = (iso) => {
  if (!iso) return '-';
  const s = typeof iso === 'string' ? iso : iso?.toDate?.().toISOString?.() || '';
  const d = s.slice(8, 10), m = s.slice(5, 7), y = s.slice(2, 4);
  if (!d || !m || !y) return '-';
  return `${d}/${m}/${y}`;
};
export const stepDays = (type) => type === 'Weekly' ? 7 : type === 'Monthly' ? 30 : 1;

export const calculateLoan = ({ loanAmount, totalInterest = 0, deductedAmount = 0, financeType = 'Daily', duration }) => {
  const principal = Number(loanAmount) || 0;
  const interest = Math.max(0, Number(totalInterest) || 0);
  const deducted = Number(deductedAmount) || 0;
  const totalPayable = principal + interest;
  const netAmountGiven = Math.max(0, principal - deducted);
  const days = Number(duration || 0) * stepDays(financeType);
  const emi = days > 0 ? Math.ceil(totalPayable / days) : totalPayable;
  const interestRate = principal ? Number(((interest / principal) * 100).toFixed(2)) : 0;
  return { interest, interestRate, totalPayable, expectedReturn: totalPayable, netAmountGiven, emi, durationDaysValue: days };
};

export const dueInstallments = (borrower) => {
  if (!borrower?.startDate || !borrower?.financeType) return 0;
  const start = new Date(borrower.startDate);
  const today = new Date();
  const diff = Math.max(0, Math.floor((today - start) / 86400000));
  return Math.min(Number(borrower.duration || 0), Math.floor(diff / stepDays(borrower.financeType)) + 1);
};

export const borrowerStatus = (borrower) => {
  if (Number(borrower.pendingAmount || 0) < 0) return 'Overpaid';
  if (borrower.status === 'Completed' || borrower.status === 'Closed') return 'Completed';
  if (borrower.endDate && borrower.endDate < todayISO()) return 'Overdue';
  return borrower.status || 'Active';
};

export const nextDueDate = (borrower) => {
  const start = borrower.startDate || todayISO();
  const paidCount = Number(borrower.paymentCount) || 0;
  const step = stepDays(borrower.financeType || borrower.repaymentType);
  return addDays(start, paidCount * step);
};

/** Calculate overdue days from end date */
export const overdueDays = (borrower) => {
  if (!borrower.endDate) return 0;
  const end = new Date(borrower.endDate);
  const now = new Date();
  const diff = Math.floor((now - end) / 86400000);
  return Math.max(0, diff);
};

/** Count missed payments (slots past due date with no payment at all — excludes late-paid slots) */
export const missedPayments = (schedule) => {
  const today = todayISO();
  return schedule.filter((s) => s.dueDate < today && !s.isFullyPaid && s.paidAmount === 0).length;
};

/**
 * Generate extension schedule for manual repayment extension.
 * @param {number} pendingBalance - remaining amount
 * @param {string} extensionType - 'Daily' | 'Monthly'
 * @param {number} extensionDuration - number of installments
 * @param {string} startFrom - ISO date to start extension from
 */
export const generateExtensionSchedule = (pendingBalance, extensionType, extensionDuration, startFrom) => {
  const step = stepDays(extensionType);
  const emiAmount = Math.ceil(pendingBalance / extensionDuration);
  const slots = [];
  for (let i = 0; i < extensionDuration; i++) {
    const isLast = i === extensionDuration - 1;
    const slotEmi = isLast ? pendingBalance - (emiAmount * (extensionDuration - 1)) : emiAmount;
    slots.push({
      slotIndex: i,
      no: i + 1,
      dueDate: addDays(startFrom, i * step),
      emiAmount: Math.max(0, slotEmi),
    });
  }
  return slots;
};

/** Build original EMI schedule (NO auto extension) */
export const buildSchedule = (borrower, slotRecords = []) => {
  const step = stepDays(borrower.financeType);
  const duration = Number(borrower.duration) || 0;
  const emiPerSlot = Number(borrower.emi) || 0;
  const startDate = borrower.startDate || todayISO();
  const today = todayISO();

  const byIndex = {};
  for (const r of slotRecords) {
    const idx = Number(r.slotIndex);
    if (!isNaN(idx)) byIndex[idx] = r;
  }

  // Include extension slots if they exist in records
  const maxIdx = Math.max(duration - 1, ...Object.keys(byIndex).map(Number).filter(n => !isNaN(n)));
  const totalSlots = Math.max(duration, maxIdx + 1);

  const slots = [];
  for (let i = 0; i < totalSlots; i++) {
    const dueDate = addDays(startDate, i * step);
    const record = byIndex[i] || null;
    const paidAmount = Number(record?.paidAmount) || 0;
    const emiAmount = Number(record?.emiAmount) || emiPerSlot;
    const isFullyPaid = paidAmount >= emiAmount;
    const isPartial = paidAmount > 0 && !isFullyPaid;
    const isExtended = i >= duration;

    let state = 'pending';
    if (isFullyPaid) state = 'paid';
    else if (isPartial) state = 'partial';
    else if (dueDate === today) state = 'today';
    else if (dueDate < today) state = 'overdue';

    slots.push({
      slotIndex: i, no: i + 1, dueDate, emiAmount, paidAmount,
      pendingAmount: Math.max(0, emiAmount - paidAmount),
      collectedDate: record?.collectedDate || null,
      record, state, isFullyPaid, isPartial, isExtended,
    });
  }
  return slots;
};

/** Compute analytics summary from schedule */
export const scheduleAnalytics = (schedule) => {
  const total = schedule.length;
  const paid = schedule.filter((s) => s.state === 'paid').length;
  const partial = schedule.filter((s) => s.state === 'partial').length;
  const missed = schedule.filter((s) => s.state === 'overdue').length;
  const upcoming = schedule.filter((s) => s.state === 'pending').length;
  const todayDue = schedule.filter((s) => s.state === 'today').length;
  const extended = schedule.filter((s) => s.isExtended).length;
  const fullyPaid = paid;
  const efficiency = total > 0 ? Math.round((fullyPaid / total) * 100) : 0;
  const totalPaid = schedule.reduce((s, sl) => s + sl.paidAmount, 0);
  const totalPending = schedule.reduce((s, sl) => s + sl.pendingAmount, 0);
  const totalEMI = schedule.reduce((s, sl) => s + sl.emiAmount, 0);
  return { total, paid, partial, missed, upcoming, todayDue, extended, fullyPaid, efficiency, totalPaid, totalPending, totalEMI };
};

/** WhatsApp message generators */
export const whatsappReminder = (borrower) => {
  const pending = Number(borrower.pendingAmount || 0);
  const emi = Number(borrower.emi || 0);
  const today = fmtDate(todayISO());
  return encodeURIComponent(
`Hello ${borrower.fullName},

Your EMI payment for ${today} is due today.

Pending Balance: ${money(pending)}
Today's EMI: ${money(emi)}

Please complete payment on time.

Thank you.
SGMI LendMate`);
};

export const whatsappReceipt = (borrower, amount, date) => {
  const remaining = Math.max(0, Number(borrower.pendingAmount || 0) - amount);
  return encodeURIComponent(
`Payment received successfully.

Collected Amount: ${money(amount)}
Collection Date: ${fmtDate(date)}
Remaining Balance: ${money(remaining)}

Thank you.
SGMI LendMate`);
};

export const whatsappOverdueReminder = (borrower) => {
  const pending = Number(borrower.pendingAmount || 0);
  const days = overdueDays(borrower);
  return encodeURIComponent(
`Hello ${borrower.fullName},

Your loan repayment is overdue by ${days} days.

Outstanding Balance: ${money(pending)}
Original End Date: ${fmtDate(borrower.endDate)}

Please clear pending dues immediately to avoid further action.

Contact us to discuss repayment extension options.

Thank you.
SGMI LendMate`);
};

export const whatsappLoanSummary = (borrower) => {
  const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
  const paid = Number(borrower.paidAmount || 0);
  const pending = Number(borrower.pendingAmount || 0);
  const emi = Number(borrower.emi || 0);
  return encodeURIComponent(
`Loan Summary - ${borrower.fullName}

Loan Amount: ${money(borrower.loanAmount)}
Total Payable: ${money(totalPayable)}
EMI: ${money(emi)} (${borrower.financeType || 'Daily'})

Start Date: ${fmtDate(borrower.startDate)}
End Date: ${fmtDate(borrower.endDate)}

Total Paid: ${money(paid)}
Remaining Balance: ${money(pending)}

Status: ${borrowerStatus(borrower)}

SGMI LendMate`);
};

export const openWhatsApp = (phone, message) => {
  const num = (phone || '').replace(/\D/g, '');
  const full = num.length === 10 ? `91${num}` : num;
  window.open(`https://wa.me/${full}?text=${message}`, '_blank');
};
