// Tests de la logique métier : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const T = (id, o = {}) => ({ id, title: id, category: 'menage', priority: 'normale', status: 'a_faire', subactions: [], ...o });
const daily = (start = '2026-10-05') => ({ freq: 'daily', interval: 1, start, alternate: true });
const weekly = (days, start = '2026-10-05', interval = 1) => ({ freq: 'weekly', interval, days, start, alternate: true });
const members = [{ person: 'ilona', daily_capacity_min: 60 }, { person: 'adrien', daily_capacity_min: 60 }];

test('jour courant calculé dans le fuseau Europe/Paris', () => {
  assert.equal(L.todayISO(new Date('2026-10-08T21:59:00Z')), '2026-10-08');
  assert.equal(L.todayISO(new Date('2026-10-08T22:01:00Z')), '2026-10-09'); // minuit passé à Paris
  assert.equal(L.todayISO(new Date('2026-10-25T00:30:00Z')), '2026-10-25'); // jour du changement d'heure
  assert.equal(L.isoDow('2026-10-11'), 7);
  assert.equal(L.startOfWeek('2026-10-11'), '2026-10-05');
});

test('récurrences : quotidienne, jours de semaine, une semaine sur deux', () => {
  assert.ok(L.occursOn(daily(), '2026-10-08'));
  assert.ok(!L.occursOn(daily('2026-10-09'), '2026-10-08'), 'pas avant la date de départ');
  const serp = weekly([3, 5, 7]);
  assert.deepEqual(L.rangeDates('2026-10-05', '2026-10-11').filter((d) => L.occursOn(serp, d)), ['2026-10-07', '2026-10-09', '2026-10-11']);
  const draps = weekly([7], '2026-10-11', 2);
  const sundays = ['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01'].filter((d) => L.occursOn(draps, d));
  assert.deepEqual(sundays, ['2026-10-11', '2026-10-25']);
  assert.equal(L.describeRecurrence(draps), 'Une semaine sur deux : dimanche (depuis le 11 oct.)');
  assert.equal(L.describeRecurrence(serp), 'Chaque mercredi, vendredi, dimanche');
});

test('validation d’une occurrence : n’affecte ni la veille ni le lendemain', () => {
  const tasks = [T('asp', { recurrence: daily() })];
  const occ = [{ task_id: 'asp', occ_date: '2026-10-08', status: 'termine' }];
  const items = L.itemsInRange(tasks, occ, '2026-10-07', '2026-10-09');
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.status), ['a_faire', 'termine', 'a_faire']);
  assert.equal(new Set(items.map((i) => i.key)).size, 3);
});

test('report d’une occurrence : déplacée sans doublon, la série reste intacte', () => {
  const tasks = [T('frigo', { recurrence: weekly([2]) })];  // mardi
  const occ = [{ task_id: 'frigo', occ_date: '2026-10-06', moved_to: '2026-10-08', status: 'a_faire' }];
  const items = L.itemsInRange(tasks, occ, '2026-10-05', '2026-10-14');
  assert.deepEqual(items.map((i) => i.date).sort(), ['2026-10-08', '2026-10-13']);
  const moved = items.find((i) => i.date === '2026-10-08');
  assert.equal(moved.occDate, '2026-10-06');
  assert.equal(moved.key, 'frigo|2026-10-06', 'même clé que l’occurrence d’origine');
});

