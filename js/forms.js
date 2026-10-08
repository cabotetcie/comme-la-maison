// Contenu des feuilles (formulaires et détails).
import * as L from './logic.js';
import { icon } from './icons.js';
import { st, esc, today, me, other, locations, personChip, prioChip, opts, findItem } from './core.js';
import { INBOX_TYPES, mealTitle } from './views.js';

const P = L.PERSON_LABEL;
const radio = (name, map, sel, cls = 'seg') => `<div class="${cls}">${Object.entries(map).map(([k, v]) => `<label><input type="radio" name="${name}" value="${esc(k)}" ${k === sel ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>`;
const ASSIGN = { '': `${icon('scale')}Auto`, ilona: 'Ilona', adrien: 'Adrien', both: 'Les deux' };
const PRIO = Object.fromEntries(Object.entries(L.PRIORITIES).map(([k, v]) => [k, `<b aria-hidden="true">${v.icon}</b>${v.label}`]));

// ------------------------------------------------------------- capture
export function captureForm(type = 'tache') {
  const types = Object.fromEntries(Object.entries(INBOX_TYPES).map(([k, [lab, ic]]) => [k, `${icon(ic)}${lab}`]));
  return `<form data-form="capture" class="stack" data-type="${type}">
    <label class="field"><span class="label">Titre</span>
      <input name="title" required maxlength="160" autofocus autocomplete="off" placeholder="Ex. Revisser le lit, 2 kg pommes, idée : chili…"></label>
    <div class="field"><span class="label">Type</span>${radio('type', types, type, 'seg wrap types')}</div>
    <p class="hint for-tache">Une tâche demande de la concentration et un temps défini : commencez par un verbe d’action.</p>
    <p class="hint for-action">Une action est une micro-tâche de quelques minutes.</p>
    <div class="field for-task"><span class="label">Quand ? (facultatif)</span>
      ${radio('when', { none: 'À organiser', today: 'Aujourd’hui', week: 'Cette semaine', date: 'Date précise', later: 'Plus tard' }, 'none', 'seg wrap')}
      <input type="date" name="date" class="for-date" value="${today()}" aria-label="Date"></div>
    <details class="more for-task"><summary>Plus d’options (facultatif)</summary>
      <div class="field"><span class="label">Responsable</span>${radio('assignee', ASSIGN, '')}</div>
      <div class="field"><span class="label">Priorité</span>${radio('priority', PRIO, 'normale')}</div>
      <label class="field"><span class="label">Durée estimée (min)</span><input type="number" name="duration" min="1" max="600" inputmode="numeric" placeholder="Estimation par défaut"></label>
    </details>
    <div class="field for-courses"><span class="label">Catégorie</span><select name="shopcat"><option value="">Automatique</option>${opts(L.SHOP_CATEGORIES)}</select></div>
    <label class="check-line for-direct"><input type="checkbox" name="direct"><span>Ranger directement (sinon : « À organiser »)</span></label>
    <label class="field"><span class="label">Note (facultatif)</span><input name="note" maxlength="300"></label>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('plus')}Ajouter</button></div>
  </form>`;
}

// ------------------------------------------------------------- détail d'une tâche
export function taskDetail(key) {
  const i = findItem(key);
  if (!i) return '<p class="muted">Cette tâche n’existe plus.</p>';
  const t = today(); const done = i.status === 'termine';
  const proj = i.projectId && st.projects.find((p) => p.id === i.projectId);
  const when = i.recurring ? `${L.fmtLongDate(i.date)}${i.occDate !== i.date ? ` (reportée, prévue initialement ${L.fmtShort(i.occDate)})` : ''}`
    : i.date ? L.fmtLongDate(i.date) : i.week ? `Semaine du ${L.fmtDayMonth(i.week)}` : i.task.someday ? 'Plus tard' : 'À organiser';
  const scopeNote = i.recurring ? '<p class="hint">S’applique à cette occurrence uniquement.</p>' : '';
  return `<div class="detail">
    <div class="detail-meta">
      ${i.kind === 'action' ? `<span class="chip kind">${icon('bolt')}Action rapide</span>` : `<span class="chip">${icon('home')}Tâche</span>`}
      <span class="chip ${done ? 'state-done' : i.status === 'en_cours' ? 'state-progress' : ''}">${done ? icon('check') : icon('clock')}${L.STATUS[i.status] || i.status}</span>
      ${prioChip(i.priority)}<span class="chip">${esc(L.CATEGORIES[i.category])}</span>
      <span class="chip ${i.durationIsDefault ? 'estimate' : ''}">${icon('clock')}${i.durationIsDefault ? '≈ ' : ''}${i.duration} min${i.durationIsDefault ? ' (estimation)' : ''}</span>
      ${personChip(i.assignee)}
    </div>
    <p class="detail-when">${icon('calendar')}${esc(when)}${i.recurring ? ` · ${icon('repeat')}${esc(L.describeRecurrence(i.task.recurrence))}` : ''}</p>
    ${i.dueDate ? `<p class="small">${icon('flag')}Échéance : ${esc(L.fmtLongDate(i.dueDate))}</p>` : ''}
    ${proj ? `<p class="small">${icon('folder')}Projet : <strong>${esc(proj.title)}</strong></p>` : ''}
    ${i.description ? `<p class="detail-desc">${esc(i.description)}</p>` : ''}
    ${i.assignSource === 'auto' && i.assignee ? '<p class="hint">Attribuée par la répartition automatique.</p>' : ''}
    ${i.subactions.length ? `<div class="subs"><span class="label">Sous-actions (${i.subactions.filter((s) => s.done).length}/${i.subactions.length})</span>
      ${i.subactions.map((s) => `<label class="check-line"><input type="checkbox" data-change="sub-toggle" data-key="${esc(key)}" data-sid="${esc(s.id)}" ${s.done ? 'checked' : ''}><span>${esc(s.title)}</span></label>`).join('')}</div>` : ''}

    <div class="detail-actions">
      <button class="btn ${done ? '' : 'primary'} big" data-act="toggle" data-key="${esc(key)}">${icon(done ? 'x' : 'check')}${done ? 'Annuler la validation' : 'Terminer'}</button>
      ${!done ? `<button class="btn" data-act="progress" data-key="${esc(key)}">${icon('clock')}${i.status === 'en_cours' ? 'Remettre « à faire »' : 'Marquer « en cours »'}</button>` : ''}
    </div>

    <div class="field"><span class="label">Reporter</span>
      <div class="row-actions">
        <button class="btn small" data-act="postpone" data-key="${esc(key)}" data-to="${t}">Aujourd’hui</button>
        <button class="btn small" data-act="postpone" data-key="${esc(key)}" data-to="${L.addDays(t, 1)}">Demain</button>
        <button class="btn small" data-act="postpone" data-key="${esc(key)}" data-to="${L.addDays(i.date || t, 7)}">+ 1 semaine</button>
        <span class="date-go"><input type="date" id="pp-date" value="${L.addDays(t, 2)}" aria-label="Nouvelle date"><button class="btn small" data-act="postpone-date" data-key="${esc(key)}">OK</button></span>
      </div>${scopeNote}</div>

    <div class="field"><span class="label">Responsable</span>
      <div class="seg">${Object.entries(ASSIGN).map(([k, v]) => `<button class="${(i.assignee || '') === k ? 'on' : ''}" aria-pressed="${(i.assignee || '') === k}" data-act="assign" data-key="${esc(key)}" data-who="${k}">${v}</button>`).join('')}</div>
      ${i.assignee && i.assignee !== 'both' && i.date ? `<button class="btn small ghost" data-act="swap-pick" data-key="${esc(key)}">${icon('swap')}Échanger avec une tâche de ${P[other(i.assignee)]}</button>` : ''}
      ${scopeNote}</div>

    <div class="sheet-actions spread">
      ${i.recurring
        ? `<button class="btn ghost" data-act="skip" data-key="${esc(key)}">Passer cette occurrence</button>
           <button class="btn" data-act="edit-item" data-key="${esc(key)}">${icon('edit')}Modifier</button>`
        : `<button class="btn ghost danger-text" data-act="delete-task" data-id="${i.taskId}">${icon('trash')}Supprimer</button>
           <button class="btn" data-act="edit-series" data-id="${i.taskId}">${icon('edit')}Modifier</button>`}
    </div>
  </div>`;
}

export function scopeChooser(key) {
  const i = findItem(key);
  return `<p>« ${esc(i.title)} » est une tâche récurrente. Que voulez-vous modifier ?</p>
  <div class="choice-list">
    <button class="choice" data-act="edit-occ" data-key="${esc(key)}">${icon('calendar')}<span><strong>Cette occurrence</strong><span class="muted small">${esc(L.fmtLongDate(i.date))} seulement</span></span></button>
    <button class="choice" data-act="edit-series" data-id="${i.taskId}">${icon('repeat')}<span><strong>Toute la série</strong><span class="muted small">Titre, fréquence, responsable… pour toutes les occurrences</span></span></button>
  </div>`;
}

export function swapPicker(key) {
  const i = findItem(key);
  const o = other(i.assignee);
  const cands = L.itemsInRange(st.tasks, st.occ, i.date, i.date).filter((x) => x.assignee === o && x.status !== 'termine' && x.key !== key);
  return `<p>Échanger « ${esc(i.title)} » (${P[i.assignee]}) avec une tâche de ${P[o]} le ${esc(L.fmtShort(i.date))} :</p>
  <div class="choice-list">${cands.length ? cands.map((c) => `<button class="choice" data-act="swap" data-key="${esc(key)}" data-with="${esc(c.key)}">${icon('swap')}<span><strong>${esc(c.title)}</strong><span class="muted small">${c.duration} min</span></span></button>`).join('') : `<p class="muted">${P[o]} n’a pas d’autre tâche ce jour-là.</p>`}</div>`;
}

// ------------------------------------------------------------- formulaire de tâche (série / ponctuelle)
export function taskForm(task = null, preset = {}) {
  const t = task || { kind: 'tache', category: 'menage', priority: 'normale', subactions: [], status: 'a_faire', ...preset };
  const rec = t.recurrence;
  const freq = !rec ? '' : rec.freq === 'weekly' && Number(rec.interval) === 2 ? 'biweekly' : rec.freq;
  const h = t.planned_date ? (t.planned_date === today() ? 'today' : 'date') : t.planned_week ? 'week' : t.someday ? 'later' : 'none';
  const ws = L.startOfWeek(today());
  const weekOpts = { [ws]: 'Cette semaine', [L.addDays(ws, 7)]: 'Semaine prochaine', [L.addDays(ws, 14)]: 'Dans 2 semaines' };
  if (t.planned_week && !weekOpts[t.planned_week]) weekOpts[t.planned_week] = `Semaine du ${L.fmtDayMonth(t.planned_week)}`;
  const days = rec?.days?.map(Number) || (rec ? [L.isoDow(rec.start)] : [L.isoDow(today())]);
  const def = L.defaultDuration(t);
  return `<form data-form="task" class="stack" data-freq="${freq}" data-h="${h}" data-kind="${t.kind}">
    <input type="hidden" name="id" value="${esc(task?.id || '')}">
    <input type="hidden" name="inbox" value="${esc(preset.inboxId || '')}">
    <div class="field"><span class="label">Type TAPP</span>${radio('kind', { tache: `${icon('home')}Tâche`, action: `${icon('bolt')}Action rapide` }, t.kind)}</div>
    <label class="field"><span class="label">Titre</span><input name="title" required maxlength="160" value="${esc(t.title || '')}" ${task ? '' : 'autofocus'} placeholder="Commencez par un verbe : Revisser, Appeler…"></label>
    <div class="grid2">
      <label class="field"><span class="label">Catégorie</span><select name="category">${opts(L.CATEGORIES, t.category)}</select></label>
      <label class="field"><span class="label">Projet (facultatif)</span><select name="project"><option value="">Aucun</option>${opts(Object.fromEntries(st.projects.filter((p) => p.status !== 'termine' || p.id === t.project_id).map((p) => [p.id, p.title])), t.project_id)}</select></label>
    </div>
    <label class="field"><span class="label">Description (facultatif)</span><textarea name="description" rows="2" maxlength="1000">${esc(t.description || '')}</textarea></label>

    <div class="field"><span class="label">Répétition</span><select name="freq">${opts({ '': 'Ponctuelle', daily: 'Tous les jours / tous les N jours', weekly: 'Chaque semaine', biweekly: 'Une semaine sur deux', monthly: 'Chaque mois' }, freq)}</select></div>

    <div class="field show-single"><span class="label">Quand ? (priorité TAPP)</span>
      ${radio('when', { none: 'À organiser', today: 'Aujourd’hui', week: 'Une semaine', date: 'Date précise', later: 'Plus tard' }, h, 'seg wrap')}
      <input type="date" name="date" class="show-date" value="${esc(t.planned_date || today())}" aria-label="Date prévue">
      <select name="week" class="show-week" aria-label="Semaine">${opts(weekOpts, t.planned_week || ws)}</select>
    </div>

    <div class="rec-box show-rec">
      <div class="field show-days"><span class="label">Jours</span><div class="days-pick week7">${L.WEEKDAYS.map((d, k) => `<label><input type="checkbox" name="days" value="${k + 1}" ${days.includes(k + 1) ? 'checked' : ''}><span>${d.slice(0, 3)}</span></label>`).join('')}</div></div>
      <div class="grid2">
        <label class="field"><span class="label">Date de départ</span><input type="date" name="start" value="${esc(rec?.start || today())}"></label>
        <label class="field show-interval"><span class="label">Tous les … jours</span><input type="number" name="interval" min="1" max="60" value="${rec?.freq === 'daily' ? rec.interval || 1 : 1}" inputmode="numeric"></label>
      </div>
      <p class="hint show-biweekly">La date de départ fixe la semaine de référence : la tâche revient une semaine sur deux à partir de celle-ci.</p>
      <label class="check-line"><input type="checkbox" name="alternate" ${rec?.alternate === false ? '' : 'checked'}><span>Alterner entre Ilona et Adrien quand c’est possible</span></label>
    </div>

    <div class="field"><span class="label">Responsable</span>${radio('assignee', ASSIGN, t.assign_mode === 'manual' || t.assignee ? t.assignee || '' : '')}
      <p class="hint">« Auto » : la répartition automatique choisit selon le temps disponible et les absences.</p></div>
    <div class="field"><span class="label">Priorité</span>${radio('priority', PRIO, t.priority)}</div>
    <div class="grid2">
      <label class="field"><span class="label">Durée estimée (min)</span><input type="number" name="duration" min="1" max="1440" inputmode="numeric" value="${esc(t.duration_min || '')}" placeholder="≈ ${def} min (estimation)"></label>
      <label class="field show-single"><span class="label">Échéance (facultatif)</span><input type="date" name="due" value="${esc(t.due_date || '')}"></label>
    </div>
    ${task && !rec ? `<div class="field"><span class="label">Statut</span>${radio('status', { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }, ['a_faire', 'en_cours', 'termine'].includes(t.status) ? t.status : 'a_faire')}</div>` : ''}

    <div class="field"><span class="label">Sous-actions (facultatif)</span>
      <div class="sub-editor" id="sub-editor">${(t.subactions || []).map((s) => subRow(s)).join('')}</div>
      <button type="button" class="btn small ghost" data-act="add-sub-row">${icon('plus')}Ajouter une sous-action</button></div>

    <div class="sheet-actions spread">
      ${task ? `<button type="button" class="btn ghost danger-text" data-act="delete-task" data-id="${task.id}">${icon('trash')}${rec ? 'Supprimer la série' : 'Supprimer'}</button>` : '<span></span>'}
      ${task && !rec && preset.organize ? `<button type="button" class="btn ghost" data-act="task-convert" data-id="${task.id}">Autre rubrique…</button>` : ''}
      <button class="btn primary">${icon('check')}Enregistrer</button>
    </div>
  </form>`;
}
export function subRow(s = {}) {
  return `<div class="sub-row"><input type="hidden" name="subid" value="${esc(s.id || '')}"><input type="hidden" name="subdone" value="${s.done ? '1' : ''}">
    <input name="sub" value="${esc(s.title || '')}" maxlength="160" placeholder="Ex. Préparer les outils" aria-label="Sous-action">
    <button type="button" class="icon-btn" data-act="rm-row" aria-label="Retirer">${icon('x')}</button></div>`;
}

export function occForm(key) {
  const i = findItem(key);
  return `<form data-form="occ" class="stack">
    <input type="hidden" name="key" value="${esc(key)}">
    <p class="hint">Modification de l’occurrence du ${esc(L.fmtLongDate(i.occDate))} uniquement. La série n’est pas modifiée.</p>
    <label class="field"><span class="label">Titre</span><input name="title" required maxlength="160" value="${esc(i.title)}"></label>
    <label class="field"><span class="label">Date</span><input type="date" name="date" value="${esc(i.date)}" required></label>
    <div class="field"><span class="label">Responsable</span>${radio('assignee', ASSIGN, i.assignee || '')}</div>
    <div class="field"><span class="label">Priorité</span>${radio('priority', PRIO, i.priority)}</div>
    <label class="field"><span class="label">Durée estimée (min)</span><input type="number" name="duration" min="1" max="1440" value="${i.durationIsDefault ? '' : i.duration}" placeholder="≈ ${i.duration} min (estimation)"></label>
    <label class="field"><span class="label">Note pour cette fois (facultatif)</span><textarea name="description" rows="2">${esc(i.description || '')}</textarea></label>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('check')}Enregistrer</button></div>
  </form>`;
}

export function convertChooser(id) {
  return `<p>Déplacer cet élément vers une autre rubrique :</p><div class="choice-list">
    ${[['courses', 'cart', 'Liste de courses'], ['repas', 'utensils', 'Idée de repas'], ['projet', 'flag', 'Projet']].map(([k, ic, lab]) => `<button class="choice" data-act="task-convert-do" data-id="${id}" data-to="${k}">${icon(ic)}<span><strong>${lab}</strong></span></button>`).join('')}</div>`;
}

// ------------------------------------------------------------- répartition
export function distForm(range = 'week', mode = 'auto') {
  return `<form data-form="dist" class="stack">
    <div class="field"><span class="label">Période</span>${radio('range', { today: 'Aujourd’hui', week: 'Jusqu’à dimanche', next: 'Semaine prochaine' }, range, 'seg wrap')}</div>
    <div class="field"><span class="label">Que faut-il répartir ?</span>
      <div class="choice-radio">
        <label><input type="radio" name="mode" value="auto" ${mode === 'auto' ? 'checked' : ''}><span><strong>Les tâches sans responsable</strong><span class="muted small">et celles attribuées automatiquement à une personne devenue absente</span></span></label>
        <label><input type="radio" name="mode" value="rebalance" ${mode === 'rebalance' ? 'checked' : ''}><span><strong>Recalculer les attributions automatiques</strong><span class="muted small">les attributions manuelles sont conservées</span></span></label>
        <label><input type="radio" name="mode" value="full" ${mode === 'full' ? 'checked' : ''}><span><strong>Tout rééquilibrer</strong><span class="muted small">y compris les attributions manuelles</span></span></label>
      </div></div>
    <div class="sheet-actions"><button class="btn primary">${icon('scale')}Calculer la proposition</button></div>
  </form><div id="dist-preview"></div>`;
}
export function distPreview(plan) {
  const ACT = { assign: 'Attribuer', replan: 'À replanifier', postpone: 'Reporter', skip: 'Passer' };
  const changed = plan.proposals.filter((p) => p.changed);
  return `<div class="preview">
    <h3>Proposition (${changed.length} changement${changed.length > 1 ? 's' : ''})</h3>
    <div class="totals">${L.PEOPLE.map((p) => `<div class="sub-card p-${p}"><strong>${P[p]}</strong><span>${Math.round(plan.load[p])} min prévues</span><span class="muted small">sur ${plan.weekCap[p]} min disponibles</span></div>`).join('')}</div>
    ${plan.warnings.length ? `<div class="notice warn">${icon('alert')}<div><strong>Attributions manuelles incompatibles</strong>${plan.warnings.map((w) => `<p>${esc(w.text)}</p>`).join('')}<p class="small">Elles sont conservées. Choisissez « Tout rééquilibrer » pour les modifier.</p></div></div>` : ''}
    ${plan.proposals.length ? `<form data-form="dist-apply" class="stack">
      ${plan.proposals.map((p, k) => `<label class="proposal ${p.changed ? '' : 'same'}"><input type="checkbox" name="pick" value="${k}" ${p.changed ? 'checked' : ''}>
        <span class="grow"><strong>${esc(p.item.title)}</strong>
          <span class="small">${esc(L.fmtShort(p.item.date))} · ${p.item.duration} min · <b>${ACT[p.action]}${p.person ? ' → ' + P[p.person] : ''}${p.toDate ? ' le ' + esc(L.fmtShort(p.toDate)) : ''}</b>${p.changed ? '' : ' (inchangé)'}</span>
          <span class="muted small">${esc(p.reason)}</span></span></label>`).join('')}
      <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('check')}Appliquer la sélection</button></div>
    </form>` : '<p class="muted">Rien à répartir sur cette période.</p>'}
  </div>`;
}

// ------------------------------------------------------------- projets et boîte de réception
export function projectForm(p = null, preset = {}) {
  return `<form data-form="project" class="stack">
    <input type="hidden" name="id" value="${esc(p?.id || '')}"><input type="hidden" name="inbox" value="${esc(preset.inboxId || '')}">
    <label class="field"><span class="label">Objectif du projet</span><input name="title" required maxlength="160" value="${esc(p?.title || preset.title || '')}" autofocus placeholder="Ex. Organiser la chambre"></label>
    <label class="field"><span class="label">Description (facultatif)</span><textarea name="description" rows="2">${esc(p?.description || preset.note || '')}</textarea></label>
    <div class="field"><span class="label">Statut</span>${radio('status', { idee: 'Idée', actif: 'En cours', termine: 'Terminé' }, p?.status || preset.status || 'actif')}</div>
    <div class="sheet-actions spread">${p ? `<button type="button" class="btn ghost danger-text" data-act="delete-project" data-id="${p.id}">${icon('trash')}Supprimer</button>` : '<span></span>'}
      <button class="btn primary">${icon('check')}Enregistrer</button></div></form>`;
}
export function inboxEditForm(x) {
  const types = Object.fromEntries(Object.entries(INBOX_TYPES).map(([k, [lab, ic]]) => [k, `${icon(ic)}${lab}`]));
  return `<form data-form="inbox-edit" class="stack"><input type="hidden" name="id" value="${x.id}">
    <label class="field"><span class="label">Titre</span><input name="title" required maxlength="160" value="${esc(x.title)}"></label>
    <div class="field"><span class="label">Rubrique</span>${radio('type', types, x.type, 'seg wrap types')}</div>
    <label class="field"><span class="label">Note</span><input name="note" maxlength="300" value="${esc(x.note || '')}"></label>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`;
}

// ------------------------------------------------------------- repas
export function mealForm(date, slot, preset = {}) {
  const m = st.meals.find((x) => x.meal_date === date && x.slot === slot);
  const rs = [...st.recipes].sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'fr'));
  return `<form data-form="meal" class="stack" data-nomeal="${m?.no_meal ? 1 : 0}">
    <input type="hidden" name="date" value="${date}"><input type="hidden" name="slot" value="${slot}"><input type="hidden" name="inbox" value="${esc(preset.inboxId || '')}">
    <label class="check-line"><input type="checkbox" name="no_meal" ${m?.no_meal ? 'checked' : ''}><span>Pas de repas à prévoir</span></label>
    <div class="meal-fields">
      <label class="field"><span class="label">Idée de repas</span><select name="recipe"><option value="">— Saisie libre —</option>${rs.map((r) => `<option value="${r.id}" ${(m?.recipe_id || preset.recipeId) === r.id ? 'selected' : ''}>${r.favorite ? '★ ' : ''}${esc(r.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="label">Ou nom du repas</span><input name="title" maxlength="120" value="${esc(m?.title || preset.title || '')}" placeholder="Ex. Restes, pizza maison…"></label>
      <label class="check-line"><input type="checkbox" name="save_recipe"><span>Ajouter aussi ce nom aux idées de repas</span></label>
      <label class="field"><span class="label">Nombre de personnes</span><input type="number" name="servings" min="1" max="50" value="${m?.servings || 2}" inputmode="numeric"></label>
    </div>
    <label class="field"><span class="label">Notes (facultatif)</span><input name="notes" maxlength="200" value="${esc(m?.notes || '')}"></label>
    <div class="sheet-actions spread">${m ? `<button type="button" class="btn ghost danger-text" data-act="meal-clear" data-id="${m.id}">${icon('trash')}Retirer</button>` : '<span></span>'}
      <button class="btn primary">${icon('check')}Enregistrer</button></div></form>`;
}
export function mealMoveForm(m) {
  const ws = L.startOfWeek(m.meal_date);
  const days = Object.fromEntries(L.rangeDates(L.addDays(ws, -7), L.addDays(ws, 13)).map((d) => [d, L.fmtLongDate(d)]));
  return `<form data-form="meal-move" class="stack"><input type="hidden" name="id" value="${m.id}">
    <p>Déplacer « ${esc(mealTitle(m))} ». Si le créneau choisi est déjà pris, les deux repas sont échangés.</p>
    <label class="field"><span class="label">Jour</span><select name="date">${opts(days, m.meal_date)}</select></label>
    <div class="field"><span class="label">Repas</span>${radio('slot', { dejeuner: 'Déjeuner', diner: 'Dîner' }, m.slot)}</div>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('move')}Déplacer</button></div></form>`;
}
export function recipePlanForm(r) {
  const t = today();
  return `<form data-form="recipe-plan" class="stack"><input type="hidden" name="recipe" value="${r.id}">
    <label class="field"><span class="label">Jour</span><input type="date" name="date" value="${t}" required></label>
    <div class="field"><span class="label">Repas</span>${radio('slot', { dejeuner: 'Déjeuner', diner: 'Dîner' }, 'diner')}</div>
    <label class="field"><span class="label">Nombre de personnes</span><input type="number" name="servings" min="1" max="50" value="${r.servings}"></label>
    <div class="sheet-actions"><button class="btn primary">${icon('calendar')}Planifier</button></div></form>`;
}
export function recipeForm(r = null, preset = {}) {
  const ings = r?.ingredients?.length ? r.ingredients : [{}, {}, {}];
  return `<form data-form="recipe" class="stack"><input type="hidden" name="id" value="${esc(r?.id || '')}"><input type="hidden" name="inbox" value="${esc(preset.inboxId || '')}">
    <label class="field"><span class="label">Nom</span><input name="name" required maxlength="120" value="${esc(r?.name || preset.title || '')}" autofocus></label>
    <div class="grid2">
      <label class="field"><span class="label">Pour (personnes)</span><input type="number" name="servings" min="1" max="50" value="${r?.servings || 2}"></label>
      <label class="field"><span class="label">Préparation (min)</span><input type="number" name="prep" min="0" max="1440" value="${esc(r?.prep_min ?? '')}"></label>
    </div>
    <div class="field"><span class="label">Ingrédients (quantité et unité facultatives)</span>
      <div class="ing-editor" id="ing-editor">${ings.map(ingRow).join('')}</div>
      <button type="button" class="btn small ghost" data-act="add-ing-row">${icon('plus')}Ajouter un ingrédient</button></div>
    <label class="field"><span class="label">Notes</span><textarea name="notes" rows="2">${esc(r?.notes || preset.note || '')}</textarea></label>
    <label class="check-line"><input type="checkbox" name="favorite" ${r?.favorite ? 'checked' : ''}><span>Favori</span></label>
    <div class="sheet-actions spread">${r ? `<button type="button" class="btn ghost danger-text" data-act="recipe-delete" data-id="${r.id}">${icon('trash')}Supprimer</button>` : '<span></span>'}
      <button class="btn primary">${icon('check')}Enregistrer</button></div></form>`;
}
export function ingRow(g = {}) {
  return `<div class="ing-row"><input name="ing" value="${esc(g.name || '')}" placeholder="Ingrédient" aria-label="Ingrédient">
    <input name="ingqty" value="${esc(g.qty ?? '')}" inputmode="decimal" placeholder="Qté" aria-label="Quantité">
    <input name="ingunit" value="${esc(g.unit || '')}" placeholder="Unité" aria-label="Unité" list="units">
    <button type="button" class="icon-btn" data-act="rm-row" aria-label="Retirer">${icon('x')}</button></div>`;
}

export function ingredientsCheck(lines) {
  return `<p class="muted small">Vérifiez la sélection : les ingrédients identiques sont regroupés, et l’inventaire est pris en compte.</p>
  <form data-form="ing-shop" class="stack">
    ${lines.map((l, k) => `<div class="ing-check ${l.check.status}">
      <label class="check-line"><input type="checkbox" name="pick" value="${k}" ${l.check.select ? 'checked' : ''}><span><strong>${esc(l.name)}</strong><span class="muted small">${esc(l.check.label)}${l.unknownQty ? ' · quantité non précisée pour une recette' : ''}</span>
        <span class="muted small">${esc(l.sources.join(', '))}</span></span></label>
      <div class="ing-inputs"><input name="qty${k}" value="${esc(l.check.qty ?? '')}" inputmode="decimal" placeholder="Qté" aria-label="Quantité">
        <input name="unit${k}" value="${esc(l.check.unit ?? l.unit ?? '')}" placeholder="Unité" aria-label="Unité">
        <select name="cat${k}" aria-label="Catégorie">${opts(L.SHOP_CATEGORIES, l.category)}</select></div></div>`).join('')}
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('cart')}Ajouter la sélection</button></div>
  </form>`;
}

// ------------------------------------------------------------- courses & inventaire
export function shopEditForm(x) {
  return `<form data-form="shop-edit" class="stack"><input type="hidden" name="id" value="${x.id}">
    <label class="field"><span class="label">Produit</span><input name="name" required maxlength="120" value="${esc(x.name)}"></label>
    <div class="grid2"><label class="field"><span class="label">Quantité</span><input name="qty" inputmode="decimal" value="${esc(x.qty ?? '')}"></label>
      <label class="field"><span class="label">Unité</span><input name="unit" value="${esc(x.unit || '')}" list="units"></label></div>
    <label class="field"><span class="label">Catégorie</span><select name="category">${opts(L.SHOP_CATEGORIES, x.category)}</select></label>
    <label class="field"><span class="label">Note</span><input name="note" maxlength="200" value="${esc(x.note || '')}"></label>
    <div class="sheet-actions spread"><button type="button" class="btn ghost danger-text" data-act="shop-delete" data-id="${x.id}">${icon('trash')}Supprimer</button>
      <button class="btn primary">${icon('check')}Enregistrer</button></div></form>`;
}
export function stowForm(items) {
  const locs = locations();
  return `<p class="muted small">Vérifiez les quantités avant de les ajouter à l’inventaire. Les produits déjà présents au même endroit sont complétés.</p>
  <form data-form="stow" class="stack">${items.map((x, k) => `<div class="ing-check">
    <label class="check-line"><input type="checkbox" name="pick" value="${k}" checked><span><strong>${esc(x.name)}</strong></span></label>
    <div class="ing-inputs"><input name="qty${k}" value="${esc(x.qty ?? 1)}" inputmode="decimal" aria-label="Quantité" placeholder="Qté">
      <input name="unit${k}" value="${esc(x.unit || '')}" aria-label="Unité" placeholder="Unité" list="units">
      <select name="loc${k}" aria-label="Emplacement">${opts(locs, guessLocation(x))}</select>
      <input type="date" name="exp${k}" aria-label="Date de péremption (facultatif)" title="Péremption (facultatif)"></div></div>`).join('')}
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="close-sheet">Annuler</button><button class="btn primary">${icon('box')}Ranger</button></div></form>`;
}
function guessLocation(x) {
  if (['frais', 'proteines'].includes(x.category)) return 'frigo';
  return 'placards';
}
export function invForm(x = null, preset = {}) {
  const locs = locations();
  return `<form data-form="inv" class="stack"><input type="hidden" name="id" value="${esc(x?.id || '')}">
    <label class="field"><span class="label">Produit</span><input name="name" required maxlength="120" value="${esc(x?.name || preset.name || '')}" ${x ? '' : 'autofocus'}></label>
    <div class="grid2"><label class="field"><span class="label">Quantité</span><input name="qty" inputmode="decimal" value="${esc(x?.qty ?? '')}"></label>
      <label class="field"><span class="label">Unité</span><input name="unit" value="${esc(x?.unit || '')}" list="units"></label></div>
    <div class="grid2"><label class="field"><span class="label">Emplacement</span><select name="location">${opts(locs, x?.location || (ui_stockLoc() !== 'tous' ? ui_stockLoc() : 'placards'))}</select></label>
      <label class="field"><span class="label">Catégorie</span><select name="category">${opts(L.SHOP_CATEGORIES, x?.category || 'autre')}</select></label></div>
    <div class="grid2"><label class="field"><span class="label">Péremption (facultatif)</span><input type="date" name="expires" value="${esc(x?.expires_on || '')}"></label>
      <label class="field"><span class="label">Seuil de stock bas (facultatif)</span><input name="low" inputmode="decimal" value="${esc(x?.low_threshold ?? '')}" placeholder="Ex. 1"></label></div>
    <div class="sheet-actions spread">${x ? `<button type="button" class="btn ghost danger-text" data-act="inv-delete" data-id="${x.id}">${icon('trash')}Supprimer</button>` : '<span></span>'}
      <button class="btn primary">${icon('check')}Enregistrer</button></div></form>`;
}
let stockLocRef = () => 'tous';
export function setStockLocRef(fn) { stockLocRef = fn; }
function ui_stockLoc() { return stockLocRef(); }

export function moreSheet(counts) {
  const items = [['#/inbox', 'inbox', 'À organiser', counts.inbox], ['#/stock', 'box', 'Inventaire', counts.stock], ['#/dispos', 'calendar', 'Disponibilités et répartition', 0], ['#/foyer', 'users', 'Foyer et compte', 0]];
  return `<div class="choice-list">${items.map(([h, ic, lab, n]) => `<a class="choice" href="${h}" data-act="close-sheet">${icon(ic)}<span><strong>${lab}</strong></span>${n ? `<span class="badge">${n}</span>` : ''}</a>`).join('')}</div>`;
}
