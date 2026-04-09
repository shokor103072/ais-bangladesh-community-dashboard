function hasEmailConfig() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendResendEmail({ to, subject, html, text, replyTo }) {
  if (!hasEmailConfig()) return { ok: false, skipped: true, reason: 'Email env vars not configured' };
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) return { ok: false, skipped: true, reason: 'No recipients' };

  const rsp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: recipients,
      subject,
      html,
      text,
      reply_to: replyTo ? [replyTo] : undefined
    })
  });

  const payload = await rsp.json().catch(() => ({}));
  if (!rsp.ok) {
    const message = payload?.message || payload?.error || `Resend error (${rsp.status})`;
    throw new Error(message);
  }
  return { ok: true, data: payload };
}

function memberSubmittedEmail(concern) {
  return {
    subject: `Concern received: ${concern.ticket}`,
    text: `Hello ${concern.name},\n\nYour concern has been received by the AIS Bangladesh Chapter, UTP support desk.\n\nTicket: ${concern.ticket}\nSubject: ${concern.title}\nStatus: ${concern.status || 'Open'}\n\nPlease keep this ticket for future tracking.\n\nRegards,\nAIS Bangladesh Chapter, UTP`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#16324f">
        <h2 style="margin-bottom:8px">Concern received</h2>
        <p>Hello <strong>${esc(concern.name)}</strong>,</p>
        <p>Your concern has been received by the AIS Bangladesh Chapter, UTP support desk.</p>
        <div style="padding:12px;border:1px solid #d8e4ee;border-radius:10px;background:#f8fbff">
          <div><strong>Ticket:</strong> ${esc(concern.ticket)}</div>
          <div><strong>Subject:</strong> ${esc(concern.title)}</div>
          <div><strong>Status:</strong> ${esc(concern.status || 'Open')}</div>
        </div>
        <p style="margin-top:12px">Please keep this ticket for future tracking.</p>
        <p>Regards,<br><strong>AIS Bangladesh Chapter, UTP</strong></p>
      </div>`
  };
}

function committeeSubmittedEmail(concern) {
  return {
    subject: `New concern submitted: ${concern.ticket}`,
    text: `A new concern was submitted.\n\nTicket: ${concern.ticket}\nName: ${concern.name}\nEmail: ${concern.email}\nCategory: ${concern.category}\nPriority: ${concern.priority}\nVisibility: ${concern.visibility}\nSubject: ${concern.title}\n\nMessage:\n${concern.message}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#16324f">
        <h2 style="margin-bottom:8px">New concern submitted</h2>
        <div style="padding:12px;border:1px solid #d8e4ee;border-radius:10px;background:#f8fbff">
          <div><strong>Ticket:</strong> ${esc(concern.ticket)}</div>
          <div><strong>Name:</strong> ${esc(concern.name)}</div>
          <div><strong>Email:</strong> ${esc(concern.email)}</div>
          <div><strong>Category:</strong> ${esc(concern.category)}</div>
          <div><strong>Priority:</strong> ${esc(concern.priority)}</div>
          <div><strong>Visibility:</strong> ${esc(concern.visibility)}</div>
        </div>
        <p style="margin-top:12px"><strong>Subject:</strong> ${esc(concern.title)}</p>
        <p>${esc(concern.message).replace(/\n/g, '<br>')}</p>
      </div>`
  };
}

function memberUpdateEmail(concern, options = {}) {
  const { latestReply, statusChanged } = options;
  const subjectParts = [];
  if (latestReply) subjectParts.push('New committee reply');
  if (statusChanged) subjectParts.push(`Status: ${concern.status}`);
  const subject = `${subjectParts.join(' • ') || 'Concern updated'} — ${concern.ticket}`;

  const textLines = [
    `Hello ${concern.name},`,
    '',
    `Your concern has an update.`,
    '',
    `Ticket: ${concern.ticket}`,
    `Subject: ${concern.title}`,
    `Current status: ${concern.status}`,
    concern.assignee ? `Assigned to: ${concern.assignee}` : ''
  ].filter(Boolean);
  if (latestReply) {
    textLines.push('', 'Latest committee reply:', latestReply.text, '', `Replied by: ${latestReply.by}`, `At: ${latestReply.at}`);
  }
  textLines.push('', 'Please use your ticket or UTP email on the dashboard to track further updates.', '', 'Regards,', 'AIS Bangladesh Chapter, UTP');

  return {
    subject,
    text: textLines.join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#16324f">
        <h2 style="margin-bottom:8px">Concern update</h2>
        <p>Hello <strong>${esc(concern.name)}</strong>,</p>
        <div style="padding:12px;border:1px solid #d8e4ee;border-radius:10px;background:#f8fbff">
          <div><strong>Ticket:</strong> ${esc(concern.ticket)}</div>
          <div><strong>Subject:</strong> ${esc(concern.title)}</div>
          <div><strong>Current status:</strong> ${esc(concern.status || 'Open')}</div>
          ${concern.assignee ? `<div><strong>Assigned to:</strong> ${esc(concern.assignee)}</div>` : ''}
        </div>
        ${latestReply ? `<div style="margin-top:14px;padding:12px;border-left:4px solid #0b8f64;background:#f2fbf8;border-radius:8px"><div style="font-size:12px;color:#5e6f82;text-transform:uppercase;letter-spacing:.08em">Latest committee reply</div><div style="margin-top:8px;font-size:16px">${esc(latestReply.text).replace(/\n/g, '<br>')}</div><div style="margin-top:8px;color:#5e6f82">Replied by <strong>${esc(latestReply.by)}</strong> on ${esc(new Date(latestReply.at).toLocaleString())}</div></div>` : ''}
        <p style="margin-top:14px">Please use your ticket or UTP email on the dashboard to track further updates.</p>
        <p>Regards,<br><strong>AIS Bangladesh Chapter, UTP</strong></p>
      </div>`
  };
}

module.exports = {
  hasEmailConfig,
  sendResendEmail,
  memberSubmittedEmail,
  committeeSubmittedEmail,
  memberUpdateEmail
};