test('progression : 3 tâches sur 5, sous-actions ignorées, tâche partagée comptée une fois', () => {
  const tasks = [
    T('a', { planned_date: '2026-10-08', assignee: 'adrien', status: 'termine', subactions: [{ id: 's1', title: 'x', done: true }, { id: 's2', title: 'y' }] }),
    T('b', { planned_date: '2026-10-08', assignee: 'adrien', status: 'termine' }),
    T('c', { planned_date: '2026-10-08', assignee: 'adrien' }),
    T('d', { planned_date: '2026-10-08', assignee: 'both', status: 'termine' }),
    T('e', { planned_date: '2026-10-08', assignee: 'both' }),
    T('f', { planned_date: '2026-10-08', assignee: 'ilona' }),
  ];
  const items = L.itemsInRange(tasks, [], '2026-10-08', '2026-10-08');
  const pa = L.progress(items, 'adrien');
  assert.deepEqual([pa.done, pa.total], [3, 5]);
  assert.equal(L.progressLabel(pa), '3 tâches sur 5 terminées');
  const pi = L.progress(items, 'ilona');
  assert.deepEqual([pi.done, pi.total], [1, 3]);
  assert.equal(L.progressLabel(pi), '1 tâche sur 3 terminée');
  const pf = L.progress(items);
  assert.deepEqual([pf.done, pf.total], [3, 6], 'foyer : 6 tâches distinctes');
  assert.equal(L.progressLabel(L.progress([], 'ilona')), 'Rien de prévu aujourd’hui');
});

test('TAPP : « Cette semaine », « Plus tard » et « À organiser » ne sont pas dans le jour', () => {
  const tasks = [
    T('sem', { planned_week: '2026-10-05' }),
    T('tard', { someday: true }),
    T('org', { status: 'a_organiser' }),
    T('jour', { planned_date: '2026-10-08' }),
  ];
  assert.deepEqual(L.itemsInRange(tasks, [], '2026-10-08', '2026-10-08').map((i) => i.key), ['jour']);
  assert.deepEqual(L.weekItems(tasks, '2026-10-05').map((i) => i.key), ['sem']);
  assert.equal(L.effectiveDuration(T('x', { kind: 'action' })).min, 5);
  assert.equal(L.effectiveDuration(T('x', { category: 'repassage' })).min, 30);
});

test('retards : ponctuelle dépassée, occurrence manquée, puis report sans doublon', () => {
  const tasks = [
    T('lit', { planned_date: '2026-10-06', category: 'entretien' }),
    T('fait', { planned_date: '2026-10-06', status: 'termine' }),
    T('asp', { recurrence: daily('2026-10-06') }),
    T('sem', { planned_week: '2026-09-28' }),
  ];
  const occ = [{ task_id: 'asp', occ_date: '2026-10-07', status: 'termine' }];
  const late = L.overdueItems(tasks, occ, '2026-10-08');
  assert.deepEqual(late.map((i) => i.key).sort(), ['asp|2026-10-06', 'lit', 'sem']);
  // report de l'occurrence du 6 à aujourd'hui
  const occ2 = [...occ, { task_id: 'asp', occ_date: '2026-10-06', moved_to: '2026-10-08' }];
  assert.ok(!L.overdueItems(tasks, occ2, '2026-10-08').some((i) => i.key === 'asp|2026-10-06'));
  const today = L.itemsInRange(tasks, occ2, '2026-10-08', '2026-10-08').filter((i) => i.taskId === 'asp');
  assert.equal(today.length, 2, 'l’occurrence reportée + celle du jour, chacune une fois');
  assert.equal(new Set(today.map((i) => i.key)).size, 2);
});

test('répartition : personne absente → rien ne lui est attribué', () => {
  const tasks = [T('asp', { recurrence: daily('2026-10-12'), duration_min: 15 }),
    T('lc', { recurrence: weekly([1], '2026-10-12'), category: 'lessive' })];
  const avail = [{ person: 'ilona', kind: 'absent', start_date: '2026-10-12', end_date: '2026-10-14' }];
  const plan = L.planDistribution({ tasks, occurrences: [], members, availabilities: avail, from: '2026-10-12', to: '2026-10-18', today: '2026-10-12' });
  const early = plan.proposals.filter((p) => p.item.date <= '2026-10-14');
  assert.ok(early.length >= 4);
  assert.ok(early.every((p) => p.person === 'adrien'), 'Ilona absente lun.–mer.');
  assert.ok(early.every((p) => /Ilona absente/.test(p.reason)));
  const later = plan.proposals.filter((p) => p.item.date > '2026-10-14' && p.action === 'assign');
  assert.ok(later.some((p) => p.person === 'ilona'), 'Ilona reprend des tâches à son retour');
});

