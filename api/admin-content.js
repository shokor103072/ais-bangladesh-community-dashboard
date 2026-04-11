const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_INBOX_TOKEN'];
const TABLES = {
  members: 'members_directory',
  committee: 'committee_directory',
  alumni: 'alumni_directory',
  events: 'events_board',
  announcements: 'announcements_board',
  achievements: 'achievements_board',
  gallery: 'gallery_items',
  admins: 'admin_accounts',
  settings: 'site_settings'
};
const KEY_VALUE_COLLECTIONS = new Set(['settings']);

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
  const id = Number(item && item.id);
  return {
    id,
    payload: (item && item.payload) || item || {},
    updated_at: (item && item.updated_at) || new Date().toISOString()
  };
}

function dedupeRows(items) {
  const map = new Map();
  for (const original of Array.isArray(items) ? items : []) {
    const current = row(original);
    if (!Number.isFinite(current.id) || current.id <= 0) continue;
    map.set(current.id, current);
  }
  return Array.from(map.values());
}

function normalizeSupabaseError(table, txt) {
  const raw = String(txt || '');
  if (raw.includes('21000') || raw.includes('cannot affect row a second time') || raw.includes('duplicate constrained values')) {
    return 'Duplicate local IDs were found in the data you tried to publish. Use the latest dashboard package, then push again. If it still happens, refresh this browser and remove duplicate copied entries before publishing.';
  }
  if (raw.includes('PGRST205') || raw.toLowerCase().includes(`public.${table}`.toLowerCase())) {
    if (table === 'admin_accounts') return 'Supabase table public.admin_accounts is missing. Run supabase/step8-admin-accounts.sql and redeploy.';
    if (table === 'committee_directory' || table === 'alumni_directory') return 'Supabase committee/alumni tables are missing. Run the updated supabase/step7-content-sync.sql and redeploy.';
    return `Supabase table public.${table} is missing. Run the latest SQL setup files and redeploy.`;
  }
  return raw;
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
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: normalizeSupabaseError(table, txt) });
      const rows = JSON.parse(txt || '[]');
      if (KEY_VALUE_COLLECTIONS.has(collection)) {
        // Return as { key: value } map for easy consumption
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        return json(res, 200, { ok: true, settings: map, items: rows });
      }
      return json(res, 200, { ok: true, items: rows });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBody(req);

      // Key-value settings upsert (uses text key, not bigint id)
      if (KEY_VALUE_COLLECTIONS.has(collection) && body.key !== undefined) {
        const settingRow = { key: String(body.key), value: body.value !== undefined ? body.value : {}, updated_at: new Date().toISOString() };
        const rsp = await fetch(`${base}?on_conflict=key`, {
          method: 'POST',
          headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
          body: JSON.stringify(settingRow)
        });
        const txt = await rsp.text();
        if (!rsp.ok) return json(res, rsp.status, { ok: false, error: normalizeSupabaseError(table, txt) });
        const parsed = JSON.parse(txt || '[]');
        return json(res, 200, { ok: true, item: Array.isArray(parsed) ? parsed[0] : parsed });
      }

      if (Array.isArray(body.items)) {
        const rows = dedupeRows(body.items);
        if (!rows.length) return json(res, 200, { ok: true, items: [], skipped: true, note: 'No valid rows — collection skipped.' });
        const rsp = await fetch(`${base}?on_conflict=id`, {
          method: 'POST',
          headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
          body: JSON.stringify(rows)
        });
        const txt = await rsp.text();
        if (!rsp.ok) return json(res, rsp.status, { ok: false, error: normalizeSupabaseError(table, txt) });
        return json(res, 200, { ok: true, items: JSON.parse(txt || '[]') });
      }

      const item = row(body.item || body);
      if (!Number.isFinite(item.id) || item.id <= 0) return json(res, 400, { ok: false, error: 'Invalid item id for publish.' });
      const rsp = await fetch(`${base}?on_conflict=id`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(item)
      });
      const txt = await rsp.text();
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: normalizeSupabaseError(table, txt) });
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
      if (!rsp.ok) return json(res, rsp.status, { ok: false, error: normalizeSupabaseError(table, txt) });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) });
  }
};
