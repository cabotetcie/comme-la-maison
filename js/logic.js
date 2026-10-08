// =====================================================================
//  Le QG — logique métier pure (aucun accès réseau ni DOM).
//  Toutes les dates sont des chaînes « AAAA-MM-JJ » exprimées dans le
//  fuseau Europe/Paris.
// =====================================================================

export const TZ = 'Europe/Paris';
export const PEOPLE = ['ilona', 'adrien'];
export const PERSON_LABEL = { ilona: 'Ilona', adrien: 'Adrien', both: 'Les deux' };
export const ABSENT_LABEL = { ilona: 'absente', adrien: 'absent' };

export const CATEGORIES = {
  menage: 'Ménage', lessive: 'Lessive', rangement: 'Rangement', repassage: 'Repassage',
  entretien: 'Entretien et réparations', administratif: 'Administratif', achats: 'Achats maison', autre: 'Autre',
};
export const DEFAULT_DURATION = {
  menage: 20, lessive: 15, rangement: 15, repassage: 30, entretien: 30, administratif: 20, achats: 30, autre: 15,
};
export const ACTION_DEFAULT_DURATION = 5;
export const KINDS = { tache: 'Tâche', action: 'Action rapide' };

export const PRIORITIES = {
  basse:   { label: 'Basse',   icon: '▽', rank: 0 },
  normale: { label: 'Normale', icon: '◇', rank: 1 },
  haute:   { label: 'Haute',   icon: '▲', rank: 2 },
  urgente: { label: 'Urgente', icon: '!!', rank: 3 },
};
export const STATUS = {
  a_organiser: 'À organiser', a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé',
  a_replanifier: 'À replanifier', saute: 'Passée',
};

export const SHOP_CATEGORIES = {
  fruits_legumes: 'Fruits et légumes', frais: 'Produits frais', proteines: 'Viandes, poissons et alternatives',
  epicerie_salee: 'Épicerie salée', epicerie_sucree: 'Épicerie sucrée', boissons: 'Boissons',
  entretien: 'Entretien et maison', hygiene: 'Hygiène', autre: 'Autre',
};
export const DEFAULT_LOCATIONS = { placards: 'Placards', frigo: 'Réfrigérateur', congelateur: 'Congélateur' };
export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const WEEKDAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