test('répartition : les deux absents → À replanifier', () => {
  const tasks = [T('v', { planned_date: '2026-10-12' })];
  const avail = [{ person: 'ilona', kind: 'absent', start_date: '2026-10-12', end_date: '2026-10-12' },
    { person: 'adrien', kind: 'absent', start_date: '2026-10-10', end_date: '2026-10-18' }];
  const plan = L.planDistribution({ tasks, occurrences: [], members, availabilities: avail, from: '2026-10-12', to: '2026-10-12', today: '2026-10-12' });
  assert.equal(plan.proposals[0].action, 'replan');
});

test('répartition : attribution manuelle conservée et signalée si incompatible', () => {
  const tasks = [T('m', { planned_date: '2026-10-12', assignee: 'ilona', assign_mode: 'manual' }), T('n', { planned_date: '2026-10-12' })];
  const avail = [{ person: 'ilona', kind: 'absent', start_date: '2026-10-12', end_date: '2026-10-12' }];
  const args = { tasks, occurrences: [], members, availabilities: avail, from: '2026-10-12', to: '2026-10-12', today: '2026-10-12' };
  const plan = L.planDistribution(args);
  assert.ok(!plan.proposals.some((p) => p.key === 'm'), 'manuelle non touchée');
  assert.equal(plan.warnings.length, 1);
  assert.match(plan.warnings[0].text, /Ilona est absente/);
  const full = L.planDistribution({ ...args, mode: 'full' });
  assert.equal(full.proposals.find((p) => p.key === 'm').person, 'adrien', 'rééquilibrage explicite');
  assert.equal(L.absenceConflicts(args).length, 1);
});

test('répartition : équilibre du temps total, pas du nombre de tâches', () => {
  const tasks = [T('long', { planned_date: '2026-10-12', duration_min: 50 }),
    T('c1', { planned_date: '2026-10-12', duration_min: 10 }), T('c2', { planned_date: '2026-10-12', duration_min: 10 }),
    T('c3', { planned_date: '2026-10-12', duration_min: 10 }), T('c4', { planned_date: '2026-10-12', duration_min: 10 })];
  const plan = L.planDistribution({ tasks, occurrences: [], members, availabilities: [], from: '2026-10-12', to: '2026-10-12', today: '2026-10-12' });
  const by = (p) => plan.proposals.filter((x) => x.person === p).reduce((s, x) => s + x.item.duration, 0);
  assert.deepEqual([by('ilona'), by('adrien')].sort(), [40, 50]);
});

test('répartition : la personne présente n’est pas surchargée — report des tâches non urgentes', () => {
  const tasks = [T('a', { planned_date: '2026-10-12', duration_min: 50, priority: 'urgente' }),
    T('b', { planned_date: '2026-10-12', duration_min: 40 })];
  const avail = [{ person: 'ilona', kind: 'absent', start_date: '2026-10-12', end_date: '2026-10-12' }];
  const plan = L.planDistribution({ tasks, occurrences: [], members, availabilities: avail, from: '2026-10-12', to: '2026-10-18', today: '2026-10-12' });
  assert.equal(plan.proposals.find((p) => p.key === 'a').action, 'assign');
  const b = plan.proposals.find((p) => p.key === 'b');
  assert.equal(b.action, 'postpone');
  assert.equal(b.toDate, '2026-10-13');
});

test('répartition : alternance des tâches récurrentes', () => {
  const tasks = [T('wc', { recurrence: weekly([1], '2026-10-05'), duration_min: 20 })];
  const occ = [{ task_id: 'wc', occ_date: '2026-10-05', assignee: 'ilona', assign_source: 'auto', status: 'termine' }];
  const plan = L.planDistribution({ tasks, occurrences: occ, members, availabilities: [], from: '2026-10-12', to: '2026-10-25', today: '2026-10-12' });
  assert.deepEqual(plan.proposals.map((p) => p.person), ['adrien', 'ilona']);
});

test('disponibilité réduite prise en compte', () => {
  const c = L.capacityFor('adrien', '2026-10-12', members, [{ person: 'adrien', kind: 'reduite', capacity_min: 15, start_date: '2026-10-12', end_date: '2026-10-12' }]);
  assert.deepEqual([c.cap, c.absent], [15, false]);
});

