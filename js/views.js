// Rendu des écrans principaux (chaînes HTML ; les interactions passent par data-act).
import * as L from './logic.js';
import { icon } from './icons.js';
import { st, ui, esc, today, me, other, locations, personChip, prioChip, progressBar, empty, opts } from './core.js';

const P = L.PERSON_LABEL;

// ------------------------------------------------------------ ligne de tâche
export function taskRow(i, o = {}) {
  ui.items.set(i.key, i);
  const done = i.status === 'termine';
  const t = today();
  const chips = [];
  if (i.kind === 'action') chips.push(`<span class="chip kind">${icon('bolt')}Action</span>`);
  if (done) chips.push(`<span class="chip state-done">${icon('check')}Terminée</span>`);
  else if (i.status === 'en_cours') chips.push(`<span class="chip state-progress">${icon('clock')}En cours</span>`);
  chips.push(prioChip(i.priority));
  if (o.showDate && i.date) chips.push(`<span class="chip ${i.date < t && !done ? 'late' : ''}">${icon('calendar')}${esc(L.relativeDay(i.date, t))}</span>`);
  if (o.showDate && !i.date && i.week) chips.push(`<span class="chip ${i.week < L.startOfWeek(t) ? 'late' : ''}">${icon('calendar')}Semaine du ${esc(L.fmtDayMonth(i.week))}</span>`);
  if (i.task.someday) chips.push(`<span class="chip">${icon('later')}Plus tard</span>`);
  chips.push(`<span class="chip ${i.durationIsDefault ? 'estimate' : ''}" title="${i.durationIsDefault ? 'Estimation par défaut, modifiable' : 'Durée estimée'}">${icon('clock')}${i.durationIsDefault ? '≈ ' : ''}${i.duration} min</span>`);
  if (i.recurring) chips.push(`<span class="chip">${icon('repeat')}Récurrente</span>`);
  if (i.subactions.length) chips.push(`<span class="chip">${icon('list')}${i.subactions.filter((s) => s.done).length}/${i.subactions.length}</span>`);
  if (i.dueDate && !done) chips.push(`<span class="chip ${i.dueDate <= t ? 'late' : ''}">${icon('flag')}Échéance ${esc(L.fmtDayMonth(i.dueDate))}</span>`);
  if (o.showPerson !== false) chips.push(personChip(i.assignee));
  return `<div class="task ${done ? 'done' : ''} prio-${i.priority}">
    <button class="check" data-act="toggle" data-key="${esc(i.key)}" aria-pressed="${done}" aria-label="${done ? 'Annuler la validation de' : 'Terminer'} « ${esc(i.title)} »">${icon('check')}</button>
    <button class="task-main" data-act="detail" data-key="${esc(i.key)}">
      <span class="task-title">${esc(i.title)}</span>
      <span class="task-meta">${chips.join('')}</span>
    </button>
    ${o.quick !== false && !done ? `<button class="icon-btn" data-act="postpone" data-key="${esc(i.key)}" data-days="1" aria-label="Reporter à demain" title="Reporter à demain">${icon('arrow')}</button>` : ''}
  </div>`;
}
const list = (items, o) => items.map((i) => taskRow(i, o)).join('');

function sectionHead(title, extra = '', ic = '') {
  return `<div class="section-head"><h2>${ic ? icon(ic) : ''}${esc(title)}</h2>${extra}</div>`;
}

