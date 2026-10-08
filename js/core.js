// État partagé, utilitaires d'affichage, feuilles (modales), confirmations, notifications.
import * as L from './logic.js';
import { icon } from './icons.js';

export const st = {
  session: null, me: null, hh: null, members: [], devices: [], tasks: [], occ: [], projects: [], inbox: [],
  avail: [], recipes: [], meals: [], shopping: [], inventory: [],
};
export const ui = {
  screen: 'loading', route: 'today', maisonTab: 'jour', maisonWeek: 0, menuWeek: 0, repasTab: 'semaine',
  stockLoc: 'tous', authMode: 'login', authMsg: null, onboard: 'create', inviteCode: '', recipeQuery: '',
  favOnly: false, sheetLive: null, online: true, items: new Map(), distPlan: null,
};
export const hooks = { render: () => {} };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const today = () => L.todayISO();
export const me = () => st.me?.person;
export const other = (p = me()) => (p === 'ilona' ? 'adrien' : 'ilona');
export const hid = () => st.me?.household_id;
export const locations = () => ({ ...L.DEFAULT_LOCATIONS, ...(st.hh?.settings?.locations || {}) });

export function putRow(key, row) {
  const arr = st[key];
  const i = key === 'occ'
    ? arr.findIndex((o) => o.task_id === row.task_id && o.occ_date === row.occ_date)
    : arr.findIndex((o) => o.id === row.id);
  if (i >= 0) arr[i] = row; else arr.push(row);
}
export function dropRow(key, id) { st[key] = st[key].filter((o) => o.id !== id); }

/** Retrouve un élément de planning (tâche ou occurrence) à partir de sa clé. */
export function findItem(key) {
  if (!key) return null;
  const [tid, occDate] = key.split('|');
  const t = st.tasks.find((x) => x.id === tid);
  if (!t) return null;
  if (!occDate) {
    const it = L.makeItem(t, null, t.planned_date);
    return t.planned_week && !t.planned_date ? { ...it, week: t.planned_week } : it;
  }
  const o = st.occ.find((x) => x.task_id === tid && x.occ_date === occDate);
  return L.makeItem(t, o, (o && o.moved_to) || occDate);
}

// --------------------------------------------------------- notifications
export function toast(msg, kind = 'ok') {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `${icon(kind === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  box.append(el);
  setTimeout(() => el.classList.add('out'), kind === 'err' ? 5200 : 2400);
  setTimeout(() => el.remove(), kind === 'err' ? 5600 : 2800);
}
export function errMsg(e) {
  const m = e?.message || String(e);
  if (/fetch|network|Load failed/i.test(m)) return 'Connexion impossible. Vérifiez le réseau puis réessayez.';
  if (/row-level security|permission denied/i.test(m)) return 'Accès refusé : cette donnée n’appartient pas à votre foyer.';
  if (/anonymous sign-?ins? (are )?disabled/i.test(m)) return 'Connexion impossible : dans Supabase, activez « Allow anonymous sign-ins » (Authentication → Sign In / Providers).';
  if (/rate limit/i.test(m)) return 'Trop d’essais en peu de temps. Patientez quelques minutes.';
  return m;
}
/** Exécute une écriture : notification de confirmation ou d'erreur, puis nouvel affichage. */
export async function save(fn, okMsg = 'Enregistré') {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    hooks.render();
    return r === undefined ? true : r;
  } catch (e) {
    console.error(e);
    toast(errMsg(e), 'err');
    hooks.render();
    return false;
  }
}

// ---------------------------------------------------------------- feuilles
export function openSheet(title, body, { live = null, wide = false } = {}) {
  const dlg = $('#sheet');
  dlg.classList.toggle('wide', wide);
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = body;
  ui.sheetLive = live;
  if (!dlg.open) dlg.showModal();
  const first = $('#sheet-body [autofocus]');
  if (first && matchMedia('(pointer: fine)').matches) first.focus();
  else $('#sheet-body').scrollTop = 0;
}
export function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); ui.sheetLive = null; }

export function confirmBox(text, { ok = 'Supprimer', danger = true, detail = '' } = {}) {
  return new Promise((resolve) => {
    const dlg = $('#confirm');
    $('#confirm-text').textContent = text;
    $('#confirm-detail').textContent = detail;
    const okBtn = $('#confirm-ok');
    okBtn.textContent = ok;
    okBtn.className = 'btn ' + (danger ? 'danger' : 'primary');
    const done = (v) => { dlg.close(); okBtn.onclick = null; $('#confirm-cancel').onclick = null; resolve(v); };
    okBtn.onclick = () => done(true);
    $('#confirm-cancel').onclick = () => done(false);
    dlg.oncancel = (e) => { e.preventDefault(); done(false); };
    dlg.showModal();
  });
}

// ------------------------------------------------------- petits rendus
export const personChip = (p, short = false) => p
  ? `<span class="chip person p-${p}">${icon(p === 'both' ? 'users' : 'user')}${esc(short && p === 'both' ? 'Les deux' : L.PERSON_LABEL[p])}</span>`
  : `<span class="chip person p-none">${icon('scale')}À répartir</span>`;
export const prioChip = (p) => p && p !== 'normale'
  ? `<span class="chip prio prio-${p}"><b aria-hidden="true">${L.PRIORITIES[p].icon}</b>${L.PRIORITIES[p].label}</span>` : '';
export function progressBar(label, p, cls = '') {
  return `<div class="progress-card ${cls}">
    <div class="progress-head"><strong>${esc(label)}</strong><span class="pct">${p.total ? p.pct + ' %' : '—'}</span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}" aria-label="${esc(label)}"><span style="width:${p.pct}%"></span></div>
    <div class="progress-txt">${esc(L.progressLabel(p))}</div></div>`;
}
export function empty(text, iconName = 'check', action = '') {
  return `<div class="empty">${icon(iconName)}<p>${esc(text)}</p>${action}</div>`;
}
export function opts(map, sel) {
  return Object.entries(map).map(([k, v]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