// ---------------------------------------------------------------- dates
const fmtISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export function todayISO(now = new Date()) { return fmtISO.format(now); }
export function toDate(iso) { return new Date(iso + 'T12:00:00Z'); }
export function fromDate(d) { return d.toISOString().slice(0, 10); }
export function addDays(iso, n) { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return fromDate(d); }
/** nombre de jours de a vers b (b - a) */
export function diffDays(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }
export function isoDow(iso) { const g = toDate(iso).getUTCDay(); return g === 0 ? 7 : g; }
export function startOfWeek(iso) { return addDays(iso, 1 - isoDow(iso)); }
export function rangeDates(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
function daysInMonth(iso) { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

const fmtLong = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtShortI = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const fmtDM = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function fmtLongDate(iso) { return cap1(fmtLong.format(toDate(iso))); }
export function fmtShort(iso) { return iso ? fmtShortI.format(toDate(iso)) : ''; }
export function fmtDayMonth(iso) { return iso ? fmtDM.format(toDate(iso)) : ''; }
export function relativeDay(iso, today) {
  const n = diffDays(today, iso);
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  return fmtShort(iso);
}

// ---------------------------------------------------------- récurrences
export function occursOn(rec, iso) {
  if (!rec || !rec.freq) return false;
  const start = rec.start || iso;
  if (iso < start) return false;
  if (rec.until && iso > rec.until) return false;
  const iv = Math.max(1, Number(rec.interval) || 1);
  switch (rec.freq) {
    case 'daily': return diffDays(start, iso) % iv === 0;
    case 'weekly': {
      const days = rec.days && rec.days.length ? rec.days.map(Number) : [isoDow(start)];
      if (!days.includes(isoDow(iso))) return false;
      const weeks = diffDays(startOfWeek(start), startOfWeek(iso)) / 7;
      return weeks % iv === 0;
    }
    case 'monthly': {
      const months = (+iso.slice(0, 4) - +start.slice(0, 4)) * 12 + (+iso.slice(5, 7) - +start.slice(5, 7));
      if (months % iv !== 0) return false;
      return +iso.slice(8) === Math.min(+start.slice(8), daysInMonth(iso));
    }
    default: return false;
  }
}
export function nextOccurrence(rec, afterIso, maxDays = 400) {
  for (let k = 1; k <= maxDays; k++) { const d = addDays(afterIso, k); if (occursOn(rec, d)) return d; }
  return null;
}
export function describeRecurrence(rec) {
  if (!rec || !rec.freq) return 'Ponctuelle';
  const iv = Math.max(1, Number(rec.interval) || 1);
  if (rec.freq === 'daily') return iv === 1 ? 'Tous les jours' : `Tous les ${iv} jours`;
  if (rec.freq === 'monthly') return (iv === 1 ? 'Chaque mois' : `Tous les ${iv} mois`) + ` le ${+rec.start.slice(8)}`;
  const days = (rec.days && rec.days.length ? rec.days : [isoDow(rec.start)]).map(Number).sort();
  const names = days.length === 7 ? 'tous les jours' : days.map((d) => WEEKDAYS[d - 1].toLowerCase()).join(', ');
  if (iv === 1) return days.length === 7 ? 'Tous les jours' : `Chaque ${names}`;
  if (iv === 2) return `Une semaine sur deux : ${names} (depuis le ${fmtDayMonth(rec.start)})`;
  return `Toutes les ${iv} semaines : ${names}`;
}

// ------------------------------------------------------- items du planning
export function defaultDuration(task) {
  return task.kind === 'action' ? ACTION_DEFAULT_DURATION : (DEFAULT_DURATION[task.category] || 15);
}
export function effectiveDuration(task, ov = {}) {
  const v = ov.duration_min ?? task.duration_min;
  return v ? { min: v, isDefault: false } : { min: defaultDuration(task), isDefault: true };
}

/** Construit l'élément affichable d'une tâche (ponctuelle) ou d'une occurrence (récurrente). */
export function makeItem(task, occ, date) {
  const recurring = !!task.recurrence;
  const ov = (occ && occ.override) || {};
  const dur = effectiveDuration(task, recurring ? ov : {});
  const occDate = recurring ? (occ ? occ.occ_date : date) : null;
  let assignee, assignSource;
  if (recurring && occ && occ.assignee) { assignee = occ.assignee; assignSource = occ.assign_source || 'manual'; }
  else { assignee = task.assignee || null; assignSource = task.assignee ? task.assign_mode : null; }
  const subdone = ov.subdone || [];
  return {
    key: recurring ? `${task.id}|${occDate}` : task.id,
    taskId: task.id, task, occ: occ || null, recurring, occDate,
    date, kind: task.kind || 'tache',
    title: (recurring && ov.title) || task.title,
    description: recurring && ov.description != null ? ov.description : task.description,
    category: task.category,
    priority: (recurring && ov.priority) || task.priority || 'normale',
    duration: dur.min, durationIsDefault: dur.isDefault,
    assignee, assignSource,
    status: recurring ? ((occ && occ.status) || 'a_faire') : task.status,
    dueDate: task.due_date || null, projectId: task.project_id || null,
    subactions: (task.subactions || []).map((s) => ({ ...s, done: recurring ? subdone.includes(s.id) : !!s.done })),
  };
}

export function occIndex(occurrences) {
  const m = new Map();
  for (const o of occurrences) m.set(o.task_id + '|' + o.occ_date, o);
  return m;
}

const HIDDEN_SINGLE = ['a_organiser', 'a_replanifier'];

/** Éléments prévus jour par jour entre from et to (inclus). Une occurrence reportée apparaît uniquement à sa nouvelle date. */
export function itemsInRange(tasks, occurrences, from, to) {
  const idx = occIndex(occurrences);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = [];
  for (const t of tasks) {
    if (t.recurrence) {
      for (const d of rangeDates(from, to)) {
        if (!occursOn(t.recurrence, d)) continue;
        const o = idx.get(t.id + '|' + d);
        if (o && o.moved_to && o.moved_to !== d) continue;
        out.push(makeItem(t, o, d));
      }
    } else if (t.planned_date && t.planned_date >= from && t.planned_date <= to && !HIDDEN_SINGLE.includes(t.status)) {
      out.push(makeItem(t, null, t.planned_date));
    }
  }
  for (const o of occurrences) {
    if (o.moved_to && o.moved_to !== o.occ_date && o.moved_to >= from && o.moved_to <= to) {
      const t = byId.get(o.task_id);
      if (t && t.recurrence) out.push(makeItem(t, o, o.moved_to));
    }
  }
  return out.filter((i) => i.status !== 'saute' && i.status !== 'a_replanifier');
}

/** Tâches « Cette semaine » (sans jour fixé) pour la semaine commençant le lundi weekStart. */
export function weekItems(tasks, weekStart) {
  return tasks
    .filter((t) => !t.recurrence && !t.planned_date && t.planned_week === weekStart && !HIDDEN_SINGLE.includes(t.status))
    .map((t) => ({ ...makeItem(t, null, null), week: weekStart }));
}

/** Retards : ponctuelles dépassées, semaines passées, occurrences non faites des 7 derniers jours. */
export function overdueItems(tasks, occurrences, today, lookback = 7) {
  const out = [];
  const monday = startOfWeek(today);
  for (const t of tasks) {
    if (t.recurrence || ['termine', ...HIDDEN_SINGLE].includes(t.status)) continue;
    if (t.planned_date && t.planned_date < today) out.push(makeItem(t, null, t.planned_date));
    else if (!t.planned_date && t.planned_week && t.planned_week < monday) out.push({ ...makeItem(t, null, null), week: t.planned_week });
  }
  const recTasks = tasks.filter((t) => t.recurrence);
  for (const i of itemsInRange(recTasks, occurrences, addDays(today, -lookback), addDays(today, -1))) {
    if (i.status !== 'termine') out.push(i);
  }
  return out.sort((a, b) => (a.date || a.week || '').localeCompare(b.date || b.week || ''));
}

export function replanItems(tasks, occurrences) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = tasks.filter((t) => !t.recurrence && t.status === 'a_replanifier').map((t) => makeItem(t, null, t.planned_date));
  for (const o of occurrences) {
    if (o.status !== 'a_replanifier') continue;
    const t = byId.get(o.task_id);
    if (t && t.recurrence) out.push({ ...makeItem(t, o, o.moved_to || o.occ_date), status: 'a_replanifier' });
  }
  return out;
}

export function isFor(item, person) { return item.assignee === person || item.assignee === 'both'; }

/** Progression : tâches terminées / tâches prévues. Les sous-actions ne comptent pas. */
export function progress(items, person = null) {
  const list = person ? items.filter((i) => isFor(i, person)) : items;
  const seen = new Set();
  const uniq = list.filter((i) => (seen.has(i.key) ? false : seen.add(i.key)));
  const done = uniq.filter((i) => i.status === 'termine').length;
  return { done, total: uniq.length, pct: uniq.length ? Math.round((done * 100) / uniq.length) : 0 };
}
export function progressLabel(p) {
  if (!p.total) return 'Rien de prévu aujourd’hui';
  const s = p.done > 1 ? 's' : '';
  return `${p.done} tâche${s} sur ${p.total} terminée${s}`;
}

export function sortItems(items) {
  return [...items].sort((a, b) =>
    (a.status === 'termine') - (b.status === 'termine')
    || PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank
    || (a.date || '').localeCompare(b.date || '')
    || a.title.localeCompare(b.title, 'fr'));
}

// -------------------------------------------------- disponibilités & répartition
export function capacityFor(person, date, members, availabilities) {
  const m = members.find((x) => x.person === person);
  let cap = m ? m.daily_capacity_min ?? 60 : 60;
  let absent = false; let note = null;
  for (const a of availabilities) {
    if (a.person !== person || date < a.start_date || date > a.end_date) continue;
    if (a.kind === 'absent') { absent = true; cap = 0; note = a.note || null; }
    else if (!absent) { cap = Math.min(cap, a.capacity_min ?? 0); note = a.note || null; }
  }
  return { cap, absent, note };
}

function who(a) { return a === 'both' ? PEOPLE : a ? [a] : []; }

/** Attributions incompatibles avec une absence (manuelles ou automatiques déjà en place). */
export function absenceConflicts({ tasks, occurrences, members, availabilities, from, to }) {
  const out = [];
  for (const i of itemsInRange(tasks, occurrences, from, to)) {
    if (i.status === 'termine' || !i.assignee) continue;
    for (const p of who(i.assignee)) {
      if (capacityFor(p, i.date, members, availabilities).absent) {
        out.push({
          key: i.key, item: i, person: p, manual: i.assignSource === 'manual',
          text: `« ${i.title} » est attribuée à ${PERSON_LABEL[p]} le ${fmtShort(i.date)}, mais ${PERSON_LABEL[p]} est ${ABSENT_LABEL[p]} ce jour-là.`,
        });
      }
    }
  }
  return out;
}

/**
 * Propose une répartition sur [from, to].
 * mode 'auto'      : seulement les tâches sans responsable (+ attributions automatiques devenues incompatibles)
 * mode 'rebalance' : recalcule aussi les attributions automatiques ; garde les manuelles
 * mode 'full'      : rééquilibrage explicite, y compris les attributions manuelles
 */
export function planDistribution({ tasks, occurrences, members, availabilities, from, to, today, mode = 'auto' }) {
  const start = from < today ? today : from;
  const items = itemsInRange(tasks, occurrences, start, to).filter((i) => i.status !== 'termine');
  const capCache = {};
  const cap = (p, d) => capCache[p + '|' + d] || (capCache[p + '|' + d] = capacityFor(p, d, members, availabilities));
  const weekCap = { ilona: 0, adrien: 0 };
  for (const d of rangeDates(start, to)) for (const p of PEOPLE) weekCap[p] += cap(p, d).cap;
  const dayLoad = {}; const load = { ilona: 0, adrien: 0 };
  const dl = (p, d) => dayLoad[p + '|' + d] || 0;
  const addLoad = (p, d, m, inRange = true) => { dayLoad[p + '|' + d] = dl(p, d) + m; if (inRange) load[p] += m; };
  const anyAbsent = (i) => who(i.assignee).some((p) => cap(p, i.date).absent);
  const isFixed = (i) => {
    if (!i.assignee) return false;
    if (i.assignSource === 'manual') return mode !== 'full';
    return mode === 'auto' ? !anyAbsent(i) : false;
  };
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date)
    || PRIORITIES[b.priority].rank - PRIORITIES[a.priority].rank || b.duration - a.duration);

  const warnings = [];
  for (const i of sorted) {
    if (!isFixed(i)) continue;
    for (const p of who(i.assignee)) {
      addLoad(p, i.date, i.duration);
      if (i.assignSource === 'manual' && cap(p, i.date).absent) {
        warnings.push({ key: i.key, text: `« ${i.title} » est attribuée manuellement à ${PERSON_LABEL[p]} le ${fmtShort(i.date)}, mais ${PERSON_LABEL[p]} est ${ABSENT_LABEL[p]}.` });
      }
    }
  }
  // charge déjà prévue après la période (pour les reports)
  for (const i of itemsInRange(tasks, occurrences, addDays(to, 1), addDays(to, 14))) {
    if (i.assignee && i.status !== 'termine') for (const p of who(i.assignee)) addLoad(p, i.date, i.duration, false);
  }
  // mémoire d'alternance
  const last = {};
  for (const o of occurrences) {
    if (o.assignee && o.assignee !== 'both' && o.occ_date < start && (!last[o.task_id] || last[o.task_id].d < o.occ_date)) {
      last[o.task_id] = { d: o.occ_date, p: o.assignee };
    }
  }

  const proposals = [];
  for (const i of sorted) {
    if (isFixed(i)) { if (i.recurring && i.assignee !== 'both') last[i.taskId] = { d: i.date, p: i.assignee }; continue; }
    const base = { key: i.key, item: i, from: i.assignee || null };
    const present = PEOPLE.filter((p) => !cap(p, i.date).absent);
    if (!present.length) {
      proposals.push({ ...base, action: 'replan', reason: 'Ilona et Adrien sont absents ce jour-là : à replanifier.' });
      continue;
    }
    const urgent = PRIORITIES[i.priority].rank >= 2 || (i.dueDate && i.dueDate <= i.date);
    const prev = i.recurring ? last[i.taskId]?.p : null;
    const alternate = i.recurring && i.task.recurrence?.alternate !== false;
    const scored = present.map((p) => {
      const c = cap(p, i.date).cap;
      const over = dl(p, i.date) + i.duration > c;
      let s = (load[p] + i.duration) / Math.max(weekCap[p], 1) + (over ? 1 : 0);
      const m = members.find((x) => x.person === p);
      const notes = [];
      if (m?.preferred_categories?.includes(i.category)) { s -= 0.15; notes.push(`préférence de ${PERSON_LABEL[p]}`); }
      if (m?.avoided_categories?.includes(i.category)) s += 0.25;
      if (alternate && present.length === 2 && prev === p) s += 0.2;
      return { p, s, over, notes };
    }).sort((a, b) => a.s - b.s);
    const best = scored[0];

    if (best.over && !urgent) {
      let target = null;
      for (let k = 1; k <= 14 && !target; k++) {
        const d2 = addDays(i.date, k);
        if (i.dueDate && d2 > i.dueDate) break;
        for (const p of PEOPLE) {
          const c = cap(p, d2);
          if (!c.absent && dl(p, d2) + i.duration <= c.cap) { target = { d: d2, p }; break; }
        }
      }
      if (i.recurring) {
        const next = nextOccurrence(i.task.recurrence, i.date);
        if (target && next && target.d >= next) target = null;
        if (!target && next) {
          proposals.push({ ...base, action: 'skip', reason: `Pas assez de temps disponible ce jour-là ; prochaine occurrence ${fmtShort(next)}.` });
          continue;
        }
      }
      if (target) {
        addLoad(target.p, target.d, i.duration, target.d <= to);
        proposals.push({ ...base, action: 'postpone', person: target.p, toDate: target.d,
          reason: `Journée déjà chargée : report au ${fmtShort(target.d)}, ${PERSON_LABEL[target.p]} a du temps.` });
        continue;
      }
    }

    addLoad(best.p, i.date, i.duration);
    if (i.recurring) last[i.taskId] = { d: i.date, p: best.p };
    const parts = [];
    if (present.length === 1) {
      const other = PEOPLE.find((p) => p !== best.p);
      parts.push(`${PERSON_LABEL[other]} ${ABSENT_LABEL[other]}`);
    } else {
      parts.push(`équilibre du temps (Ilona ${Math.round(load.ilona)} min · Adrien ${Math.round(load.adrien)} min)`);
      if (alternate && prev && prev !== best.p) parts.push('alternance avec la fois précédente');
    }
    parts.push(...best.notes);
    if (best.over) parts.push('dépasse le temps disponible ce jour-là');
    proposals.push({ ...base, action: 'assign', person: best.p, reason: cap1(parts.join(' ; ')) + '.' });
  }
  for (const pr of proposals) pr.changed = pr.action !== 'assign' || pr.person !== pr.item.assignee;
  return { proposals, warnings, load, weekCap, from: start, to };
}