// ------------------------------------------------------------ Aujourd'hui
export function viewToday() {
  const t = today();
  const items = L.itemsInRange(st.tasks, st.occ, t, t);
  const late = L.overdueItems(st.tasks, st.occ, t);
  const week = L.weekItems(st.tasks, L.startOfWeek(t)).filter((i) => i.status !== 'termine');
  const replan = L.replanItems(st.tasks, st.occ);
  const conflicts = L.absenceConflicts({ tasks: st.tasks, occurrences: st.occ, members: st.members, availabilities: st.avail, from: t, to: L.addDays(t, 6) });
  const order = [me(), other()];
  const mine = (p) => L.sortItems(items.filter((i) => L.isFor(i, p)));
  const unassigned = L.sortItems(items.filter((i) => !i.assignee));
  const prios = L.sortItems(items.filter((i) => L.PRIORITIES[i.priority].rank >= 2 && i.status !== 'termine'));
  const toOrganize = organizeCount();
  const shopLeft = st.shopping.filter((x) => !x.checked && !x.archived).length;
  const absentToday = L.PEOPLE.filter((p) => L.capacityFor(p, t, st.members, st.avail).absent);
  const meals = st.meals.filter((m) => m.meal_date === t).sort((a, b) => a.slot.localeCompare(b.slot));
  const stockAlerts = st.inventory.filter((x) => L.isLowStock(x) || ['soon', 'expired'].includes(L.expiryStatus(x.expires_on, t)?.level)).length;

  const alerts = [];
  if (toOrganize) alerts.push(`<a class="pill" href="#/inbox">${icon('inbox')}${toOrganize} à organiser</a>`);
  if (replan.length) alerts.push(`<a class="pill warn" href="#/maison" data-act="maison-tab" data-tab="replan">${icon('alert')}${replan.length} à replanifier</a>`);
  if (stockAlerts) alerts.push(`<a class="pill warn" href="#/stock">${icon('box')}${stockAlerts} alerte${stockAlerts > 1 ? 's' : ''} inventaire</a>`);
  for (const p of absentToday) alerts.push(`<a class="pill" href="#/dispos">${icon('moon')}${P[p]} ${L.ABSENT_LABEL[p]} aujourd’hui</a>`);

  return `
  <section class="hero">
    <div class="hero-date">${esc(L.fmtLongDate(t))}</div>
    <h1>Bonjour ${esc(P[me()])}</h1>
    <div class="progress-grid">
      ${order.map((p) => progressBar(p === me() ? `${P[p]} (vous)` : P[p], L.progress(items, p), 'p-' + p)).join('')}
      ${progressBar('Foyer', L.progress(items), 'foyer')}
    </div>
  </section>
  ${alerts.length ? `<div class="pills">${alerts.join('')}</div>` : ''}
  ${conflicts.length ? `<div class="notice warn">${icon('alert')}<div><strong>Attribution incompatible avec une absence</strong>${conflicts.slice(0, 3).map((c) => `<p>${esc(c.text)}</p>`).join('')}<button class="btn small" data-act="distribute">Rééquilibrer</button></div></div>` : ''}

  <section class="card">
    ${sectionHead('Priorités du jour', '', 'flag')}
    ${prios.length ? list(prios) : `<p class="muted small">Aucune tâche haute ou urgente aujourd’hui.</p>`}
  </section>

  ${late.length ? `<section class="card late-card">${sectionHead(`En retard (${late.length})`, `<button class="btn small ghost" data-act="postpone-all-late">Tout reporter à aujourd’hui</button>`, 'alert')}${list(late, { showDate: true })}</section>` : ''}

  <div class="two-col">
    ${order.map((p) => {
      const its = mine(p); const pr = L.progress(items, p);
      return `<section class="card person-card p-${p}">
        ${sectionHead(p === me() ? `Mes tâches` : `Tâches ${p === 'ilona' ? 'd’Ilona' : 'd’Adrien'}`, its.length ? `<span class="muted small">${esc(L.progressLabel(pr))}</span>` : '', 'user')}
        ${its.length ? list(its, { showPerson: false }) : `<p class="muted small">${absentToday.includes(p) ? `${P[p]} est ${L.ABSENT_LABEL[p]} aujourd’hui.` : 'Rien de prévu aujourd’hui'}</p>`}
      </section>`;
    }).join('')}
  </div>

  ${unassigned.length ? `<section class="card">${sectionHead(`À répartir (${unassigned.length})`, `<button class="btn small primary" data-act="distribute" data-range="today">${icon('scale')}Répartir</button>`, 'scale')}${list(unassigned)}</section>` : ''}

  ${week.length ? `<section class="card">${sectionHead('Cette semaine, sans jour fixé', `<a class="link" href="#/maison" data-act="maison-tab" data-tab="semaine">Voir la semaine</a>`, 'calendar')}${list(week)}</section>` : ''}

  <div class="two-col">
    <section class="card">
      ${sectionHead('Repas du jour', `<a class="link" href="#/repas">Menus</a>`, 'utensils')}
      ${['dejeuner', 'diner'].map((slot) => {
        const m = meals.find((x) => x.slot === slot);
        if (!m && slot === 'dejeuner') return '';
        return `<button class="meal-line" data-act="meal-edit" data-date="${t}" data-slot="${slot}">
          <span class="meal-slot">${slot === 'diner' ? 'Dîner' : 'Déjeuner'}</span>
          <span>${m ? (m.no_meal ? '<em>Pas de repas à prévoir</em>' : esc(mealTitle(m))) : '<em class="muted">Rien de prévu — ajouter</em>'}</span>
          ${m && !m.no_meal ? `<span class="chip">${icon('users')}${m.servings}</span>` : ''}
        </button>`;
      }).join('')}
    </section>
    <a class="card shop-quick" href="#/courses">
      ${icon('cart', 'big')}
      <div><strong>Courses</strong><span>${shopLeft ? `${shopLeft} produit${shopLeft > 1 ? 's' : ''} à acheter` : 'Liste vide'}</span></div>
      ${icon('right')}
    </a>
  </div>`;
}

export function organizeCount() {
  return st.inbox.length + st.tasks.filter((t) => isUnorganized(t)).length;
}
export function isUnorganized(t) {
  if (t.recurrence || t.status === 'termine' || t.status === 'a_replanifier') return false;
  if (t.status === 'a_organiser') return true;
  return !t.planned_date && !t.planned_week && !t.someday;
}
export function mealTitle(m) {
  const r = m.recipe_id && st.recipes.find((x) => x.id === m.recipe_id);
  return m.title || (r ? r.name : 'Repas');
}

