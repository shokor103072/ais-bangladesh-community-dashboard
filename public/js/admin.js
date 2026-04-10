/* ========== ADMIN MODULE ========== */
let isAdmin = false;
let adminSession = null;
const ADMIN_ACCOUNTS_KEY = 'utp_admin_accounts';
const ADMIN_LOGS_KEY = 'utp_admin_logs';

const DEFAULT_ADMIN_PASSWORD_HINT = 'Change it immediately after first login';
const DEFAULT_ADMIN_PASSWORD_HASH = '44f121c68834ee9693e4474a404987dad80da35070569f596027aa6e216940dc';

function defaultAdminAccounts() {
  return [
    { id: 1, username: 'masteradmin', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'Md Shokor A Rahaman', role: 'Master Admin', isMaster: true },
    { id: 2, username: 'president', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'President Account', role: 'President', isMaster: false },
    { id: 3, username: 'vicepresident', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'Vice President Account', role: 'Vice President', isMaster: false },
    { id: 4, username: 'generalsecretary', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'General Secretary Account', role: 'General Secretary', isMaster: false },
    { id: 5, username: 'mediahead', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'Media & Communication Account', role: 'Head of Media & Communication', isMaster: false },
    { id: 6, username: 'projectmanager', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'Project Manager Account', role: 'Project Manager', isMaster: false },
    { id: 7, username: 'prlogistics', passwordHash: DEFAULT_ADMIN_PASSWORD_HASH, passwordHint: DEFAULT_ADMIN_PASSWORD_HINT, name: 'PR & Logistics Account', role: 'Head of PR & Logistics', isMaster: false }
  ];
}