// ---------------------------------------------------- courses & inventaire
export function norm(s) {
  return String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}
/** Clé de rapprochement des produits (accents, casse, pluriel simple). */
export function nameKey(s) {
  return norm(s).split(' ').map((w) => (w.length > 3 && /[sx]$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
}
const UNIT_ALIASES = {
  g: ['g', 'gr', 'gramme', 'grammes'], kg: ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'], mg: ['mg'],
  ml: ['ml', 'millilitre', 'millilitres'], cl: ['cl', 'centilitre', 'centilitres'], dl: ['dl'],
  l: ['l', 'litre', 'litres', 'lt'], pc: ['', 'pc', 'pcs', 'piece', 'pieces', 'u', 'unite', 'unites', 'x'],
};
const BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000], pc: ['pc', 1] };
const EXTRA_UNITS = ['boite', 'boites', 'sachet', 'sachets', 'paquet', 'paquets', 'bouteille', 'bouteilles', 'pot', 'pots',
  'tranche', 'tranches', 'botte', 'bottes', 'brique', 'briques', 'cs', 'cc', 'gousse', 'gousses', 'rouleau', 'rouleaux', 'boite(s)'];
export function normUnit(u) {
  const n = norm(u).replace(/\.$/, '');
  for (const [k, list] of Object.entries(UNIT_ALIASES)) if (list.includes(n)) return k;
  return n.replace(/s$/, '');
}
export function isKnownUnit(u) { const n = norm(u).replace(/\.$/, ''); return Object.values(UNIT_ALIASES).some((l) => l.includes(n) && n) || EXTRA_UNITS.includes(n); }
export function toBase(qty, unit) {
  const u = normUnit(unit); const b = BASE[u];
  const q = qty == null || qty === '' ? null : Number(qty);
  return b ? { qty: q == null ? null : q * b[1], unit: b[0] } : { qty: q, unit: u };
}
export function compatibleUnits(u1, u2) { return toBase(1, u1).unit === toBase(1, u2).unit; }
export function fromBase(qty, baseUnit) {
  if (qty == null) return { qty: null, unit: baseUnit === 'pc' ? '' : baseUnit };
  if (baseUnit === 'g' && qty >= 1000) return { qty: round(qty / 1000), unit: 'kg' };
  if (baseUnit === 'ml' && qty >= 1000) return { qty: round(qty / 1000), unit: 'l' };
  return { qty: round(qty), unit: baseUnit === 'pc' ? '' : baseUnit };
}
function round(n) { return Math.round(n * 100) / 100; }
export function fmtQty(qty, unit) {
  if (qty == null || qty === '') return unit ? unit : '';
  const n = String(round(Number(qty))).replace('.', ',');
  return unit ? `${n} ${unit}` : n;
}