// ---------------------------------------------------------- À organiser
export const INBOX_TYPES = {
  tache: ['Tâche maison', 'home'], action: ['Action rapide', 'bolt'], admin: ['Démarche administrative', 'folder'],
  achat_maison: ['Achat pour la maison', 'box'], courses: ['Produit de courses', 'cart'], repas: ['Idée de repas', 'utensils'],
  projet: ['Idée de projet', 'flag'],
};
export function viewInbox() {
  const tasks = st.tasks.filter(isUnorganized).sort((a, b) => a.created_at?.localeCompare(b.created_at || '') || 0);
  const inbox = [...st.inbox].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return `
  <div class="page-head"><h1>${icon('inbox')}À organiser</h1>
    <button class="btn primary" data-act="capture">${icon('plus')}Capturer</button></div>
  <p class="muted lead">La boîte de réception commune. Selon la méthode TAPP, chaque élément reçoit ensuite un horizon — aujourd’hui, cette semaine ou une date précise — ou part dans « Plus tard ».</p>
  <section class="card">
    ${sectionHead(`Tâches et actions sans horizon (${tasks.length})`, '', 'list')}
    ${tasks.length ? tasks.map((t) => {
      const i = L.makeItem(t, null, null); ui.items.set(i.key, i);
      return `<div class="inbox-row">
        <span class="type-ic">${icon(t.kind === 'action' ? 'bolt' : t.category === 'administratif' ? 'folder' : t.category === 'achats' ? 'box' : 'home')}</span>
        <div class="grow"><strong>${esc(t.title)}</strong><span class="muted small">${esc(t.kind === 'action' ? 'Action rapide' : L.CATEGORIES[t.category])}</span></div>
        <div class="row-actions">
          <button class="btn small" data-act="horizon" data-id="${t.id}" data-h="today">Aujourd’hui</button>
          <button class="btn small" data-act="horizon" data-id="${t.id}" data-h="week">Cette semaine</button>
          <button class="btn small" data-act="edit-series" data-id="${t.id}" data-organize="1">Date…</button>
          <button class="btn small ghost" data-act="horizon" data-id="${t.id}" data-h="later">Plus tard</button>
        </div></div>`;
    }).join('') : empty('Tout est organisé.', 'check')}
  </section>
  <section class="card">
    ${sectionHead(`Captures à ranger (${inbox.length})`, '', 'inbox')}
    ${inbox.length ? inbox.map((x) => `<div class="inbox-row">
        <span class="type-ic">${icon(INBOX_TYPES[x.type][1])}</span>
        <div class="grow"><strong>${esc(x.title)}</strong><span class="muted small">${esc(INBOX_TYPES[x.type][0])}${x.note ? ' · ' + esc(x.note) : ''}${x.created_by ? ' · par ' + esc(P[x.created_by] || '') : ''}</span></div>
        <div class="row-actions">
          <button class="btn small primary" data-act="inbox-organize" data-id="${x.id}">Ranger</button>
          <button class="icon-btn" data-act="inbox-edit" data-id="${x.id}" aria-label="Modifier">${icon('edit')}</button>
          <button class="icon-btn" data-act="inbox-delete" data-id="${x.id}" aria-label="Supprimer">${icon('trash')}</button>
        </div></div>`).join('') : empty('Aucune capture en attente.', 'inbox')}
  </section>`;
}

