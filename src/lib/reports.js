import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Smart PDF generation with multi-page support.
 * Properly handles content scaling, avoids blank pages, prevents cropping.
 */
export const downloadElementPdf = async (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Report content not found');

  // Temporarily style for print
  const origStyle = element.getAttribute('style') || '';
  element.style.width = '700px';
  element.style.maxWidth = '700px';
  element.style.overflow = 'visible';

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // Restore style
  element.setAttribute('style', origStyle);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= usableHeight) {
    // Fits single page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, imgHeight);
  } else {
    // Multi-page: slice the canvas
    const scaleFactor = canvas.width / imgWidth;
    const sliceHeight = usableHeight * scaleFactor;
    let position = 0;
    let page = 0;

    while (position < canvas.height) {
      if (page > 0) pdf.addPage();
      const remainingHeight = canvas.height - position;
      const currentSlice = Math.min(sliceHeight, remainingHeight);

      // Create slice canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSlice;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, position, canvas.width, currentSlice, 0, 0, canvas.width, currentSlice);

      const sliceImgHeight = (currentSlice * imgWidth) / canvas.width;
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, sliceImgHeight);

      position += currentSlice;
      page++;
      if (page > 20) break; // Safety limit
    }
  }

  pdf.save(filename);
};

/**
 * Generate a professional receipt HTML string for print/PDF
 */
export const generateReceiptHTML = ({ borrower, amount, date, remaining, collectorName, type = 'Payment Receipt' }) => {
  const photo = borrower.photoUrl || '';
  const photoBlock = photo ? `<img src="${photo}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;" />` : '';
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:400px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
  <div style="text-align:center;margin-bottom:16px;">
    <h2 style="margin:0;font-size:18px;color:#1e293b;">SGMI LendMate</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${type}</p>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    ${photoBlock}
    <div>
      <p style="margin:0;font-weight:800;font-size:15px;color:#1e293b;">${borrower.fullName}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${borrower.phone || ''}</p>
    </div>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#64748b;">Collected Amount</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#059669;">₹${Number(amount).toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Collection Date</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${date}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Remaining Balance</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#dc2626;">₹${Number(remaining).toLocaleString('en-IN')}</td></tr>
    ${collectorName ? `<tr><td style="padding:6px 0;color:#64748b;">Collected By</td><td style="padding:6px 0;text-align:right;color:#1e293b;">${collectorName}</td></tr>` : ''}
  </table>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:0;">Thank you for your payment</p>
</div>`;
};

/**
 * Render an HTML string into an off-screen div, capture as image,
 * then open a download + show WhatsApp share instructions.
 * WhatsApp Web doesn't support direct image sharing via URL,
 * so we: download the image + open WhatsApp with the borrower.
 */
export const shareReceiptAsImage = async (html, phone, fallbackText) => {
  try {
    // Render HTML off-screen
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;background:#fff;z-index:-1;';
    container.innerHTML = html;
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 100)); // let fonts/images settle

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, allowTaint: true,
      logging: false, backgroundColor: '#ffffff',
    });
    document.body.removeChild(container);

    // Download the image automatically
    const link = document.createElement('a');
    link.download = 'receipt.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Then open WhatsApp — user attaches the downloaded image manually
    const msg = encodeURIComponent(fallbackText || 'Payment receipt attached.');
    const waPhone = phone ? phone.replace(/\D/g, '') : '';
    const waUrl = waPhone.length >= 10
      ? `https://wa.me/91${waPhone.slice(-10)}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    setTimeout(() => window.open(waUrl, '_blank'), 500);
  } catch (e) {
    console.error('shareReceiptAsImage failed:', e);
    // Fallback: just open WhatsApp with text
    const msg = encodeURIComponent(fallbackText || 'Payment receipt');
    const waPhone = phone ? phone.replace(/\D/g, '') : '';
    const waUrl = waPhone.length >= 10
      ? `https://wa.me/91${waPhone.slice(-10)}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(waUrl, '_blank');
  }
};

/**
 * Generate loan summary HTML for print/PDF
 */
export const generateLoanSummaryHTML = (borrower) => {
  const photo = borrower.photoUrl || '';
  const photoBlock = photo ? `<img src="${photo}" style="width:70px;height:70px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;" />` : '';
  const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
  const paid = Number(borrower.paidAmount || 0);
  const pending = Number(borrower.pendingAmount || 0);
  const progress = totalPayable > 0 ? Math.min(100, Math.round((paid / totalPayable) * 100)) : 0;

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:450px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
  <div style="text-align:center;margin-bottom:16px;">
    <h2 style="margin:0;font-size:18px;color:#1e293b;">SGMI LendMate</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Loan Summary</p>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    ${photoBlock}
    <div>
      <p style="margin:0;font-weight:800;font-size:16px;color:#1e293b;">${borrower.fullName}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${borrower.phone || ''}</p>
    </div>
  </div>
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#64748b;">Loan Amount</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#1e293b;">₹${Number(borrower.loanAmount).toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Total Payable</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#1e293b;">₹${totalPayable.toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">EMI</td><td style="padding:6px 0;text-align:right;color:#1e293b;">₹${Number(borrower.emi || 0).toLocaleString('en-IN')} (${borrower.financeType || 'Daily'})</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Start Date</td><td style="padding:6px 0;text-align:right;color:#1e293b;">${borrower.startDate || '-'}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">End Date</td><td style="padding:6px 0;text-align:right;color:#1e293b;">${borrower.endDate || '-'}</td></tr>
  </table>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#64748b;">Total Paid</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#059669;">₹${paid.toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Remaining Balance</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#dc2626;">₹${pending.toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Progress</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#1e293b;">${progress}%</td></tr>
  </table>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:0;">Generated by SGMI LendMate</p>
</div>`;
};