/** Fusionne des lignes {name, qty, unit, ...} : même produit + unités compatibles → quantités additionnées. */
export function mergeLines(lines) {
  const groups = [];
  for (const l of lines) {
    const key = nameKey(l.name); const b = toBase(l.qty, l.unit);
    let g = groups.find((x) => x.key === key && x.baseUnit === b.unit);
    if (!g) {
      g = { key, name: l.name.trim(), baseUnit: b.unit, qty: null, unknownQty: false, category: l.category || null, sources: [], units: new Set() };
      groups.push(g);
    }
    if (b.qty == null) g.unknownQty = true; else { g.qty = (g.qty || 0) + b.qty; g.units.add(String(l.unit || '').trim()); }
    if (l.source) g.sources.push(l.source);
  }
  return groups.map(({ units, ...g }) => {
    // une seule unité d'origine : on la conserve (40 cl reste 40 cl)
    if (g.qty != null && units.size === 1) { const u = [...units][0]; return { ...g, qty: round(g.qty / toBase(1, u).qty), unit: u }; }
    const f = fromBase(g.qty, g.baseUnit); return { ...g, qty: f.qty, unit: f.unit };
  });
}

/** Compare un besoin à l'inventaire : absent, enough, partial (manque), present (quantités non comparables). */
export function inventoryCheck(line, inventory) {
  const inv = inventory.filter((x) => nameKey(x.name) === nameKey(line.name));
  if (!inv.length) return { status: 'absent', select: true, qty: line.qty, label: 'Pas dans l’inventaire' };
  const need = toBase(line.qty, line.unit);
  const comparable = inv.filter((x) => x.qty != null && compatibleUnits(x.unit, line.unit));
  const stockTxt = inv.map((x) => fmtQty(x.qty, x.unit) || 'quantité non précisée').join(' + ');
  if (need.qty == null || !comparable.length) return { status: 'present', select: false, qty: line.qty, label: `Déjà en stock : ${stockTxt}` };
  const have = comparable.reduce((s, x) => s + toBase(x.qty, x.unit).qty, 0);
  if (have >= need.qty) return { status: 'enough', select: false, qty: line.qty, label: `Assez en stock : ${stockTxt}` };
  const miss = fromBase(need.qty - have, need.unit);
  return { status: 'partial', select: true, qty: miss.qty, unit: miss.unit, label: `En stock : ${stockTxt} — il manque ${fmtQty(miss.qty, miss.unit)}` };
}

