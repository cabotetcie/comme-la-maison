// =====================================================================
//  Le QG — point d'entrée : écrans, navigation et actions.
// =====================================================================
import * as L from './logic.js';
import * as D from './data.js';
import { icon } from './icons.js';
import {
  st, ui, hooks, $, esc, today, me, other, hid, putRow, dropRow, findItem,
  toast, errMsg, save, openSheet, closeSheet, confirmBox, opts,
} from './core.js';
import * as V from './views.js';
import * as F from './forms.js';

const P = L.PERSON_LABEL;
let sb = null;
let channel = null;
let booting = false;

const VIEWS = {
  today: V.viewToday, inbox: V.viewInbox, maison: V.viewMaison, repas: V.viewRepas,
  courses: V.viewCourses, stock: V.viewStock, dispos: V.viewDispos, foyer: V.viewFoyer,
};
const NAV = [
  ['today', 'sun', 'Aujourd’hui'], ['inbox', 'inbox', 'À organiser'], ['maison', 'home', 'Maison'],
  ['repas', 'utensils', 'Repas'], ['courses', 'cart', 'Courses'], ['stock', 'box', 'Inventaire'],
  ['dispos', 'calendar', 'Disponibilités'], ['foyer', 'users', 'Foyer'],
];
const rid = () => Math.random().toString(36).slice(2, 10);
const num = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };
const str = (v) => { const s = String(v ?? '').trim(); return s || null; };
F.setStockLocRef(() => ui.stockLoc);