// ------------------------------------------------------------ Maison
const MAISON_TABS = { jour: 'Aujourd’hui', semaine: 'Semaine', personne: 'Par personne', projet: 'Par projet', plus_tard: 'Plus tard', series: 'Récurrences', replan: 'À replanifier' };
export function viewMaison() {
  const tab = ui.maisonTab;
  const tabs = `<div class="tabs" role="tablist">${Object.entries(MAISON_TABS).map(([k, v]) => `<button role="tab" aria-selected="${k === tab}" data-act="maison-tab" data-tab="${k}">${v}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'jour') body = maisonJour();
  else if (tab === 'semaine') body = maisonSemaine();
  else if (tab === 'personne') body = maisonPersonne();
  else if (tab === 'projet') body = maisonProjets();
  else if (tab === 'plus_tard') body = maisonPlusTard();
  else if (tab === 'series') body = maisonSeries();
  else body = maisonReplan();
  return `<div class="page-head"><h1>${icon('home')}Maison</h1>
    <div class="head-actions"><button class="btn" data-act="distribute">${icon('scale')}<span>Répartir</span></button>
    <button class="btn primary" data-act="new-task">${icon('plus')}<span>Tâche</span></button></div></div>${tabs}${body}`;
}
function weekNav(offset, act) {
  const ws = L.addDays(L.startOfWeek(today()), offset * 7);
  return `<div class="week-nav"><button class="icon-btn" data-act="${act}" data-delta="-1" aria-label="Semaine précédente">${icon('left')}</button>
    <strong>Semaine du ${esc(L.fmtDayMonth(ws))} au ${esc(L.fmtDayMonth(L.addDays(ws, 6)))}</strong>
    <button class="icon-btn" data-act="${act}" data-delta="1" aria-label="Semaine suivante">${icon('right')}</button>
    ${offset ? `<button class="btn small ghost" data-act="${act}" data-delta="0">Aujourd’hui</button>` : ''}</div>`;
}
function maisonJour() {
  const t = today();
  const items = L.sortItems(L.itemsInRange(st.tasks, st.occ, t, t));
  return `<section class="card">${sectionHead(`${L.fmtLongDate(t)} — ${L.progressLabel(L.progress(items))}`, '', 'sun')}
    ${items.length ? list(items) : empty('Rien de prévu aujourd’hui', 'sun')}</section>`;
}
function maisonSemaine() {
  const ws = L.addDays(L.startOfWeek(today()), ui.maisonWeek * 7);
  const all = L.itemsInRange(st.tasks, st.occ, ws, L.addDays(ws, 6));
  const wk = L.weekItems(st.tasks, ws);
  return `${weekNav(ui.maisonWeek, 'week')}
  <section class="card">${sectionHead('Cette semaine, sans jour fixé', `<button class="btn small" data-act="new-task" data-week="${ws}">${icon('plus')}Ajouter</button>`, 'calendar')}
    ${wk.length ? list(L.sortItems(wk)) : '<p class="muted small">Rien. Selon TAPP : ce qui est important mais demande un vrai temps dédié.</p>'}</section>
  ${L.rangeDates(ws, L.addDays(ws, 6)).map((d) => {
    const its = L.sortItems(all.filter((i) => i.date === d));
    const mins = (p) => its.filter((i) => L.isFor(i, p) && i.status !== 'termine').reduce((s, i) => s + i.duration, 0);
    const abs = L.PEOPLE.filter((p) => L.capacityFor(p, d, st.members, st.avail).absent);
    return `<section class="card day-card ${d === today() ? 'is-today' : ''}">
      <div class="section-head"><h2>${esc(L.fmtLongDate(d))}</h2>
        <span class="muted small">Ilona ${mins('ilona')} min · Adrien ${mins('adrien')} min${abs.length ? ' · ' + abs.map((p) => `${P[p]} ${L.ABSENT_LABEL[p]}`).join(', ') : ''}</span>
        <button class="icon-btn" data-act="new-task" data-date="${d}" aria-label="Ajouter une tâche ce jour">${icon('plus')}</button></div>
      ${its.length ? list(its) : '<p class="muted small">Rien de prévu.</p>'}</section>`;
  }).join('')}`;
}
function maisonPersonne() {
  const ws = L.addDays(L.startOfWeek(today()), ui.maisonWeek * 7);
  const all = L.itemsInRange(st.tasks, st.occ, ws, L.addDays(ws, 6)).concat(L.weekItems(st.tasks, ws));
  const groups = [['ilona', all.filter((i) => i.assignee === 'ilona')], ['adrien', all.filter((i) => i.assignee === 'adrien')],
    ['both', all.filter((i) => i.assignee === 'both')], [null, all.filter((i) => !i.assignee)]];
  return `${weekNav(ui.maisonWeek, 'week')}${groups.map(([p, its]) => {
    const mins = its.filter((i) => i.status !== 'termine').reduce((s, i) => s + i.duration, 0);
    const pr = L.progress(its);
    return `<section class="card">${sectionHead(p ? P[p] : 'Non attribuées', `<span class="muted small">${its.length} tâche${its.length > 1 ? 's' : ''} · ${mins} min restantes · ${pr.done} terminée${pr.done > 1 ? 's' : ''}</span>`, p === 'both' ? 'users' : p ? 'user' : 'scale')}
      ${its.length ? list(L.sortItems(its), { showDate: true, showPerson: !p }) : '<p class="muted small">Aucune tâche.</p>'}</section>`;
  }).join('')}`;
}
function maisonProjets() {
  const projs = [...st.projects].sort((a, b) => ({ actif: 0, idee: 1, termine: 2 }[a.status] - { actif: 0, idee: 1, termine: 2 }[b.status]) || a.title.localeCompare(b.title, 'fr'));
  return `<p class="muted lead">Un projet ne va jamais tel quel dans la to-do du jour : on le découpe en tâches concrètes, qui elles reçoivent un horizon.</p>
  <div class="page-actions"><button class="btn primary" data-act="new-project">${icon('plus')}Nouveau projet</button></div>
  ${projs.length ? projs.map((p) => {
    const ts = st.tasks.filter((t) => t.project_id === p.id);
    const done = ts.filter((t) => !t.recurrence && t.status === 'termine').length;
    const singles = ts.filter((t) => !t.recurrence).length;
    const pct = singles ? Math.round(done * 100 / singles) : 0;
    return `<section class="card project">
      <div class="section-head"><h2>${icon('flag')}${esc(p.title)}</h2>
        <span class="chip ${p.status === 'termine' ? 'state-done' : ''}">${{ actif: 'En cours', idee: 'Idée', termine: 'Terminé' }[p.status]}</span>
        <button class="icon-btn" data-act="edit-project" data-id="${p.id}" aria-label="Modifier le projet">${icon('edit')}</button></div>
      ${p.description ? `<p class="muted small">${esc(p.description)}</p>` : ''}
      ${ts.length ? `<div class="bar thin"><span style="width:${pct}%"></span></div><p class="muted small">${done} tâche${done > 1 ? 's' : ''} sur ${singles} terminée${done > 1 ? 's' : ''}</p>` : `<div class="notice">${icon('alert')}<div><strong>À découper en tâches</strong><p>Ajoutez les premières tâches concrètes, en commençant par un verbe d’action.</p></div></div>`}
      ${ts.map((t) => { const i = L.makeItem(t, null, t.planned_date); return taskRow(t.planned_week && !t.planned_date ? { ...i, week: t.planned_week } : i, { showDate: true, quick: false }); }).join('')}
      <button class="btn small" data-act="new-task" data-project="${p.id}">${icon('plus')}Ajouter une tâche au projet</button>
    </section>`;
  }).join('') : empty('Aucun projet pour l’instant.', 'flag')}`;
}
function maisonPlusTard() {
  const ts = st.tasks.filter((t) => !t.recurrence && t.someday && !t.planned_date && !t.planned_week && t.status !== 'termine');
  return `<p class="muted lead">L’espace dédié de la méthode TAPP : ce qui n’est ni pour aujourd’hui, ni pour cette semaine, ni pour une date précise.</p>
  <section class="card">${ts.length ? ts.map((t) => {
    const i = L.makeItem(t, null, null); ui.items.set(i.key, i);
    return `<div class="inbox-row"><span class="type-ic">${icon(t.kind === 'action' ? 'bolt' : 'later')}</span>
      <button class="grow plain" data-act="detail" data-key="${t.id}"><strong>${esc(t.title)}</strong><span class="muted small">${esc(L.CATEGORIES[t.category])}</span></button>
      <div class="row-actions"><button class="btn small" data-act="horizon" data-id="${t.id}" data-h="today">Aujourd’hui</button>
      <button class="btn small" data-act="horizon" data-id="${t.id}" data-h="week">Cette semaine</button>
      <button class="btn small" data-act="edit-series" data-id="${t.id}">Date…</button></div></div>`;
  }).join('') : empty('Rien en attente pour plus tard.', 'later')}</section>`;
}
function maisonSeries() {
  const series = st.tasks.filter((t) => t.recurrence).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const singles = st.tasks.filter((t) => !t.recurrence && (t.planned_date || t.planned_week)).sort((a, b) => (b.planned_date || b.planned_week).localeCompare(a.planned_date || a.planned_week)).slice(0, 40);
  return `<section class="card">${sectionHead(`Tâches récurrentes (${series.length})`, '', 'repeat')}
    <p class="muted small">Toutes les fréquences sont modifiables : touchez une ligne.</p>
    ${series.map((t) => `<button class="series-row" data-act="edit-series" data-id="${t.id}">
      <span class="grow"><strong>${esc(t.title)}</strong><span class="muted small">${esc(L.describeRecurrence(t.recurrence))} · ${esc(L.CATEGORIES[t.category])} · ${t.duration_min ? t.duration_min + ' min' : '≈ ' + L.defaultDuration(t) + ' min'}</span></span>
      ${personChip(t.assignee)}${icon('edit')}</button>`).join('') || empty('Aucune tâche récurrente.', 'repeat')}
  </section>
  <section class="card">${sectionHead('Tâches ponctuelles planifiées', '', 'list')}
    ${singles.map((t) => { const i = L.makeItem(t, null, t.planned_date); return taskRow(t.planned_date ? i : { ...i, week: t.planned_week }, { showDate: true, quick: false }); }).join('') || empty('Aucune.', 'list')}</section>`;
}
function maisonReplan() {
  const its = L.replanItems(st.tasks, st.occ);
  return `<p class="muted lead">Tâches que personne ne pouvait faire (les deux absents). Choisissez une nouvelle date.</p>
  <section class="card">${its.length ? its.map((i) => { ui.items.set(i.key, i); return `<div class="inbox-row"><span class="type-ic">${icon('alert')}</span>
    <div class="grow"><strong>${esc(i.title)}</strong><span class="muted small">Prévue ${esc(L.fmtShort(i.occDate || i.date || today()))}</span></div>
    <div class="row-actions"><button class="btn small" data-act="postpone" data-key="${esc(i.key)}" data-to="${today()}">Aujourd’hui</button>
    <button class="btn small" data-act="detail" data-key="${esc(i.key)}">Autre date…</button></div></div>`; }).join('') : empty('Rien à replanifier.', 'check')}</section>`;
}