async function sha256(input) {
  const encoded = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

window.getAdminAccountsSnapshot = function () { return getAdminAccounts(); };
window.applyAdminAccountsSnapshot = function (accounts, forceUi = true) {
  if (!Array.isArray(accounts)) return getAdminAccounts();
  store.set(ADMIN_ACCOUNTS_KEY, accounts);
  if (forceUi && typeof renderAdminAccountsList === 'function') renderAdminAccountsList();
  return accounts;
};

function getAdminAccounts() {
  const existing = store.get(ADMIN_ACCOUNTS_KEY, null);
  if (Array.isArray(existing) && existing.length) return existing;
  const defaults = defaultAdminAccounts();
  store.set(ADMIN_ACCOUNTS_KEY, defaults);
  return defaults;
}
async function saveAdminAccounts(accounts, options = {}) {
  const { silent = false } = options;
  store.set(ADMIN_ACCOUNTS_KEY, accounts);
  if (typeof window.saveAdminAccountsToCloud !== 'function') return accounts;
  try {
    const saved = await window.saveAdminAccountsToCloud(accounts);
    if (Array.isArray(saved) && saved.length) {
      store.set(ADMIN_ACCOUNTS_KEY, saved);
      if (typeof refreshAdminAccountsFromCloud === 'function') await refreshAdminAccountsFromCloud(false);
      return saved;
    }
    return accounts;
  } catch (err) {
    console.warn('Cloud admin account sync failed:', err);
    if (!silent) {
      const message = /token/i.test(String(err.message || err))
        ? 'Admin account changed only on this browser. Connect the secure admin inbox token to sync logins across browsers.'
        : 'Admin account changed locally, but cloud sync failed.';
      showToast(message);
    }
    throw err;
  }
}
async function refreshAdminAccountsFromCloud(forceUi = false) {
  if (typeof window.loadAdminAccountsFromCloud !== 'function') return getAdminAccounts();
  try {
    const cloudAccounts = await window.loadAdminAccountsFromCloud();
    if (Array.isArray(cloudAccounts) && cloudAccounts.length) {
      store.set(ADMIN_ACCOUNTS_KEY, cloudAccounts);
      if (forceUi && typeof renderAdminAccountsList === 'function') renderAdminAccountsList();
      return cloudAccounts;
    }
  } catch (err) {
    console.warn('Cloud admin account refresh failed:', err);
  }
  return getAdminAccounts();
}
window.refreshAdminAccountsFromCloud = refreshAdminAccountsFromCloud;
function getAdminLogs() { return store.get(ADMIN_LOGS_KEY, []); }
function saveAdminLogs(logs) { store.set(ADMIN_LOGS_KEY, logs); }
function isMasterAdmin() { return !!(adminSession && adminSession.isMaster); }
function adminLabel() { return adminSession ? `${adminSession.name} • ${adminSession.role}` : 'Admin'; }

function logAction(action, detail = '') {
  const logs = getAdminLogs();
  logs.unshift({
    id: Date.now() + Math.random(),
    at: new Date().toISOString(),
    by: adminSession ? adminSession.name : 'System',
    username: adminSession ? adminSession.username : 'system',
    role: adminSession ? adminSession.role : 'System',
    action,
    detail
  });
  saveAdminLogs(logs.slice(0, 300));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function renderAdminAccountsList() {
  const host = document.getElementById('adminAccountsList');
  if (!host) return;
  const accounts = getAdminAccounts();
  host.innerHTML = accounts.map(acc => `
    <div class="stack-item">
      <div>
        <strong>${acc.name}</strong>
        <div class="muted">${acc.role} • @${acc.username}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${acc.isMaster ? '<span class="chip">Master</span>' : ''}
        <button class="ghost" type="button" onclick="editAdminAccount(${acc.id})">Edit</button>
        ${acc.isMaster ? '' : `<button class="ghost" type="button" onclick="deleteAdminAccount(${acc.id})" style="color:var(--red)">Delete</button>`}
      </div>
    </div>`).join('');
}

function renderAdminLogs() {
  const box = document.getElementById('adminLogsList');
  if (!box) return;
  const logs = getAdminLogs();
  box.innerHTML = logs.length ? logs.slice(0, 50).map(log => `
    <div class="stack-item">
      <div>
        <strong>${log.action}</strong>
        <div class="muted">${new Date(log.at).toLocaleString()} • ${log.by} (${log.role})</div>
        <div>${log.detail || ''}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">No logs yet.</div>';
}

function syncAdminUI() {
  const settingsBtn = document.getElementById('adminSettingsBtn');
  if (settingsBtn) settingsBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  document.querySelectorAll('.admin-actions').forEach(el => {
    el.style.display = isAdmin ? 'flex' : 'none';
  });
  const toggleBtn = document.getElementById('adminToggleBtn');
  if (toggleBtn) toggleBtn.innerHTML = isAdmin ? `🔓 ${adminLabel()}` : '🔒 Admin';
  const masterOnly = document.getElementById('masterAdminSections');
  if (masterOnly) masterOnly.style.display = isMasterAdmin() ? 'block' : 'none';
}

function toggleAdminPanel() {
  if (isAdmin) {
    logAction('Admin logout', adminLabel());
    isAdmin = false;
    adminSession = null;
    document.body.classList.remove('admin-mode');
    syncAdminUI();
    showToast('Logged out of admin mode');
    reRenderAll();
    if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
  } else {
    openModal('modalAdminLogin');
    document.getElementById('adminUsernameInput').value = '';
    document.getElementById('adminPwdInput').value = '';
    document.getElementById('adminLoginError').style.display = 'none';
    setTimeout(() => document.getElementById('adminUsernameInput').focus(), 100);
  }
}

document.getElementById('formAdminLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('adminUsernameInput').value.trim().toLowerCase();
  const pwd = document.getElementById('adminPwdInput').value;
  await refreshAdminAccountsFromCloud(false);
  const pwdHash = await sha256(pwd);
  const account = getAdminAccounts().find(a => a.username.toLowerCase() === username && (a.passwordHash ? a.passwordHash === pwdHash : a.password === pwd));
  if (account) {
    adminSession = { ...account };
    isAdmin = true;
    document.body.classList.add('admin-mode');
    closeModal('modalAdminLogin');
    syncAdminUI();
    logAction('Admin login', adminLabel());
    showToast(`Admin mode activated for ${account.role}`);
    fillAdminSettingsForm();
    reRenderAll();
    if (typeof refreshConcernsFromCloud === 'function') refreshConcernsFromCloud(true);
  } else {
    document.getElementById('adminLoginError').style.display = 'block';
  }
});

document.getElementById('formChangePassword').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin || !adminSession) return;
  const f = e.target;
  const msg = document.getElementById('pwdChangeMsg');
  if (f.newpwd.value !== f.confirmpwd.value) {
    msg.style.display = 'block';
    msg.style.color = 'var(--red)';
    msg.textContent = 'Passwords do not match.';
    return;
  }
  const accounts = getAdminAccounts();
  const idx = accounts.findIndex(a => a.id === adminSession.id);
  if (idx === -1) return;
  const newHash = await sha256(f.newpwd.value);
  accounts[idx].passwordHash = newHash;
  accounts[idx].passwordHint = 'Updated by admin';
  delete accounts[idx].password;
  adminSession.passwordHash = newHash;
  delete adminSession.password;
  try {
    await saveAdminAccounts(accounts, { silent: false });
    logAction('Password changed', adminLabel());
    msg.style.display = 'block';
    msg.style.color = 'var(--green)';
    msg.textContent = 'Password updated successfully!';
    f.reset();
  } catch (err) {
    msg.style.display = 'block';
    msg.style.color = 'var(--red)';
    msg.textContent = String(err.message || err);
  }
});
const VISIBILITY_KEY = 'utp_public_visibility';
const COMMUNITY_LINKS_KEY = 'utp_community_links';
const ONBOARD_STEPS_KEY = 'utp_onboard_steps';
const FAQ_KEY = 'utp_faqs';

function fillAdminSettingsForm() {
  const visibility = store.get(VISIBILITY_KEY, defaultPublicVisibility);
  const links = store.get(COMMUNITY_LINKS_KEY, defaultCommunityLinks);
  const steps = store.get(ONBOARD_STEPS_KEY, defaultOnboardSteps);
  const faqs = store.get(FAQ_KEY, defaultFaqData);
  const $ = id => document.getElementById(id);
  if (!$('visEmail')) return;
  $('visEmail').checked = !!visibility.email;
  $('visPhone').checked = !!visibility.phone;
  $('visBirthday').checked = !!visibility.birthday;
  $('visIntake').checked = !!visibility.intake;
  $('visPlace').checked = !!visibility.place;
  $('visSocial').checked = !!visibility.social;
  $('communityWhatsapp').value = links.whatsapp || '';
  $('communityFacebook').value = links.facebook || '';
  $('communityInstagram').value = links.instagram || '';
  $('onboardStepsEditor').value = (steps || []).join('\n');
  $('faqEditor').value = (faqs || []).map(item => `${item.q} | ${item.a}`).join('\n');
  const masterSection = document.getElementById('masterAdminSections');
  if (masterSection) masterSection.style.display = isMasterAdmin() ? 'block' : 'none';
  if (isMasterAdmin()) { renderAdminAccountsList(); renderAdminLogs(); }
}

document.getElementById('adminSettingsBtn')?.addEventListener('click', () => setTimeout(fillAdminSettingsForm, 50));

document.getElementById('formCommunityVisibility')?.addEventListener('submit', e => {
  e.preventDefault();
  if (!isAdmin) return;
  const visibility = {
    email: document.getElementById('visEmail').checked,
    phone: document.getElementById('visPhone').checked,
    birthday: document.getElementById('visBirthday').checked,
    intake: document.getElementById('visIntake').checked,
    place: document.getElementById('visPlace').checked,
    social: document.getElementById('visSocial').checked
  };
  const links = {
    whatsapp: document.getElementById('communityWhatsapp').value.trim(),
    facebook: document.getElementById('communityFacebook').value.trim(),
    instagram: document.getElementById('communityInstagram').value.trim()
  };
  const steps = document.getElementById('onboardStepsEditor').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6);
  const faqs = document.getElementById('faqEditor').value.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const parts = line.split('|');
    return { q: (parts[0] || '').trim(), a: parts.slice(1).join('|').trim() };
  }).filter(x => x.q && x.a);
  publicVisibility = visibility;
  communityLinksData = links;
  onboardSteps = steps.length ? steps : defaultOnboardSteps;
  faqData = faqs.length ? faqs : defaultFaqData;
  store.set(VISIBILITY_KEY, publicVisibility);
  store.set(COMMUNITY_LINKS_KEY, communityLinksData);
  store.set(ONBOARD_STEPS_KEY, onboardSteps);
  store.set(FAQ_KEY, faqData);
  logAction('Public settings updated', 'Visibility, links, onboarding, or FAQ changed');
  showToast('Public settings updated');
  reRenderAll();
});

async function addAdminAccount() {
  if (!isMasterAdmin()) return;
  const name = prompt('Admin display name');
  if (!name) return;
  const role = prompt('Admin role / committee position');
  if (!role) return;
  const username = prompt('Username (lowercase, no spaces)');
  if (!username) return;
  const accounts = getAdminAccounts();
  if (accounts.some(a => a.username.toLowerCase() === username.toLowerCase())) { showToast('Username already exists'); return; }
  const password = prompt('Password for this account');
  if (!password) return;
  const passwordHash = await sha256(password);
  accounts.push({ id: Date.now(), username: username.toLowerCase(), passwordHash, passwordHint: 'Created by master admin', name, role, isMaster: false });
  try {
    await saveAdminAccounts(accounts, { silent: false });
    logAction('Admin account added', `${name} • @${username.toLowerCase()}`);
    renderAdminAccountsList();
    showToast('Admin account added');
  } catch (err) {
    alert(String(err.message || err));
  }
}
async function editAdminAccount(id) {
  if (!isMasterAdmin()) return;
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  const name = prompt('Display name', acc.name); if (!name) return;
  const role = prompt('Role', acc.role); if (!role) return;
  const username = prompt('Username', acc.username); if (!username) return;
  const password = prompt('Enter a new password only if you want to replace the current one. Leave blank to keep the existing password.', '');
  acc.name = name;
  acc.role = role;
  acc.username = username.toLowerCase();
  if (password) {
    acc.passwordHash = await sha256(password);
    acc.passwordHint = 'Updated by master admin';
    delete acc.password;
  }
  try {
    await saveAdminAccounts(accounts, { silent: false });
    if (adminSession && adminSession.id === acc.id) adminSession = { ...adminSession, ...acc };
    logAction('Admin account edited', `${acc.name} • @${acc.username}`);
    renderAdminAccountsList();
    showToast('Admin account updated');
  } catch (err) {
    alert(String(err.message || err));
  }
}
async function deleteAdminAccount(id) {
  if (!isMasterAdmin()) return;
  const accounts = getAdminAccounts();
  const acc = accounts.find(a => a.id === id);
  if (!acc || acc.isMaster) return;
  if (!confirm(`Delete admin account for ${acc.name}?`)) return;
  try {
    await saveAdminAccounts(accounts.filter(a => a.id !== id), { silent: false });
    logAction('Admin account deleted', `${acc.name} • @${acc.username}`);
    renderAdminAccountsList();
    showToast('Admin account deleted');
  } catch (err) {
    alert(String(err.message || err));
  }
}
function clearAdminLogs() {
  if (!isMasterAdmin()) return;
  if (!confirm('Clear audit logs?')) return;
  saveAdminLogs([]);
  renderAdminLogs();
  showToast('Audit logs cleared');
}

async function addCommitteeMember() {
  if (!isAdmin) return;
  const role = prompt('Committee role (example: Advisor, President, Vice President)');
  if (!role) return;
  const name = prompt('Full name');
  if (!name) return;
  const gender = prompt('Gender (Male/Female)', 'Male') || '';
  const normalizedGender = /female/i.test(gender) ? 'Female' : /male/i.test(gender) ? 'Male' : '';
  const email = prompt('Email (optional)') || '';
  const phone = prompt('Phone (optional)') || '';
  const photo = prompt('Photo URL (optional)') || '';
  const newItem = { id: Date.now(), role, name, gender: normalizedGender, email, phone, photo };
  committeeData.unshift(newItem);
  store.set('utp_committee', committeeData);
  if (typeof window.saveCommitteeToCloud === 'function') {
    try {
      const saved = await window.saveCommitteeToCloud(newItem);
      const idx = committeeData.findIndex(x => Number(x.id) === Number(newItem.id));
      if (saved && idx >= 0) committeeData[idx] = saved;
      store.set('utp_committee', committeeData);
    } catch (err) { console.warn('Cloud committee save failed:', err); }
  }
  logAction('Committee member added', `${name} • ${role}`);
  showToast('Committee member added');
  reRenderAll();
}
async function confirmDeleteCommitteeMember(key) {
  if (!isAdmin) return;
  key = decodeURIComponent(String(key));
  const c = committeeData.find(x => String(x.id || x.role) === String(key));
  if (!confirm(`Delete committee record for "${c?.name || c?.role}"?`)) return;
  const deleteId = c?.id;
  committeeData = committeeData.filter(x => String(x.id || x.role) !== String(key));
  store.set('utp_committee', committeeData);
  if (deleteId && typeof window.deleteCommitteeFromCloud === 'function') {
    try { await window.deleteCommitteeFromCloud(deleteId); } catch (err) { console.warn('Cloud committee delete failed:', err); }
  }
  showToast('Committee profile deleted');
  reRenderAll();
}

async function addAlumniProfile() {
  if (!isAdmin) return;
  const name = prompt('Alumni name');
  if (!name) return;
  const batch = prompt('Batch / graduation year (optional)') || '';
  const gender = prompt('Gender (Male/Female)', 'Male') || '';
  const normalizedGender = /female/i.test(gender) ? 'Female' : /male/i.test(gender) ? 'Male' : '';
  const position = prompt('Current position (optional)') || '';
  const company = prompt('Company / organization (optional)') || '';
  const location = prompt('Location (optional)') || '';
  const photo = prompt('Photo URL (optional)') || '';
  const linkedin = prompt('LinkedIn URL (optional)') || '';
  const facebook = prompt('Facebook URL (optional)') || '';
  const instagram = prompt('Instagram URL (optional)') || '';
  const googleScholar = prompt('Google Scholar URL (optional)') || '';
  const researchGate = prompt('ResearchGate URL (optional)') || '';
  const website = prompt('Other social / website URL (optional)') || '';
  const newItem = { id: Date.now(), name, batch, gender: normalizedGender, position, company, location, photo, linkedin, facebook, instagram, googleScholar, researchGate, website };
  alumniData.unshift(newItem);
  store.set('utp_alumni', alumniData);
  if (typeof window.saveAlumniToCloud === 'function') {
    try {
      const saved = await window.saveAlumniToCloud(newItem);
      const idx = alumniData.findIndex(x => Number(x.id) === Number(newItem.id));
      if (saved && idx >= 0) alumniData[idx] = saved;
      store.set('utp_alumni', alumniData);
    } catch (err) { console.warn('Cloud alumni save failed:', err); }
  }
  logAction('Alumni added', name);
  showToast('Alumni profile added');
  reRenderAll();
}


function reRenderAll() {
  renderHome(); renderMembers(); renderCommittee(); renderAlumni();
  renderEvents(); renderAchievements(); renderGallery();
  renderConcerns(); renderOnboarding(); renderEmergency();
  syncAdminUI();
}

/* --------- Member edit --------- */
let editingMemberId = null;
function openEditMember(id) {
  if (!isAdmin) return;
  const m = membersData.find(x => x.id === id);
  if (!m) return;
  editingMemberId = id;
  document.getElementById('editMemberId').value = id;
  document.getElementById('editMemberName').value = m.name || '';
  document.getElementById('editMemberCategory').value = m.category || 'Undergraduate';
  document.getElementById('editMemberDept').value = m.department || '';
  document.getElementById('editMemberGender').value = m.gender || '';
  document.getElementById('editMemberBday').value = m.birthday || '';
  document.getElementById('editMemberPhone').value = m.phone || '';
  document.getElementById('editMemberIntakeMonth').value = m.intakeMonth || '';
  document.getElementById('editMemberIntakeYear').value = m.intakeYear || '';
  document.getElementById('editMemberPlace').value = m.place || '';
  document.getElementById('editMemberEmail').value = m.email || '';
  document.getElementById('editMemberPhoto').value = m.photo || '';
  if (typeof window.syncUploadPreviewFromInput === 'function') window.syncUploadPreviewFromInput('editMemberPhoto', 'editMemberPhotoPreview', m.name || 'Member photo');
  document.getElementById('editMemberFacebook').value = m.facebook || '';
  document.getElementById('editMemberInstagram').value = m.instagram || '';
  document.getElementById('editMemberWhatsapp').value = m.whatsapp || '';
  document.getElementById('editMemberLinkedin').value = m.linkedin || '';
  document.getElementById('editMemberGradYear').value = m.graduateYear || '';
  openModal('modalEditMember');
}

document.getElementById('formEditMember').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const formId = Number(f.querySelector('#editMemberId').value || editingMemberId);
  if (!isAdmin || !formId) return;
  const idx = membersData.findIndex(x => Number(x.id) === formId);
  if (idx === -1) return;
  const updatedMember = {
    ...membersData[idx],
    id: membersData[idx].id,
    name: f.querySelector('#editMemberName').value.trim(),
    category: f.querySelector('#editMemberCategory').value,
    department: f.querySelector('#editMemberDept').value.trim(),
    gender: f.querySelector('#editMemberGender').value,
    birthday: f.querySelector('#editMemberBday').value,
    phone: f.querySelector('#editMemberPhone').value.trim(),
    intakeMonth: f.querySelector('#editMemberIntakeMonth').value,
    intakeYear: f.querySelector('#editMemberIntakeYear').value.trim(),
    place: f.querySelector('#editMemberPlace').value,
    email: f.querySelector('#editMemberEmail').value.trim(),
    facebook: f.querySelector('#editMemberFacebook').value.trim(),
    instagram: f.querySelector('#editMemberInstagram').value.trim(),
    whatsapp: f.querySelector('#editMemberWhatsapp').value.trim(),
    linkedin: f.querySelector('#editMemberLinkedin').value.trim(),
    graduateYear: parseInt(f.querySelector('#editMemberGradYear').value, 10) || null
  };
  const photoValue = f.querySelector('#editMemberPhoto').value.trim();
  if (looksLikeLocalFilePath(photoValue)) {
    showToast('Use the upload box for local files. PC file paths will not work.');
    return;
  }
  if (photoValue) updatedMember.photo = photoValue;
  membersData[idx] = updatedMember;
  editingMemberId = formId;
  store.set('utp_members', membersData);
  if (typeof window.saveMemberToCloud === 'function') {
    try {
      const saved = await window.saveMemberToCloud(updatedMember);
      if (saved) membersData[idx] = saved;
      store.set('utp_members', membersData);
    } catch (err) { console.warn('Cloud member update failed:', err); }
  }
  closeModal('modalEditMember');
  showToast('Member updated');
  reRenderAll();
});

async function deleteMember() {
  if (!isAdmin || !editingMemberId) return;
  const m = membersData.find(x => x.id === editingMemberId);
  if (!confirm(`Delete "${m?.name}"? This cannot be undone.`)) return;
  const deleteId = editingMemberId;
  membersData = membersData.filter(x => x.id !== editingMemberId);
  store.set('utp_members', membersData);
  if (typeof window.deleteMemberFromCloud === 'function') {
    try { await window.deleteMemberFromCloud(deleteId); } catch (err) { console.warn('Cloud member delete failed:', err); }
  }
  closeModal('modalEditMember');
  showToast('Member deleted');
  reRenderAll();
}
async function confirmDeleteMember(id) {
  if (!isAdmin) return;
  const m = membersData.find(x => x.id === id);
  if (!confirm(`Delete "${m?.name}"?`)) return;
  membersData = membersData.filter(x => x.id !== id);
  store.set('utp_members', membersData);
  if (typeof window.deleteMemberFromCloud === 'function') {
    try { await window.deleteMemberFromCloud(id); } catch (err) { console.warn('Cloud member delete failed:', err); }
  }
  showToast('Member deleted');
  reRenderAll();
}

/* --------- Event edit --------- */
let editingEventId = null;
function openEditEvent(id) {
  if (!isAdmin) return;
  const ev = eventsData.find(x => x.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('editEventId').value = id;
  document.getElementById('editEventTitle').value = ev.title || '';
  document.getElementById('editEventDate').value = ev.date || '';
  document.getElementById('editEventTime').value = ev.time || '';
  document.getElementById('editEventVenue').value = ev.venue || '';
  document.getElementById('editEventDesc').value = ev.description || '';
  document.getElementById('editEventImage').value = ev.image || '';
  if (typeof window.syncUploadPreviewFromInput === 'function') window.syncUploadPreviewFromInput('editEventImage', 'editEventImagePreview', ev.title || 'Event image');
  openModal('modalEditEvent');
}

document.getElementById('formEditEvent').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin || !editingEventId) return;
  const idx = eventsData.findIndex(x => x.id === editingEventId);
  if (idx === -1) return;
  const f = e.target;
  Object.assign(eventsData[idx], {
    title: f.title.value.trim(),
    date: f.date.value,
    time: f.time.value,
    venue: f.venue.value.trim(),
    description: f.description.value,
    image: f.image.value.trim()
  });
  if (looksLikeLocalFilePath(eventsData[idx].image)) {
    showToast('Use the upload box for local files. PC file paths will not work.');
    return;
  }
  eventsData[idx].image = String(eventsData[idx].image || '').trim();
  store.set('utp_events', eventsData);
  if (typeof window.saveEventToCloud === 'function') {
    try {
      const saved = await window.saveEventToCloud(eventsData[idx]);
      if (saved) eventsData[idx] = saved;
      store.set('utp_events', eventsData);
    } catch (err) { console.warn('Cloud event update failed:', err); }
  }
  closeModal('modalEditEvent');
  showToast('Event updated');
  reRenderAll();
});
async function deleteEvent() {
  if (!isAdmin || !editingEventId) return;
  if (!confirm('Delete this event?')) return;
  const deleteId = editingEventId;
  eventsData = eventsData.filter(x => x.id !== editingEventId);
  store.set('utp_events', eventsData);
  if (typeof window.deleteEventFromCloud === 'function') {
    try { await window.deleteEventFromCloud(deleteId); } catch (err) { console.warn('Cloud event delete failed:', err); }
  }
  closeModal('modalEditEvent');
  showToast('Event deleted');
  reRenderAll();
}
async function confirmDeleteEvent(id) {
  if (!isAdmin) return;
  if (!confirm('Delete this event?')) return;
  eventsData = eventsData.filter(x => x.id !== id);
  store.set('utp_events', eventsData);
  if (typeof window.deleteEventFromCloud === 'function') {
    try { await window.deleteEventFromCloud(id); } catch (err) { console.warn('Cloud event delete failed:', err); }
  }
  showToast('Event deleted');
  reRenderAll();
}

/* --------- Committee edit --------- */
let editingCommitteeKey = null;
function openEditCommittee(key) {
  if (!isAdmin) return;
  key = decodeURIComponent(String(key));
  const c = committeeData.find(x => String(x.id || x.role) === String(key));
  if (!c) return;
  editingCommitteeKey = String(key);
  document.getElementById('editCommitteeId').value = editingCommitteeKey;
  document.getElementById('editCommitteeRole').value = c.role || '';
  document.getElementById('editCommitteeName').value = c.name || '';
  document.getElementById('editCommitteeGender').value = c.gender || '';
  document.getElementById('editCommitteeEmail').value = c.email || '';
  document.getElementById('editCommitteePhone').value = c.phone || '';
  document.getElementById('editCommitteePhoto').value = (c.photo && !String(c.photo).startsWith('data:')) ? c.photo : '';
  openModal('modalEditCommittee');
}

document.getElementById('formEditCommittee').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin || !editingCommitteeKey) return;
  const idx = committeeData.findIndex(x => String(x.id || x.role) === editingCommitteeKey);
  if (idx === -1) return;
  const f = e.target;
  Object.assign(committeeData[idx], {
    role: f.role.value.trim(),
    name: f.name.value.trim(),
    gender: f.gender ? f.gender.value : '',
    email: f.email.value.trim(),
    phone: f.phone.value.trim()
  });
  if (f.photo.value.trim()) committeeData[idx].photo = f.photo.value.trim();
  store.set('utp_committee', committeeData);
  if (typeof window.saveCommitteeToCloud === 'function') {
    try {
      const saved = await window.saveCommitteeToCloud(committeeData[idx]);
      if (saved) committeeData[idx] = saved;
      store.set('utp_committee', committeeData);
    } catch (err) { console.warn('Cloud committee update failed:', err); }
  }
  closeModal('modalEditCommittee');
  showToast('Committee profile updated');
  reRenderAll();
});
async function deleteCommitteeMember() {
  if (!isAdmin || !editingCommitteeKey) return;
  const c = committeeData.find(x => String(x.id || x.role) === editingCommitteeKey);
  if (!confirm(`Delete committee record for "${c?.name}"?`)) return;
  const deleteId = c?.id;
  committeeData = committeeData.filter(x => String(x.id || x.role) !== editingCommitteeKey);
  store.set('utp_committee', committeeData);
  if (deleteId && typeof window.deleteCommitteeFromCloud === 'function') {
    try { await window.deleteCommitteeFromCloud(deleteId); } catch (err) { console.warn('Cloud committee delete failed:', err); }
  }
  closeModal('modalEditCommittee');
  showToast('Committee profile deleted');
  reRenderAll();
}

/* --------- Alumni edit --------- */
let editingAlumniKey = null;
function openEditAlumni(key) {
  if (!isAdmin) return;
  key = decodeURIComponent(String(key));
  const a = alumniData.find(x => String(x.id || x.name) === String(key));
  if (!a) return;
  editingAlumniKey = String(key);
  document.getElementById('editAlumniId').value = editingAlumniKey;
  document.getElementById('editAlumniName').value = a.name || '';
  document.getElementById('editAlumniBatch').value = a.batch || '';
  document.getElementById('editAlumniGender').value = a.gender || '';
  document.getElementById('editAlumniPosition').value = a.position || '';
  document.getElementById('editAlumniCompany').value = a.company || '';
  document.getElementById('editAlumniLocation').value = a.location || '';
  document.getElementById('editAlumniPhoto').value = (a.photo && !String(a.photo).startsWith('data:')) ? a.photo : '';
  document.getElementById('editAlumniLinkedin').value = a.linkedin || '';
  document.getElementById('editAlumniFacebook').value = a.facebook || '';
  document.getElementById('editAlumniInstagram').value = a.instagram || '';
  document.getElementById('editAlumniGoogleScholar').value = a.googleScholar || '';
  document.getElementById('editAlumniResearchGate').value = a.researchGate || '';
  document.getElementById('editAlumniWebsite').value = a.website || '';
  openModal('modalEditAlumni');
}

document.getElementById('formEditAlumni').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin || !editingAlumniKey) return;
  const idx = alumniData.findIndex(x => String(x.id || x.name) === editingAlumniKey);
  if (idx === -1) return;
  const f = e.target;
  Object.assign(alumniData[idx], {
    name: f.name.value.trim(),
    batch: f.batch.value.trim(),
    gender: f.gender ? f.gender.value : '',
    position: f.position.value.trim(),
    company: f.company.value.trim(),
    location: f.location.value.trim(),
    linkedin: f.linkedin ? f.linkedin.value.trim() : '',
    facebook: f.facebook ? f.facebook.value.trim() : '',
    instagram: f.instagram ? f.instagram.value.trim() : '',
    googleScholar: f.googleScholar ? f.googleScholar.value.trim() : '',
    researchGate: f.researchGate ? f.researchGate.value.trim() : '',
    website: f.website ? f.website.value.trim() : ''
  });
  if (f.photo.value.trim()) alumniData[idx].photo = f.photo.value.trim();
  store.set('utp_alumni', alumniData);
  if (typeof window.saveAlumniToCloud === 'function') {
    try {
      const saved = await window.saveAlumniToCloud(alumniData[idx]);
      if (saved) alumniData[idx] = saved;
      store.set('utp_alumni', alumniData);
    } catch (err) { console.warn('Cloud alumni update failed:', err); }
  }
  closeModal('modalEditAlumni');
  showToast('Alumni profile updated');
  reRenderAll();
});
async function deleteAlumni() {
  if (!isAdmin || !editingAlumniKey) return;
  const a = alumniData.find(x => String(x.id || x.name) === editingAlumniKey);
  if (!confirm(`Delete alumni record for "${a?.name}"?`)) return;
  const deleteId = a?.id;
  alumniData = alumniData.filter(x => String(x.id || x.name) !== editingAlumniKey);
  store.set('utp_alumni', alumniData);
  if (deleteId && typeof window.deleteAlumniFromCloud === 'function') {
    try { await window.deleteAlumniFromCloud(deleteId); } catch (err) { console.warn('Cloud alumni delete failed:', err); }
  }
  closeModal('modalEditAlumni');
  showToast('Alumni profile deleted');
  reRenderAll();
}

/* --------- Announcement edit --------- */
let editingAnnouncementId = null;
function openEditAnnouncement(id) {
  if (!isAdmin) return;
  const a = announcementsData.find(x => x.id === id);
  if (!a) return;
  editingAnnouncementId = id;
  document.getElementById('editAnnouncementId').value = id;
  document.getElementById('editAnnouncementTitle').value = a.title || '';
  document.getElementById('editAnnouncementDate').value = a.date || '';
  document.getElementById('editAnnouncementCategory').value = a.category || 'General';
  document.getElementById('editAnnouncementPinned').checked = !!a.pinned;
  document.getElementById('editAnnouncementContent').value = a.content || '';
  openModal('modalEditAnnouncement');
}

document.getElementById('formEditAnnouncement').addEventListener('submit', e => {
  e.preventDefault();
  if (!isAdmin || !editingAnnouncementId) return;
  const idx = announcementsData.findIndex(x => x.id === editingAnnouncementId);
  if (idx === -1) return;
  announcementsData[idx] = {
    ...announcementsData[idx],
    title: document.getElementById('editAnnouncementTitle').value.trim(),
    date: document.getElementById('editAnnouncementDate').value,
    category: document.getElementById('editAnnouncementCategory').value,
    pinned: document.getElementById('editAnnouncementPinned').checked,
    content: document.getElementById('editAnnouncementContent').value
  };
  store.set('utp_announcements', announcementsData);
  closeModal('modalEditAnnouncement');
  showToast('Announcement updated');
  reRenderAll();
});
function deleteAnnouncement() {
  if (!isAdmin || !editingAnnouncementId) return;
  if (!confirm('Delete this announcement?')) return;
  announcementsData = announcementsData.filter(x => x.id !== editingAnnouncementId);
  store.set('utp_announcements', announcementsData);
  closeModal('modalEditAnnouncement');
  showToast('Announcement deleted');
  reRenderAll();
}
function confirmDeleteAnnouncement(id) {
  if (!isAdmin) return;
  if (!confirm('Delete this announcement?')) return;
  announcementsData = announcementsData.filter(x => x.id !== id);
  store.set('utp_announcements', announcementsData);
  showToast('Announcement deleted');
  reRenderAll();
}

/* --------- Achievement edit --------- */
let editingAchievementId = null;
function openEditAchievement(id) {
  if (!isAdmin) return;
  const a = achievementsData.find(x => x.id === id);
  if (!a) return;
  editingAchievementId = id;
  document.getElementById('editAchievementId').value = id;
  document.getElementById('editAchievementMember').value = a.member || '';
  document.getElementById('editAchievementType').value = a.type || 'Publication';
  document.getElementById('editAchievementDate').value = a.date || '';
  document.getElementById('editAchievementTitle').value = a.title || '';
  document.getElementById('editAchievementDepartment').value = a.department || '';
  document.getElementById('editAchievementDetails').value = a.details || '';
  document.getElementById('editAchievementPhoto').value = (a.photo && !String(a.photo).startsWith('data:')) ? a.photo : '';
  openModal('modalEditAchievement');
}

document.getElementById('formEditAchievement').addEventListener('submit', e => {
  e.preventDefault();
  if (!isAdmin || !editingAchievementId) return;
  const idx = achievementsData.findIndex(x => x.id === editingAchievementId);
  if (idx === -1) return;
  const f = e.target;
  Object.assign(achievementsData[idx], {
    member: f.member.value.trim(),
    type: f.type.value,
    date: f.date.value,
    title: f.title.value.trim(),
    department: f.department.value.trim(),
    details: f.details.value.trim()
  });
  if (f.photo.value.trim()) achievementsData[idx].photo = f.photo.value.trim();
  store.set('utp_achievements', achievementsData);
  closeModal('modalEditAchievement');
  showToast('Achievement updated');
  reRenderAll();
});
function deleteAchievementEdit() {
  if (!isAdmin || !editingAchievementId) return;
  if (!confirm('Delete this achievement?')) return;
  achievementsData = achievementsData.filter(x => x.id !== editingAchievementId);
  store.set('utp_achievements', achievementsData);
  closeModal('modalEditAchievement');
  showToast('Achievement deleted');
  reRenderAll();
}
function confirmDeleteAchievement(id) {
  if (!isAdmin) return;
  if (!confirm('Delete this achievement?')) return;
  achievementsData = achievementsData.filter(x => x.id !== id);
  store.set('utp_achievements', achievementsData);
  showToast('Achievement deleted');
  reRenderAll();
}

/* --------- Photo edit --------- */
let editingPhotoId = null;
function openEditPhoto(id) {
  if (!isAdmin) return;
  const g = galleryData.find(x => x.id === id);
  if (!g) return;
  editingPhotoId = id;
  document.getElementById('editPhotoId').value = id;
  document.getElementById('editPhotoTitle').value = g.title || '';
  document.getElementById('editPhotoDate').value = g.date || '';
  document.getElementById('editPhotoCategory').value = g.category || 'Community';
  document.getElementById('editPhotoUrl').value = g.url || '';
  if (typeof window.syncUploadPreviewFromInput === 'function') window.syncUploadPreviewFromInput('editPhotoUrl', 'editPhotoPreview', g.title || 'Gallery media');
  openModal('modalEditPhoto');
}

document.getElementById('formEditPhoto').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin || !editingPhotoId) return;
  const idx = galleryData.findIndex(x => x.id === editingPhotoId);
  if (idx === -1) return;
  const f = e.target;
  Object.assign(galleryData[idx], {
    title: f.title.value.trim(),
    date: f.date.value,
    category: f.category.value,
    url: f.url.value.trim(),
    mediaType: detectMediaType(f.url.value.trim())
  });
  if (looksLikeLocalFilePath(galleryData[idx].url)) {
    showToast('Use the upload box for local files. PC file paths will not work.');
    return;
  }
  galleryData[idx].url = String(galleryData[idx].url || '').trim();
  store.set('utp_gallery', galleryData);
  if (typeof window.saveGalleryItemToCloud === 'function') {
    try {
      const saved = await window.saveGalleryItemToCloud(galleryData[idx]);
      if (saved) galleryData[idx] = saved;
      store.set('utp_gallery', galleryData);
    } catch (err) { console.warn('Cloud gallery update failed:', err); }
  }
  closeModal('modalEditPhoto');
  showToast('Photo updated');
  reRenderAll();
});
async function deletePhotoEdit() {
  if (!isAdmin || !editingPhotoId) return;
  if (!confirm('Delete this photo?')) return;
  const deleteId = editingPhotoId;
  galleryData = galleryData.filter(x => x.id !== editingPhotoId);
  store.set('utp_gallery', galleryData);
  if (typeof window.deleteGalleryItemFromCloud === 'function') {
    try { await window.deleteGalleryItemFromCloud(deleteId); } catch (err) { console.warn('Cloud gallery delete failed:', err); }
  }
  closeModal('modalEditPhoto');
  showToast('Photo deleted');
  reRenderAll();
}
async function confirmDeletePhoto(id) {
  if (!isAdmin) return;
  if (!confirm('Delete this photo?')) return;
  galleryData = galleryData.filter(x => x.id !== id);
  store.set('utp_gallery', galleryData);
  if (typeof window.deleteGalleryItemFromCloud === 'function') {
    try { await window.deleteGalleryItemFromCloud(id); } catch (err) { console.warn('Cloud gallery delete failed:', err); }
  }
  showToast('Photo deleted');
  reRenderAll();
}

/* --------- Export / Import / Reset --------- */
function exportAllData() {
  const data = {
    members: membersData,
    committee: committeeData,
    alumni: alumniData,
    events: eventsData,
    announcements: announcementsData,
    achievements: achievementsData,
    gallery: galleryData,
    concerns: concernsData,
    adminAccounts: getAdminAccounts(),
    adminLogs: getAdminLogs(),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ais-utp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  logAction('Data exported', 'Full JSON backup created');
  showToast('Data exported');
}

function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('This will replace ALL current data. Continue?')) { event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.members) { membersData = data.members; store.set('utp_members', membersData); }
      if (data.committee) { committeeData = data.committee; store.set('utp_committee', committeeData); }
      if (data.alumni) { alumniData = data.alumni; store.set('utp_alumni', alumniData); }
      if (data.events) { eventsData = data.events; store.set('utp_events', eventsData); }
      if (data.announcements) { announcementsData = data.announcements; store.set('utp_announcements', announcementsData); }
      if (data.achievements) { achievementsData = data.achievements; store.set('utp_achievements', achievementsData); }
      if (data.gallery) { galleryData = data.gallery; store.set('utp_gallery', galleryData); }
      if (data.concerns) { concernsData = data.concerns; store.set('utp_concerns', concernsData); }
      if (data.adminAccounts) { saveAdminAccounts(data.adminAccounts, { silent: true }).catch(() => {}); }
      if (data.adminLogs) { saveAdminLogs(data.adminLogs); }
      logAction('Data imported', 'Backup restored');
      showToast('Data imported successfully');
      reRenderAll();
    } catch (err) {
      alert('Invalid JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function resetAllData() {
  if (!isAdmin) return;
  if (!confirm('Reset all locally edited data back to the original default dataset?')) return;
  localStorage.removeItem('utp_members');
  localStorage.removeItem('utp_committee');
  localStorage.removeItem('utp_alumni');
  localStorage.removeItem('utp_events');
  localStorage.removeItem('utp_announcements');
  localStorage.removeItem('utp_achievements');
  localStorage.removeItem('utp_gallery');
  localStorage.removeItem('utp_rsvps');
  localStorage.removeItem('utp_concerns');
  localStorage.removeItem('utp_admin_accounts');
  localStorage.removeItem('utp_admin_logs');
  membersData = members;
  committeeData = committee;
  alumniData = alumni;
  eventsData = events;
  announcementsData = announcements;
  achievementsData = achievements;
  galleryData = gallery;
  concernsData = [];
  rsvps = {};
  saveAdminAccounts(defaultAdminAccounts(), { silent: true }).catch(() => {});
  saveAdminLogs([]);
  closeModal('modalAdminSettings');
  logAction('Data reset', 'Local edits reset to default dataset');
  showToast('Reset to defaults');
  reRenderAll();
}

syncAdminUI();


window.toggleAdminPanel = toggleAdminPanel;
window.exportAllData = exportAllData;
window.importAllData = importAllData;
window.resetAllData = resetAllData;
window.addAdminAccount = addAdminAccount;
window.editAdminAccount = editAdminAccount;
window.deleteAdminAccount = deleteAdminAccount;
window.clearAdminLogs = clearAdminLogs;
window.openEditMember = openEditMember;
window.deleteMember = deleteMember;
window.openEditEvent = openEditEvent;
window.deleteEvent = deleteEvent;
window.openEditCommittee = openEditCommittee;
window.deleteCommitteeMember = deleteCommitteeMember;
window.openEditAlumni = openEditAlumni;
window.deleteAlumni = deleteAlumni;
window.openEditAnnouncement = openEditAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.openEditAchievement = openEditAchievement;
window.deleteAchievementEdit = deleteAchievementEdit;
window.openEditPhoto = openEditPhoto;
window.deletePhotoEdit = deletePhotoEdit;
window.addCommitteeMember = addCommitteeMember;
window.addAlumniProfile = addAlumniProfile;


document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof refreshAdminAccountsFromCloud === 'function') refreshAdminAccountsFromCloud(false);
  }, 300);
});
