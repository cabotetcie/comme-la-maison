// =====================================================================
//  Accès aux données (Supabase). Toute la sécurité est appliquée côté
//  base (RLS) : l'application ne voit que les données de son foyer.
// =====================================================================
import { addDays } from './logic.js';

const cfg = window.QG_CONFIG || {};
export const configured = !!(window.__QG_CLIENT__ || (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY));
let sb = null;

export async function client() {
  if (sb) return sb;
  if (window.__QG_CLIENT__) { sb = window.__QG_CLIENT__; return sb; }  // utilisé uniquement par les tests automatisés
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return sb;
}

/** table Supabase → clé dans l'état local */
export const TABLES = {
  households: 'hh', members: 'members', projects: 'projects', tasks: 'tasks', task_occurrences: 'occ',
  inbox_items: 'inbox', availabilities: 'avail', recipes: 'recipes', meals: 'meals',
  shopping_items: 'shopping', inventory_items: 'inventory',
};

function check({ data, error }) { if (error) throw error; return data; }

export async function loadTable(table, hid, today) {
  let q = sb.from(table).select('*');
  q = table === 'households' ? q.eq('id', hid) : q.eq('household_id', hid);
  if (table === 'task_occurrences') { const d = addDays(today, -60); q = q.or(`occ_date.gte.${d},moved_to.gte.${d}`); }
  if (table === 'meals') q = q.gte('meal_date', addDays(today, -70));
  if (table === 'shopping_items') q = q.eq('archived', false);
  return check(await q);
}

export async function myMembership(userId) {
  return check(await sb.from('members').select('*').eq('user_id', userId).maybeSingle());
}
export async function insert(table, row) {
  const many = Array.isArray(row);
  const q = sb.from(table).insert(row).select();
  return check(many ? await q : await q.single());
}
export async function update(table, id, patch) {
  return check(await sb.from(table).update(patch).eq('id', id).select().single());
}
export async function updateMember(householdId, person, patch) {
  return check(await sb.from('members').update(patch).eq('household_id', householdId).eq('person', person).select().single());
}
export async function updateHousehold(id, patch) {
  return check(await sb.from('households').update(patch).eq('id', id).select().single());
}
export async function remove(table, id) {
  check(await sb.from(table).delete().eq('id', id));
}
export async function upsertOcc(row) {
  return check(await sb.from('task_occurrences').upsert(row, { onConflict: 'task_id,occ_date' }).select().single());
}
export async function upsertMeal(row) {
  return check(await sb.from('meals').upsert(row, { onConflict: 'household_id,meal_date,slot' }).select().single());
}
export async function rpc(name, args) { return check(await sb.rpc(name, args)); }

/** Synchronisation temps réel : rappelle onChange(table) à chaque modification du foyer. */
export function subscribe(hid, onChange) {
  const ch = sb.channel('foyer-' + hid);
  for (const t of Object.keys(TABLES)) {
    const filter = t === 'households' ? `id=eq.${hid}` : `household_id=eq.${hid}`;
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter }, () => onChange(t));
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter }, () => onChange(t));
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, () => onChange(t));
  }
  ch.subscribe((status) => onChange(null, status));
  return ch;
}