/** Prépare l'ajout de lignes à une liste existante : met à jour les lignes non achetées compatibles, sinon insère. */
export function planMergeInto(newLines, existing, isOpen = (x) => !x.checked && !x.archived) {
  const updates = []; const inserts = [];
  const pool = existing.filter(isOpen).map((x) => ({ ...x }));
  for (const l of newLines) {
    const target = pool.find((x) => nameKey(x.name) === nameKey(l.name) && (
      (x.qty == null && !x.unit) || (l.qty == null && !l.unit) || compatibleUnits(x.unit, l.unit)));
    if (target) {
      let qty = target.qty; let unit = target.unit;
      if (l.qty != null && target.qty != null && compatibleUnits(target.unit, l.unit)) {
        const f = fromBase(toBase(target.qty, target.unit).qty + toBase(l.qty, l.unit).qty, toBase(1, l.unit).unit);
        qty = f.qty; unit = f.unit || null;
      } else if (target.qty == null && l.qty != null) { qty = l.qty; unit = l.unit || null; }
      target.qty = qty; target.unit = unit;
      const u = updates.find((x) => x.id === target.id);
      if (u) Object.assign(u, { qty, unit }); else updates.push({ id: target.id, name: target.name, qty, unit });
    } else {
      inserts.push({ ...l });
      pool.push({ ...l, id: null });
    }
  }
  return { updates, inserts };
}

