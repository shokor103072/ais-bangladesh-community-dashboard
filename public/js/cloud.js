(function () {
  const config = window.SUPABASE_CONFIG || {};
  const state = {
    enabled: !!config.enabled,
    ready: false,
    client: null,
    channel: null,
    note: 'Local browser mode'
  };
  const ADMIN_TOKEN_KEY = 'utp_admin_inbox_token';
  const DEFAULT_ADMIN_INBOX_TOKEN = 'AIS-Admin-Inbox-2026-Secure-Token';
  const CONTENT_TABLES = {
    members: 'members_directory',
    committee: 'committee_directory',
    alumni: 'alumni_directory',
    events: 'events_board',
    gallery: 'gallery_items',
    admins: 'admin_accounts',
    settings: 'site_settings'
  };
  const MEDIA_BUCKET = config.mediaBucket || 'community-media';

  function el(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    node.innerHTML = html;
    return node;
  }

  function adminInboxToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  }

  function storeAdminInboxToken(token) {
    if (!token) return;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    updateAdminTokenUi();
  }

  function updateBadge(message, tone = 'muted') {
    let badge = document.getElementById('cloudSyncBadge');
    if (!badge) {
      badge = el('div', { id: 'cloudSyncBadge', class: `cloud-badge ${tone}` }, 'Cloud sync: local browser mode');
      document.body.appendChild(badge);
    }
    badge.className = `cloud-badge ${tone}`;
    badge.textContent = message;
  }

  function setAdminInboxMessage(message, tone = 'muted') {
    const box = document.getElementById('adminInboxMsg');
    if (!box) return;
    box.style.display = 'block';
    box.style.color = tone === 'success' ? 'var(--green)' : tone === 'warn' ? 'var(--red)' : 'var(--muted)';
    box.textContent = message;
  }

  function setContentCloudMessage(message, tone = 'muted') {
    const box = document.getElementById('contentCloudMsg');
    if (!box) return;
    box.style.display = 'block';
    box.style.color = tone === 'success' ? 'var(--green)' : tone === 'warn' ? 'var(--red)' : 'var(--muted)';
    box.textContent = message;
  }

  function updateContentCloudChip(message, tone = 'muted') {
    const chip = document.getElementById('contentCloudStatusChip');
    if (!chip) return;
    chip.textContent = message;
    chip.className = `chip ${tone === 'success' ? 'green' : tone === 'warn' ? 'red' : ''}`.trim();
  }

  function updateAdminTokenUi() {
    const chip = document.getElementById('adminApiStatusChip');
    const input = document.getElementById('adminInboxTokenInput');
    const token = adminInboxToken();
    if (chip) {
      chip.textContent = token ? 'Connected on this browser' : 'Not connected';
      chip.className = `chip ${token ? 'green' : ''}`.trim();
    }
    if (input && token && !input.value) input.value = token;
  }

  function updateAdminNotice(message, tone = 'muted') {
    let box = document.getElementById('cloudAdminNotice');
    if (!box) {
      const host = document.querySelector('#modalAdminSettings .modal-body') || document.querySelector('#modalAdminSettings .modal-card');
      if (!host) return;
      box = el('div', { id: 'cloudAdminNotice', class: `cloud-admin-notice ${tone}` });
      host.insertBefore(box, host.firstChild.nextSibling || host.firstChild);
    }
    box.className = `cloud-admin-notice ${tone}`;
    box.innerHTML = message;
  }

  function isMissingRelationError(err, table) {
    const msg = String(err && (err.message || err.details || err.hint || err) || '');
    return msg.includes('PGRST205') || (table && msg.toLowerCase().includes(`public.${table}`.toLowerCase())) || msg.toLowerCase().includes('schema cache');
  }

  function missingRelationMessage(table) {
    if (table === CONTENT_TABLES.admins) return 'Supabase table public.admin_accounts is missing. Run supabase/step8-admin-accounts.sql, then redeploy or refresh.';
    if (table === CONTENT_TABLES.committee || table === CONTENT_TABLES.alumni) return 'Supabase committee/alumni tables are missing. Run the updated supabase/step7-content-sync.sql, then redeploy or refresh.';
    return `Supabase table public.${table} is missing. Run the latest SQL setup files, then refresh.`;
  }

  function mapConcernRow(row) {
    return {
      id: Number(row.id),
      ticket: row.ticket,
      name: row.name,
      email: row.email,
      category: row.category || '',
      priority: row.priority || 'Normal',
      visibility: row.visibility || 'private',
      title: row.title || '',
      message: row.message || '',
      status: row.status || 'Open',
      assignee: row.assignee || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      replies: Array.isArray(row.replies) ? row.replies : [],
      internalNotes: Array.isArray(row.internal_notes) ? row.internal_notes : [],
      timeline: Array.isArray(row.timeline) ? row.timeline : []
    };
  }

  function toConcernRow(item) {
    return {
      id: Number(item.id),
      ticket: item.ticket,
      name: item.name,
      email: item.email,
      category: item.category,
      priority: item.priority,
      visibility: item.visibility,
      title: item.title,
      message: item.message,
      status: item.status,
      assignee: item.assignee || '',
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString(),
      replies: Array.isArray(item.replies) ? item.replies : [],
      internal_notes: Array.isArray(item.internalNotes) ? item.internalNotes : [],
      timeline: Array.isArray(item.timeline) ? item.timeline : []
    };
  }

  function mapPayloadRow(row) {
    const payload = row && typeof row.payload === 'object' ? row.payload : {};
    return { ...payload, id: Number(row.id), updatedAt: row.updated_at || payload.updatedAt || payload.updated_at || '' };
  }

  function toPayloadRow(item) {
    return {
      id: Number(item.id),
      payload: item,
      updated_at: new Date().toISOString()
    };
  }

  function dedupeItemsById(items, label = 'items') {
    const map = new Map();
    let removed = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const id = Number(item && item.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (map.has(id)) removed += 1;
      map.set(id, { ...item, id });
    }
    if (removed) console.warn(`Removed ${removed} duplicate ${label} before Supabase publish.`);
    return Array.from(map.values());
  }

  async function ensureAdminInboxConnected(options = {}) {
    const silent = options.silent !== false;
    const stored = adminInboxToken();
    const candidates = [...new Set([stored, DEFAULT_ADMIN_INBOX_TOKEN].filter(Boolean))];

    for (const token of candidates) {
      try {
        const rsp = await fetch('/api/admin-concerns?ping=1', { headers: { Authorization: `Bearer ${token}` } });
        const data = await rsp.json().catch(() => ({}));
        if (!rsp.ok || data.ok === false) throw new Error(data.error || 'Unauthorized');
        storeAdminInboxToken(token);
        if (!silent) setAdminInboxMessage('Secure admin inbox connected.', 'success');
        return token;
      } catch (err) {
        if (token === stored) console.warn('Stored admin inbox token check failed:', err);
      }
    }

    if (!silent) setAdminInboxMessage('Secure admin inbox is not connected on this browser.', 'warn');
    throw new Error('Connect the secure admin inbox first');
  }

  async function adminApiFetch(method = 'GET', concern) {
    const token = await ensureAdminInboxConnected({ silent: true });
    const rsp = await fetch(`/api/admin-concerns${method === 'GET' ? '' : ''}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: method === 'GET' ? undefined : JSON.stringify({ concern })
    });
    const data = await rsp.json().catch(() => ({}));
    if (!rsp.ok || data.ok === false) throw new Error(data.error || `Admin API failed (${rsp.status})`);
    return data;
  }

  async function adminContentApi(method = 'GET', collection, payload) {
    const token = await ensureAdminInboxConnected({ silent: true });
    const qs = collection ? `?collection=${encodeURIComponent(collection)}` : '';
    const rsp = await fetch(`/api/admin-content${qs}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload || {})
    });
    const data = await rsp.json().catch(() => ({}));
    if (!rsp.ok || data.ok === false) throw new Error(data.error || `Content API failed (${rsp.status})`);
    return data;
  }

  async function testAdminApiToken() {
    const token = adminInboxToken();
    if (!token) {
      updateAdminTokenUi();
      return false;
    }
    try {
      const rsp = await fetch('/api/admin-concerns?ping=1', { headers: { Authorization: `Bearer ${token}` } });
      const data = await rsp.json().catch(() => ({}));
      if (!rsp.ok || data.ok === false) throw new Error(data.error || 'Unauthorized');
      updateAdminTokenUi();
      setAdminInboxMessage('Secure admin inbox connected.', 'success');
      return true;
    } catch (err) {
      setAdminInboxMessage(String(err.message || err), 'warn');
      return false;
    }
  }

  async function initSupabase() {
    if (!state.enabled || !config.url || !config.anonKey || !window.supabase) {
      state.note = 'Local browser mode';
      updateBadge('Cloud sync: local browser mode', 'muted');
      updateAdminNotice('<strong>Cloud sync is OFF.</strong> Add your Supabase URL and anon key in <code>public/js/supabase-config.js</code> to enable shared concerns across devices.', 'muted');
      updateContentCloudChip('Local browser data', 'muted');
      setContentCloudMessage('Supabase content sync is off. Members, events, and gallery are still using this browser storage.', 'muted');
      return;
    }

    try {
      state.client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { error } = await state.client.from('concerns').select('id', { head: true, count: 'exact' });
      if (error) throw error;
      state.ready = true;
      state.note = 'Supabase live sync enabled';
      updateBadge('Cloud sync: live via Supabase', 'success');
      updateAdminNotice('<strong>Cloud sync is ON.</strong> Public concern submissions and trackable lookups use Supabase directly. Admin full inbox should use the secure Vercel API token below.', 'success');
      updateContentCloudChip('Supabase ready', 'success');
      setContentCloudMessage('Members, committee, alumni, events, gallery, and admin accounts can now be published to Supabase. Use “Push local content to Supabase” once after schema setup to migrate your existing browser data.', 'success');
      attachRealtime();
      updateAdminTokenUi();
      await testAdminApiToken();
      if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
      if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      if (typeof refreshAdminAccountsFromCloud === 'function') refreshAdminAccountsFromCloud(false);
      if (typeof refreshSiteSettingsFromCloud === 'function') refreshSiteSettingsFromCloud();
    } catch (err) {
      console.error('Supabase init failed:', err);
      state.ready = false;
      state.note = 'Supabase not connected';
      updateBadge('Cloud sync: setup needed', 'warn');
      updateAdminNotice(`<strong>Supabase connection failed.</strong> ${String(err.message || err)}<br>Check your URL, anon key, and run <code>supabase/schema.sql</code> and <code>supabase/step7-content-sync.sql</code> in the SQL editor.`, 'warn');
      updateContentCloudChip('Setup needed', 'warn');
      setContentCloudMessage(`Content sync setup failed: ${String(err.message || err)}`, 'warn');
    }
  }

  function attachRealtime() {
    if (!state.ready || state.channel) return;
    state.channel = state.client
      .channel('public:utp-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concerns' }, () => {
        if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.members }, () => {
        if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.committee }, () => {
        if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.alumni }, () => {
        if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.events }, () => {
        if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.gallery }, () => {
        if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.admins }, () => {
        if (typeof refreshAdminAccountsFromCloud === 'function') refreshAdminAccountsFromCloud(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: CONTENT_TABLES.settings }, () => {
        if (typeof refreshSiteSettingsFromCloud === 'function') refreshSiteSettingsFromCloud();
      })
      .subscribe();
  }

  async function loadPayloadCollection(collection) {
    if (!state.ready) return null;
    const table = CONTENT_TABLES[collection];
    if (!table) throw new Error(`Unknown collection: ${collection}`);
    const { data, error } = await state.client.from(table).select('*').order('updated_at', { ascending: false });
    if (error) {
      if (isMissingRelationError(error, table)) {
        console.warn(missingRelationMessage(table));
        return [];
      }
      throw error;
    }
    return Array.isArray(data) ? data.map(mapPayloadRow) : [];
  }

  async function savePayloadItem(collection, item) {
    if (!state.ready) return item;
    const data = await adminContentApi('POST', collection, { collection, item: toPayloadRow(item) });
    return data.item ? mapPayloadRow(data.item) : item;
  }

  async function deletePayloadItem(collection, id) {
    if (!state.ready) return true;
    await adminContentApi('DELETE', collection, { collection, id: Number(id) });
    return true;
  }

  window.submitConcernToServer = async function (item) {
    const rsp = await fetch('/api/concern-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concern: toConcernRow(item) })
    });
    if (rsp.status === 404) {
      return window.saveConcernToCloud(item);
    }
    const data = await rsp.json().catch(() => ({}));
    if (!rsp.ok || data.ok === false) throw new Error(data.error || 'Concern submit API failed');
    const saved = data.item ? mapConcernRow(data.item) : item;
    if (typeof refreshConcernsFromCloud === 'function') setTimeout(() => refreshConcernsFromCloud(true), 150);
    return saved;
  };

  window.loadConcernsFromCloud = async function () {
    if (!state.ready) return null;
    const isAdminView = typeof adminMode === 'function' && adminMode();
    if (isAdminView) {
      const data = await adminApiFetch('GET');
      return Array.isArray(data.items) ? data.items.map(mapConcernRow) : [];
    }
    let query = state.client.from('concerns').select('*').order('updated_at', { ascending: false }).eq('visibility', 'trackable');
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.map(mapConcernRow) : [];
  };

  window.saveConcernToCloud = async function (item) {
    if (!state.ready) return item;
    const row = toConcernRow(item);
    const isAdminView = typeof adminMode === 'function' && adminMode();
    if (isAdminView) {
      const data = await adminApiFetch('POST', row);
      return mapConcernRow(data.item);
    }
    const { data, error } = await state.client
      .from('concerns')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return mapConcernRow(data);
  };

  window.loadMembersFromCloud = () => loadPayloadCollection('members');
  window.loadCommitteeFromCloud = () => loadPayloadCollection('committee');
  window.loadAlumniFromCloud = () => loadPayloadCollection('alumni');
  window.loadEventsFromCloud = () => loadPayloadCollection('events');
  window.loadGalleryFromCloud = () => loadPayloadCollection('gallery');
  window.loadAdminAccountsFromCloud = () => loadPayloadCollection('admins');
  window.saveMemberToCloud = item => savePayloadItem('members', item);
  window.saveCommitteeToCloud = item => savePayloadItem('committee', item);
  window.saveAlumniToCloud = item => savePayloadItem('alumni', item);
  window.saveEventToCloud = item => savePayloadItem('events', item);
  window.saveGalleryItemToCloud = item => savePayloadItem('gallery', item);
  window.saveAdminAccountsToCloud = async items => {
    if (!state.ready) return items;
    const cleanItems = dedupeItemsById(items || [], 'admin accounts');
    const data = await adminContentApi('POST', 'admins', { collection: 'admins', items: cleanItems.map(toPayloadRow) });
    return Array.isArray(data.items) ? data.items.map(mapPayloadRow) : cleanItems;
  };
  window.deleteMemberFromCloud = id => deletePayloadItem('members', id);
  window.deleteCommitteeFromCloud = id => deletePayloadItem('committee', id);
  window.deleteAlumniFromCloud = id => deletePayloadItem('alumni', id);
  window.deleteEventFromCloud = id => deletePayloadItem('events', id);
  window.deleteGalleryItemFromCloud = id => deletePayloadItem('gallery', id);
  window.uploadDashboardMediaFile = async function (file, options = {}) {
    if (!state.ready || !state.client) throw new Error('Supabase is not connected');
    const folder = (options.folder || 'general').replace(/[^a-z0-9/_-]/gi, '-');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const safeBase = (file.name.replace(/\.[^.]+$/, '') || 'file').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const path = `${folder}/${Date.now()}-${safeBase}.${ext}`;
    const { error } = await state.client.storage.from(MEDIA_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
    });
    if (error) throw error;
    const { data } = state.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    if (!data || !data.publicUrl) throw new Error('Could not get public media URL');
    return data.publicUrl;
  };

  window.loadSiteSettingsFromCloud = async function () {
    if (!state.ready) return null;
    const { data, error } = await state.client.from(CONTENT_TABLES.settings).select('*');
    if (error) { console.warn('Settings load error:', error); return null; }
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    return map;
  };

  window.saveSiteSettingToCloud = async function (key, value) {
    if (!state.ready) return;
    await adminContentApi('POST', 'settings', { key, value });
  };

  window.pushContentToCloud = async function () {
    if (!state.ready) {
      setContentCloudMessage('Supabase is not connected yet. Check supabase-config.js first.', 'warn');
      return;
    }
    if (!adminInboxToken()) {
      setContentCloudMessage('Connect the secure admin inbox first so Vercel can publish content safely.', 'warn');
      return;
    }
    const snapshot = typeof window.getCloudContentSnapshot === 'function' ? window.getCloudContentSnapshot() : null;
    if (!snapshot) {
      setContentCloudMessage('Local content snapshot not available on this page.', 'warn');
      return;
    }
    try {
      const collections = [
        { key: 'members',   label: 'members',        items: dedupeItemsById(snapshot.members || [], 'members') },
        { key: 'committee', label: 'committee',       items: dedupeItemsById(snapshot.committee || [], 'committee') },
        { key: 'alumni',    label: 'alumni',          items: dedupeItemsById(snapshot.alumni || [], 'alumni') },
        { key: 'events',    label: 'events',          items: dedupeItemsById(snapshot.events || [], 'events') },
        { key: 'gallery',   label: 'gallery items',   items: dedupeItemsById(snapshot.gallery || [], 'gallery items') },
        { key: 'admins',    label: 'admin accounts',  items: dedupeItemsById(snapshot.adminAccounts || [], 'admin accounts') },
      ];

      const toSync = collections.filter(c => c.items.length > 0);
      if (!toSync.length) {
        setContentCloudMessage('Nothing to publish — no local data found. Add members, events, or gallery items first, then push again.', 'warn');
        return;
      }

      const labels = toSync.map(c => c.label).join(', ');
      setContentCloudMessage(`Publishing ${labels} to Supabase…`, 'muted');

      const errors = [];
      for (const col of toSync) {
        try {
          await adminContentApi('POST', col.key, { collection: col.key, items: col.items.map(toPayloadRow) });
        } catch (err) {
          errors.push(`${col.label}: ${String(err.message || err)}`);
        }
      }

      // Also push site settings (community links, committee message)
      try {
        const cm = typeof window.getCommitteeMessage === 'function' ? window.getCommitteeMessage() : null;
        const cl = typeof communityLinksData !== 'undefined' ? communityLinksData : null;
        if (cm) await adminContentApi('POST', 'settings', { key: 'committee_message', value: cm });
        if (cl) await adminContentApi('POST', 'settings', { key: 'community_links', value: cl });
      } catch(e) { console.warn('Settings push failed:', e); }

      if (errors.length) {
        const succeeded = toSync.length - errors.length;
        const msg = succeeded
          ? `Partially published (${succeeded}/${toSync.length} collections). Errors — ${errors.join(' | ')}`
          : `Publish failed — ${errors.join(' | ')}`;
        setContentCloudMessage(msg, 'warn');
      } else {
        setContentCloudMessage(`Content published (${toSync.length} collection${toSync.length !== 1 ? 's' : ''}). All devices will now read from Supabase.`, 'success');
      }

      if (typeof refreshDirectoryMediaFromCloud === 'function') refreshDirectoryMediaFromCloud(true);
      if (typeof refreshAdminAccountsFromCloud === 'function') refreshAdminAccountsFromCloud(false);
    } catch (err) {
      setContentCloudMessage(String(err.message || err), 'warn');
    }
  };

  window.pullContentFromCloud = async function () {
    try {
      setContentCloudMessage('Refreshing members, committee, alumni, events, gallery, and admin accounts from Supabase...', 'muted');
      if (typeof refreshDirectoryMediaFromCloud === 'function') await refreshDirectoryMediaFromCloud(true);
      if (typeof refreshAdminAccountsFromCloud === 'function') await refreshAdminAccountsFromCloud(false);
      if (typeof refreshSiteSettingsFromCloud === 'function') await refreshSiteSettingsFromCloud();
      setContentCloudMessage('Cloud content refreshed on this browser.', 'success');
    } catch (err) {
      setContentCloudMessage(String(err.message || err), 'warn');
    }
  };

  window.connectAdminInboxToken = async function (token) {
    if (!token) throw new Error('Enter the admin inbox token first');
    storeAdminInboxToken(token);
    const ok = await testAdminApiToken();
    if (!ok) throw new Error('Token rejected by Vercel API');
    if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
    return true;
  };

  window.clearAdminInboxToken = function () {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    const input = document.getElementById('adminInboxTokenInput');
    if (input) input.value = '';
    updateAdminTokenUi();
    setAdminInboxMessage('Secure admin inbox disconnected on this browser.', 'muted');
  };

  window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formAdminInboxToken');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await window.connectAdminInboxToken(DEFAULT_ADMIN_INBOX_TOKEN);
        } catch (err) {
          setAdminInboxMessage(String(err.message || err), 'warn');
        }
      });
    }
    window.addEventListener('focus', async () => {
      try {
        if (typeof refreshDirectoryMediaFromCloud === 'function') await refreshDirectoryMediaFromCloud(false);
        if (typeof refreshAdminAccountsFromCloud === 'function') await refreshAdminAccountsFromCloud(false);
        if (typeof refreshSiteSettingsFromCloud === 'function') await refreshSiteSettingsFromCloud();
      } catch (err) {
        console.warn('Cloud refresh on focus failed:', err);
      }
    });
    initSupabase();
  });
})();
