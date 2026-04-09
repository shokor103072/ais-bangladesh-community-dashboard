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

  function el(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    node.innerHTML = html;
    return node;
  }

  function adminInboxToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || '';
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

  async function adminApiFetch(method = 'GET', concern) {
    const token = adminInboxToken();
    if (!token) throw new Error('Admin inbox token not connected on this browser');
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
      attachRealtime();
      updateAdminTokenUi();
      await testAdminApiToken();
      if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
    } catch (err) {
      console.error('Supabase init failed:', err);
      state.ready = false;
      state.note = 'Supabase not connected';
      updateBadge('Cloud sync: setup needed', 'warn');
      updateAdminNotice(`<strong>Supabase connection failed.</strong> ${String(err.message || err)}<br>Check your URL, anon key, and run <code>supabase/schema.sql</code> in the SQL editor.`, 'warn');
    }
  }

  function attachRealtime() {
    if (!state.ready || state.channel) return;
    state.channel = state.client
      .channel('public:concerns-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concerns' }, () => {
        if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
      })
      .subscribe();
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

  window.connectAdminInboxToken = async function (token) {
    if (!token) throw new Error('Enter the admin inbox token first');
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    updateAdminTokenUi();
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
        const input = document.getElementById('adminInboxTokenInput');
        try {
          await window.connectAdminInboxToken(input.value.trim());
        } catch (err) {
          setAdminInboxMessage(String(err.message || err), 'warn');
        }
      });
    }
    initSupabase();
  });
})();
