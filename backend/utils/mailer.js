const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const {
    SMTP_HOST = 'smtp.gmail.com',
    SMTP_PORT = '587',
    SMTP_USER,
    SMTP_PASS,
  } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS env vars must be configured to send email.');
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const STATUS_ORDER = ['New', 'In Progress', 'Completed', 'Not Completed'];

const STATUS_COLORS = {
  'New': '#2563eb',
  'In Progress': '#d97706',
  'Completed': '#059669',
  'Not Completed': '#dc2626',
};

// Only include Completed / Not Completed tasks updated TODAY (IST).
// New / In Progress are always included regardless of date.
const isToday = (d) => {
  if (!d) return false;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return false;
  const now = new Date();
  return dt.toDateString() === now.toDateString();
};

const buildRow = (task, idx) => {
  const remark = Array.isArray(task.responses) && task.responses.length
    ? task.responses.map((r) => r.text).join(' | ')
    : '—';
  return `
    <tr>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;">${idx + 1}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;">${esc(task.clientName || '—')}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#374151;">${esc(task.message || '—')}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;">${esc(task.assignedTo || '—')}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;font-weight:600;">${esc(task.status || '—')}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#374151;">${esc(remark)}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;white-space:nowrap;">${fmtDate(task.receivedAt)}</td>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#111827;white-space:nowrap;">${fmtDate(task.deadline)}</td>
    </tr>`;
};

const buildSection = (status, rows) => {
  const color = STATUS_COLORS[status] || '#374151';
  const body = rows.length
    ? rows.map((t, i) => buildRow(t, i)).join('')
    : `<tr><td colspan="8" style="padding:12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;font-style:italic;">No tasks</td></tr>`;

  return `
    <div style="margin:0 0 24px;">
      <div style="display:inline-block;padding:6px 14px;background:${color};color:#ffffff;font-size:13px;font-weight:700;border-radius:6px;margin-bottom:10px;letter-spacing:0.3px;">
        ${esc(status)} <span style="opacity:0.85;font-weight:500;">(${rows.length})</span>
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Task No</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Client Name</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Work Of Client</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Assigned To</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Status</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Remark by SPOC</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">Start Date</th>
            <th style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:0.4px;">End Date</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
};

const sortByDeadline = (list) => [...list].sort((a, b) => {
  const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
  const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
  return ad - bd;
});

const buildTaskEmail = ({ recipientLabel, tasks, mode }) => {
  const grouped = STATUS_ORDER.reduce((acc, s) => {
    const matches = tasks.filter((t) => (t.status || 'New') === s);
    // Completed + Not Completed → only today's (by updatedAt)
    const filtered = (s === 'Completed' || s === 'Not Completed')
      ? matches.filter((t) => isToday(t.updatedAt))
      : matches;
    acc[s] = sortByDeadline(filtered);
    return acc;
  }, {});

  const total = STATUS_ORDER.reduce((n, s) => n + grouped[s].length, 0);
  const title = mode === 'admin' ? 'All Client Tasks — Admin Summary' : 'Your Assigned Client Tasks';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const subject = mode === 'admin'
    ? `MRM Hub — All Client Tasks Summary (${total})`
    : `MRM Hub — Your Assigned Tasks (${total})`;

  const html = `
    <div style="background:#f3f4f6;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:960px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:22px 28px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">MRM Hub — Artist Portal</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px;">${esc(title)}</div>
          <div style="font-size:13px;opacity:0.9;margin-top:4px;">${esc(today)} · ${esc(recipientLabel)}</div>
        </div>
        <div style="padding:24px 28px;">
          <div style="margin-bottom:18px;font-size:13px;color:#4b5563;">
            ${mode === 'admin'
              ? `Overview of every client task across all SPOCs, grouped by status and sorted by deadline.`
              : `Tasks currently assigned to you, grouped by status and sorted by deadline.`}
          </div>
          ${STATUS_ORDER.map((s) => buildSection(s, grouped[s])).join('')}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
            Generated automatically by MRM Hub · Total Tasks: ${total}
          </div>
        </div>
      </div>
    </div>`;

  const textLines = [title, today, '', ...STATUS_ORDER.flatMap((s) => {
    const rows = grouped[s];
    const head = `\n[${s}] (${rows.length})`;
    if (!rows.length) return [head, '  — none —'];
    return [head, ...rows.map((t, i) =>
      `  ${i + 1}. ${t.clientName} — ${t.message} · ${t.assignedTo || '—'} · ${fmtDate(t.receivedAt)} → ${fmtDate(t.deadline)}`
    )];
  })];

  return { subject, html, text: textLines.join('\n') };
};

const sendTaskEmail = async ({ to, recipientLabel, tasks, mode }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const { subject, html, text } = buildTaskEmail({ recipientLabel, tasks, mode });
  const info = await getTransporter().sendMail({ from, to, subject, html, text });
  return info;
};

module.exports = { sendTaskEmail, buildTaskEmail };
