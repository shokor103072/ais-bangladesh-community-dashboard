/* --------- Storage helpers --------- */
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

let membersData = store.get('utp_members', members);
let committeeData = store.get('utp_committee', committee);
let alumniData = store.get('utp_alumni', alumni);
let eventsData = store.get('utp_events', events);
let announcementsData = store.get('utp_announcements', announcements);
let achievementsData = store.get('utp_achievements', achievements);
let galleryData = store.get('utp_gallery', gallery);
let rsvps = store.get('utp_rsvps', {});
const defaultConcerns = [];
let concernsData = store.get('utp_concerns', defaultConcerns);
if (!Array.isArray(concernsData)) concernsData = [];

function persistConcernsLocal() {
  store.set('utp_concerns', concernsData);
}

async function refreshConcernsFromCloud(forceRender = true) {
  if (typeof window.loadConcernsFromCloud !== 'function') return concernsData;
  try {
    const cloudItems = await window.loadConcernsFromCloud();
    if (Array.isArray(cloudItems)) {
      concernsData = cloudItems;
      persistConcernsLocal();
      if (forceRender) renderConcerns();
    }
  } catch (err) {
    console.warn('Cloud concern refresh failed:', err);
  }
  return concernsData;
}

async function saveConcernItem(item, options = {}) {
  concernsData = Array.isArray(concernsData) ? concernsData : [];
  const idx = concernsData.findIndex(c => c.id === item.id);
  if (idx >= 0) concernsData[idx] = item;
  else concernsData.unshift(item);
  concernsData = [...concernsData].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  persistConcernsLocal();

  if (!options.skipCloud && typeof window.saveConcernToCloud === 'function') {
    try {
      const saved = await window.saveConcernToCloud(item);
      if (saved) {
        const savedIdx = concernsData.findIndex(c => c.id === saved.id);
        if (savedIdx >= 0) concernsData[savedIdx] = saved;
        else concernsData.unshift(saved);
        concernsData = [...concernsData].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        persistConcernsLocal();
      }
    } catch (err) {
      console.warn('Cloud concern save failed:', err);
    }
  }
  return item;
}

function persistMembersLocal() { store.set('utp_members', membersData); }
function persistCommitteeLocal() { store.set('utp_committee', committeeData); }
function persistAlumniLocal() { store.set('utp_alumni', alumniData); }
function persistEventsLocal() { store.set('utp_events', eventsData); }
function persistGalleryLocal() { store.set('utp_gallery', galleryData); }

window.getCloudContentSnapshot = function () {
  return {
    members: Array.isArray(membersData) ? membersData : [],
    committee: Array.isArray(committeeData) ? committeeData : [],
    alumni: Array.isArray(alumniData) ? alumniData : [],
    events: Array.isArray(eventsData) ? eventsData : [],
    gallery: Array.isArray(galleryData) ? galleryData : [],
    adminAccounts: typeof window.getAdminAccountsSnapshot === 'function' ? window.getAdminAccountsSnapshot() : []
  };
};

window.applyCloudContentSnapshot = function (payload = {}, forceRender = true) {
  if (Array.isArray(payload.members)) { membersData = payload.members; persistMembersLocal(); }
  if (Array.isArray(payload.committee)) { committeeData = payload.committee; persistCommitteeLocal(); }
  if (Array.isArray(payload.alumni)) { alumniData = payload.alumni; persistAlumniLocal(); }
  if (Array.isArray(payload.events)) { eventsData = payload.events; persistEventsLocal(); }
  if (Array.isArray(payload.gallery)) { galleryData = payload.gallery; persistGalleryLocal(); }
  if (Array.isArray(payload.adminAccounts) && typeof window.applyAdminAccountsSnapshot === 'function') {
    window.applyAdminAccountsSnapshot(payload.adminAccounts, false);
  }
  if (forceRender) {
    renderHome();
    renderMembers();
    renderCommittee();
    renderAlumni();
    renderEvents();
    renderGallery();
    renderOnboarding();
  }
};

async function refreshDirectoryMediaFromCloud(forceRender = true) {
  try {
    if (typeof window.loadMembersFromCloud === 'function') {
      const cloudMembers = await window.loadMembersFromCloud();
      if (Array.isArray(cloudMembers) && (cloudMembers.length || !membersData.length)) {
        membersData = cloudMembers;
        persistMembersLocal();
      }
    }
    if (typeof window.loadCommitteeFromCloud === 'function') {
      const cloudCommittee = await window.loadCommitteeFromCloud();
      if (Array.isArray(cloudCommittee) && (cloudCommittee.length || !committeeData.length)) {
        committeeData = cloudCommittee;
        persistCommitteeLocal();
      }
    }
    if (typeof window.loadAlumniFromCloud === 'function') {
      const cloudAlumni = await window.loadAlumniFromCloud();
      if (Array.isArray(cloudAlumni) && (cloudAlumni.length || !alumniData.length)) {
        alumniData = cloudAlumni;
        persistAlumniLocal();
      }
    }
    if (typeof window.loadEventsFromCloud === 'function') {
      const cloudEvents = await window.loadEventsFromCloud();
      if (Array.isArray(cloudEvents) && (cloudEvents.length || !eventsData.length)) {
        eventsData = cloudEvents;
        persistEventsLocal();
      }
    }
    if (typeof window.loadGalleryFromCloud === 'function') {
      const cloudGallery = await window.loadGalleryFromCloud();
      if (Array.isArray(cloudGallery) && (cloudGallery.length || !galleryData.length)) {
        galleryData = cloudGallery;
        persistGalleryLocal();
      }
    }
    if (forceRender) {
      renderHome();
      renderMembers();
      renderCommittee();
      renderAlumni();
      renderEvents();
      renderGallery();
      renderOnboarding();
    }
  } catch (err) {
    console.warn('Cloud content refresh failed:', err);
  }
}
const intakeMonths = ['January', 'May', 'September'];
const livingPlaces = ['Inside UTP', 'Pangsapuri', 'SIBC', 'Bandar U', 'Tasik Putra', 'Tronoh', 'KG Bali', 'Soho', 'IFS Soho', 'Ipoh'];
const defaultPublicVisibility = { email: true, phone: true, birthday: true, intake: true, place: true, social: true };
let publicVisibility = store.get('utp_public_visibility', defaultPublicVisibility);
const defaultCommunityLinks = { whatsapp: '', facebook: '', instagram: '' };
let communityLinksData = store.get('utp_community_links', defaultCommunityLinks);
const defaultOnboardSteps = [
  'Create UTP email & access',
  'Join WhatsApp & Telegram groups',
  'Attend orientation briefing',
  'Register with International Office',
  'Open CIMB bank account',
  'Get student ID & library access'
];
let onboardSteps = store.get('utp_onboard_steps', defaultOnboardSteps);
const defaultFaqData = [
  { q: 'How do I renew my visa?', a: 'Submit passport, offer letter, and insurance to ISA at least 1 month before expiry.' },
  { q: 'Where is the Bangladeshi store?', a: 'Near V5 – ask welfare head for current location.' },
  { q: 'How to join events?', a: 'RSVP on Events page. Check announcements for deadlines.' }
];
let faqData = store.get('utp_faqs', defaultFaqData);

/* --------- View Switcher --------- */
const viewBadge = document.getElementById('viewBadge');
const allowedViewModes = new Set(['auto', 'desktop']);
function normalizeViewMode(mode) {
  return allowedViewModes.has(mode) ? mode : 'auto';
}
function applyView(mode) {
  const safeMode = normalizeViewMode(mode);
  document.body.classList.remove('view-auto', 'view-desktop', 'view-mobile');
  document.body.classList.add('view-' + safeMode);
  localStorage.setItem('utp_view_mode', safeMode);
  document.querySelectorAll('.view-switcher button').forEach(b => b.classList.toggle('active', b.dataset.mode === safeMode));
  viewBadge.textContent = 'Viewing: ' + safeMode.charAt(0).toUpperCase() + safeMode.slice(1);
}
(function initView() {
  const saved = normalizeViewMode(localStorage.getItem('utp_view_mode') || 'auto');
  applyView(saved);
  document.querySelectorAll('.view-switcher button').forEach(btn => btn.addEventListener('click', () => applyView(btn.dataset.mode)));
})();

document.addEventListener('DOMContentLoaded', () => {
  initUploadWidgets();
});

/* --------- Navigation --------- */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (id === 'home') renderHome();
  if (id === 'members') renderMembers();
  if (id === 'committee') renderCommittee();
  if (id === 'alumni') renderAlumni();
  if (id === 'events') renderEvents();
  if (id === 'achievements') renderAchievements();
  if (id === 'gallery') renderGallery();
  if (id === 'concerns') renderConcerns();
  if (id === 'onboarding') renderOnboarding();
  if (id === 'emergency') renderEmergency();
}
document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));