// ------------------------------------------------------------ Disponibilités
export function viewDispos() {
  const t = today();
  const upcoming = st.avail.filter((a) => a.end_date >= t).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const ws = L.startOfWeek(t);
  const conflicts = L.absenceConflicts({ tasks: st.tasks, occurrences: st.occ, members: st.members, availabilities: st.avail, from: t, to: L.addDays(t, 13) });
  return `<div class="page-head"><h1>${icon('calendar')}Disponibilités</h1>
    <button class="btn primary" data-act="distribute">${icon('scale')}Répartir les tâches</button></div>
  <section class="card">
    ${sectionHead('Signaler une absence ou une disponibilité réduite', '', 'moon')}
    <form data-form="avail" class="stack">
      <div class="field"><span class="label">Qui ?</span><div class="seg">
        ${L.PEOPLE.map((p) => `<label><input type="radio" name="person" value="${p}" ${p === me() ? 'checked' : ''}><span>${P[p]}</span></label>`).join('')}</div></div>
      <div class="field"><span class="label">Quoi ?</span><div class="seg">
        <label><input type="radio" name="kind" value="absent" checked><span>${icon('moon')}Absence</span></label>
        <label><input type="radio" name="kind" value="reduite"><span>${icon('clock')}Disponibilité réduite</span></label></div></div>
      <div class="field"><span class="label">Quand ?</span>
        <div class="seg wrap" id="when-seg">
          <label><input type="radio" name="when" value="today" checked><span>Aujourd’hui</span></label>
          <label><input type="radio" name="when" value="tomorrow"><span>Demain</span></label>
          <label><input type="radio" name="when" value="days"><span>Certains jours</span></label>
          <label><input type="radio" name="when" value="week"><span>Cette semaine</span></label>
          <label><input type="radio" name="when" value="nextweek"><span>Semaine prochaine</span></label>
          <label><input type="radio" name="when" value="period"><span>Période précise</span></label>
        </div></div>
      <div class="field show-days"><span class="label">Jours (semaine du ${esc(L.fmtDayMonth(ws))})</span><div class="days-pick">
        ${L.rangeDates(ws, L.addDays(ws, 13)).map((d, k) => `<label class="${d < t ? 'past' : ''}"><input type="checkbox" name="days" value="${d}" ${d < t ? 'disabled' : ''}><span>${L.WEEKDAYS_SHORT[k % 7]}<b>${+d.slice(8)}</b></span></label>`).join('')}</div></div>
      <div class="grid2 show-period">
        <label class="field"><span class="label">Du</span><input type="date" name="start" value="${t}"></label>
        <label class="field"><span class="label">Au</span><input type="date" name="end" value="${t}"></label></div>
      <label class="field show-reduced"><span class="label">Temps disponible pour les tâches ce jour-là (minutes)</span><input type="number" name="capacity" min="0" max="600" step="5" value="20" inputmode="numeric"></label>
      <label class="field"><span class="label">Note (facultatif)</span><input name="note" maxlength="120" placeholder="Ex. déplacement pro"></label>
      <button class="btn primary">Enregistrer</button>
    </form>
  </section>
  ${conflicts.length ? `<div class="notice warn">${icon('alert')}<div><strong>À vérifier</strong>${conflicts.map((c) => `<p>${esc(c.text)}${c.manual ? ' (attribution manuelle)' : ''}</p>`).join('')}<button class="btn small" data-act="distribute">Proposer une répartition</button></div></div>` : ''}
  <section class="card">${sectionHead('Absences et disponibilités à venir', '', 'list')}
    ${upcoming.length ? upcoming.map((a) => `<div class="inbox-row"><span class="type-ic">${icon(a.kind === 'absent' ? 'moon' : 'clock')}</span>
      <div class="grow"><strong>${esc(P[a.person])} ${a.kind === 'absent' ? L.ABSENT_LABEL[a.person] : `disponible ${a.capacity_min ?? 0} min`}</strong>
      <span class="muted small">${a.start_date === a.end_date ? esc(L.fmtLongDate(a.start_date)) : `du ${esc(L.fmtShort(a.start_date))} au ${esc(L.fmtShort(a.end_date))}`}${a.note ? ' · ' + esc(a.note) : ''}</span></div>
      <button class="icon-btn" data-act="avail-delete" data-id="${a.id}" aria-label="Supprimer">${icon('trash')}</button></div>`).join('') : empty('Personne n’a signalé d’absence.', 'check')}
  </section>
  <section class="card">${sectionHead('Réglages de la répartition', '', 'scale')}
    <p class="muted small">La répartition équilibre le temps total estimé, en respectant le temps disponible de chacun et ses préférences.</p>
    <div class="two-col">${L.PEOPLE.map((p) => memberPrefs(p)).join('')}</div></section>`;
}
function memberPrefs(p) {
  const m = st.members.find((x) => x.person === p);
  if (!m) return `<div class="sub-card"><strong>${P[p]}</strong><p class="muted small">Réglages indisponibles.</p></div>`;
  return `<form class="sub-card stack" data-form="member-prefs" data-person="${p}">
    <strong>${P[p]}</strong>
    <label class="field"><span class="label">Temps habituel pour les tâches, par jour (min)</span>
      <input type="number" name="cap" min="0" max="600" step="5" value="${m.daily_capacity_min}" inputmode="numeric"></label>
    <div class="field"><span class="label">Préfère (facultatif)</span><div class="chips-pick">${Object.entries(L.CATEGORIES).map(([k, v]) => `<label><input type="checkbox" name="pref" value="${k}" ${m.preferred_categories.includes(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></div>
    <div class="field"><span class="label">Préfère éviter (facultatif)</span><div class="chips-pick">${Object.entries(L.CATEGORIES).map(([k, v]) => `<label><input type="checkbox" name="avoid" value="${k}" ${m.avoided_categories.includes(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></div>
    <button class="btn small">Enregistrer</button></form>`;
}

// ------------------------------------------------------------ Repas
export function viewRepas() {
  const tabs = `<div class="tabs" role="tablist"><button role="tab" aria-selected="${ui.repasTab === 'semaine'}" data-act="repas-tab" data-tab="semaine">Menu de la semaine</button><button role="tab" aria-selected="${ui.repasTab === 'idees'}" data-act="repas-tab" data-tab="idees">Idées de repas</button></div>`;
  return `<div class="page-head"><h1>${icon('utensils')}Repas</h1></div>${tabs}${ui.repasTab === 'semaine' ? repasSemaine() : repasIdees()}`;
}
function repasSemaine() {
  const ws = L.addDays(L.startOfWeek(today()), ui.menuWeek * 7);
  const days = L.rangeDates(ws, L.addDays(ws, 6));
  const meals = st.meals.filter((m) => m.meal_date >= ws && m.meal_date <= days[6]);
  const slot = (d, s) => {
    const m = meals.find((x) => x.meal_date === d && x.slot === s);
    const label = s === 'diner' ? 'Dîner' : 'Déjeuner';
    if (!m) return `<button class="meal-slot-btn empty-slot ${s}" data-act="meal-edit" data-date="${d}" data-slot="${s}">${icon('plus')}${label}${s === 'dejeuner' ? ' <em>(facultatif)</em>' : ''}</button>`;
    const r = m.recipe_id && st.recipes.find((x) => x.id === m.recipe_id);
    return `<div class="meal-slot-card ${m.no_meal ? 'no-meal' : ''}">
      <button class="grow plain" data-act="meal-edit" data-date="${d}" data-slot="${s}">
        <span class="meal-slot">${label}</span>
        <strong>${m.no_meal ? 'Pas de repas à prévoir' : esc(mealTitle(m))}</strong>
        <span class="muted small">${m.no_meal ? '' : `${m.servings} pers.`}${r?.prep_min ? ` · ${r.prep_min} min` : ''}${m.notes ? ' · ' + esc(m.notes) : ''}</span></button>
      <button class="icon-btn" data-act="meal-move" data-id="${m.id}" aria-label="Déplacer">${icon('move')}</button>
      <button class="icon-btn" data-act="meal-clear" data-id="${m.id}" aria-label="Retirer">${icon('x')}</button></div>`;
  };
  const prev = st.meals.filter((m) => m.meal_date >= L.addDays(ws, -7) && m.meal_date < ws).length;
  return `${weekNav(ui.menuWeek, 'menu-week')}
  <div class="page-actions">
    <button class="btn primary" data-act="meal-to-shop" data-week="${ws}">${icon('cart')}Ajouter les ingrédients aux courses</button>
    <button class="btn" data-act="meal-copy-prev" data-week="${ws}" ${prev ? '' : 'disabled'}>${icon('copy')}Reprendre la semaine précédente${prev ? ` (${prev})` : ''}</button>
  </div>
  <div class="menu-grid">${days.map((d) => `<section class="card day-meals ${d === today() ? 'is-today' : ''}">
    <h3>${esc(L.fmtLongDate(d))}</h3>${slot(d, 'dejeuner')}${slot(d, 'diner')}</section>`).join('')}</div>`;
}
function repasIdees() {
  const q = L.norm(ui.recipeQuery);
  const rs = st.recipes.filter((r) => (!ui.favOnly || r.favorite) && (!q || L.norm(r.name).includes(q)))
    .sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'fr'));
  return `<div class="page-actions">
    <input class="search" type="search" placeholder="Rechercher une idée…" value="${esc(ui.recipeQuery)}" data-input="recipe-search" aria-label="Rechercher">
    <label class="toggle"><input type="checkbox" data-change="fav-only" ${ui.favOnly ? 'checked' : ''}><span>${icon('star')}Favoris</span></label>
    <button class="btn primary" data-act="recipe-new">${icon('plus')}Nouvelle idée</button></div>
  ${rs.length ? `<div class="recipe-grid">${rs.map((r) => `<article class="card recipe">
    <div class="section-head"><h2>${esc(r.name)}</h2>
      <button class="icon-btn fav ${r.favorite ? 'on' : ''}" data-act="recipe-fav" data-id="${r.id}" aria-pressed="${r.favorite}" aria-label="${r.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon('star')}</button></div>
    <p class="muted small">${r.ingredients.length} ingrédient${r.ingredients.length > 1 ? 's' : ''}${r.prep_min ? ` · ${r.prep_min} min` : ''} · pour ${r.servings} pers.${r.favorite ? ' · Favori' : ''}</p>
    ${r.ingredients.length ? `<p class="small">${r.ingredients.slice(0, 6).map((g) => esc(g.name)).join(', ')}${r.ingredients.length > 6 ? '…' : ''}</p>` : ''}
    ${r.notes ? `<p class="muted small">${esc(r.notes)}</p>` : ''}
    <div class="row-actions"><button class="btn small" data-act="recipe-plan" data-id="${r.id}">${icon('calendar')}Planifier</button>
      <button class="btn small ghost" data-act="recipe-edit" data-id="${r.id}">${icon('edit')}Modifier</button></div>
  </article>`).join('')}</div>` : empty(st.recipes.length ? 'Aucune idée ne correspond.' : 'La bibliothèque est vide : ajoutez vos premières idées de repas.', 'utensils')}`;
}

// ------------------------------------------------------------ Courses
export function viewCourses() {
  const open = st.shopping.filter((x) => !x.checked && !x.archived);
  const bought = st.shopping.filter((x) => x.checked && !x.archived);
  const row = (x) => `<div class="shop-row ${x.checked ? 'done' : ''}">
    <label class="shop-check"><input type="checkbox" data-change="shop-check" data-id="${x.id}" ${x.checked ? 'checked' : ''}>
      <span class="box" aria-hidden="true">${icon('check')}</span><span class="sr">Acheté</span></label>
    <button class="grow plain" data-act="shop-edit" data-id="${x.id}">
      <strong>${esc(x.name)}</strong>${x.qty != null || x.unit ? `<span class="qty">${esc(L.fmtQty(x.qty, x.unit))}</span>` : ''}
      ${x.note ? `<span class="muted small">${esc(x.note)}</span>` : ''}${x.checked ? '<span class="chip state-done">Acheté</span>' : ''}</button>
  </div>`;
  const cats = Object.keys(L.SHOP_CATEGORIES).filter((c) => open.some((x) => x.category === c));
  return `<div class="page-head"><h1>${icon('cart')}Courses</h1></div>
  <form class="quick-add" data-form="shop-add">
    <input name="text" placeholder="Ajouter : « 2 kg pommes », « lait d’avoine »…" autocomplete="off" required aria-label="Produit à ajouter">
    <select name="category" aria-label="Catégorie"><option value="">Catégorie auto</option>${opts(L.SHOP_CATEGORIES)}</select>
    <button class="btn primary" aria-label="Ajouter">${icon('plus')}</button>
  </form>
  ${open.length ? cats.map((c) => `<section class="card shop-cat"><h2>${esc(L.SHOP_CATEGORIES[c])} <span class="muted">(${open.filter((x) => x.category === c).length})</span></h2>
    ${open.filter((x) => x.category === c).sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(row).join('')}</section>`).join('') : empty('Tout est acheté. La liste est vide.', 'cart')}
  ${bought.length ? `<section class="card bought">
    <div class="section-head"><h2>${icon('check')}Dans le panier (${bought.length})</h2></div>
    ${bought.map(row).join('')}
    <div class="row-actions">
      <button class="btn primary" data-act="shop-stow">${icon('box')}Ranger les achats</button>
      <button class="btn ghost" data-act="shop-archive">Archiver sans ranger</button></div>
    <p class="muted small">Cocher un produit ne modifie pas l’inventaire : « Ranger les achats » vous laisse vérifier les quantités avant.</p>
  </section>` : ''}`;
}

// ------------------------------------------------------------ Inventaire
export function viewStock() {
  const t = today();
  const locs = locations();
  const all = [...st.inventory].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const alerts = all.filter((x) => L.isLowStock(x) || ['soon', 'expired'].includes(L.expiryStatus(x.expires_on, t)?.level));
  const shown = ui.stockLoc === 'tous' ? all : all.filter((x) => x.location === ui.stockLoc);
  const row = (x) => {
    const ex = L.expiryStatus(x.expires_on, t); const low = L.isLowStock(x);
    return `<div class="inv-row">
      <button class="grow plain" data-act="inv-edit" data-id="${x.id}">
        <strong>${esc(x.name)}</strong>
        <span class="inv-meta"><span class="qty">${esc(L.fmtQty(x.qty, x.unit) || 'Quantité non précisée')}</span>
        ${ui.stockLoc === 'tous' ? `<span class="chip">${esc(locs[x.location] || x.location)}</span>` : ''}
        ${ex && ex.level !== 'ok' ? `<span class="chip ${ex.level === 'expired' ? 'late' : 'soon'}">${icon('alert')}${esc(ex.label)}</span>` : ex ? `<span class="chip">${esc(ex.label)}</span>` : ''}
        ${low ? `<span class="chip soon">${icon('alert')}Stock bas</span>` : ''}</span></button>
      <button class="icon-btn" data-act="inv-dec" data-id="${x.id}" aria-label="Diminuer le stock de ${esc(x.name)}" ${x.qty == null || Number(x.qty) <= 0 ? 'disabled' : ''}>${icon('minus')}</button>
      <button class="icon-btn" data-act="inv-to-shop" data-id="${x.id}" aria-label="Ajouter ${esc(x.name)} aux courses">${icon('cart')}</button></div>`;
  };
  return `<div class="page-head"><h1>${icon('box')}Inventaire</h1>
    <button class="btn primary" data-act="inv-new">${icon('plus')}Produit</button></div>
  <p class="muted lead">À remplir petit à petit : les menus et les courses fonctionnent même si l’inventaire est incomplet.</p>
  ${alerts.length ? `<section class="card alert-card">${sectionHead(`À surveiller (${alerts.length})`, '', 'alert')}${alerts.map(row).join('')}</section>` : ''}
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="${ui.stockLoc === 'tous'}" data-act="stock-loc" data-loc="tous">Tout (${all.length})</button>
    ${Object.entries(locs).map(([k, v]) => `<button role="tab" aria-selected="${ui.stockLoc === k}" data-act="stock-loc" data-loc="${esc(k)}">${esc(v)} (${all.filter((x) => x.location === k).length})</button>`).join('')}
  </div>
  <section class="card">${shown.length ? shown.map(row).join('') : empty('Aucun produit ici pour l’instant.', 'box', `<button class="btn" data-act="inv-new">${icon('plus')}Ajouter un produit</button>`)}</section>`;
}

// ------------------------------------------------------------ Foyer
export function viewFoyer() {
  const locs = st.hh?.settings?.locations || {};
  const devices = (p) => st.devices.filter((d) => d.person === p).length;
  return `<div class="page-head"><h1>${icon('users')}Foyer</h1></div>
  <section class="card">
    <form data-form="hh-name" class="inline-form"><label class="field grow"><span class="label">Nom du foyer</span><input name="name" value="${esc(st.hh?.name || '')}" maxlength="60" required></label><button class="btn">Enregistrer</button></form>
    <div class="members">${L.PEOPLE.map((p) => `<div class="member p-${p}">${icon('user')}<div><strong>${P[p]}${p === me() ? ' (cet appareil)' : ''}</strong>
      <span class="muted small">${devices(p) ? `Reconnue sur ${devices(p)} appareil${devices(p) > 1 ? 's' : ''}`.replace('Reconnue', p === 'adrien' ? 'Reconnu' : 'Reconnue') : `Pas encore ${p === 'adrien' ? 'connecté' : 'connectée'}`}</span></div></div>`).join('')}</div>
    <p class="muted small">Pour ajouter un appareil : ouvrez l’app dessus, choisissez « Je suis … » et tapez le code du foyer. C’est à faire une seule fois par appareil.</p>
  </section>
  <section class="card">${sectionHead('Code du foyer', '', 'scale')}
    <p class="muted small">Ce code protège l’accès : sans lui, personne ne peut entrer, même avec l’adresse du site. Le changer n’affecte pas les appareils déjà reconnus.</p>
    <form data-form="hh-code" class="stack">
      <div class="grid2"><label class="field"><span class="label">Nouveau code</span><input type="password" name="code" minlength="4" required autocomplete="new-password"></label>
      <label class="field"><span class="label">Confirmer</span><input type="password" name="code2" minlength="4" required autocomplete="new-password"></label></div>
      <div><button class="btn">Changer le code</button></div></form>
  </section>
  <section class="card">${sectionHead('Emplacements de l’inventaire', '', 'box')}
    <div class="chips-list">${Object.values(L.DEFAULT_LOCATIONS).map((v) => `<span class="chip">${esc(v)}</span>`).join('')}
      ${Object.entries(locs).map(([k, v]) => `<span class="chip">${esc(v)}<button class="chip-x" data-act="loc-delete" data-loc="${esc(k)}" aria-label="Supprimer ${esc(v)}">${icon('x')}</button></span>`).join('')}</div>
    <form data-form="loc-add" class="inline-form"><label class="field grow"><span class="label">Nouvel emplacement</span><input name="name" maxlength="40" placeholder="Ex. Cave, Cellier" required></label><button class="btn">${icon('plus')}Ajouter</button></form>
  </section>
  <section class="card">${sectionHead('Cet appareil', '', 'user')}
    <p class="small">Reconnu comme <strong>${P[me()]}</strong>.</p>
    <p class="muted small">Données initiales importées ${st.hh?.settings?.seeded_on ? 'le ' + esc(L.fmtLongDate(st.hh.settings.seeded_on)) : ''} · synchronisation ${ui.online ? 'active' : 'en reconnexion…'}</p>
    <button class="btn" data-act="logout">${icon('swap')}Changer de personne sur cet appareil</button>
  </section>`;
}