test('courses : fusion des ingrédients sans additionner des unités incompatibles', () => {
  const merged = L.mergeLines([
    { name: 'Farine', qty: 200, unit: 'g' }, { name: 'farine', qty: 0.3, unit: 'kg' },
    { name: 'Œufs', qty: 2 }, { name: 'oeuf', qty: 3, unit: 'pièces' },
    { name: 'Lait', qty: 25, unit: 'cl' }, { name: 'lait', qty: 1, unit: 'l' },
    { name: 'Tomates', qty: 3 }, { name: 'tomate', qty: 200, unit: 'g' },
  ]);
  const f = (n) => merged.filter((m) => m.key === L.nameKey(n));
  assert.deepEqual([f('farine')[0].qty, f('farine')[0].unit], [500, 'g']);
  assert.equal(f('oeufs').length, 1);
  assert.equal(f('oeufs')[0].qty, 5);
  assert.deepEqual([f('lait')[0].qty, f('lait')[0].unit], [1.25, 'l']);
  assert.equal(f('tomates').length, 2, 'pièces et grammes restent séparés');
});

test('courses : prise en compte de l’inventaire et des lignes existantes', () => {
  const inv = [{ name: 'Riz', qty: 1, unit: 'kg' }, { name: 'Lait', qty: 25, unit: 'cl' }, { name: 'Sel' }];
  assert.equal(L.inventoryCheck({ name: 'riz', qty: 300, unit: 'g' }, inv).status, 'enough');
  const lait = L.inventoryCheck({ name: 'lait', qty: 1, unit: 'l' }, inv);
  assert.equal(lait.status, 'partial');
  assert.deepEqual([lait.qty, lait.unit], [750, 'ml']);
  assert.equal(L.inventoryCheck({ name: 'Sel', qty: 1, unit: 'cs' }, inv).status, 'present');
  assert.equal(L.inventoryCheck({ name: 'Basilic' }, inv).status, 'absent');
  const plan = L.planMergeInto([{ name: 'tomates', qty: 2 }, { name: 'Lait d’avoine', qty: 1, unit: 'l' }, { name: 'Lait de coco' }],
    [{ id: '1', name: 'Tomates', qty: 3, unit: null, checked: false }, { id: '2', name: 'Lait d’avoine', qty: null, unit: null, checked: false },
      { id: '3', name: 'Lait de coco', checked: true }]);
  assert.deepEqual(plan.updates.map((u) => [u.id, u.qty]), [['1', 5], ['2', 1]]);
  assert.equal(plan.inserts.length, 1, 'le produit déjà coché n’est pas réutilisé');
});

test('saisie rapide et catégories', () => {
  assert.deepEqual(L.parseQuickProduct('2 kg pommes'), { name: 'pommes', qty: 2, unit: 'kg' });
  assert.deepEqual(L.parseQuickProduct('3 citrons'), { name: 'citrons', qty: 3, unit: null });
  assert.deepEqual(L.parseQuickProduct('500g de farine'), { name: 'farine', qty: 500, unit: 'g' });
  assert.deepEqual(L.parseQuickProduct('Lait d’avoine'), { name: 'Lait d’avoine', qty: null, unit: null });
  assert.equal(L.guessShopCategory('Lait d’avoine'), 'boissons');
  assert.equal(L.guessShopCategory('lait'), 'frais');
  assert.equal(L.guessShopCategory('Pommes de terre'), 'fruits_legumes');
  assert.equal(L.guessShopCategory('Papier cuisson'), 'entretien');
  assert.equal(L.guessShopCategory('Truc inconnu'), 'autre');
});

test('inventaire : péremption et stock bas', () => {
  assert.equal(L.expiryStatus('2026-10-10', '2026-10-08').level, 'soon');
  assert.equal(L.expiryStatus('2026-10-01', '2026-10-08').level, 'expired');
  assert.ok(L.isLowStock({ qty: 1, low_threshold: 2 }));
  assert.ok(!L.isLowStock({ qty: 3, low_threshold: 2 }));
});
