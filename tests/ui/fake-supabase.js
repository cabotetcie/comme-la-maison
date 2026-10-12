// Faux client Supabase POUR LES TESTS AUTOMATISÉS UNIQUEMENT (jamais chargé par l'application réelle).
// Données dans localStorage (partagées entre onglets = deux comptes), notifications via BroadcastChannel.
(() => {
  const KEY = 'fake-db';
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{"users":[],"t":{}}');
  const persist = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const bc = new BroadcastChannel('fake-rt');
  const uuid = () => crypto.randomUUID();
  const PK = { task_occurrences: ['task_id', 'occ_date'] };
  const DEFAULTS = {
    tasks: { kind: 'tache', category: 'autre', description: null, assignee: null, assign_mode: 'auto', planned_date: null, planned_week: null, someday: false, due_date: null, priority: 'normale', duration_min: null, recurrence: null, subactions: [], project_id: null, status: 'a_faire', done_at: null, done_by: null, seed_key: null },
    task_occurrences: { status: null, moved_to: null, assignee: null, assign_source: null, override: {}, done_at: null, done_by: null },
    shopping_items: { qty: null, unit: null, note: null, category: 'autre', checked: false, checked_at: null, checked_by: null, archived: false, seed_key: null },
    inventory_items: { category: 'autre', qty: null, unit: null, location: 'placards', expires_on: null, low_threshold: null },
    recipes: { ingredients: [], servings: 2, prep_min: null, notes: null, favorite: false },
    meals: { recipe_id: null, title: null, servings: 2, notes: null, no_meal: false },
    projects: { description: null, status: 'actif' }, inbox_items: { note: null, created_by: null },
    availabilities: { capacity_min: null, note: null },
  };
  let session = JSON.parse(sessionStorage.getItem('fake-session') || 'null');
  const listeners = [];
  const uid = () => session?.user?.id;
  const myHid = (db) => (db.t.members || []).find((m) => m.user_id === uid())?.household_id;
  const visible = (db, table, r) => {
    const h = myHid(db); if (!h) return false;
    return table === 'households' ? r.id === h : r.household_id === h;
  };
  const err = (message) => ({ data: null, error: { message } });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const add = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

  function seed(db, h) {
    const t = today(); const dow = ((new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1; const sunday = add(t, (7 - dow) % 7);
    const T = (k, title, category, description, days, iv = 1) => ({ id: uuid(), household_id: h, seed_key: k, title, category, description, status: 'a_faire', created_at: new Date().toISOString(),
      ...DEFAULTS.tasks, seed_key: k, title, category, description,
      recurrence: days ? { freq: 'weekly', interval: iv, days, start: iv === 2 ? sunday : t, alternate: true } : { freq: 'daily', interval: 1, start: t, alternate: true } });
    db.t.tasks = db.t.tasks || [];
    db.t.tasks.push(
      { ...DEFAULTS.tasks, id: uuid(), household_id: h, seed_key: 'ponctuel_lit', title: 'Revisser le lit', category: 'entretien', status: 'a_organiser', created_at: new Date().toISOString() },
      { ...DEFAULTS.tasks, id: uuid(), household_id: h, seed_key: 'ponctuel_hellobank', title: 'Appeler Hello bank! au sujet des frais de carte bancaire', category: 'administratif', status: 'a_organiser', created_at: new Date().toISOString() },
      T('a', 'Passer l’aspirateur', 'menage', 'Entretien rapide', null), T('b', 'Faire une lessive de couleurs', 'lessive', null, [1]), T('c', 'Nettoyer les toilettes', 'menage', null, [1]),
      T('d', 'Ranger le linge', 'rangement', null, [2]), T('e', 'Faire la poussière', 'menage', 'Meubles, étagères et plinthes', [2]), T('f', 'Nettoyer le réfrigérateur', 'menage', null, [2]),
      T('g', 'Passer la serpillière', 'menage', null, [3, 5, 7]), T('h', 'Nettoyer la salle de bain', 'menage', 'Lavabo, robinetterie, douche, joints et calcaire', [3]), T('i', 'Vider les poubelles', 'menage', null, [3, 6]),
      T('j', 'Faire une lessive de linge clair', 'lessive', null, [4]), T('k', 'Nettoyer les traces sur les murs, les interrupteurs et les portes', 'menage', null, [4]), T('l', 'Nettoyer les vitres', 'menage', null, [4]),
      T('m', 'Nettoyer le lave-vaisselle', 'entretien', null, [5]), T('n', 'Nettoyer Valérie', 'autre', null, [5]), T('o', 'Repasser et ranger le linge', 'repassage', null, [6]),
      T('p', 'Nettoyer Nicole, l’aspirateur à main', 'entretien', null, [6]), T('q', 'Nettoyer et désinfecter la voiture', 'autre', null, [7]), T('r', 'Nettoyer le lave-linge', 'entretien', null, [7]),
      T('s', 'Changer les draps et laver les serviettes de bain', 'lessive', null, [7], 2));
    db.t.shopping_items = db.t.shopping_items || [];
    for (const [name, category] of [['Lait de coco', 'boissons'], ['Lait d’avoine', 'boissons'], ['Capsules de café', 'boissons'], ['Sirop de vanille', 'epicerie_sucree'], ['Papier cuisson', 'entretien'], ['Film étirable', 'entretien'], ['Cotons-tiges', 'hygiene']]) {
      db.t.shopping_items.push({ ...DEFAULTS.shopping_items, id: uuid(), household_id: h, name, category, created_at: new Date().toISOString() });
    }
  }

  class Q {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.one = false; this.maybe = false; }
    select() { if (this.op === 'select') this.op = 'select'; this.ret = true; return this; }
    eq(c, v) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
    gte(c, v) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
    or(expr) { const parts = expr.split(',').map((p) => p.split('.')); this.filters.push((r) => parts.some(([c, , v]) => r[c] != null && r[c] >= v)); return this; }
    insert(rows) { this.op = 'insert'; this.rows = rows; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; }
    delete() { this.op = 'delete'; return this; }
    upsert(row, o) { this.op = 'upsert'; this.rows = row; this.conflict = o.onConflict.split(','); return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; this.maybe = true; return this; }
    then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
    run() {
      const db = load(); const t = this.table; db.t[t] = db.t[t] || [];
      const list = db.t[t];
      const notify = () => { persist(db); bc.postMessage(t); };
      const out = (rows) => (this.one ? (rows.length || this.maybe ? { data: rows[0] || null, error: null } : err('no rows')) : { data: rows, error: null });
      const clone = (x) => JSON.parse(JSON.stringify(x));
      if (this.op === 'select') {
        if (t === 'members' && !myHid(db)) return out(list.filter((r) => r.user_id === uid()).map(clone));
        return out(list.filter((r) => visible(db, t, r) && this.filters.every((f) => f(r))).map(clone));
      }
      const h = myHid(db);
      if (this.op === 'insert') {
        const rows = (Array.isArray(this.rows) ? this.rows : [this.rows]).map((r) => {
          if (r.household_id !== h) throw new Error('new row violates row-level security policy');
          if (t === 'meals' && list.some((x) => x.household_id === h && x.meal_date === r.meal_date && x.slot === r.slot)) throw new Error('duplicate key value violates unique constraint');
          return { ...(DEFAULTS[t] || {}), id: uuid(), created_at: new Date().toISOString(), ...r };
        });
        list.push(...rows); notify(); return out(rows.map(clone));
      }
      if (this.op === 'upsert') {
        const r = this.rows; if (r.household_id !== h) throw new Error('row-level security');
        let ex = list.find((x) => this.conflict.every((c) => String(x[c]) === String(r[c])));
        if (ex) Object.assign(ex, r, { updated_at: new Date().toISOString() });
        else { ex = { ...(DEFAULTS[t] || {}), ...(PK[t] ? {} : { id: uuid() }), created_at: new Date().toISOString(), ...r }; list.push(ex); }
        notify(); return out([clone(ex)]);
      }
      const hits = list.filter((r) => visible(db, t, r) && this.filters.every((f) => f(r)));
      if (this.op === 'update') { hits.forEach((r) => Object.assign(r, this.patch, { updated_at: new Date().toISOString() })); notify(); return out(hits.map(clone)); }
      if (this.op === 'delete') {
        db.t[t] = list.filter((r) => !hits.includes(r));
        if (t === 'tasks') db.t.task_occurrences = (db.t.task_occurrences || []).filter((o) => !hits.some((x) => x.id === o.task_id));
        notify(); return { data: null, error: null };
      }
      return err('op');
    }
  }

  const authEvent = (ev) => listeners.forEach((cb) => cb(ev, session));
  window.__QG_CLIENT__ = {
    from: (t) => new Q(t),
    async rpc(name, args) {
      const db = load(); db.t.members = db.t.members || []; db.t.households = db.t.households || [];
      if (!uid()) return err('Connexion requise');
      if (db.t.members.some((m) => m.user_id === uid())) return err('Ce compte fait déjà partie d’un foyer');
      const mem = (h, person) => ({ household_id: h, user_id: uid(), person, daily_capacity_min: 60, preferred_categories: [], avoided_categories: [] });
      if (name === 'create_household') {
        const h = uuid(); db.t.households.push({ id: h, name: args.p_name, invite_code: Math.random().toString(16).slice(2, 8).toUpperCase(), settings: { seeded: true, seeded_on: today() } });
        db.t.members.push(mem(h, args.p_person)); seed(db, h); persist(db); return { data: h, error: null };
      }
      if (name === 'join_household') {
        const hh = db.t.households.find((x) => x.invite_code === String(args.p_code).trim().toUpperCase());
        if (!hh) return err('Code d’invitation introuvable');
        const taken = db.t.members.filter((m) => m.household_id === hh.id).map((m) => m.person);
        if (taken.length >= 2) return err('Ce foyer est déjà complet');
        const p = taken.includes('ilona') ? 'adrien' : 'ilona';
        db.t.members.push(mem(hh.id, p)); persist(db); bc.postMessage('members'); return { data: { household_id: hh.id, person: p }, error: null };
      }
      return err('rpc inconnue');
    },
    auth: {
      async getSession() { return { data: { session } }; },
      onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      async signUp({ email, password }) {
        const db = load(); if (db.users.some((u) => u.email === email)) return err('User already registered');
        const u = { id: uuid(), email, password }; db.users.push(u); persist(db);
        session = { user: { id: u.id, email } }; sessionStorage.setItem('fake-session', JSON.stringify(session)); authEvent('SIGNED_IN');
        return { data: { session, user: session.user }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = load().users.find((x) => x.email === email && x.password === password);
        if (!u) return err('Invalid login credentials');
        session = { user: { id: u.id, email } }; sessionStorage.setItem('fake-session', JSON.stringify(session)); authEvent('SIGNED_IN');
        return { data: { session }, error: null };
      },
      async signOut() { session = null; sessionStorage.removeItem('fake-session'); authEvent('SIGNED_OUT'); return { error: null }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { error: null }; },
    },
    channel() {
      const handlers = [];
      const ch = {
        on(_, f, cb) { handlers.push([f.table, cb]); return ch; },
        subscribe(cb) { cb && setTimeout(() => cb('SUBSCRIBED'), 0); bc.onmessage = (e) => handlers.filter(([t]) => t === e.data).forEach(([, f]) => f()); return ch; },
        unsubscribe() { bc.onmessage = null; },
      };
      return ch;
    },
  };
})();
