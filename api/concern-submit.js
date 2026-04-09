const { sendResendEmail, memberSubmittedEmail, committeeSubmittedEmail } = require('./_email');

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) return json(res, 500, { ok: false, error: `Missing env vars: ${missing.join(', ')}` });
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const concern = body.concern || body;
    const rsp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/concerns`, {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({
        id: Number(concern.id),
        ticket: concern.ticket,
        name: concern.name,
        email: concern.email,
        category: concern.category,
        priority: concern.priority,
        visibility: concern.visibility,
        title: concern.title,
        message: concern.message,
        status: concern.status || 'Open',
        assignee: concern.assignee || '',
        created_at: concern.createdAt,
        updated_at: concern.updatedAt,
        replies: Array.isArray(concern.replies) ? concern.replies : [],
        internal_notes: Array.isArray(concern.internalNotes) ? concern.internalNotes : [],
        timeline: Array.isArray(concern.timeline) ? concern.timeline : []
      })
    });
    const txt = await rsp.text();
    if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
    const parsed = JSON.parse(txt || '[]');
    const saved = Array.isArray(parsed) ? parsed[0] : parsed;

    const emailErrors = [];
    try {
      const memberMail = memberSubmittedEmail(concern);
      await sendResendEmail({ to: concern.email, ...memberMail });
    } catch (err) {
      emailErrors.push(`member:${err.message || err}`);
    }
    try {
      if (process.env.COMMITTEE_NOTIFY_TO) {
        const committeeMail = committeeSubmittedEmail(concern);
        await sendResendEmail({ to: process.env.COMMITTEE_NOTIFY_TO.split(',').map(s => s.trim()), ...committeeMail, replyTo: concern.email });
      }
    } catch (err) {
      emailErrors.push(`committee:${err.message || err}`);
    }

    return json(res, 200, { ok: true, item: saved, emailErrors });
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) });
  }
};
