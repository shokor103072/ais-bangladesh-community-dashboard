(function () {
  const config = window.SUPABASE_CONFIG || {};
  const state = {
    enabled: !!config.enabled,
    ready: false,
    client: null,
    channel: null,
    note: 'Local browser mode'
  };

  function el(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    node.innerHTML = html;
    return node;
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

  function updateAdminNotice(message, tone = 'muted') {
    let box = document.getElementById('cloudAdminNotice');
    if (!box) {
      const host = document.querySelector('#modalAdminSettings .modal-body');
      if (!host) return;
      box = el('div', { id: 'cloudAdminNotice', class: `cloud-admin-notice ${tone}` });
      host.insertBefore(box, host.firstChild);
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
      timeline: Array.isArray(item.timeline) ? item.timeline : []
    };
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
      updateAdminNotice('<strong>Cloud sync is ON.</strong> Concern submissions are now shared across devices through Supabase. Admin login and full role security should be moved to secure Vercel API routes next.', 'success');
      attachRealtime();
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

  window.loadConcernsFromCloud = async function () {
    if (!state.ready) return null;
    const isAdminView = typeof adminMode === 'function' && adminMode();
    let query = state.client.from('concerns').select('*').order('updated_at', { ascending: false });
    if (!isAdminView) query = query.eq('visibility', 'trackable');
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.map(mapConcernRow) : [];
  };

  window.saveConcernToCloud = async function (item) {
    if (!state.ready) return item;
    const row = toConcernRow(item);
    const { data, error } = await state.client
      .from('concerns')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return mapConcernRow(data);
  };

  window.addEventListener('DOMContentLoaded', initSupabase);
})();
