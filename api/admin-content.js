const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_INBOX_TOKEN'];
const TABLES = {
  members: 'members_directory',
  events: 'events_board',
  gallery: 'gallery_items'
};

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

function row(item) {
  return {
    id: Number(item.id),
    payload: item.payload || item,
    updated_at: item.updated_at || new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) return json(res, 500, { ok: false, error: `Missing env vars: ${missing.join(', ')}` });
  if (!isAuthed(req)) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const urlObj = new URL(req.url, 'http://localhost');
  const collection = urlObj.searchParams.get('collection') || '';
  const table = TABLES[collection];
  if (!table) return json(res, 400, { ok: false, error: 'Unknown collection' });
  const base = `${process.env.SUPABASE_URL}/rest/v1/${table}`;

  try {
    if (req.method === 'GET') {
      const rsp = await fetch(`${base}?select=*&order=updated_at.desc`, { headers: supabaseHeaders() });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
      return json(res, 200, { ok: true, items: JSON.parse(txt || '[]') });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);
      if (Array.isArray(body.items)) {
        const rows = body.items.map(row);
        const rsp = await fetch(`${base}?on_conflict=id`, {
          method: 'POST',
          headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
          body: JSON.stringify(rows)
        });
        const txt = await rsp.text();
        if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
        return json(res, 200, { ok: true, items: JSON.parse(txt || '[]') });
      }

      const item = row(body.item || body);
      const rsp = await fetch(`${base}?on_conflict=id`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(item)
      });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
      const parsed = JSON.parse(txt || '[]');
      return json(res, 200, { ok: true, item: Array.isArray(parsed) ? parsed[0] : parsed });
    }

    if (req.method === 'DELETE') {
      const body = await readBody(req);
      const id = Number(body.id);
      if (!id) return json(res, 400, { ok: false, error: 'Missing id' });
      const rsp = await fetch(`${base}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: supabaseHeaders({ Prefer: 'return=minimal' })
      });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: txt });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) });
  }
};