export function scaleQty(qty, mealServings, recipeServings) {
  if (qty == null || qty === '') return null;
  return round(Number(qty) * (mealServings || 1) / (recipeServings || mealServings || 1));
}

/** Analyse « 2 kg pommes » / « 3 citrons » / « lait ». */
export function parseQuickProduct(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([^\s\d]+)?\s+(.+)$/) || t.match(/^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\s+(.+)$/);
  if (!m) return { name: t, qty: null, unit: null };
  const qty = Number(m[1].replace(',', '.'));
  if (m[2] && isKnownUnit(m[2])) {
    const name = m[3].replace(/^(de |d’|d')/i, '').trim();
    return { name, qty, unit: normUnit(m[2]) === 'pc' ? null : m[2].toLowerCase() };
  }
  return { name: [m[2], m[3]].filter(Boolean).join(' '), qty, unit: null };
}

const CAT_WORDS = [
  ['boissons', ['lait d\'avoine', 'lait de coco', 'lait d\'amande', 'lait de soja', 'eau', 'jus', 'cafe', 'the', 'tisane', 'soda', 'biere', 'vin', 'capsule', 'sirop d\'orgeat']],
  ['fruits_legumes', ['pomme de terre', 'pomme', 'poire', 'banane', 'citron', 'orange', 'tomate', 'carotte', 'oignon', 'ail', 'salade', 'courgette', 'poivron', 'champignon', 'avocat', 'fraise', 'epinard', 'brocoli', 'concombre', 'aubergine', 'persil', 'coriandre', 'basilic', 'gingembre', 'echalote', 'poireau', 'chou', 'patate', 'fruit', 'legume', 'raisin', 'kiwi', 'mangue', 'menthe', 'radis', 'navet', 'courge', 'potiron', 'butternut']],
  ['proteines', ['poulet', 'boeuf', 'porc', 'jambon', 'lardon', 'saumon', 'thon', 'poisson', 'crevette', 'steak', 'dinde', 'viande', 'tofu', 'tempeh', 'seitan', 'saucisse', 'cabillaud', 'oeuf']],
  ['frais', ['lait', 'beurre', 'creme', 'yaourt', 'fromage', 'mozzarella', 'parmesan', 'feta', 'ricotta', 'skyr', 'emmental', 'comte', 'pate feuilletee', 'pate brisee']],
  ['epicerie_salee', ['pate', 'pates', 'riz', 'huile', 'vinaigre', 'sel', 'poivre', 'epice', 'conserve', 'lentille', 'pois chiche', 'sauce', 'moutarde', 'bouillon', 'semoule', 'quinoa', 'haricot', 'coulis', 'curry', 'cumin', 'paprika', 'chapelure', 'olive', 'mais']],
  ['epicerie_sucree', ['sucre', 'chocolat', 'miel', 'confiture', 'biscuit', 'cereale', 'sirop', 'farine', 'levure', 'vanille', 'compote', 'cacao', 'amande', 'noisette']],
  ['entretien', ['papier cuisson', 'papier absorbant', 'essuie-tout', 'lessive', 'liquide vaisselle', 'eponge', 'sac poubelle', 'film', 'aluminium', 'javel', 'nettoyant', 'pastille', 'sopalin', 'adoucissant', 'vinaigre blanc']],
  ['hygiene', ['savon', 'shampoing', 'shampooing', 'dentifrice', 'coton', 'gel douche', 'deodorant', 'rasoir', 'papier toilette', 'brosse a dent', 'creme solaire', 'mouchoir']],
];
export function guessShopCategory(name) {
  const n = ' ' + norm(name) + ' ';
  let best = null; let bestLen = 0;
  for (const [cat, words] of CAT_WORDS) {
    for (const w of words) {
      const re = new RegExp(`[\\s(]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?[\\s)]`);
      if (re.test(n) && w.length > bestLen) { best = cat; bestLen = w.length; }
    }
  }
  return best || 'autre';
}

export function expiryStatus(expires, today, soonDays = 3) {
  if (!expires) return null;
  const n = diffDays(today, expires);
  if (n < 0) return { level: 'expired', label: `Périmé depuis le ${fmtDayMonth(expires)}` };
  if (n === 0) return { level: 'soon', label: 'Périme aujourd’hui' };
  if (n <= soonDays) return { level: 'soon', label: n === 1 ? 'Périme demain' : `Périme dans ${n} jours` };
  return { level: 'ok', label: `À consommer avant le ${fmtDayMonth(expires)}` };
}
export function isLowStock(item) {
  return item.low_threshold != null && item.low_threshold !== '' && item.qty != null && Number(item.qty) <= Number(item.low_threshold);
}