/* --------- Utils --------- */
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const monthName = m => new Date(2000, m, 1).toLocaleString('en-GB', { month: 'long' });
const avatarOf = (v) => v || 'https://i.pravatar.cc/200';
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function normalize(str) { return (str || '').toString().trim().toLowerCase(); }
function intakeLabel(m) {
  if (!m) return '';
  if (m.intake) return m.intake;
  const month = m.intakeMonth || '';
  const year = m.intakeYear || '';
  return month && year ? `${month} Intake ${year}` : (month || year || '');
}
const adminMode = () => typeof isAdmin !== 'undefined' && isAdmin;
function showField(key) { return adminMode() || !!publicVisibility[key]; }
function socialLinksOf(m) {
  if (!showField('social')) return '';
  return [
    m.facebook ? `<a class="chip" href="${m.facebook}" target="_blank" rel="noopener">Facebook</a>` : '',
    m.instagram ? `<a class="chip" href="${m.instagram}" target="_blank" rel="noopener">Instagram</a>` : '',
    m.whatsapp ? `<a class="chip" href="${m.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : '',
    m.linkedin ? `<a class="chip" href="${m.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : '',
    m.googleScholar ? `<a class="chip" href="${m.googleScholar}" target="_blank" rel="noopener">Google Scholar</a>` : '',
    m.researchGate ? `<a class="chip" href="${m.researchGate}" target="_blank" rel="noopener">ResearchGate</a>` : '',
    m.website ? `<a class="chip" href="${m.website}" target="_blank" rel="noopener">Website</a>` : ''
  ].filter(Boolean).join('');
}
function currentAdminName() { return (typeof adminSession !== 'undefined' && adminSession && adminSession.name) ? adminSession.name : 'Committee Admin'; }
function isValidUtpEmail(email) { return /^[A-Za-z0-9._%+-]+@utp\.edu\.my$/i.test((email || '').trim()); }
function looksLikeLocalFilePath(value='') { return /^[A-Za-z]:\\|^\\/.test(String(value).trim()) || String(value).includes('fakepath'); }
function isVideoUrl(url='') {
  const v = String(url || '').trim().toLowerCase();
  return v.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(v);
}
function detectMediaType(url='') { return isVideoUrl(url) ? 'video' : 'image'; }
function mediaPreviewHtml(url='', title='', opts={}) {
  const safeUrl = escapeHtml(url || '');
  const safeTitle = escapeHtml(title || '');
  if (detectMediaType(url) === 'video') {
    return `<video src="${safeUrl}" ${opts.controls ? 'controls' : 'muted playsinline preload="metadata"'}></video>`;
  }
  return `<img src="${safeUrl}" alt="${safeTitle}">`;
}
function formatBytes(bytes=0) {
  const n = Number(bytes) || 0;
  if (!n) return 'Ready';
  const units = ['B','KB','MB','GB'];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx += 1; }
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}
async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}
function setUploadPreview(previewId, value='', label='') {
  const box = document.getElementById(previewId);
  if (!box) return;
  if (!value) {
    box.classList.remove('active');
    box.innerHTML = '';
    return;
  }
  box.classList.add('active');
  box.innerHTML = `${mediaPreviewHtml(value, label, { controls: detectMediaType(value) === 'video' })}<div class="meta"><strong>${escapeHtml(label || 'Selected file')}</strong><span>${detectMediaType(value) === 'video' ? 'Video ready' : 'Image ready'}</span></div>`;
}
function syncUploadPreviewFromInput(inputId, previewId, label='Current file') {
  const input = document.getElementById(inputId);
  if (!input) return;
  const value = String(input.value || '').trim();
  setUploadPreview(previewId, value, label || 'Current file');
}
async function assignUploadedFileToInput(file, options = {}) {
  const { inputId, previewId, folder = 'general', kind = 'image' } = options;
  const input = document.getElementById(inputId);
  if (!input || !file) return;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (kind === 'image' && !isImage) {
    showToast('Please upload an image file here');
    return;
  }
  if (kind === 'media' && !(isImage || isVideo)) {
    showToast('Please upload an image or video file');
    return;
  }
  try {
    let finalUrl = '';
    if (typeof window.uploadDashboardMediaFile === 'function') {
      try {
        finalUrl = await window.uploadDashboardMediaFile(file, { folder, kind: isVideo ? 'video' : 'image' });
      } catch (err) {
        console.warn('Cloud upload failed:', err);
      }
    }
    if (!finalUrl) {
      if (!isImage) {
        showToast('Video upload needs Supabase Storage. Create the community-media bucket first.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast('This image is large. Enable Supabase Storage for larger uploads.');
        return;
      }
      finalUrl = await fileToDataUrl(file);
    }
    input.value = finalUrl;
    setUploadPreview(previewId, finalUrl, `${file.name} • ${formatBytes(file.size)}`);
    showToast(isVideo ? 'Video attached successfully' : 'Image attached successfully');
  } catch (err) {
    console.error(err);
    showToast(String(err.message || err));
  }
}
function initUploadWidgets() {
  document.querySelectorAll('.upload-panel').forEach(panel => {
    if (panel.dataset.bound === '1') return;
    panel.dataset.bound = '1';
    const inputId = panel.dataset.uploadTarget;
    const previewId = panel.dataset.previewTarget;
    const fileInputId = panel.dataset.fileInput;
    const folder = panel.dataset.folder || 'general';
    const kind = panel.dataset.uploadKind || 'image';
    const fileInput = document.getElementById(fileInputId);
    const dropzone = panel.querySelector('[data-role="dropzone"]');
    if (!fileInput || !dropzone) return;
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      await assignUploadedFileToInput(file, { inputId, previewId, folder, kind });
      e.target.value = '';
    });
    ['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    }));
    ['dragleave','dragend','drop'].forEach(evt => dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    }));
    dropzone.addEventListener('drop', async e => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      await assignUploadedFileToInput(file, { inputId, previewId, folder, kind });
    });
    const input = document.getElementById(inputId);
    if (input) input.addEventListener('input', () => {
      const value = String(input.value || '').trim();
      if (!value) setUploadPreview(previewId, '', '');
      else if (!looksLikeLocalFilePath(value)) setUploadPreview(previewId, value, 'Current file');
    });
  });
}
window.syncUploadPreviewFromInput = syncUploadPreviewFromInput;
window.looksLikeLocalFilePath = looksLikeLocalFilePath;
function escapeHtml(str) { return (str || '').toString().replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function canViewLogs() { return typeof isMasterAdmin === 'function' && isMasterAdmin(); }
function communityLinksHtml() {
  const links = [
    communityLinksData.whatsapp ? `<a class="chip" href="${communityLinksData.whatsapp}" target="_blank" rel="noopener">Community WhatsApp</a>` : '',
    communityLinksData.facebook ? `<a class="chip" href="${communityLinksData.facebook}" target="_blank" rel="noopener">Community Facebook</a>` : '',
    communityLinksData.instagram ? `<a class="chip" href="${communityLinksData.instagram}" target="_blank" rel="noopener">Community Instagram</a>` : ''
  ].filter(Boolean);
  return links.length ? links.join('') : '<span class="muted">Community links will appear here after admin setup.</span>';
}
function topDepartments(limit = 4) {
  const counts = membersData.reduce((acc, m) => {
    acc[m.department] = (acc[m.department] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}
function nextEvent() {
  const now = new Date();
  return [...eventsData].filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
}
function completionRate(list, key) {
  if (!list.length) return 0;
  const filled = list.filter(x => !!(x && x[key])).length;
  return Math.round((filled / list.length) * 100);
}
function uniqueCount(arr, selector) {
  return new Set(arr.map(selector).filter(Boolean)).size;
}

/* --------- HOME --------- */
function renderHome() {
  const now = new Date();
  const total = membersData.length;
  const ug = membersData.filter(m => m.category === 'Undergraduate').length;
  const pg = membersData.filter(m => ['Msc', 'PhD'].includes(m.category)).length;
  const foundation = membersData.filter(m => m.category === 'Foundation').length;
  const staffCount = membersData.filter(m => ['Lecturer', 'Staff (Research Scientist/Post Doctoral)'].includes(m.category)).length;
  const bday = membersData.filter(m => m.birthday && new Date(m.birthday).getMonth() === now.getMonth());
  const grads = membersData.filter(m => String(m.graduateYear || '') === String(now.getFullYear()));
  const pinned = announcementsData.filter(a => a.pinned).sort((a,b)=> new Date(b.date)-new Date(a.date));
  const pinnedPreview = pinned.length ? pinned.slice(0, 4) : [...announcementsData].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
  const upcoming = nextEvent();
  const latestAch = [...achievementsData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  const topDepts = topDepartments();
  const page = document.getElementById('page-home');

  page.innerHTML = `
    <div class="hero card">
      <div class="hero-grid">
        <div>
          <div class="section-kicker">Bangladesh Community Dashboard</div>
          <h2>A smarter, cleaner and more engaging digital home for AIS Bangladesh Chapter, UTP</h2>
          <p>Browse members, spotlight achievements, track events, highlight the committee, and manage community updates from one polished dashboard.</p>
          <div class="hero-stats">
            <div class="hero-stat"><strong>${total}</strong><span>Total community members</span></div>
            <div class="hero-stat"><strong>${committeeData.length}</strong><span>Current committee positions</span></div>
            <div class="hero-stat"><strong>${eventsData.length}</strong><span>Events and gatherings listed</span></div>
            <div class="hero-stat"><strong>${alumniData.length}</strong><span>Alumni in the network</span></div>
          </div>
        </div>
        <div>
          <div class="spotlight-list">
            <div class="spotlight-item"><div><strong>Next event</strong><div style="opacity:.8">${upcoming ? `${upcoming.title} • ${fmtDate(upcoming.date)}` : 'No upcoming event yet'}</div></div><span class="chip">📍</span></div>
            <div class="spotlight-item"><div><strong>Pinned updates</strong><div style="opacity:.8">${pinned.length} important update${pinned.length === 1 ? '' : 's'} currently highlighted</div></div><span class="chip">📌</span></div>
            <div class="spotlight-item"><div><strong>Community links</strong><div style="opacity:.8">WhatsApp, Facebook, and Instagram shortcuts</div></div><span class="chip">🔗</span></div>
            <div class="spotlight-item"><div><strong>Data richness</strong><div style="opacity:.8">${completionRate(membersData, 'photo')}% profiles already include member photos</div></div><span class="chip">✨</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-strip">
      <div class="card"><div class="section-kicker">Students</div><div class="stat"><div class="icon">🎓</div><div><div class="v">${ug}</div><div class="l">Undergraduate</div></div></div></div>
      <div class="card"><div class="section-kicker">Research</div><div class="stat"><div class="icon">🧪</div><div><div class="v">${pg}</div><div class="l">MSc & PhD</div></div></div></div>
      <div class="card"><div class="section-kicker">Foundation</div><div class="stat"><div class="icon">🌱</div><div><div class="v">${foundation}</div><div class="l">Foundation members</div></div></div></div>
      <div class="card"><div class="section-kicker">Support</div><div class="stat"><div class="icon">🤝</div><div><div class="v">${staffCount}</div><div class="l">Staff & lecturers</div></div></div></div>
    </div>

    <div class="admin-console">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div>
          <strong>Admin quick actions</strong>
          <div style="opacity:.8;font-size:13px;margin-top:4px">Manage committee, alumni, announcements, events, gallery, achievements, checklist, FAQ, and public visibility.</div>
        </div>
        <button onclick="openModal(&#39;modalAdminSettings&#39;)">⚙️ Open admin settings</button>
      </div>
      <div class="admin-console-grid">
        <button onclick="showPage('committee')">Committee</button>
        <button onclick="showPage('members')">Members</button>
        <button onclick="showPage('alumni')">Alumni</button>
        <button onclick="showPage('events')">Events</button>
        <button onclick="showPage('achievements')">Achievements</button>
        <button onclick="showPage('gallery')">Gallery</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="ticker"><div class="ticker-track" id="tickerTrack"></div></div>
    </div>

    <div class="grid grid-2" style="margin-top:14px">
      <div class="card cover-card">
        <div class="section-title"><h2>📍 Next Event & RSVP</h2><span class="chip">Calendar</span></div>
        <div id="homeNextEvent"></div>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>🏆 Latest Achievements</h2><span class="chip">Highlights</span></div>
        <div class="list" id="homeAchievements"></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:14px">
      <div class="card cover-card">
        <div class="section-title"><h2>🏢 Department distribution</h2><span class="chip">${uniqueCount(membersData, x => x.department)} depts</span></div>
        <div id="homeDeptMetrics" class="list"></div>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>🔗 Quick links</h2><span class="chip">Community</span></div>
        <div class="inline-metrics" id="homeQuickLinks"></div>
      </div>
    </div>

    <div class="card cover-card" style="margin-top:14px">
      <div class="section-title"><h2>📢 Pinned updates</h2><span class="chip">${pinnedPreview.length}</span></div>
      <div class="grid grid-2" id="homePinnedList"></div>
    </div>

    <div class="grid grid-2" style="margin-top:14px">
      <div class="card cover-card">
        <div class="section-title"><h2>🎂 Birthday spotlight – ${monthName(now.getMonth())}</h2><span class="chip">${bday.length}</span></div>
        <div class="list" id="homeBirthdays"></div>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>🎓 Graduation spotlight ${now.getFullYear()}</h2><span class="chip">${grads.length}</span></div>
        <div class="list" id="homeGrads"></div>
      </div>
    </div>
  `;

  const track = page.querySelector('#tickerTrack');
  const tickerItems = pinnedPreview.length ? pinnedPreview : [];
  const htmlItems = tickerItems.length ? tickerItems.map(a => `<span class="ticker-item"><span class="dot"></span><strong>${a.title}</strong> – ${a.content}</span>`).join('') : '<span class="ticker-item"><span class="dot"></span><strong>No pinned update yet</strong> – Admin can pin important announcements here.</span>';
  track.innerHTML = htmlItems + htmlItems;
  page.querySelector('#homeQuickLinks').innerHTML = communityLinksHtml();

  page.querySelector('#homeBirthdays').innerHTML = bday.length ? bday.map(m => `
    <div class="person">
      <img class="avatar" src="${avatarOf(m.photo)}" alt="">
      <div><div><strong>${m.name}</strong></div><div class="muted">${fmtDate(m.birthday)} • ${m.department}</div></div>
    </div>`).join('') : `<div class="empty-state">No birthdays recorded for this month.</div>`;

  page.querySelector('#homeGrads').innerHTML = grads.length ? grads.map(m => `
    <div class="person">
      <img class="avatar" src="${avatarOf(m.photo)}" alt="">
      <div><div><strong>${m.name}</strong></div><div class="muted">${m.category} • ${m.department}</div></div>
    </div>`).join('') : `<div class="empty-state">No graduating members recorded for ${now.getFullYear()}.</div>`;

  const ne = page.querySelector('#homeNextEvent');
  if (upcoming) {
    const going = !!rsvps[upcoming.id];
    ne.innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <img src="${upcoming.image || 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800'}" alt="" style="width:170px;height:120px;object-fit:cover;border-radius:16px">
        <div style="flex:1;min-width:220px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div style="font-weight:800;font-size:20px">${upcoming.title}</div><span class="chip">${fmtDate(upcoming.date)}</span></div>
          <div class="muted" style="margin-top:6px">${upcoming.time} • ${upcoming.venue}</div>
          <div style="margin-top:10px">${upcoming.description || ''}</div>
          <div class="inline-metrics">
            <button class="primary" onclick="toggleRSVP(${upcoming.id})">${going ? 'Going ✓' : 'RSVP now'}</button>
            <span class="chip">${num(upcoming.rsvp)} going</span>
          </div>
        </div>
      </div>`;
  } else {
    ne.innerHTML = `<div class="empty-state">No upcoming events found.</div>`;
  }

  page.querySelector('#homeAchievements').innerHTML = latestAch.length ? latestAch.map(a => `
    <div class="person">
      <img class="avatar" src="${avatarOf(a.photo)}" alt="">
      <div>
        <div><strong>${a.title}</strong> <span class="chip gold">${a.type}</span></div>
        <div class="muted">${a.member} • ${fmtDate(a.date)} • ${a.department || ''}</div>
      </div>
    </div>`).join('') : `<div class="empty-state">No achievements added yet.</div>`;

  page.querySelector('#homeDeptMetrics').innerHTML = topDepts.length ? topDepts.map(([dept, count]) => {
    const pct = Math.max(8, Math.round((count / Math.max(1, membersData.length)) * 100));
    return `<div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:6px"><strong style="font-size:14px">${dept}</strong><span class="chip">${count}</span></div>
      <div class="metric-bar"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('') : `<div class="empty-state">No department information available.</div>`;

  page.querySelector('#homePinnedList').innerHTML = pinnedPreview.length ? pinnedPreview.map(a => `
    <div class="card pinned-update-card" style="padding:14px;border-left:5px solid ${a.category === 'Urgent' ? 'var(--red)' : a.pinned ? 'var(--gold)' : 'var(--green)'}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
        <div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong>${a.title}</strong>${a.pinned ? '<span class="chip gold">Pinned</span>' : ''}</div>
          <div class="muted">${fmtDate(a.date)}</div>
        </div>
        <span class="chip ${a.category === 'Urgent' ? 'red' : a.category === 'Event' ? 'gold' : 'green'}">${a.category}</span>
      </div>
      <div style="margin-top:8px">${a.content}</div>
    </div>`).join('') : `<div class="empty-state">No announcements available.</div>`;
}

/* RSVP */
function toggleRSVP(id) {
  rsvps[id] = !rsvps[id];
  const ev = eventsData.find(e => e.id === id);
  if (ev) ev.rsvp = Math.max(0, num(ev.rsvp) + (rsvps[id] ? 1 : -1));
  store.set('utp_rsvps', rsvps);
  store.set('utp_events', eventsData);
  renderHome();
  renderEvents();
}

/* --------- MEMBERS --------- */
function renderMembers() {
  const page = document.getElementById('page-members');
  const depts = [...new Set(membersData.map(m => m.department).filter(Boolean))].sort();
  const places = [...new Set(membersData.map(m => m.place).filter(Boolean))].sort((a, b) => {
    const ia = livingPlaces.indexOf(a);
    const ib = livingPlaces.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  page.innerHTML = `
    <div class="page-banner"><h2>Members Directory</h2><p>Search by name, category, gender, department, intake, place of living, phone, or email.</p></div>
    <div class="card cover-card">
      <div class="section-title"><h2>Browse community members</h2>${adminMode() ? '<button class="ghost" id="exportCsv">Export CSV</button>' : ''}</div>
      <div class="directory-toolbar">
        <div class="search-compact"><input id="mSearch" placeholder="Search name, email, phone, department, intake, or place..."></div>
        <select id="mDept"><option value="">All departments</option>${depts.map(d => `<option>${d}</option>`).join('')}</select>
        <select id="mPlace"><option value="">All places</option>${places.map(p => `<option>${p}</option>`).join('')}</select>
      </div>
      <div style="margin-top:10px">
        <div class="muted" style="font-size:12px;margin-bottom:6px">Filter by category</div>
        <div id="mCats" style="display:flex;gap:8px;flex-wrap:wrap">${['All', 'Foundation', 'Undergraduate', 'Msc', 'PhD', 'Lecturer', 'Staff (Research Scientist/Post Doctoral)'].map(c => `<button class="pill ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      </div>
      <div style="margin-top:12px">
        <div class="muted" style="font-size:12px;margin-bottom:6px">Quick filter by place of living</div>
        <div id="mPlacePills" style="display:flex;gap:8px;flex-wrap:wrap">${['All places', ...places].map((p, i) => `<button class="pill ${i === 0 ? 'active' : ''}" data-place="${i === 0 ? '' : p}">${p}</button>`).join('')}</div>
      </div>
    </div>
    <div class="grid grid-3" id="membersGrid" style="margin-top:12px"></div>
  `;
  const grid = page.querySelector('#membersGrid');
  const search = page.querySelector('#mSearch');
  const dept = page.querySelector('#mDept');
  const place = page.querySelector('#mPlace');
  const cats = page.querySelectorAll('#mCats .pill');
  const placePills = page.querySelectorAll('#mPlacePills .pill');
  let activeCat = 'All';
  let activePlace = '';
  cats.forEach(p => p.addEventListener('click', () => {
    cats.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    activeCat = p.dataset.cat;
    draw();
  }));
  placePills.forEach(p => p.addEventListener('click', () => {
    placePills.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    activePlace = p.dataset.place || '';
    place.value = activePlace;
    draw();
  }));
  search.addEventListener('input', draw);
  dept.addEventListener('change', draw);
  place.addEventListener('change', () => {
    activePlace = place.value;
    placePills.forEach(x => x.classList.toggle('active', (x.dataset.place || '') === activePlace));
    draw();
  });
  const exportBtn = page.querySelector('#exportCsv');
  if (exportBtn) exportBtn.addEventListener('click', exportMembers);
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'edit-member') openEditMember(id);
    if (button.dataset.action === 'delete-member') confirmDeleteMember(id);
  });

  function draw() {
    const q = normalize(search.value);
    const d = normalize(dept.value);
    const pl = normalize(activePlace || place.value);
    const list = membersData.filter(m => {
      const matchQ = !q || [m.name, m.email, m.phone, m.department, m.category, m.gender, m.place, intakeLabel(m), m.intakeMonth, m.intakeYear].some(v => normalize(v).includes(q));
      const matchC = activeCat === 'All' || m.category === activeCat;
      const matchD = !d || normalize(m.department) === d;
      const matchP = !pl || normalize(m.place) === pl;
      return matchQ && matchC && matchD && matchP;
    });
    grid.innerHTML = list.length ? list.map(m => `
      <div class="card cover-card">
        <div class="person" style="align-items:flex-start">
          <img class="avatar" src="${avatarOf(m.photo)}" alt="" style="width:64px;height:64px;border-radius:18px">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
              <div><strong>${m.name}</strong><div class="muted">${m.department}</div></div>
              <span class="chip">${m.category}</span>
            </div>
            <div class="inline-metrics">
              ${showField('email') && m.email ? `<span class="chip">✉️ ${m.email}</span>` : ''}
              ${showField('phone') && m.phone ? `<span class="chip">📞 ${m.phone}</span>` : ''}
              ${m.gender ? `<span class="chip">${m.gender}</span>` : ''}
              ${showField('birthday') && m.birthday ? `<span class="chip">🎂 ${fmtDate(m.birthday)}</span>` : ''}
              ${showField('intake') && intakeLabel(m) ? `<span class="chip">🗓️ ${intakeLabel(m)}</span>` : ''}
              ${showField('place') && m.place ? `<span class="chip">📍 ${m.place}</span>` : ''}
              ${m.graduateYear ? `<span class="chip">🎓 ${m.graduateYear}</span>` : ''}
            </div>
            <div class="inline-metrics">${socialLinksOf(m)}</div>
            <div class="admin-actions"><button class="btn-edit" data-action="edit-member" data-id="${m.id}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-member" data-id="${m.id}" type="button">🗑️ Delete</button></div>
          </div>
        </div>
      </div>`).join('') : `<div class="card empty-state">No members matched your filters.</div>`;
  }
  draw();

  function exportMembers() {
    if (!adminMode()) return;
    const rows = [['Name', 'Category', 'Gender', 'Department', 'Email', 'Phone', 'Birthday', 'Intake', 'Place of Living', 'Facebook', 'Instagram', 'WhatsApp', 'LinkedIn', 'Graduate Year']].concat(
      membersData.map(m => [m.name, m.category, m.gender || '', m.department, m.email, m.phone || '', m.birthday || '', intakeLabel(m), m.place || '', m.facebook || '', m.instagram || '', m.whatsapp || '', m.linkedin || '', m.graduateYear || ''])
    );
    const csv = rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'utp_members.csv';
    a.click();
  }
}

/* --------- COMMITTEE --------- */
function renderCommittee() {
  const page = document.getElementById('page-committee');
  page.innerHTML = `
    <div class="page-banner"><h2>Current Committee</h2><p>Leadership roles are presented more clearly with highlighted contact details and admin edit controls.</p></div>
    ${adminMode() ? `<div class="card cover-card" style="margin-bottom:12px"><div class="section-title"><h2>Committee Management</h2><button class="primary" onclick="addCommitteeMember()">+ Add Committee / Advisor</button></div></div>` : ''}
    <div class="grid grid-3 committee-grid">
      ${committeeData.map(c => `
        <div class="card cover-card">
          <div class="role-tag">${c.role}</div>
          <div class="person" style="margin-top:14px;align-items:flex-start">
            <img class="avatar" src="${avatarOf(c.photo)}" alt="" style="width:72px;height:72px;border-radius:20px">
            <div style="flex:1">
              <div><strong style="font-size:16px">${c.name}</strong></div>
              <div class="inline-metrics">
                ${c.gender ? `<span class="chip">${c.gender}</span>` : ''}
                ${c.email ? `<span class="chip">✉️ ${c.email}</span>` : ''}
                ${c.phone ? `<span class="chip">📞 ${c.phone}</span>` : ''}
              </div>
              <div class="admin-actions"><button class="btn-edit" data-action="edit-committee" data-id="${encodeURIComponent(String(c.id || c.role)).replace(/'/g, '%27')}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-committee" data-id="${encodeURIComponent(String(c.id || c.role)).replace(/'/g, '%27')}" type="button">🗑️ Delete</button></div>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
  page.querySelector('.committee-grid')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'edit-committee') openEditCommittee(button.dataset.id);
    if (button.dataset.action === 'delete-committee') confirmDeleteCommitteeMember(button.dataset.id);
  });
}

/* --------- ALUMNI --------- */
function renderAlumni() {
  const page = document.getElementById('page-alumni');
  page.innerHTML = `
    <div class="page-banner"><h2>Alumni Network</h2><p>Track past members and where they are now. Use the search bar to quickly filter by name, company, position, or location.</p></div>
    <div class="card cover-card">
      <div class="section-title"><h2>Alumni directory</h2>${adminMode() ? '<button class="primary" onclick="addAlumniProfile()">+ Add Alumni</button>' : ''}</div>
      <div class="directory-toolbar">
        <div class="search-compact"><input id="alumniSearch" placeholder="Search alumni, company, role, location..."></div>
        <div class="inline-metrics"><span class="chip">${alumniData.length} alumni profiles</span></div>
        <div></div>
      </div>
    </div>
    <div class="grid grid-3 alumni-grid" id="alumniGrid" style="margin-top:12px"></div>`;
  const search = page.querySelector('#alumniSearch');
  const grid = page.querySelector('#alumniGrid');
  const draw = () => {
    const q = normalize(search.value);
    const list = alumniData.filter(a => !q || [a.name, a.batch, a.gender, a.position, a.company, a.location].some(v => normalize(v).includes(q)));
    grid.innerHTML = list.length ? list.map(a => `
      <div class="card cover-card">
        <div class="person" style="align-items:flex-start">
          <img class="avatar" src="${avatarOf(a.photo)}" alt="" style="width:70px;height:70px;border-radius:20px">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${a.name}</strong><span class="chip">Batch ${a.batch || '-'}</span></div>
            <div style="margin-top:6px">${a.position || ''}${a.company ? ` @ ${a.company}` : ''}</div>
            <div class="inline-metrics">${a.gender ? `<span class="chip">${a.gender}</span>` : ''}${a.location ? `<span class="chip">📍 ${a.location}</span>` : ''}</div>
            <div class="inline-metrics">${socialLinksOf(a)}</div>
            <div class="admin-actions"><button class="btn-edit" data-action="edit-alumni" data-id="${encodeURIComponent(String(a.id || a.name)).replace(/'/g, '%27')}" type="button">✏️ Edit</button></div>
          </div>
        </div>
      </div>`).join('') : `<div class="card empty-state">No alumni profile matched the search.</div>`;
  };
  search.addEventListener('input', draw);
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="edit-alumni"]');
    if (!button) return;
    openEditAlumni(button.dataset.id);
  });
  draw();
}

/* --------- EVENTS & ANNOUNCEMENTS --------- */
function renderEvents() {
  const page = document.getElementById('page-events');
  const upcomingCount = eventsData.filter(e => new Date(e.date) >= new Date()).length;
  page.innerHTML = `
    <div class="page-banner"><h2>Events & Announcements</h2><p>Community programs, important updates, and RSVP tracking in one view.</p></div>
    <div class="info-strip" style="margin-top:0;margin-bottom:12px">
      <div class="card"><div class="section-kicker">Upcoming</div><div class="stat"><div class="icon">📅</div><div><div class="v">${upcomingCount}</div><div class="l">Scheduled events</div></div></div></div>
      <div class="card"><div class="section-kicker">Announcements</div><div class="stat"><div class="icon">📢</div><div><div class="v">${announcementsData.length}</div><div class="l">Posted updates</div></div></div></div>
      <div class="card"><div class="section-kicker">Pinned</div><div class="stat"><div class="icon">📌</div><div><div class="v">${announcementsData.filter(a => a.pinned).length}</div><div class="l">Pinned items</div></div></div></div>
      <div class="card"><div class="section-kicker">Interest</div><div class="stat"><div class="icon">🙋</div><div><div class="v">${eventsData.reduce((t, e) => t + num(e.rsvp), 0)}</div><div class="l">RSVP total</div></div></div></div>
    </div>
    <div class="grid grid-2">
      <div class="card cover-card">
        <div class="section-title"><h2>Events</h2>${adminMode() ? '<button class="primary" onclick="openModal(\'modalEvent\')">+ Add Event</button>' : ''}</div>
        <div class="list" id="eventsList"></div>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>Announcements</h2>${adminMode() ? '<button class="primary" onclick="openModal(\'modalAnnounce\')">+ Add</button>' : ''}</div>
        <div class="list" id="annList"></div>
      </div>
    </div>`;

  page.querySelector('#eventsList').innerHTML = [...eventsData].sort((a, b) => new Date(a.date) - new Date(b.date)).map(e => {
    const going = !!rsvps[e.id];
    return `
      <div class="card" style="padding:12px">
        <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <img src="${e.image || 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800'}" style="width:120px;height:88px;object-fit:cover;border-radius:14px" alt="">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${e.title}</strong><span class="chip">${fmtDate(e.date)}</span></div>
            <div class="muted">${e.time} • ${e.venue}</div>
            <div style="margin-top:4px">${e.description || ''}</div>
            <div class="inline-metrics">
              <button class="${going ? 'ghost' : 'primary'}" onclick="toggleRSVP(${e.id})">${going ? 'Going ✓' : 'RSVP'}</button>
              <span class="chip">${num(e.rsvp)} going</span>
              <span class="admin-actions"><button class="btn-edit" data-action="edit-event" data-id="${e.id}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-event" data-id="${e.id}" type="button">🗑️ Delete</button></span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('') || `<div class="empty-state">No events available.</div>`;

  page.querySelector('#annList').innerHTML = [...announcementsData].sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1) || new Date(b.date) - new Date(a.date)).map(a => `
    <div class="card" style="padding:12px;border-left:4px solid ${a.category === 'Urgent' ? 'var(--red)' : a.pinned ? 'var(--gold)' : 'var(--green)'}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div><strong>${a.title}</strong><div class="muted">${fmtDate(a.date)}${a.pinned ? ' • Pinned' : ''}</div></div>
        <span class="chip ${a.category === 'Urgent' ? 'red' : a.category === 'Event' ? 'gold' : 'green'}">${a.category}</span>
      </div>
      <div style="margin-top:8px">${a.content}</div>
      <div class="admin-actions"><button class="btn-edit" data-action="edit-announcement" data-id="${a.id}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-announcement" data-id="${a.id}" type="button">🗑️ Delete</button></div>
    </div>`).join('') || `<div class="empty-state">No announcements available.</div>`;

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'edit-event') openEditEvent(id);
    if (button.dataset.action === 'delete-event') confirmDeleteEvent(id);
    if (button.dataset.action === 'edit-announcement') openEditAnnouncement(id);
    if (button.dataset.action === 'delete-announcement') confirmDeleteAnnouncement(id);
  });
}

document.getElementById('formEvent').addEventListener('submit', async e => {
  e.preventDefault();
  if (!adminMode()) return;
  const f = e.target;
  const imageValue = String(f.image.value || '').trim();
  if (looksLikeLocalFilePath(imageValue)) {
    showToast('Use the upload box for local files. PC file paths will not work.');
    return;
  }
  const obj = { id: Date.now(), title: f.title.value.trim(), date: f.date.value, time: f.time.value, venue: f.venue.value, description: f.description.value, image: imageValue, rsvp: 0 };
  eventsData.push(obj);
  persistEventsLocal();
  if (typeof window.saveEventToCloud === 'function') {
    try {
      const saved = await window.saveEventToCloud(obj);
      const idx = eventsData.findIndex(x => Number(x.id) === Number(obj.id));
      if (saved && idx >= 0) eventsData[idx] = saved;
      persistEventsLocal();
    } catch (err) { console.warn('Cloud event save failed:', err); }
  }
  closeModal('modalEvent');
  renderEvents();
  renderHome();
  f.reset();
});

document.getElementById('formAnnounce').addEventListener('submit', e => {
  e.preventDefault();
  if (!adminMode()) return;
  const f = e.target;
  const obj = { id: Date.now(), title: f.title.value.trim(), date: f.date.value, category: f.category.value, pinned: f.pinned.checked, content: f.content.value };
  announcementsData.unshift(obj);
  store.set('utp_announcements', announcementsData);
  closeModal('modalAnnounce');
  renderEvents();
  renderHome();
  f.reset();
});

/* --------- ACHIEVEMENTS --------- */
function renderAchievements() {
  const page = document.getElementById('page-achievements');
  page.innerHTML = `
    <div class="page-banner"><h2>Achievements</h2><p>Celebrate progress like RPD, Viva, publications, semester exams, and project milestones.</p></div>
    <div class="card cover-card">
      <div class="section-title"><h2>Achievement board</h2>${adminMode() ? '<button class="primary" onclick="openAchModal()">+ Add</button>' : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px" id="achFilters">${['All', 'RPD', 'Viva', 'Semester Exam', 'FYP', 'Publication'].map(t => `<button class="pill ${t === 'All' ? 'active' : ''}" data-type="${t}">${t}</button>`).join('')}</div>
      <div class="grid grid-3" id="achGrid"></div>
    </div>`;
  const grid = page.querySelector('#achGrid');
  const filters = page.querySelectorAll('#achFilters .pill');
  let active = 'All';
  filters.forEach(b => b.addEventListener('click', () => { filters.forEach(x => x.classList.remove('active')); b.classList.add('active'); active = b.dataset.type; draw(); }));

  function draw() {
    const list = active === 'All' ? achievementsData : achievementsData.filter(a => a.type === active);
    grid.innerHTML = list.length ? list.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => `
      <div class="card cover-card">
        <div class="person" style="align-items:flex-start">
          <img class="avatar" src="${avatarOf(a.photo)}" alt="" style="width:64px;height:64px;border-radius:18px">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${a.title}</strong><span class="chip gold">${a.type}</span></div>
            <div class="muted">${a.member} • ${fmtDate(a.date)}</div>
            <div class="muted">${a.department || ''}${a.details ? ' • ' + a.details : ''}</div>
            <div class="admin-actions"><button class="btn-edit" data-action="edit-achievement" data-id="${a.id}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-achievement" data-id="${a.id}" type="button">🗑️ Delete</button></div>
          </div>
        </div>
      </div>`).join('') : `<div class="card empty-state">No achievements found.</div>`;
  }
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'edit-achievement') openEditAchievement(id);
    if (button.dataset.action === 'delete-achievement') confirmDeleteAchievement(id);
  });
  draw();
}

function openAchModal() {
  const sel = document.getElementById('achMemberSelect');
  sel.innerHTML = membersData.map(m => `<option>${m.name}</option>`).join('');
  openModal('modalAchieve');
}

document.getElementById('formAchieve').addEventListener('submit', e => {
  e.preventDefault();
  if (!adminMode()) return;
  const f = e.target;
  const obj = { id: Date.now(), member: f.member.value, title: f.title.value, type: f.type.value, date: f.date.value, department: f.department.value, details: f.details.value, photo: f.photo.value };
  achievementsData.unshift(obj);
  store.set('utp_achievements', achievementsData);
  closeModal('modalAchieve');
  renderAchievements();
  renderHome();
  f.reset();
});

/* --------- GALLERY --------- */
function renderGallery() {
  const page = document.getElementById('page-gallery');
  page.innerHTML = `
    <div class="page-banner"><h2>Gallery</h2><p>Keep community memories organized by category with a cleaner visual layout and edit controls.</p></div>
    <div class="card cover-card">
      <div class="section-title"><h2>Community moments</h2>${adminMode() ? '<button class="primary" onclick="openModal(\'modalPhoto\')">+ Add Media</button>' : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px" id="galFilters">${['All', 'Cultural', 'Sports', 'Academic', 'Community'].map(c => `<button class="pill ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="masonry" id="galGrid"></div>
    </div>`;
  const grid = page.querySelector('#galGrid');
  const filters = page.querySelectorAll('#galFilters .pill');
  let active = 'All';
  filters.forEach(b => b.addEventListener('click', () => { filters.forEach(x => x.classList.remove('active')); b.classList.add('active'); active = b.dataset.cat; draw(); }));
  function draw() {
    const list = active === 'All' ? galleryData : galleryData.filter(g => g.category === active);
    grid.innerHTML = list.length ? list.sort((a, b) => new Date(b.date) - new Date(a.date)).map(g => `
      <div class="masonry-item card gallery-card" style="padding:0;overflow:hidden">
        <button class="gallery-preview" type="button" data-action="open-lightbox" data-url="${escapeHtml(g.url)}" data-title="${escapeHtml(g.title || '')}" style="display:block;width:100%;padding:0;border:none;background:none;cursor:pointer">
          ${mediaPreviewHtml(g.url, g.title || '', { controls: false })}
        </button>
        <div style="padding:12px">
          <strong>${g.title}</strong>
          <div class="muted">${fmtDate(g.date)} • ${g.category}</div>
          <div class="admin-actions"><button class="btn-edit" data-action="edit-photo" data-id="${g.id}" type="button">✏️ Edit</button><button class="btn-delete" data-action="delete-photo" data-id="${g.id}" type="button">🗑️ Delete</button></div>
        </div>
      </div>`).join('') : `<div class="card empty-state">No photos in this category.</div>`;
  }
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    event.stopPropagation();
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'open-lightbox') return openLightbox(button.dataset.url, button.dataset.title || '');
    if (!adminMode()) return;
    if (button.dataset.action === 'edit-photo') return openEditPhoto(id);
    if (button.dataset.action === 'delete-photo') return confirmDeletePhoto(id);
  });
  draw();
}

document.getElementById('formPhoto').addEventListener('submit', async e => {
  e.preventDefault();
  if (!adminMode()) return;
  const f = e.target;
  const mediaUrl = String(f.url.value || '').trim();
  if (looksLikeLocalFilePath(mediaUrl)) {
    showToast('Use the upload box for local files. PC file paths will not work.');
    return;
  }
  const obj = { id: Date.now(), title: f.title.value, date: f.date.value, category: f.category.value, url: mediaUrl, mediaType: detectMediaType(mediaUrl) };
  galleryData.unshift(obj);
  persistGalleryLocal();
  if (typeof window.saveGalleryItemToCloud === 'function') {
    try {
      const saved = await window.saveGalleryItemToCloud(obj);
      const idx = galleryData.findIndex(x => Number(x.id) === Number(obj.id));
      if (saved && idx >= 0) galleryData[idx] = saved;
      persistGalleryLocal();
    } catch (err) { console.warn('Cloud gallery save failed:', err); }
  }
  closeModal('modalPhoto');
  renderGallery();
  f.reset();
});

function openLightbox(url, title) {
  const lb = document.getElementById('lightbox');
  const stage = document.getElementById('lightboxStage');
  stage.innerHTML = mediaPreviewHtml(url, title, { controls: detectMediaType(url) === 'video' });
  const media = stage.querySelector('img,video');
  if (media) media.setAttribute('alt', title || '');
  lb.classList.add('active');
}

/* --------- ONBOARDING --------- */
function concernTicket() { return 'AIS-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-4); }
function concernStatusTone(status) { return ({Open:'red', 'In Review':'yellow', Resolved:'green', Closed:'slate'})[status] || 'blue'; }
function concernMatchesLookup(c, lookup) { const q = normalize(lookup); return !q || [c.ticket, c.name, c.email, c.title, c.category, c.status].some(v => normalize(v).includes(q)); }
function concernTimelineTone(text='') {
  const t = String(text || '').toLowerCase();
  if (t.includes('status changed')) return 'blue';
  if (t.includes('submitted')) return 'yellow';
  if (t.includes('thank') || t.includes('review') || t.includes('response') || t.includes('reply')) return 'green';
  return 'slate';
}
function concernLatestReply(c) {
  const replies = Array.isArray(c.replies) ? c.replies : [];
  return replies.length ? replies[replies.length - 1] : null;
}
function concernInternalNotes(c) {
  return Array.isArray(c.internalNotes) ? c.internalNotes : [];
}
function renderConcernTimeline(c) {
  return (c.timeline || []).map(t => `
    <div class="timeline-item">
      <div class="timeline-dot ${concernTimelineTone(t.text)}"></div>
      <div>
        <div class="timeline-meta"><strong>${t.by}</strong><span class="chip ${concernTimelineTone(t.text)}">${String(t.text||'').toLowerCase().includes('status changed') ? 'Status update' : String(t.text||'').toLowerCase().includes('submitted') ? 'Submitted' : 'Committee update'}</span></div>
        <div class="muted">${new Date(t.at).toLocaleString()}</div>
        <div>${t.text}</div>
      </div>
    </div>`).join('');
}
function renderPublicConcernSummary(c) {
  const reply = concernLatestReply(c);
  return `<div class="card concern-public-summary public-summary-card">
    <div class="section-title"><h3 style="margin:0;font-size:18px">Tracking summary</h3><span class="chip ${concernStatusTone(c.status)}">${c.status || 'Open'}</span></div>
    <div class="grid grid-2 public-summary-grid">
      <div class="mini-stat"><div class="mini-label">Assigned to</div><div class="mini-value">${c.assignee || 'Committee inbox'}</div></div>
      <div class="mini-stat"><div class="mini-label">Last updated</div><div class="mini-value">${new Date(c.updatedAt || c.createdAt).toLocaleString()}</div></div>
    </div>
    <div class="public-reply-box ${reply ? 'has-reply' : ''}">
      <div class="section-kicker">Committee reply</div>
      ${reply ? `<div class="public-reply-text">${reply.text}</div><div class="muted" style="margin-top:8px">Replied by <strong>${reply.by}</strong> on ${new Date(reply.at).toLocaleString()}</div>` : `<div class="muted">Your concern has been received. The committee has not posted a public reply yet. Please keep your ticket code for future tracking.</div>`}
    </div>
  </div>`;
}
function renderConcernReplyPanel(c) {
  if (!adminMode()) return '';
  const internalNotes = concernInternalNotes(c);
  return `<div class="card admin-response-card" style="margin-top:12px">
    <div class="section-title"><h3 style="margin:0;font-size:18px">Committee response</h3><span class="chip ${concernStatusTone(c.status)}">${c.status}</span></div>
    <div class="grid grid-2 admin-response-grid">
      <div><label>Status</label><select id="concern-status-${c.id}"><option ${c.status==='Open'?'selected':''}>Open</option><option ${c.status==='In Review'?'selected':''}>In Review</option><option ${c.status==='Resolved'?'selected':''}>Resolved</option><option ${c.status==='Closed'?'selected':''}>Closed</option></select></div>
      <div><label>Assign to</label><input id="concern-assignee-${c.id}" value="${c.assignee || currentAdminName()}" placeholder="Committee member"></div>
    </div>
    <label>Reply</label><textarea id="concern-reply-${c.id}" rows="4" placeholder="Write a helpful response..."></textarea>
    <div class="admin-response-actions">
      <button class="ghost" type="button" onclick="updateConcernStatus(${c.id})">Update status</button>
      <button class="primary" type="button" onclick="replyConcern(${c.id})">Send reply</button>
    </div>
    <div class="internal-notes-card">
      <div class="section-title"><h3 style="margin:0;font-size:18px">Internal notes</h3><span class="chip">Admin only</span></div>
      <div class="muted" style="margin-bottom:10px">These notes are private to the committee and are never shown on the public tracking view.</div>
      <textarea id="concern-note-${c.id}" rows="3" placeholder="Write a private committee note..."></textarea>
      <div class="internal-note-actions">
        <button class="ghost" type="button" onclick="saveInternalNote(${c.id})">Save internal note</button>
      </div>
      <div class="internal-notes-list">
        ${internalNotes.length ? internalNotes.slice().reverse().map(n => `<div class="internal-note-item"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong>${n.by}</strong><span class="chip slate">Internal note</span></div><div class="muted">${new Date(n.at).toLocaleString()}</div><div class="internal-note-text">${n.text}</div></div>`).join('') : '<div class="empty-state" style="padding:12px">No internal notes yet.</div>'}
      </div>
    </div>
  </div>`;
}
function renderConcerns() {
  const page = document.getElementById('page-concerns');
  const concerns = Array.isArray(concernsData) ? concernsData : [];
  const openCount = concerns.filter(c => c.status === 'Open').length;
  const reviewCount = concerns.filter(c => c.status === 'In Review').length;
  const resolvedCount = concerns.filter(c => c.status === 'Resolved').length;
  const latest = [...concerns].sort((a,b)=> new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  page.innerHTML = `
    <div class="page-banner"><h2>Community Concerns & Support Desk</h2><p>A professional channel for members to share concerns, ask for support, and receive documented responses from the committee.</p></div>
    <div class="grid grid-4">
      <div class="card cover-card"><div class="section-kicker">Inbox</div><div class="stat"><div class="icon">📥</div><div><div class="v">${concerns.length}</div><div class="l">Total submissions</div></div></div></div>
      <div class="card cover-card"><div class="section-kicker">Open</div><div class="stat"><div class="icon">🟠</div><div><div class="v">${openCount}</div><div class="l">Awaiting review</div></div></div></div>
      <div class="card cover-card"><div class="section-kicker">In Review</div><div class="stat"><div class="icon">🧭</div><div><div class="v">${reviewCount}</div><div class="l">Committee handling</div></div></div></div>
      <div class="card cover-card"><div class="section-kicker">Resolved</div><div class="stat"><div class="icon">✅</div><div><div class="v">${resolvedCount}</div><div class="l">Closed with response</div></div></div></div>
    </div>
    <div class="grid grid-3" style="margin-top:14px">
      <div class="card cover-card"><div class="section-kicker">How to use</div><strong>Write clearly</strong><div class="muted" style="margin-top:8px">Use a short subject and explain the issue with enough detail so the committee can review it properly.</div></div>
      <div class="card cover-card"><div class="section-kicker">Eligibility</div><strong>UTP email required</strong><div class="muted" style="margin-top:8px">Please submit using your official <code>@utp.edu.my</code> email address so the committee can verify the request.</div></div>
      <div class="card cover-card"><div class="section-kicker">Policy</div><strong>Professional conduct</strong><div class="muted" style="margin-top:8px">If false, misleading, abusive, or intentionally wrong information is provided, the committee reserves the right to remove the submission without notice.</div></div>
    </div>
    <div class="grid grid-2" style="margin-top:14px">
      <div class="card cover-card">
        <div class="section-title"><h2>Submit a concern</h2><span class="chip">Confidential & structured</span></div>
        <div class="muted" style="margin-bottom:10px">Please share your opinion, concern, feedback, or request professionally. The committee will review submissions and reply through this desk.</div>
        <form id="formConcern">
          <div class="grid grid-2">
            <div><label>Name</label><input required name="name" placeholder="Your full name"></div>
            <div><label>UTP Email</label><input required type="email" name="email" placeholder="name@utp.edu.my"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Category</label><select name="category"><option>Academic</option><option>Accommodation</option><option>Visa / International Office</option><option>Welfare</option><option>Event</option><option>Financial</option><option>Well-being</option><option>Other</option></select></div>
            <div><label>Priority</label><select name="priority"><option>Normal</option><option>High</option><option>Urgent</option></select></div>
            <div><label>Visibility</label><select name="visibility"><option value="private">Private to committee</option><option value="trackable">Trackable by ticket & email</option></select></div>
          </div>
          <label>Subject</label><input required name="title" placeholder="Short title for your concern">
          <label>Description</label><textarea required name="message" rows="6" placeholder="Describe the issue, what happened, and what kind of support you need."></textarea>
          <div class="card" style="padding:12px;background:#f8fafc;margin-top:12px">
            <div class="section-kicker">Declaration</div>
            <div class="muted">By submitting, you confirm that the information provided is accurate to the best of your knowledge. Submissions with false or misleading information may be removed by the committee.</div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="primary" type="submit">Submit concern</button></div>
        </form>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>${adminMode() ? 'Committee inbox' : 'Track your concern'}</h2><span class="chip">Live updates</span></div>
        <div class="muted" style="margin-bottom:10px">${adminMode() ? 'Review, assign, and reply to member concerns from one place.' : 'Use your ticket code or UTP email to view updates from the committee.'}</div>
        ${!adminMode() ? `<div class="card concern-lookup-help" style="padding:12px;margin-bottom:10px"><div class="section-kicker">What you will see</div><div class="muted">Trackable concerns show the latest status, the committee reply, assigned owner, and the full update timeline.</div></div>` : ''}
        ${adminMode() ? `
        <div class="grid grid-3">
          <div><label>Status</label><select id="concernFilterStatus"><option value="">All</option><option>Open</option><option>In Review</option><option>Resolved</option><option>Closed</option></select></div>
          <div><label>Category</label><select id="concernFilterCategory"><option value="">All</option>${[...new Set(concerns.map(c => c.category))].filter(Boolean).map(c => `<option>${c}</option>`).join('')}</select></div>
          <div><label>Search</label><input id="concernFilterSearch" placeholder="Ticket, name, email..."></div>
        </div>` : `
        <div class="grid grid-2">
          <div><label>Ticket or UTP email</label><input id="concernLookup" placeholder="AIS-AB12-3456 or name@utp.edu.my"></div>
          <div class="lookup-refresh-wrap"><button class="ghost" type="button" onclick="renderConcerns()">Refresh</button></div>
        </div>`}
        <div id="concernList" class="stack-list" style="margin-top:12px"></div>
      </div>
    </div>`;

  const form = page.querySelector('#formConcern');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim();
    if (!isValidUtpEmail(email)) {
      showToast('Please use your official UTP email address');
      f.email.focus();
      return;
    }
    const item = {
      id: Date.now(), ticket: concernTicket(), name: f.name.value.trim(), email,
      category: f.category.value, priority: f.priority.value, visibility: f.visibility.value, title: f.title.value.trim(),
      message: f.message.value.trim(), status: 'Open', assignee: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      replies: [], timeline: [{ by: f.name.value.trim(), at: new Date().toISOString(), text: 'Concern submitted.' }]
    };
    if (typeof window.submitConcernToServer === 'function') {
      try {
        const saved = await window.submitConcernToServer(item);
        await saveConcernItem(saved || item, { skipCloud: true });
      } catch (err) {
        console.warn('Server submission route failed, falling back to direct save:', err);
        await saveConcernItem(item);
      }
    } else {
      await saveConcernItem(item);
    }
    if (typeof logAction === 'function') logAction('Concern submitted', `${item.ticket} • ${item.title}`);
    f.reset();
    showToast(`Concern submitted. Your ticket is ${item.ticket}`);
    renderConcerns();
  });

  const list = page.querySelector('#concernList');
  const draw = () => {
    let items = latest;
    if (adminMode()) {
      const status = page.querySelector('#concernFilterStatus')?.value || '';
      const category = page.querySelector('#concernFilterCategory')?.value || '';
      const search = page.querySelector('#concernFilterSearch')?.value || '';
      items = latest.filter(c => (!status || c.status === status) && (!category || c.category === category) && concernMatchesLookup(c, search));
    } else {
      const lookup = page.querySelector('#concernLookup')?.value || '';
      items = latest.filter(c => c.visibility === 'trackable' && concernMatchesLookup(c, lookup));
    }
    list.innerHTML = items.length ? items.map(c => `
      <div class="card concern-card">
        <div class="section-title">
          <div class="concern-head-main"><h3 class="concern-title">${c.title || 'Untitled concern'}</h3><div class="muted concern-meta">${c.ticket || ''} • ${c.name || 'Anonymous'} • ${c.email || ''}</div></div>
          <div class="concern-head-chips">
            <span class="chip ${concernStatusTone(c.status)}">${c.status || 'Open'}</span>
            ${c.category ? `<span class="chip">${c.category}</span>` : ''}
            ${c.priority ? `<span class="chip">${c.priority}</span>` : ''}
          </div>
        </div>
        <p>${c.message || ''}</p>
        <div class="grid grid-2 concern-detail-grid">
          <div class="card concern-timeline-card" style="padding:12px">
            <div class="section-kicker">Timeline</div>
            <div class="timeline">${renderConcernTimeline(c)}</div>
          </div>
          <div>${renderConcernReplyPanel(c)}${!adminMode() ? renderPublicConcernSummary(c) : ''}</div>
        </div>
      </div>`).join('') : `<div class="card empty-state">${adminMode() ? 'No concerns match the current filter yet.' : 'No trackable concerns found yet. Submit one above or search using your ticket and UTP email.'}</div>`;
  };
  if (adminMode()) ['concernFilterStatus','concernFilterCategory','concernFilterSearch'].forEach(id => page.querySelector('#'+id)?.addEventListener('input', draw));
  else page.querySelector('#concernLookup')?.addEventListener('input', draw);
  draw();
}

async function replyConcern(id) {
  if (!adminMode()) return;
  const item = concernsData.find(c => c.id === id);
  if (!item) return;
  const msg = document.getElementById(`concern-reply-${id}`)?.value.trim();
  const status = document.getElementById(`concern-status-${id}`)?.value || item.status;
  const assignee = document.getElementById(`concern-assignee-${id}`)?.value.trim() || currentAdminName();
  if (!msg) return showToast('Write a reply first');
  item.assignee = assignee; item.status = status; item.updatedAt = new Date().toISOString();
  item.replies = item.replies || [];
  item.replies.push({ by: currentAdminName(), at: item.updatedAt, text: msg });
  item.timeline = item.timeline || [];
  item.timeline.push({ by: currentAdminName(), at: item.updatedAt, text: msg });
  await saveConcernItem(item);
  if (typeof logAction === 'function') logAction('Concern replied', `${item.ticket} • ${status}`);
  showToast('Reply posted');
  renderConcerns();
}
async function saveInternalNote(id) {
  if (!adminMode()) return;
  const item = concernsData.find(c => c.id === id);
  if (!item) return;
  const note = document.getElementById(`concern-note-${id}`)?.value.trim();
  if (!note) return showToast('Write an internal note first');
  item.internalNotes = concernInternalNotes(item);
  item.updatedAt = new Date().toISOString();
  item.internalNotes.push({ by: currentAdminName(), at: item.updatedAt, text: note });
  await saveConcernItem(item);
  if (typeof logAction === 'function') logAction('Internal note saved', `${item.ticket}`);
  showToast('Internal note saved');
  renderConcerns();
}

async function updateConcernStatus(id) {
  if (!adminMode()) return;
  const item = concernsData.find(c => c.id === id);
  if (!item) return;
  const status = document.getElementById(`concern-status-${id}`)?.value || item.status;
  const assignee = document.getElementById(`concern-assignee-${id}`)?.value.trim() || currentAdminName();
  item.status = status; item.assignee = assignee; item.updatedAt = new Date().toISOString();
  item.timeline = item.timeline || [];
  item.timeline.push({ by: currentAdminName(), at: item.updatedAt, text: `Status changed to ${status}.` });
  await saveConcernItem(item);
  if (typeof logAction === 'function') logAction('Concern status updated', `${item.ticket} • ${status}`);
  showToast('Concern updated');
  renderConcerns();
}

function renderOnboarding() {
  const page = document.getElementById('page-onboarding');
  const state = store.get('utp_onboarding', {});
  const memberPanel = adminMode() ? `
        <form id="formNewMember">
          <label>Name</label><input required name="name">
          <div class="grid grid-2">
            <div><label>Category</label><select name="category"><option>Foundation</option><option>Undergraduate</option><option>Msc</option><option>PhD</option><option>Lecturer</option><option>Staff (Research Scientist/Post Doctoral)</option></select></div>
            <div><label>Department</label><input required name="department" id="nmDept" list="deptList"></div>
          </div>
          <div class="grid grid-2">
            <div><label>Gender</label><select name="gender"><option value="">Select gender</option><option>Male</option><option>Female</option></select></div>
            <div></div>
          </div>
          <datalist id="deptList">${[...new Set([...membersData.map(m => m.department), 'Department of Chemical Engineering', 'Department of Civil and Environmental Engineering', 'Department of Electrical and Electronics Engineering', 'Department of Integrated Engineering', 'Department of Mechanical Engineering', 'Department of Petroleum Engineering', 'Department of Applied Science (formerly Fundamental and Applied Sciences)', 'Department of Computing (formerly Computer & Information Sciences)', 'Department of Geoscience', 'Department of Management (formerly Management & Humanities)'])].map(d => `<option value="${d}">`).join('')}</datalist>
          <div class="grid grid-2">
            <div><label>Birthday</label><input type="date" name="birthday"></div>
            <div><label>Phone</label><input name="phone" placeholder="+60 ..."></div>
          </div>
          <div class="grid grid-2">
            <div><label>Intake Month</label><select name="intakeMonth"><option value="">Select month</option>${intakeMonths.map(m => `<option>${m}</option>`).join('')}</select></div>
            <div><label>Intake Year</label><input type="number" name="intakeYear" placeholder="2026"></div>
          </div>
          <div class="grid grid-2">
            <div><label>Place of Living</label><select name="place"><option value="">Select place</option>${livingPlaces.map(p => `<option>${p}</option>`).join('')}</select></div>
            <div><label>Graduate Year</label><input type="number" name="graduateYear" placeholder="2027"></div>
          </div>
          <label>Email</label><input type="email" name="email" placeholder="name@utp.edu.my">
          <label>Photo URL</label><input name="photo" placeholder="https://...">
          <div class="grid grid-2">
            <div><label>Facebook</label><input name="facebook" placeholder="https://facebook.com/..."></div>
            <div><label>Instagram</label><input name="instagram" placeholder="https://instagram.com/..."></div>
          </div>
          <div class="grid grid-2">
            <div><label>WhatsApp</label><input name="whatsapp" placeholder="https://wa.me/..."></div>
            <div><label>LinkedIn</label><input name="linkedin" placeholder="https://linkedin.com/in/..."></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="primary" type="submit">Add to Directory</button></div>
        </form>` : `
        <div class="card" style="padding:14px;background:#f8fafc">
          <div class="section-kicker">Admin only</div>
          <strong>Member registration is managed by the admin panel.</strong>
          <div class="muted" style="margin-top:8px">Please contact the committee if you need your profile to be added or updated in the directory.</div>
        </div>`;
  page.innerHTML = `
    <div class="page-banner"><h2>New Member Onboarding</h2><p>Track orientation progress, recommend buddies by department, and add new members to the directory.</p></div>
    <div class="grid grid-2">
      <div class="card cover-card">
        <div class="section-title"><h2>6-Step Checklist</h2><div style="display:flex;gap:8px;align-items:center"><span class="chip">${Object.values(state).filter(Boolean).length}/${onboardSteps.length}</span>${adminMode() ? '<button class="ghost" type="button" onclick="openModal(&#39;modalAdminSettings&#39;)">Edit</button>' : ''}</div></div>
        <div class="list" id="onList"></div>
        <div class="muted" style="margin-top:8px">Progress saves automatically.</div>
      </div>
      <div class="card cover-card">
        <div class="section-title"><h2>Add New Member</h2><span class="chip">Directory</span></div>
        ${memberPanel}
        <div id="buddyBox" style="margin-top:12px"></div>
      </div>
    </div>
    <div class="card cover-card" style="margin-top:14px">
      <div class="section-title"><h2>FAQ</h2>${adminMode() ? '<button class="ghost" type="button" onclick="openModal(&#39;modalAdminSettings&#39;)">Edit FAQ</button>' : ''}</div>
      ${faqData.map(item => `<details><summary>${item.q}</summary><p class="muted">${item.a}</p></details>`).join('') || '<div class="empty-state">No FAQ added yet.</div>'}
    </div>`;
  const list = page.querySelector('#onList');
  list.innerHTML = onboardSteps.map((s, i) => `
    <label style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:12px">
      <input type="checkbox" data-step="${i}" ${state[i] ? 'checked' : ''}> <span>${i + 1}. ${s}</span>
    </label>`).join('');
  list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { state[cb.dataset.step] = cb.checked; store.set('utp_onboarding', state); }));

  const form = page.querySelector('#formNewMember');
  const buddyBox = page.querySelector('#buddyBox');
  const deptInput = page.querySelector('#nmDept');
  if (deptInput) deptInput.addEventListener('input', e => {
    const dept = e.target.value.trim();
    if (!dept) { buddyBox.innerHTML = ''; return; }
    const buds = membersData.filter(m => normalize(m.department) === normalize(dept)).slice(0, 3);
    buddyBox.innerHTML = buds.length ? `<div class="muted" style="margin-bottom:6px">Suggested buddies in ${dept}:</div>` + buds.map(b => `
      <div class="person" style="margin-bottom:6px"><img class="avatar" src="${avatarOf(b.photo)}"><div><div><strong>${b.name}</strong></div><div class="muted">${b.category}</div></div></div>`).join('') : `<div class="muted">No buddies found yet.</div>`;
  });
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!adminMode()) return showToast('Only admin can add new members');
    const f = e.target;
    if (f.email.value.trim() && !isValidUtpEmail(f.email.value.trim())) {
      showToast('Please enter a valid UTP email for the member');
      f.email.focus();
      return;
    }
    const obj = { id: Date.now(), name: f.name.value.trim(), category: f.category.value, department: f.department.value, gender: f.gender.value, birthday: f.birthday.value || '', phone: f.phone.value, email: f.email.value.trim(), photo: f.photo.value || 'https://i.pravatar.cc/200', intakeMonth: f.intakeMonth.value, intakeYear: f.intakeYear.value, place: f.place.value, graduateYear: parseInt(f.graduateYear.value) || null, facebook: f.facebook.value.trim(), instagram: f.instagram.value.trim(), whatsapp: f.whatsapp.value.trim(), linkedin: f.linkedin.value.trim() };
    membersData.unshift(obj);
    persistMembersLocal();
    if (typeof window.saveMemberToCloud === 'function') {
      try {
        const saved = await window.saveMemberToCloud(obj);
        const idx = membersData.findIndex(x => Number(x.id) === Number(obj.id));
        if (saved && idx >= 0) membersData[idx] = saved;
        persistMembersLocal();
      } catch (err) { console.warn('Cloud member save failed:', err); }
    }
    f.reset();
    buddyBox.innerHTML = `<div class="chip green">Added ${obj.name} to directory ✓</div>`;
    renderMembers();
    renderHome();
  });
}

/* --------- EMERGENCY --------- */
function renderEmergency() {
  const welfare = committeeData.find(c => normalize(c.role).includes('welfare'));
  const page = document.getElementById('page-emergency');
  page.innerHTML = `
    <div class="page-banner"><h2>Emergency & Support Resources</h2><p>Fast access to important campus, embassy, and welfare contacts.</p></div>
    <div class="grid grid-3">
      ${[
        { t: 'UTP Security', p: '+60 5-368 8999', d: '24/7 campus emergency' },
        { t: 'Perak Police', p: '999', d: 'Malaysia emergency' },
        { t: 'Ambulance', p: '999', d: 'Medical emergency' },
        { t: 'Bangladesh High Commission KL', p: '+60 3-4251 3555', d: 'Passport & welfare' },
        { t: 'UTP International Office', p: '+60 5-368 7243', d: 'Visa & student pass' },
        { t: 'Committee Welfare', p: welfare?.phone || '+60 14-333 4444', d: 'Community support' }
      ].map(c => `
        <div class="card cover-card">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong>${c.t}</strong><a class="chip red" href="tel:${c.p.replace(/\s/g, '')}">Call</a></div>
          <div style="font-size:22px;font-weight:800;margin:10px 0">${c.p}</div>
          <div class="muted">${c.d}</div>
        </div>`).join('')}
    </div>
    <div class="card cover-card" style="margin-top:14px">
      <div class="section-title"><h2>Quick Links</h2></div>
      <div class="grid grid-3">
        <a class="card" style="text-align:center" href="https://www.utp.edu.my" target="_blank">UTP Website</a>
        <a class="card" style="text-align:center" href="#">ISA Portal</a>
        <a class="card" style="text-align:center" href="#">E-Learning</a>
      </div>
    </div>`;
}

/* --------- Modals helpers --------- */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

/* --------- Initial render --------- */
renderHome();
renderMembers();
renderCommittee();
renderAlumni();
renderEvents();
renderAchievements();
renderGallery();
renderConcerns();
renderOnboarding();
renderEmergency();
showPage('home');
refreshDirectoryMediaFromCloud(false);

document.getElementById('footerYear') && (document.getElementById('footerYear').textContent = new Date().getFullYear());
