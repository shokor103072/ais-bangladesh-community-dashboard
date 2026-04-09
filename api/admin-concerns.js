const { sendResendEmail, memberUpdateEmail } = require('./_email');

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_INBOX_TOKEN'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-admin-token'] || '';
}

function isAuthed(req) {
  return !!process.env.ADMIN_INBOX_TOKEN && getToken(req) === process.env.ADMIN_INBOX_TOKEN;
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
  if (!isAuthed(req)) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const base = `${process.env.SUPABASE_URL}/rest/v1/concerns`;

  try {
    if (req.method === 'GET') {
      if (req.url.includes('ping=1')) return json(res, 200, { ok: true });
      const rsp = await fetch(`${base}?select=*&order=updated_at.desc`, { headers: supabaseHeaders() });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
      return json(res, 200, { ok: true, items: JSON.parse(txt || '[]') });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);
      const concern = body.concern || body;

      let previous = null;
      try {
        const prevRsp = await fetch(`${base}?id=eq.${encodeURIComponent(concern.id)}&select=*`, { headers: supabaseHeaders() });
        const prevTxt = await prevRsp.text();
        if (prevRsp.ok) {
          const prevParsed = JSON.parse(prevTxt || '[]');
          previous = Array.isArray(prevParsed) && prevParsed.length ? prevParsed[0] : null;
        }
      } catch {}

      const rsp = await fetch(`${base}?on_conflict=id`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(concern)
      });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
      const parsed = JSON.parse(txt || '[]');
      const item = Array.isArray(parsed) ? parsed[0] : parsed;

      const emailErrors = [];
      try {
        const prevReplies = Array.isArray(previous?.replies) ? previous.replies : [];
        const nextReplies = Array.isArray(item?.replies) ? item.replies : [];
        const latestReply = nextReplies.length > prevReplies.length ? nextReplies[nextReplies.length - 1] : null;
        const statusChanged = previous && previous.status !== item.status;
        if ((latestReply || statusChanged) && item?.email) {
          const mail = memberUpdateEmail({
            ticket: item.ticket,
            name: item.name,
            email: item.email,
            title: item.title,
            status: item.status,
            assignee: item.assignee
          }, { latestReply, statusChanged });
          await sendResendEmail({ to: item.email, ...mail });
        }
      } catch (err) {
        emailErrors.push(`member-update:${err.message || err}`);
      }

      return json(res, 200, { ok: true, item, emailErrors });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) });
  }
};