/**
 * Generate performance score HTML for print/PDF
 */
export const generateScoreHTML = ({ borrower, score, level, levelDesc, onTime, partial, missed, streak, trend, insights, paid, pending, progress }) => {
  const photo = borrower.photoUrl || '';
  const photoBlock = photo ? `<img src="${photo}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;" />` : '';
  const scoreColor = score >= 90 ? '#10b981' : score >= 75 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const insightsList = (insights || []).map(i => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;"><span style="width:6px;height:6px;border-radius:50%;background:#6366f1;flex-shrink:0;"></span>${i}</div>`).join('');

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">
  <div style="text-align:center;margin-bottom:16px;">
    <h2 style="margin:0;font-size:18px;color:#1e293b;">SGMI LendMate</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Credit Performance Report</p>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    ${photoBlock}
    <div>
      <p style="margin:0;font-weight:800;font-size:15px;color:#1e293b;">${borrower.fullName}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${borrower.phone || ''}</p>
    </div>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <div style="text-align:center;margin:16px 0;">
    <div style="display:inline-block;width:100px;height:100px;border-radius:50%;border:8px solid ${scoreColor};position:relative;">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <span style="font-size:28px;font-weight:900;color:#1e293b;">${score}</span>
        <span style="font-size:10px;color:#94a3b8;">/100</span>
      </div>
    </div>
    <div style="margin-top:8px;">
      <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:800;background:${scoreColor}20;color:${scoreColor};">${level}</span>
    </div>
    <p style="margin-top:6px;font-size:11px;color:#64748b;">${levelDesc}</p>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="padding:5px 0;color:#64748b;">On-Time Payments</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#059669;">${onTime}</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Partial Payments</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#d97706;">${partial}</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Missed EMIs</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#dc2626;">${missed}</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Best Streak</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#1e293b;">${streak} consecutive</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Trend</td><td style="padding:5px 0;text-align:right;font-weight:600;color:#1e293b;">${trend}</td></tr>
  </table>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr><td style="padding:5px 0;color:#64748b;">Total Paid</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#059669;">${paid}</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Remaining</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#dc2626;">${pending}</td></tr>
    <tr><td style="padding:5px 0;color:#64748b;">Completion</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#1e293b;">${progress}%</td></tr>
  </table>
  ${insightsList ? `<hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" /><div style="display:flex;flex-direction:column;gap:4px;">${insightsList}</div>` : ''}
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:0;">Generated by SGMI LendMate</p>
</div>`;
};

/**
 * Generate full payment history ledger HTML for print/PDF
 */
export const generatePaymentHistoryHTML = (borrower, collections = []) => {
  const photo = borrower.photoUrl || '';
  const photoBlock = photo ? `<img src="${photo}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;" />` : '';
  const totalPayable = Number(borrower.totalPayable ?? borrower.expectedReturn ?? 0);
  const totalPaid = collections.reduce((s, c) => s + Number(c.totalCollected || 0), 0);
  const totalPending = Math.max(0, totalPayable - totalPaid);

  const rows = collections.length ? collections.map((c, idx) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 4px;font-weight:600;color:#1e293b;">#${collections.length - idx}</td>
      <td style="padding:10px 4px;color:#475569;">${c.collectedDate || '-'}</td>
      <td style="padding:10px 4px;color:#475569;">${c.collectorName || 'Admin'}</td>
      <td style="padding:10px 4px;text-align:right;font-weight:700;color:#059669;">₹${Number(c.totalCollected).toLocaleString('en-IN')}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No payments recorded yet.</td></tr>`;

  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
  <div style="text-align:center;margin-bottom:16px;">
    <h2 style="margin:0;font-size:18px;color:#1e293b;">SGMI LendMate</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Statement of Account</p>
  </div>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:12px 0;" />
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    ${photoBlock}
    <div>
      <p style="margin:0;font-weight:800;font-size:16px;color:#1e293b;">${borrower.fullName}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${borrower.phone || ''}</p>
    </div>
  </div>
  
  <div style="display:grid;grid-template-cols: repeat(3, 1fr);gap:10px;background:#f8fafc;padding:12px;border-radius:12px;margin-bottom:16px;font-size:12px;display:flex;justify-content:space-between;">
    <div style="text-align:center;flex:1;">
      <p style="margin:0 0 2px;color:#64748b;">Total Loan</p>
      <b style="color:#1e293b;font-size:14px;">₹${totalPayable.toLocaleString('en-IN')}</b>
    </div>
    <div style="text-align:center;flex:1;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <p style="margin:0 0 2px;color:#64748b;">Paid</p>
      <b style="color:#059669;font-size:14px;">₹${totalPaid.toLocaleString('en-IN')}</b>
    </div>
    <div style="text-align:center;flex:1;">
      <p style="margin:0 0 2px;color:#64748b;">Balance</p>
      <b style="color:#dc2626;font-size:14px;">₹${totalPending.toLocaleString('en-IN')}</b>
    </div>
  </div>

  <h3 style="font-size:14px;color:#1e293b;margin:0 0 8px;">Payment Transactions</h3>
  <table style="width:100%;font-size:12px;border-collapse:collapse;text-align:left;">
    <thead>
      <tr style="border-bottom:2px solid #e2e8f0;color:#64748b;">
        <th style="padding:6px 4px;">No.</th>
        <th style="padding:6px 4px;">Date</th>
        <th style="padding:6px 4px;">Collector</th>
        <th style="padding:6px 4px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <hr style="border:none;border-top:1px dashed #cbd5e1;margin:16px 0;" />
  <p style="text-align:center;font-size:11px;color:#94a3b8;margin:0;">Statement generated on ${new Date().toLocaleDateString('en-IN')}</p>
</div>`;
};

/**
 * Print receipt in a new window (mobile-friendly)
 */
export const printReceipt = (html) => {
  const win = window.open('', '_blank', 'width=420,height=600');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt</title><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { padding:16px; background:#fff; }
    @media print { body { padding:0; } }
  </style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 400);
};