// =====================================================================
//  Rendu
// =====================================================================
function render(force = false) {
  const root = $('#app');
  if (ui.screen !== 'app') { root.innerHTML = SCREENS[ui.screen](); return; }
  const active = document.activeElement;
  if (!force && active && $('#view')?.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && !active.matches('[data-input]') && active.type !== 'checkbox' && active.type !== 'radio') {
    ui.pending = true; return;  // on n'efface pas une saisie en cours ; rendu au départ du champ
  }
  ui.pending = false;
  if (!$('#view')) root.innerHTML = shell();
  ui.items.clear();
  const fn = VIEWS[ui.route] || V.viewToday;
  try { $('#view').innerHTML = fn(); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="notice warn">${icon('alert')}<div><strong>Affichage impossible</strong><p>${esc(e.message)}</p></div></div>`; }
  updateNav();
  if (ui.refocus) {
    const el = $(ui.refocus); ui.refocus = null;
    if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'search') { const n = el.value.length; el.setSelectionRange(n, n); } }
  }
  if (ui.sheetLive && $('#sheet').open) $('#sheet-body').innerHTML = ui.sheetLive();
}
hooks.render = render;

function shell() {
  const link = ([r, ic, lab]) => `<a href="#/${r}" data-route="${r}">${icon(ic)}<span>${lab}</span><b class="badge" data-badge="${r}" hidden></b></a>`;
  return `
  <header class="topbar">
    <a class="brand" href="#/today" aria-label="Accueil"><img src="icons/favicon-64.png" alt="" width="34" height="34"><span>Le QG</span></a>
    <span class="sync" id="sync" role="status"></span>
    <button class="avatar p-${me()}" data-act="more" aria-label="Menu : À organiser, inventaire, disponibilités, foyer">${esc(P[me()][0])}<b class="badge" data-badge="more" hidden></b></button>
  </header>
  <nav class="sidebar" aria-label="Navigation principale">${NAV.map(link).join('')}</nav>
  <main id="view" tabindex="-1"></main>
  <nav class="tabbar" aria-label="Navigation">
    ${link(NAV[0])}${link(NAV[2])}
    <span class="fab-slot"></span>
    ${link(NAV[3])}${link(NAV[4])}
  </nav>
  <button class="fab" data-act="capture" aria-label="Ajouter">${icon('plus')}<span>Ajouter</span></button>`;
}
function updateNav() {
  document.querySelectorAll('[data-route]').forEach((a) => a.setAttribute('aria-current', a.dataset.route === ui.route ? 'page' : 'false'));
  const inbox = V.organizeCount();
  const t = today();
  const stock = st.inventory.filter((x) => L.isLowStock(x) || ['soon', 'expired'].includes(L.expiryStatus(x.expires_on, t)?.level)).length;
  const shop = st.shopping.filter((x) => !x.checked && !x.archived).length;
  const set = (k, n) => document.querySelectorAll(`[data-badge="${k}"]`).forEach((b) => { b.hidden = !n; b.textContent = n; });
  set('inbox', inbox); set('stock', stock); set('courses', shop); set('more', inbox + stock);
  const s = $('#sync'); if (s) { s.textContent = ui.online ? '' : 'Reconnexion…'; s.className = 'sync ' + (ui.online ? '' : 'off'); }
}

// =====================================================================
//  Écrans hors application : configuration, connexion, création du foyer
// =====================================================================
const brandBlock = `<div class="auth-brand"><img src="icons/icon-192.png" alt="" width="96" height="96"><h1>Le QG</h1><p>Le quotidien du foyer d’Ilona et Adrien</p></div>`;
const SCREENS = {
  loading: () => `<div class="center-screen">${brandBlock}<p class="muted">Chargement…</p></div>`,
  config: () => `<div class="center-screen"><div class="auth-card">${brandBlock}
    <div class="notice warn">${icon('alert')}<div><strong>Configuration manquante</strong>
    <p>Le fichier <code>js/config.js</code> est introuvable ou incomplet. Créez-le à partir de <code>.env</code> avec <code>npm run config</code> (voir le README), puis rechargez la page.</p></div></div></div></div>`,
  error: () => `<div class="center-screen"><div class="auth-card">${brandBlock}<div class="notice warn">${icon('alert')}<div><strong>Impossible de démarrer</strong><p>${esc(ui.error)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div></div></div></div>`,
  auth: () => {
    const m = ui.authMode;
    const msg = ui.authMsg ? `<div class="notice ${ui.authMsg.kind === 'err' ? 'warn' : ''}">${icon(ui.authMsg.kind === 'err' ? 'alert' : 'check')}<div><p>${esc(ui.authMsg.text)}</p></div></div>` : '';
    const invite = ui.inviteCode ? `<p class="hint">Invitation reçue : créez votre compte (ou connectez-vous), le code ${esc(ui.inviteCode)} sera prérempli.</p>` : '';
    if (m === 'reset') return `<div class="center-screen"><div class="auth-card">${brandBlock}${msg}
      <form data-form="reset" class="stack"><h2>Mot de passe oublié</h2>
      <label class="field"><span class="label">Adresse e-mail</span><input type="email" name="email" required autocomplete="email"></label>
      <button class="btn primary big">Recevoir un lien</button>
      <button type="button" class="btn ghost" data-act="auth-mode" data-mode="login">Retour</button></form></div></div>`;
    if (m === 'newpass') return `<div class="center-screen"><div class="auth-card">${brandBlock}${msg}
      <form data-form="newpass" class="stack"><h2>Nouveau mot de passe</h2>
      <label class="field"><span class="label">Nouveau mot de passe (8 caractères minimum)</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
      <button class="btn primary big">Enregistrer</button></form></div></div>`;
    const signup = m === 'signup';
    return `<div class="center-screen"><div class="auth-card">${brandBlock}${msg}${invite}
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${!signup}" data-act="auth-mode" data-mode="login">Se connecter</button><button role="tab" aria-selected="${signup}" data-act="auth-mode" data-mode="signup">Créer un compte</button></div>
      <form data-form="${signup ? 'signup' : 'login'}" class="stack">
        <label class="field"><span class="label">Adresse e-mail</span><input type="email" name="email" required autocomplete="email"></label>
        <label class="field"><span class="label">Mot de passe${signup ? ' (8 caractères minimum)' : ''}</span><input type="password" name="password" required ${signup ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'}></label>
        <button class="btn primary big">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
      </form>
      ${signup ? '<p class="muted small">Chaque personne du foyer crée son propre compte avec sa propre adresse e-mail.</p>' : '<button class="btn ghost small" data-act="auth-mode" data-mode="reset">Mot de passe oublié ?</button>'}
    </div></div>`;
  },
  onboarding: () => {
    const join = ui.onboard === 'join';
    return `<div class="center-screen"><div class="auth-card">${brandBlock}
      <p class="muted small">Connecté·e : ${esc(st.session?.user?.email || '')}</p>
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${!join}" data-act="onboard" data-mode="create">Créer notre foyer</button><button role="tab" aria-selected="${join}" data-act="onboard" data-mode="join">Rejoindre un foyer</button></div>
      ${join ? `<form data-form="join-hh" class="stack">
          <p>Saisissez le code d’invitation affiché chez l’autre membre (rubrique Foyer).</p>
          <label class="field"><span class="label">Code d’invitation</span><input name="code" required maxlength="12" value="${esc(ui.inviteCode)}" autocapitalize="characters" autocomplete="off" class="code-input"></label>
          <button class="btn primary big">Rejoindre</button></form>`
        : `<form data-form="create-hh" class="stack">
          <label class="field"><span class="label">Nom du foyer</span><input name="name" value="Le QG" maxlength="60" required></label>
          <div class="field"><span class="label">Je suis</span><div class="seg"><label><input type="radio" name="person" value="ilona" required><span>Ilona</span></label><label><input type="radio" name="person" value="adrien" required><span>Adrien</span></label></div></div>
          <p class="muted small">Le planning ménage, les deux tâches ponctuelles et la liste de courses de départ seront ajoutés une seule fois.</p>
          <button class="btn primary big">Créer le foyer</button></form>`}
      <button class="btn ghost small" data-act="logout">Se déconnecter</button>
    </div></div>`;
  },
};

// =====================================================================
//  Démarrage, session, chargement et synchronisation
// =====================================================================
function readInvite() {
  try {
    const u = new URL(location.href);
    const code = u.searchParams.get('invitation');
    if (code) { sessionStorage.setItem('qg-invite', code); u.searchParams.delete('invitation'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    ui.inviteCode = (code || sessionStorage.getItem('qg-invite') || '').toUpperCase();
  } catch { /* stockage indisponible : on ignore */ }
  if (ui.inviteCode) { ui.onboard = 'join'; ui.authMode = 'signup'; }
}

async function boot() {
  hooks.render = render;
  readInvite();
  ui.route = (location.hash.slice(2) || 'today').split('?')[0];
  if (!VIEWS[ui.route]) ui.route = 'today';
  render();
  if (!D.configured) { ui.screen = 'config'; render(); return; }
  try { sb = await D.client(); } catch (e) { ui.screen = 'error'; ui.error = 'Le service de données ne répond pas. ' + errMsg(e); render(); return; }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { ui.screen = 'auth'; ui.authMode = 'newpass'; render(); return; }
    if (event === 'SIGNED_OUT') { teardown(); ui.screen = 'auth'; ui.authMode = 'login'; render(); return; }
    if (event === 'SIGNED_IN' && !st.me) setTimeout(() => onSession(session), 0);
  });
  const { data } = await sb.auth.getSession();
  await onSession(data.session);
}

async function onSession(session) {
  if (booting) return;
  booting = true;
  try {
    st.session = session;
    if (!session) { ui.screen = 'auth'; render(); return; }
    const m = await D.myMembership(session.user.id);
    if (!m) { ui.screen = 'onboarding'; render(); return; }
    st.me = m;
    await loadAll();
    try { sessionStorage.removeItem('qg-invite'); } catch { /* rien */ }
    ui.screen = 'app';
    $('#app').innerHTML = '';
    render();
    if (channel) channel.unsubscribe?.();
    channel = D.subscribe(m.household_id, onRemoteChange);
  } catch (e) {
    console.error(e);
    ui.screen = 'error'; ui.error = errMsg(e); render();
  } finally { booting = false; }
}

async function loadAll() {
  const t = today();
  const names = Object.keys(D.TABLES);
  const rows = await Promise.all(names.map((n) => D.loadTable(n, hid(), t)));
  names.forEach((n, k) => { st[D.TABLES[n]] = rows[k]; });
  st.hh = st.hh[0] || null;
  st.me = st.members.find((x) => x.user_id === st.session.user.id) || st.me;
}

const reloadTimers = {};
function onRemoteChange(table, status) {
  if (status) { ui.online = status === 'SUBSCRIBED'; if (ui.screen === 'app') updateNav(); if (ui.online) refreshAll(); return; }
  if (!table) return;
  clearTimeout(reloadTimers[table]);
  reloadTimers[table] = setTimeout(async () => {
    try {
      const rows = await D.loadTable(table, hid(), today());
      if (table === 'households') st.hh = rows[0] || st.hh; else st[D.TABLES[table]] = rows;
      render();
    } catch (e) { console.warn('Synchronisation', e); }
  }, 250);
}
async function refreshAll() {
  if (ui.screen !== 'app') return;
  try { await loadAll(); render(); } catch (e) { console.warn(e); }
}
function teardown() {
  if (channel) channel.unsubscribe?.();
  channel = null;
  Object.assign(st, { session: null, me: null, hh: null, members: [], tasks: [], occ: [], projects: [], inbox: [], avail: [], recipes: [], meals: [], shopping: [], inventory: [] });
}

// =====================================================================
//  Opérations sur les tâches
// =====================================================================
const occBase = (i) => ({ task_id: i.taskId, occ_date: i.occDate, household_id: hid() });
async function writeOcc(i, patch) { const row = await D.upsertOcc({ ...occBase(i), ...patch }); putRow('occ', row); return row; }
async function writeTask(id, patch) { const row = await D.update('tasks', id, patch); putRow('tasks', row); return row; }

async function setStatus(i, status) {
  const doneFields = status === 'termine' ? { done_at: new Date().toISOString(), done_by: me() } : { done_at: null, done_by: null };
  if (i.recurring) return writeOcc(i, { status, ...doneFields });
  return writeTask(i.taskId, { status, ...doneFields });
}
async function postponeItem(i, to, extra = {}) {
  if (i.recurring) {
    const status = ['a_replanifier', 'saute'].includes(i.status) ? 'a_faire' : i.status;
    return writeOcc(i, { moved_to: to === i.occDate ? null : to, status, ...(extra.assignee ? { assignee: extra.assignee, assign_source: extra.source || 'manual' } : {}) });
  }
  const status = ['a_replanifier', 'a_organiser'].includes(i.task.status) ? 'a_faire' : i.task.status;
  return writeTask(i.taskId, { planned_date: to, planned_week: null, someday: false, status,
    ...(extra.assignee ? { assignee: extra.assignee, assign_mode: extra.source || 'manual' } : {}) });
}
async function assignItem(i, who, source = 'manual') {
  if (i.recurring) return writeOcc(i, { assignee: who || null, assign_source: who ? source : null });
  return writeTask(i.taskId, { assignee: who || null, assign_mode: who ? source : 'auto' });
}
/** Attribution automatique d'une tâche ponctuelle datée créée sans responsable. */
async function autoAssign(task) {
  if (task.recurrence || task.assignee || !task.planned_date || task.planned_date < today()) return '';
  const plan = L.planDistribution({ tasks: st.tasks, occurrences: st.occ, members: st.members, availabilities: st.avail, from: task.planned_date, to: task.planned_date, today: today() });
  const p = plan.proposals.find((x) => x.key === task.id);
  if (!p) return '';
  if (p.action === 'assign') { await writeTask(task.id, { assignee: p.person, assign_mode: 'auto' }); return ` · attribuée à ${P[p.person]} (${p.reason.replace(/\.$/, '').toLowerCase()})`; }
  if (p.action === 'replan') return ' · les deux sont absents ce jour-là : à répartir';
  return ' · journée chargée : pensez à répartir';
}

function readSubs(fd) {
  const names = fd.getAll('sub'); const ids = fd.getAll('subid'); const dones = fd.getAll('subdone');
  return names.map((n, k) => ({ id: ids[k] || rid(), title: String(n).trim(), done: dones[k] === '1' })).filter((s) => s.title);
}
function readTaskForm(fd, existing) {
  const freq = fd.get('freq') || '';
  const assignee = fd.get('assignee') || null;
  const row = {
    kind: fd.get('kind') || 'tache', title: String(fd.get('title')).trim(), category: fd.get('category'),
    description: str(fd.get('description')), priority: fd.get('priority') || 'normale',
    duration_min: int(fd.get('duration')), project_id: fd.get('project') || null,
    assignee, assign_mode: assignee ? 'manual' : 'auto', subactions: readSubs(fd),
  };
  if (freq) {
    const days = fd.getAll('days').map(Number);
    if ((freq === 'weekly' || freq === 'biweekly') && !days.length) throw new Error('Choisissez au moins un jour de la semaine.');
    row.recurrence = {
      freq: freq === 'biweekly' ? 'weekly' : freq,
      interval: freq === 'biweekly' ? 2 : freq === 'daily' ? Math.max(1, int(fd.get('interval')) || 1) : 1,
      start: fd.get('start') || today(), alternate: fd.get('alternate') === 'on',
      ...(freq === 'weekly' || freq === 'biweekly' ? { days } : {}),
    };
    Object.assign(row, { planned_date: null, planned_week: null, someday: false, due_date: null, status: 'a_faire' });
  } else {
    const when = fd.get('when') || 'none';
    row.recurrence = null;
    row.planned_date = when === 'today' ? today() : when === 'date' ? fd.get('date') || today() : null;
    row.planned_week = when === 'week' ? fd.get('week') : null;
    row.someday = when === 'later';
    row.due_date = fd.get('due') || null;
    let status = fd.get('status') || (existing && existing.status) || 'a_faire';
    if (when === 'none' && status !== 'termine') status = 'a_organiser';
    else if (['a_organiser', 'a_replanifier'].includes(status)) status = 'a_faire';
    row.status = status;
    if (status === 'termine' && existing?.status !== 'termine') Object.assign(row, { done_at: new Date().toISOString(), done_by: me() });
    if (status !== 'termine') Object.assign(row, { done_at: null, done_by: null });
  }
  return row;
}

// =====================================================================
//  Actions (clics)
// =====================================================================
const A = {
  'close-sheet': () => closeSheet(),
  more: () => openSheet('Menu', F.moreSheet({ inbox: V.organizeCount(), stock: st.inventory.filter((x) => L.isLowStock(x)).length })),
  'auth-mode': (d) => { ui.authMode = d.mode; ui.authMsg = null; render(); },
  onboard: (d) => { ui.onboard = d.mode; render(); },
  logout: async () => { await sb.auth.signOut(); teardown(); ui.screen = 'auth'; render(); },

  // --- navigation interne
  'maison-tab': (d) => { ui.maisonTab = d.tab; if (ui.route !== 'maison') location.hash = '#/maison'; else render(); },
  week: (d) => { ui.maisonWeek = d.delta === '0' ? 0 : ui.maisonWeek + Number(d.delta); render(); },
  'menu-week': (d) => { ui.menuWeek = d.delta === '0' ? 0 : ui.menuWeek + Number(d.delta); render(); },
  'repas-tab': (d) => { ui.repasTab = d.tab; render(true); },
  'stock-loc': (d) => { ui.stockLoc = d.loc; render(); },

  // --- capture
  capture: () => openSheet('Ajouter', F.captureForm()),

  // --- tâches
  detail: (d) => openSheet('Tâche', F.taskDetail(d.key), { live: () => F.taskDetail(d.key) }),
  toggle: (d) => {
    const i = findItem(d.key); if (!i) return;
    const done = i.status === 'termine';
    save(() => setStatus(i, done ? 'a_faire' : 'termine'), done ? 'Validation annulée' : 'Tâche terminée');
  },
  progress: (d) => { const i = findItem(d.key); save(() => setStatus(i, i.status === 'en_cours' ? 'a_faire' : 'en_cours')); },
  postpone: (d) => {
    const i = findItem(d.key); if (!i) return;
    const to = d.to || L.addDays(today(), Number(d.days || 1));
    save(() => postponeItem(i, to), `Reportée ${L.relativeDay(to, today())}`).then(() => { if ($('#sheet').open && ui.sheetLive) closeSheet(); });
  },
  'postpone-date': (d) => { const v = $('#pp-date')?.value; if (!v) return toast('Choisissez une date.', 'err'); A.postpone({ key: d.key, to: v }); },
  'postpone-all-late': async () => {
    const late = L.overdueItems(st.tasks, st.occ, today());
    if (!late.length) return;
    const ok = await confirmBox(`Reporter les ${late.length} tâches en retard à aujourd’hui ?`, { ok: 'Reporter', danger: false });
    if (ok) save(async () => { for (const i of late) await postponeItem(i, today()); }, `${late.length} tâches reportées à aujourd’hui`);
  },
  assign: (d) => { const i = findItem(d.key); save(() => assignItem(i, d.who), d.who ? `Responsable : ${P[d.who]}` : 'Responsable : répartition automatique'); },
  'swap-pick': (d) => openSheet('Échanger', F.swapPicker(d.key)),
  swap: (d) => {
    const a = findItem(d.key); const b = findItem(d.with);
    save(async () => { const pa = a.assignee; await assignItem(a, b.assignee); await assignItem(b, pa); }, 'Tâches échangées').then(closeSheet);
  },
  skip: async (d) => {
    const i = findItem(d.key);
    if (await confirmBox(`Passer l’occurrence du ${L.fmtShort(i.date)} de « ${i.title} » ?`, { ok: 'Passer', danger: false, detail: 'La série continue normalement.' })) {
      save(() => writeOcc(i, { status: 'saute' }), 'Occurrence passée').then(closeSheet);
    }
  },
  'delete-task': async (d) => {
    const t = st.tasks.find((x) => x.id === d.id); if (!t) return;
    const ok = await confirmBox(t.recurrence ? `Supprimer toute la série « ${t.title} » ?` : `Supprimer « ${t.title} » ?`,
      { detail: t.recurrence ? 'Toutes les occurrences et leur historique seront supprimés. Pour une seule fois, utilisez plutôt « Passer cette occurrence ».' : 'Cette action est définitive.' });
    if (!ok) return;
    save(async () => { await D.remove('tasks', t.id); dropRow('tasks', t.id); st.occ = st.occ.filter((o) => o.task_id !== t.id); closeSheet(); }, 'Supprimée');
  },
  'edit-item': (d) => { const i = findItem(d.key); if (i.recurring) openSheet('Modifier', F.scopeChooser(d.key)); else A['edit-series']({ id: i.taskId }); },
  'edit-occ': (d) => openSheet('Modifier cette occurrence', F.occForm(d.key)),
  'edit-series': (d) => { const t = st.tasks.find((x) => x.id === d.id); openSheet(t.recurrence ? 'Modifier toute la série' : 'Modifier la tâche', F.taskForm(t, { organize: !!d.organize || V.isUnorganized(t) }), { wide: true }); },
  'new-task': (d) => openSheet('Nouvelle tâche', F.taskForm(null, { planned_date: d.date || null, planned_week: d.week || null, project_id: d.project || null }), { wide: true }),
  horizon: (d) => {
    const t = st.tasks.find((x) => x.id === d.id);
    const patch = { status: t.status === 'termine' ? 'termine' : 'a_faire', planned_date: null, planned_week: null, someday: false };
    if (d.h === 'today') patch.planned_date = today();
    if (d.h === 'week') patch.planned_week = L.startOfWeek(today());
    if (d.h === 'later') patch.someday = true;
    const label = { today: 'Prévue aujourd’hui', week: 'Prévue cette semaine', later: 'Rangée dans « Plus tard »' }[d.h];
    save(async () => { const row = await writeTask(t.id, patch); const extra = await autoAssign(row); toast(label + extra); }, '');
  },
  'add-sub-row': () => { $('#sub-editor').insertAdjacentHTML('beforeend', F.subRow()); $('#sub-editor .sub-row:last-child input[name=sub]').focus(); },
  'add-ing-row': () => { $('#ing-editor').insertAdjacentHTML('beforeend', F.ingRow()); $('#ing-editor .ing-row:last-child input').focus(); },
  'rm-row': (d, el) => el.closest('.sub-row, .ing-row').remove(),
  'task-convert': (d) => openSheet('Autre rubrique', F.convertChooser(d.id)),
  'task-convert-do': (d) => {
    const t = st.tasks.find((x) => x.id === d.id);
    save(async () => {
      if (d.to === 'courses') await addToShopping([{ name: t.title, category: L.guessShopCategory(t.title), note: t.description }]);
      if (d.to === 'repas') putRow('recipes', await D.insert('recipes', { household_id: hid(), name: t.title, notes: t.description }));
      if (d.to === 'projet') putRow('projects', await D.insert('projects', { household_id: hid(), title: t.title, description: t.description, status: 'idee' }));
      await D.remove('tasks', t.id); dropRow('tasks', t.id); closeSheet();
    }, 'Déplacé');
  },

  // --- répartition
  distribute: (d) => { ui.distPlan = null; openSheet('Répartition automatique', F.distForm(d.range || 'week'), { wide: true }); },

  // --- boîte de réception
  'inbox-edit': (d) => openSheet('Modifier', F.inboxEditForm(st.inbox.find((x) => x.id === d.id))),
  'inbox-delete': async (d) => {
    const x = st.inbox.find((y) => y.id === d.id);
    if (await confirmBox(`Supprimer « ${x.title} » ?`)) save(async () => { await D.remove('inbox_items', x.id); dropRow('inbox', x.id); }, 'Supprimé');
  },
  'inbox-organize': (d) => {
    const x = st.inbox.find((y) => y.id === d.id);
    const pre = { title: x.title, note: x.note, inboxId: x.id };
    if (['tache', 'action', 'admin', 'achat_maison'].includes(x.type)) {
      openSheet('Organiser', F.taskForm(null, { title: x.title, description: x.note, inboxId: x.id, kind: x.type === 'action' ? 'action' : 'tache',
        category: x.type === 'admin' ? 'administratif' : x.type === 'achat_maison' ? 'achats' : x.type === 'action' ? 'autre' : 'menage' }), { wide: true });
    } else if (x.type === 'courses') {
      const q = L.parseQuickProduct(x.title);
      save(async () => { await addToShopping([{ ...q, category: L.guessShopCategory(q.name), note: x.note }]); await D.remove('inbox_items', x.id); dropRow('inbox', x.id); }, 'Ajouté à la liste de courses');
    } else if (x.type === 'repas') openSheet('Idée de repas', F.recipeForm(null, pre), { wide: true });
    else openSheet('Projet', F.projectForm(null, { ...pre, status: 'idee' }));
  },

  // --- projets
  'new-project': () => openSheet('Nouveau projet', F.projectForm()),
  'edit-project': (d) => openSheet('Projet', F.projectForm(st.projects.find((p) => p.id === d.id))),
  'delete-project': async (d) => {
    const p = st.projects.find((x) => x.id === d.id);
    if (await confirmBox(`Supprimer le projet « ${p.title} » ?`, { detail: 'Ses tâches sont conservées, sans projet associé.' })) {
      save(async () => { await D.remove('projects', p.id); dropRow('projects', p.id); st.tasks.forEach((t) => { if (t.project_id === p.id) t.project_id = null; }); closeSheet(); }, 'Projet supprimé');
    }
  },

  // --- repas
  'meal-edit': (d) => openSheet(`${d.slot === 'diner' ? 'Dîner' : 'Déjeuner'} — ${L.fmtLongDate(d.date)}`, F.mealForm(d.date, d.slot)),
  'meal-clear': (d) => save(async () => { await D.remove('meals', d.id); dropRow('meals', d.id); closeSheet(); }, 'Repas retiré'),
  'meal-move': (d) => openSheet('Déplacer le repas', F.mealMoveForm(st.meals.find((m) => m.id === d.id))),
  'meal-copy-prev': async (d) => {
    const ws = d.week; const src = st.meals.filter((m) => m.meal_date >= L.addDays(ws, -7) && m.meal_date < ws);
    const todo = src.filter((m) => !st.meals.some((x) => x.meal_date === L.addDays(m.meal_date, 7) && x.slot === m.slot));
    if (!todo.length) return toast('Tous les créneaux de cette semaine sont déjà remplis.', 'err');
    if (!await confirmBox(`Reprendre ${todo.length} repas de la semaine précédente ?`, { ok: 'Reprendre', danger: false, detail: 'Les repas déjà prévus cette semaine ne sont pas remplacés.' })) return;
    save(async () => {
      const rows = await D.insert('meals', todo.map((m) => ({ household_id: hid(), meal_date: L.addDays(m.meal_date, 7), slot: m.slot, recipe_id: m.recipe_id, title: m.title, servings: m.servings, notes: m.notes, no_meal: m.no_meal })));
      rows.forEach((r) => putRow('meals', r));
    }, `${todo.length} repas repris`);
  },
  'meal-to-shop': (d) => {
    const ws = d.week; const end = L.addDays(ws, 6);
    const meals = st.meals.filter((m) => m.meal_date >= ws && m.meal_date <= end && !m.no_meal && m.recipe_id);
    const lines = [];
    for (const m of meals) {
      const r = st.recipes.find((x) => x.id === m.recipe_id); if (!r) continue;
      for (const g of r.ingredients) {
        if (!g.name) continue;
        lines.push({ name: g.name, qty: L.scaleQty(g.qty, m.servings, r.servings), unit: g.unit || null, category: L.guessShopCategory(g.name), source: `${r.name} (${L.fmtShort(m.meal_date)})` });
      }
    }
    if (!lines.length) return toast('Aucun ingrédient : associez à vos repas des idées qui contiennent des ingrédients.', 'err');
    const merged = L.mergeLines(lines).map((l) => {
      const check = L.inventoryCheck(l, st.inventory);
      const onList = st.shopping.filter((x) => !x.checked && L.nameKey(x.name) === l.key);
      if (onList.length) check.label += ` · déjà sur la liste (${onList.map((x) => L.fmtQty(x.qty, x.unit) || 'sans quantité').join(', ')}) : sera complété`;
      return { ...l, sources: [...new Set(l.sources)], check };
    });
    ui.ingLines = merged;
    openSheet('Ingrédients à ajouter', F.ingredientsCheck(merged), { wide: true });
  },

  // --- recettes
  'recipe-new': () => openSheet('Nouvelle idée de repas', F.recipeForm(), { wide: true }),
  'recipe-edit': (d) => openSheet('Idée de repas', F.recipeForm(st.recipes.find((r) => r.id === d.id)), { wide: true }),
  'recipe-fav': (d) => { const r = st.recipes.find((x) => x.id === d.id); save(async () => putRow('recipes', await D.update('recipes', r.id, { favorite: !r.favorite })), r.favorite ? 'Retiré des favoris' : 'Ajouté aux favoris'); },
  'recipe-plan': (d) => openSheet('Planifier', F.recipePlanForm(st.recipes.find((r) => r.id === d.id))),
  'recipe-delete': async (d) => {
    const r = st.recipes.find((x) => x.id === d.id);
    if (!await confirmBox(`Supprimer l’idée « ${r.name} » ?`, { detail: 'Les repas déjà planifiés gardent leur nom.' })) return;
    save(async () => {
      for (const m of st.meals.filter((x) => x.recipe_id === r.id)) putRow('meals', await D.update('meals', m.id, { title: m.title || r.name, recipe_id: null }));
      await D.remove('recipes', r.id); dropRow('recipes', r.id); closeSheet();
    }, 'Idée supprimée');
  },

  // --- courses
  'shop-edit': (d) => openSheet('Produit', F.shopEditForm(st.shopping.find((x) => x.id === d.id))),
  'shop-delete': (d) => save(async () => { await D.remove('shopping_items', d.id); dropRow('shopping', d.id); closeSheet(); }, 'Produit supprimé'),
  'shop-stow': () => {
    const bought = st.shopping.filter((x) => x.checked && !x.archived);
    ui.stowItems = bought;
    openSheet('Ranger les achats', F.stowForm(bought), { wide: true });
  },
  'shop-archive': async () => {
    const bought = st.shopping.filter((x) => x.checked && !x.archived);
    if (!await confirmBox(`Archiver ${bought.length} produit${bought.length > 1 ? 's' : ''} acheté${bought.length > 1 ? 's' : ''} sans les ranger ?`, { ok: 'Archiver', danger: false, detail: 'L’inventaire ne sera pas modifié.' })) return;
    save(async () => { for (const x of bought) { await D.update('shopping_items', x.id, { archived: true }); dropRow('shopping', x.id); } }, 'Achats archivés');
  },

  // --- inventaire
  'inv-new': () => openSheet('Nouveau produit', F.invForm()),
  'inv-edit': (d) => openSheet('Produit', F.invForm(st.inventory.find((x) => x.id === d.id))),
  'inv-delete': async (d) => {
    const x = st.inventory.find((y) => y.id === d.id);
    if (await confirmBox(`Supprimer « ${x.name} » de l’inventaire ?`)) save(async () => { await D.remove('inventory_items', x.id); dropRow('inventory', x.id); closeSheet(); }, 'Produit supprimé');
  },
  'inv-dec': async (d) => {
    const x = st.inventory.find((y) => y.id === d.id);
    const step = { g: 100, ml: 100, kg: 0.25, l: 0.25 }[L.normUnit(x.unit)] || 1;
    const qty = Math.max(0, Math.round((Number(x.qty) - step) * 100) / 100);
    const ok = await save(async () => putRow('inventory', await D.update('inventory_items', x.id, { qty })), `${x.name} : ${L.fmtQty(qty, x.unit) || 0}`);
    const after = st.inventory.find((y) => y.id === x.id);
    const onList = st.shopping.some((s) => !s.checked && L.nameKey(s.name) === L.nameKey(x.name));
    if (ok && !onList && (qty === 0 || L.isLowStock(after)) && await confirmBox(`${x.name} : stock ${qty === 0 ? 'épuisé' : 'bas'}. L’ajouter aux courses ?`, { ok: 'Ajouter aux courses', danger: false })) {
      save(() => addToShopping([{ name: x.name, category: L.SHOP_CATEGORIES[x.category] ? x.category : L.guessShopCategory(x.name) }]), 'Ajouté aux courses');
    }
  },
  'inv-to-shop': (d) => {
    const x = st.inventory.find((y) => y.id === d.id);
    if (st.shopping.some((s) => !s.checked && L.nameKey(s.name) === L.nameKey(x.name))) return toast(`${x.name} est déjà sur la liste de courses.`);
    save(() => addToShopping([{ name: x.name, category: L.SHOP_CATEGORIES[x.category] ? x.category : L.guessShopCategory(x.name) }]), 'Ajouté aux courses');
  },

  // --- disponibilités
  'avail-delete': (d) => save(async () => { await D.remove('availabilities', d.id); dropRow('avail', d.id); }, 'Supprimé'),

  // --- foyer
  'copy-invite': async (d) => {
    try { await navigator.clipboard.writeText(d.text); toast('Lien copié : envoyez-le à ' + P[other()]); }
    catch { openSheet('Lien d’invitation', `<p>Copiez ce lien :</p><input class="code-input" readonly value="${esc(d.text)}" onfocus="this.select()">`); }
  },
  'loc-delete': async (d) => {
    const used = st.inventory.filter((x) => x.location === d.loc);
    if (!await confirmBox('Supprimer cet emplacement ?', { detail: used.length ? `${used.length} produit(s) seront déplacés dans « Placards ».` : '' })) return;
    save(async () => {
      for (const x of used) putRow('inventory', await D.update('inventory_items', x.id, { location: 'placards' }));
      const locs = { ...(st.hh.settings.locations || {}) }; delete locs[d.loc];
      st.hh = await D.updateHousehold(st.hh.id, { settings: { ...st.hh.settings, locations: locs } });
    }, 'Emplacement supprimé');
  },
};

async function addToShopping(lines) {
  const plan = L.planMergeInto(lines.map((l) => ({ ...l, category: l.category || L.guessShopCategory(l.name) })), st.shopping);
  for (const u of plan.updates) putRow('shopping', await D.update('shopping_items', u.id, { qty: u.qty, unit: u.unit }));
  if (plan.inserts.length) {
    const rows = await D.insert('shopping_items', plan.inserts.map((l) => ({ household_id: hid(), name: l.name.trim(), qty: l.qty ?? null, unit: str(l.unit), note: str(l.note), category: l.category || 'autre' })));
    rows.forEach((r) => putRow('shopping', r));
  }
  return plan.updates.length + plan.inserts.length;
}

// =====================================================================
//  Formulaires (envoi)
// =====================================================================
const FORMS = {
  // --- comptes
  login: async (fd) => {
    const { error } = await sb.auth.signInWithPassword({ email: fd.get('email').trim(), password: fd.get('password') });
    if (error) { ui.authMsg = { kind: 'err', text: errMsg(error) }; render(); }
  },
  signup: async (fd) => {
    const email = fd.get('email').trim();
    const redirect = location.origin + location.pathname + (ui.inviteCode ? `?invitation=${encodeURIComponent(ui.inviteCode)}` : '');
    const { data, error } = await sb.auth.signUp({ email, password: fd.get('password'), options: { emailRedirectTo: redirect } });
    if (error) { ui.authMsg = { kind: 'err', text: errMsg(error) }; render(); return; }
    if (!data.session) { ui.authMsg = { kind: 'ok', text: `Compte créé. Un e-mail de confirmation a été envoyé à ${email} : ouvrez le lien, puis connectez-vous.` }; ui.authMode = 'login'; render(); }
  },
  reset: async (fd) => {
    const { error } = await sb.auth.resetPasswordForEmail(fd.get('email').trim(), { redirectTo: location.origin + location.pathname });
    ui.authMsg = error ? { kind: 'err', text: errMsg(error) } : { kind: 'ok', text: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.' };
    render();
  },
  newpass: async (fd) => {
    const { error } = await sb.auth.updateUser({ password: fd.get('password') });
    if (error) { ui.authMsg = { kind: 'err', text: errMsg(error) }; render(); return; }
    toast('Mot de passe modifié'); ui.authMsg = null;
    const { data } = await sb.auth.getSession(); await onSession(data.session);
  },
  'create-hh': async (fd) => {
    try { await D.rpc('create_household', { p_name: fd.get('name'), p_person: fd.get('person') }); toast('Foyer créé'); await onSession(st.session); }
    catch (e) { toast(errMsg(e), 'err'); }
  },
  'join-hh': async (fd) => {
    try { const r = await D.rpc('join_household', { p_code: fd.get('code') }); toast(`Bienvenue ${P[r.person]} !`); await onSession(st.session); }
    catch (e) { toast(errMsg(e), 'err'); }
  },

  // --- capture
  capture: async (fd) => {
    const type = fd.get('type'); const title = String(fd.get('title')).trim(); const note = str(fd.get('note'));
    const direct = fd.get('direct') === 'on';
    if (['tache', 'action', 'admin', 'achat_maison'].includes(type)) {
      const when = fd.get('when') || 'none';
      const assignee = fd.get('assignee') || null;
      const row = {
        household_id: hid(), kind: type === 'action' ? 'action' : 'tache', title, description: note,
        category: type === 'admin' ? 'administratif' : type === 'achat_maison' ? 'achats' : type === 'action' ? 'autre' : 'menage',
        priority: fd.get('priority') || 'normale', duration_min: int(fd.get('duration')), assignee, assign_mode: assignee ? 'manual' : 'auto',
        status: when === 'none' ? 'a_organiser' : 'a_faire',
        planned_date: when === 'today' ? today() : when === 'date' ? fd.get('date') || today() : null,
        planned_week: when === 'week' ? L.startOfWeek(today()) : null, someday: when === 'later',
      };
      return save(async () => {
        const t = await D.insert('tasks', row); putRow('tasks', t);
        const extra = await autoAssign(t);
        closeSheet();
        toast((when === 'none' ? 'Ajouté à « À organiser »' : 'Tâche ajoutée') + extra);
      }, '');
    }
    if (type === 'courses' && direct) {
      const q = L.parseQuickProduct(title);
      return save(async () => { await addToShopping([{ ...q, note, category: fd.get('shopcat') || L.guessShopCategory(q.name) }]); closeSheet(); }, 'Ajouté à la liste de courses');
    }
    if (type === 'repas' && direct) return save(async () => { putRow('recipes', await D.insert('recipes', { household_id: hid(), name: title, notes: note })); closeSheet(); }, 'Ajouté aux idées de repas');
    if (type === 'projet' && direct) return save(async () => { putRow('projects', await D.insert('projects', { household_id: hid(), title, description: note, status: 'idee' })); closeSheet(); }, 'Projet ajouté (à découper en tâches)');
    return save(async () => { putRow('inbox', await D.insert('inbox_items', { household_id: hid(), type, title, note, created_by: me() })); closeSheet(); }, 'Ajouté à « À organiser »');
  },

  // --- tâches
  task: async (fd) => {
    const id = fd.get('id'); const existing = id && st.tasks.find((t) => t.id === id);
    let row;
    try { row = readTaskForm(fd, existing); } catch (e) { toast(e.message, 'err'); return; }
    const inboxId = fd.get('inbox');
    return save(async () => {
      let t;
      if (existing) t = await writeTask(id, row);
      else { t = await D.insert('tasks', { ...row, household_id: hid() }); putRow('tasks', t); }
      if (inboxId) { await D.remove('inbox_items', inboxId); dropRow('inbox', inboxId); }
      const extra = await autoAssign(t);
      closeSheet();
      toast((existing ? 'Modifications enregistrées' : 'Tâche créée') + extra);
    }, '');
  },
  occ: async (fd) => {
    const i = findItem(fd.get('key'));
    const ov = { ...((i.occ && i.occ.override) || {}) };
    const title = String(fd.get('title')).trim();
    const setOv = (k, v, base) => { if (v == null || v === '' || v === base) delete ov[k]; else ov[k] = v; };
    setOv('title', title, i.task.title);
    setOv('priority', fd.get('priority'), i.task.priority);
    setOv('duration_min', int(fd.get('duration')), i.task.duration_min);
    setOv('description', str(fd.get('description')), i.task.description);
    const who = fd.get('assignee') || null;
    const date = fd.get('date') || i.date;
    return save(async () => {
      await writeOcc(i, { override: ov, moved_to: date === i.occDate ? null : date, assignee: who, assign_source: who ? 'manual' : null });
      closeSheet();
    }, 'Occurrence modifiée (la série est inchangée)');
  },
  dist: async (fd, form) => {
    const t = today(); const ws = L.startOfWeek(t); const range = fd.get('range');
    const [from, to] = range === 'today' ? [t, t] : range === 'next' ? [L.addDays(ws, 7), L.addDays(ws, 13)] : [t, L.addDays(ws, 6)];
    const plan = L.planDistribution({ tasks: st.tasks, occurrences: st.occ, members: st.members, availabilities: st.avail, from, to, today: t, mode: fd.get('mode') });
    ui.distPlan = plan;
    $('#dist-preview').innerHTML = F.distPreview(plan);
    $('#dist-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'dist-apply': async (fd) => {
    const picks = fd.getAll('pick').map(Number).map((k) => ui.distPlan.proposals[k]).filter(Boolean);
    if (!picks.length) return toast('Aucune ligne sélectionnée.', 'err');
    return save(async () => {
      for (const p of picks) {
        const i = findItem(p.key) || p.item;
        if (p.action === 'assign') await assignItem(i, p.person, 'auto');
        else if (p.action === 'postpone') await postponeItem(i, p.toDate, { assignee: p.person, source: 'auto' });
        else if (p.action === 'replan') { if (i.recurring) await writeOcc(i, { status: 'a_replanifier' }); else await writeTask(i.taskId, { status: 'a_replanifier' }); }
        else if (p.action === 'skip') await writeOcc(i, { status: 'saute' });
      }
      ui.distPlan = null; closeSheet();
    }, `Répartition appliquée (${picks.length} tâche${picks.length > 1 ? 's' : ''})`);
  },

  // --- projets et réception
  project: async (fd) => {
    const id = fd.get('id'); const inboxId = fd.get('inbox');
    const row = { title: String(fd.get('title')).trim(), description: str(fd.get('description')), status: fd.get('status') };
    return save(async () => {
      putRow('projects', id ? await D.update('projects', id, row) : await D.insert('projects', { ...row, household_id: hid() }));
      if (inboxId) { await D.remove('inbox_items', inboxId); dropRow('inbox', inboxId); }
      closeSheet();
    }, id ? 'Projet enregistré' : 'Projet créé — découpez-le en tâches');
  },
  'inbox-edit': async (fd) => save(async () => {
    putRow('inbox', await D.update('inbox_items', fd.get('id'), { title: String(fd.get('title')).trim(), type: fd.get('type'), note: str(fd.get('note')) }));
    closeSheet();
  }),

  // --- repas
  meal: async (fd) => {
    const noMeal = fd.get('no_meal') === 'on';
    let recipeId = fd.get('recipe') || null; const title = str(fd.get('title'));
    if (!noMeal && !recipeId && !title) return toast('Choisissez une idée de repas ou saisissez un nom.', 'err');
    const inboxId = fd.get('inbox');
    return save(async () => {
      if (!noMeal && !recipeId && title && fd.get('save_recipe') === 'on') {
        const r = await D.insert('recipes', { household_id: hid(), name: title, servings: int(fd.get('servings')) || 2 }); putRow('recipes', r); recipeId = r.id;
      }
      putRow('meals', await D.upsertMeal({
        household_id: hid(), meal_date: fd.get('date'), slot: fd.get('slot'), no_meal: noMeal,
        recipe_id: noMeal ? null : recipeId, title: noMeal ? null : (recipeId ? null : title),
        servings: Math.max(1, int(fd.get('servings')) || 2), notes: str(fd.get('notes')),
      }));
      if (inboxId) { await D.remove('inbox_items', inboxId); dropRow('inbox', inboxId); }
      closeSheet();
    }, 'Repas enregistré');
  },
  'meal-move': async (fd) => {
    const m = st.meals.find((x) => x.id === fd.get('id'));
    const date = fd.get('date'); const slot = fd.get('slot');
    if (date === m.meal_date && slot === m.slot) return closeSheet();
    const occupant = st.meals.find((x) => x.meal_date === date && x.slot === slot);
    const content = (x) => ({ recipe_id: x.recipe_id, title: x.title, servings: x.servings, notes: x.notes, no_meal: x.no_meal });
    return save(async () => {
      if (occupant) {
        const a = content(m); const b = content(occupant);
        putRow('meals', await D.update('meals', m.id, b));
        putRow('meals', await D.update('meals', occupant.id, a));
      } else putRow('meals', await D.update('meals', m.id, { meal_date: date, slot }));
      closeSheet();
    }, occupant ? 'Repas échangés' : 'Repas déplacé');
  },
  recipe: async (fd) => {
    const id = fd.get('id'); const inboxId = fd.get('inbox');
    const names = fd.getAll('ing'); const qtys = fd.getAll('ingqty'); const units = fd.getAll('ingunit');
    const ingredients = names.map((n, k) => ({ name: String(n).trim(), qty: num(qtys[k]), unit: str(units[k]) })).filter((g) => g.name);
    const row = { name: String(fd.get('name')).trim(), servings: Math.max(1, int(fd.get('servings')) || 2), prep_min: int(fd.get('prep')), notes: str(fd.get('notes')), favorite: fd.get('favorite') === 'on', ingredients };
    return save(async () => {
      putRow('recipes', id ? await D.update('recipes', id, row) : await D.insert('recipes', { ...row, household_id: hid() }));
      if (inboxId) { await D.remove('inbox_items', inboxId); dropRow('inbox', inboxId); }
      closeSheet();
    }, 'Idée de repas enregistrée');
  },
  'recipe-plan': async (fd) => {
    const date = fd.get('date'); const slot = fd.get('slot');
    const taken = st.meals.find((x) => x.meal_date === date && x.slot === slot);
    if (taken && !await confirmBox(`Remplacer « ${V.mealTitle(taken)} » ?`, { ok: 'Remplacer', danger: false })) return;
    return save(async () => {
      putRow('meals', await D.upsertMeal({ household_id: hid(), meal_date: date, slot, recipe_id: fd.get('recipe'), title: null, no_meal: false, servings: Math.max(1, int(fd.get('servings')) || 2) }));
      closeSheet();
    }, 'Repas planifié');
  },
  'ing-shop': async (fd) => {
    const picks = fd.getAll('pick').map(Number);
    if (!picks.length) return toast('Aucun ingrédient sélectionné.', 'err');
    const lines = picks.map((k) => ({ name: ui.ingLines[k].name, qty: num(fd.get('qty' + k)), unit: str(fd.get('unit' + k)), category: fd.get('cat' + k) }));
    return save(async () => { const n = await addToShopping(lines); closeSheet(); toast(`${n} produit${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} ou complété${n > 1 ? 's' : ''} sur la liste`); }, '');
  },

  // --- courses
  'shop-add': async (fd, form) => {
    const text = String(fd.get('text')).trim(); if (!text) return;
    const q = L.parseQuickProduct(text);
    const category = fd.get('category') || L.guessShopCategory(q.name);
    const ok = await save(() => addToShopping([{ ...q, category }]), `${q.name} ajouté (${L.SHOP_CATEGORIES[category]})`);
    if (ok) { form.reset(); ui.refocus = 'form[data-form=shop-add] input[name=text]'; render(); }
  },
  'shop-edit': async (fd) => save(async () => {
    putRow('shopping', await D.update('shopping_items', fd.get('id'), { name: String(fd.get('name')).trim(), qty: num(fd.get('qty')), unit: str(fd.get('unit')), category: fd.get('category'), note: str(fd.get('note')) }));
    closeSheet();
  }),
  stow: async (fd) => {
    const picks = fd.getAll('pick').map(Number);
    if (!picks.length) return toast('Aucun produit sélectionné.', 'err');
    return save(async () => {
      for (const k of picks) {
        const x = ui.stowItems[k];
        const line = { name: x.name, qty: num(fd.get('qty' + k)), unit: str(fd.get('unit' + k)), category: x.category };
        const loc = fd.get('loc' + k); const exp = fd.get('exp' + k) || null;
        const pool = st.inventory.filter((y) => y.location === loc);
        const plan = L.planMergeInto([line], pool, () => true);
        if (plan.updates.length) {
          const u = plan.updates[0];
          putRow('inventory', await D.update('inventory_items', u.id, { qty: u.qty, unit: u.unit, ...(exp ? { expires_on: exp } : {}) }));
        } else {
          putRow('inventory', await D.insert('inventory_items', { household_id: hid(), name: x.name, category: x.category, qty: line.qty, unit: line.unit, location: loc, expires_on: exp }));
        }
        await D.update('shopping_items', x.id, { archived: true }); dropRow('shopping', x.id);
      }
      closeSheet();
    }, `${picks.length} produit${picks.length > 1 ? 's' : ''} rangé${picks.length > 1 ? 's' : ''} dans l’inventaire`);
  },

  // --- inventaire
  inv: async (fd) => {
    const id = fd.get('id');
    const row = { name: String(fd.get('name')).trim(), qty: num(fd.get('qty')), unit: str(fd.get('unit')), location: fd.get('location'), category: fd.get('category'), expires_on: fd.get('expires') || null, low_threshold: num(fd.get('low')) };
    return save(async () => { putRow('inventory', id ? await D.update('inventory_items', id, row) : await D.insert('inventory_items', { ...row, household_id: hid() })); closeSheet(); }, 'Inventaire mis à jour');
  },

  // --- disponibilités
  avail: async (fd, form) => {
    const t = today(); const ws = L.startOfWeek(t);
    const person = fd.get('person'); const kind = fd.get('kind'); const when = fd.get('when');
    let ranges = [];
    if (when === 'today') ranges = [[t, t]];
    else if (when === 'tomorrow') ranges = [[L.addDays(t, 1), L.addDays(t, 1)]];
    else if (when === 'week') ranges = [[t, L.addDays(ws, 6)]];
    else if (when === 'nextweek') ranges = [[L.addDays(ws, 7), L.addDays(ws, 13)]];
    else if (when === 'period') {
      const s = fd.get('start'); const e = fd.get('end');
      if (!s || !e || e < s) return toast('Vérifiez les dates : la fin doit être après le début.', 'err');
      ranges = [[s, e]];
    } else {
      const days = fd.getAll('days').sort();
      if (!days.length) return toast('Choisissez au moins un jour.', 'err');
      for (const d of days) { const last = ranges[ranges.length - 1]; if (last && L.addDays(last[1], 1) === d) last[1] = d; else ranges.push([d, d]); }
    }
    if (kind === 'reduite' && ranges.some(([s, e]) => s !== e) && !await confirmBox('Appliquer cette disponibilité réduite à chaque jour de la période ?', { ok: 'Oui', danger: false })) return;
    const capacity = kind === 'reduite' ? Math.max(0, int(fd.get('capacity')) ?? 0) : null;
    const ok = await save(async () => {
      const rows = await D.insert('availabilities', ranges.map(([s, e]) => ({ household_id: hid(), person, kind, start_date: s, end_date: e, capacity_min: capacity, note: str(fd.get('note')) })));
      rows.forEach((r) => putRow('avail', r));
    }, kind === 'absent' ? `Absence de ${P[person]} enregistrée` : `Disponibilité de ${P[person]} enregistrée`);
    if (!ok) return;
    form.reset();
    const end = ranges[ranges.length - 1][1];
    const conflicts = L.absenceConflicts({ tasks: st.tasks, occurrences: st.occ, members: st.members, availabilities: st.avail, from: ranges[0][0] < t ? t : ranges[0][0], to: end });
    if (conflicts.length && await confirmBox(`${conflicts.length} tâche${conflicts.length > 1 ? 's sont attribuées' : ' est attribuée'} à ${P[person]} pendant cette période. Proposer une nouvelle répartition ?`, { ok: 'Voir la proposition', danger: false })) {
      A.distribute({ range: ranges[0][0] > L.addDays(ws, 6) ? 'next' : 'week' });
    }
  },
  'member-prefs': async (fd, form) => save(async () => {
    const row = await D.updateMember(hid(), form.dataset.person, { daily_capacity_min: Math.max(0, int(fd.get('cap')) ?? 60), preferred_categories: fd.getAll('pref'), avoided_categories: fd.getAll('avoid') });
    const k = st.members.findIndex((m) => m.person === row.person); st.members[k] = row;
  }, 'Préférences enregistrées'),

  // --- foyer
  'hh-name': async (fd) => save(async () => { st.hh = await D.updateHousehold(st.hh.id, { name: String(fd.get('name')).trim() }); }, 'Nom enregistré'),
  'loc-add': async (fd, form) => {
    const name = String(fd.get('name')).trim(); if (!name) return;
    const key = L.norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || rid();
    if (locations()[key]) return toast('Cet emplacement existe déjà.', 'err');
    const ok = await save(async () => { st.hh = await D.updateHousehold(st.hh.id, { settings: { ...st.hh.settings, locations: { ...(st.hh.settings.locations || {}), [key]: name } } }); }, `Emplacement « ${name} » ajouté`);
    if (ok) form.reset();
  },
};
function locations() { return { ...L.DEFAULT_LOCATIONS, ...(st.hh?.settings?.locations || {}) }; }

// =====================================================================
//  Écouteurs
// =====================================================================
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  const fn = FORMS[form.dataset.form]; if (!fn) return;
  if (form.dataset.busy) return;               // évite les doubles envois (et donc les doublons)
  form.dataset.busy = '1';
  const btns = [...form.querySelectorAll('button:not([type=button])')];
  btns.forEach((b) => { b.disabled = true; });
  try { await fn(new FormData(form), form); }
  finally { delete form.dataset.busy; btns.forEach((b) => { b.disabled = false; }); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('form[data-form=capture] input[name=type]')) {
    const direct = el.form.querySelector('input[name=direct]'); if (direct) direct.checked = el.value === 'courses';
  }
  if (el.matches('form[data-form=meal] input[name=no_meal]')) el.form.dataset.nomeal = el.checked ? '1' : '0';
  const k = el.dataset.change; if (!k) return;
  if (k === 'shop-check') {
    const x = st.shopping.find((y) => y.id === el.dataset.id);
    save(async () => putRow('shopping', await D.update('shopping_items', x.id, { checked: el.checked, checked_at: el.checked ? new Date().toISOString() : null, checked_by: el.checked ? me() : null })), '');
  }
  if (k === 'sub-toggle') {
    const i = findItem(el.dataset.key); const sid = el.dataset.sid;
    if (i.recurring) {
      const ov = { ...((i.occ && i.occ.override) || {}) };
      const set = new Set(ov.subdone || []); if (el.checked) set.add(sid); else set.delete(sid);
      ov.subdone = [...set];
      save(() => writeOcc(i, { override: ov }), '');
    } else {
      save(() => writeTask(i.taskId, { subactions: i.task.subactions.map((s) => (s.id === sid ? { ...s, done: el.checked } : s)) }), '');
    }
  }
  if (k === 'fav-only') { ui.favOnly = el.checked; render(); }
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'recipe-search') { ui.recipeQuery = e.target.value; ui.refocus = '[data-input=recipe-search]'; render(); }
});
document.addEventListener('focusout', () => { setTimeout(() => { if (ui.pending) render(); }, 50); });
window.addEventListener('hashchange', () => {
  const r = (location.hash.slice(2) || 'today').split('?')[0];
  ui.route = VIEWS[r] ? r : 'today';
  closeSheet();
  if ($('#view')?.contains(document.activeElement)) document.activeElement.blur();
  render(true);
  window.scrollTo(0, 0);
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAll(); });
window.addEventListener('online', refreshAll);
$('#sheet').addEventListener('close', () => { ui.sheetLive = null; if (ui.pending) render(); });
$('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet')) closeSheet(); });

boot();
