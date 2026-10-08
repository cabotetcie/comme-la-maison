-- =====================================================================
--  Le QG — gestion du foyer (méthode TAPP)
--  Schéma Supabase. Script idempotent : on peut le relancer sans créer
--  de doublons ni perdre de données.
--  À coller dans Supabase > SQL Editor > New query > Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Foyer (un seul), personnes (Ilona, Adrien) et appareils connectés
-- Pas de comptes e-mail : chaque appareil reçoit une session anonyme
-- Supabase, rattachée à « Ilona » ou « Adrien » après saisie du code du foyer.
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Le QG',
  code_hash   text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.households add column if not exists code_hash text;
alter table public.households drop column if exists invite_code;
alter table public.households drop column if exists created_by;
create unique index if not exists households_un_seul_foyer on public.households ((true));

-- Réglages de chaque personne (répartition)
create table if not exists public.people (
  household_id         uuid not null references public.households(id) on delete cascade,
  person               text not null check (person in ('ilona','adrien')),
  daily_capacity_min   int  not null default 60 check (daily_capacity_min between 0 and 1440),
  preferred_categories text[] not null default '{}',
  avoided_categories   text[] not null default '{}',
  primary key (household_id, person)
);

-- Appareils autorisés : une ligne par téléphone / ordinateur
create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  person       text not null check (person in ('ilona','adrien')),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);
alter table public.members drop constraint if exists members_household_id_person_key;
alter table public.members drop column if exists daily_capacity_min;
alter table public.members drop column if exists preferred_categories;
alter table public.members drop column if exists avoided_categories;
alter table public.members add column if not exists last_seen timestamptz not null default now();

-- ---------------------------------------------------------------------
-- TAPP : projets, tâches / actions, occurrences des récurrences
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  description  text,
  status       text not null default 'actif' check (status in ('idee','actif','termine')),
  created_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  kind          text not null default 'tache' check (kind in ('tache','action')),
  title         text not null check (length(trim(title)) > 0),
  category      text not null default 'autre'
                check (category in ('menage','lessive','rangement','repassage','entretien','administratif','achats','autre')),
  description   text,
  assignee      text check (assignee in ('ilona','adrien','both')),
  assign_mode   text not null default 'auto' check (assign_mode in ('auto','manual')),
  planned_date  date,          -- « Aujourd'hui » ou « À une date précise »
  planned_week  date,          -- « Cette semaine » : lundi de la semaine visée
  someday       boolean not null default false,   -- « Plus tard » (espace dédié)
  due_date      date,
  priority      text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  duration_min  int check (duration_min is null or duration_min between 1 and 1440),
  recurrence    jsonb,         -- null = ponctuelle
  subactions    jsonb not null default '[]'::jsonb,
  project_id    uuid references public.projects(id) on delete set null,
  status        text not null default 'a_faire'
                check (status in ('a_organiser','a_faire','en_cours','termine','a_replanifier')),
  done_at       timestamptz,
  done_by       text,
  seed_key      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, seed_key)
);

-- Une ligne par occurrence « touchée » (validée, reportée, réattribuée…).
-- Clé = (tâche, date d'origine) : impossible de créer un doublon.
create table if not exists public.task_occurrences (
  task_id       uuid not null references public.tasks(id) on delete cascade,
  occ_date      date not null,
  household_id  uuid not null references public.households(id) on delete cascade,
  status        text check (status in ('a_faire','en_cours','termine','saute','a_replanifier')),
  moved_to      date,
  assignee      text check (assignee in ('ilona','adrien','both')),
  assign_source text check (assign_source in ('auto','manual')),
  override      jsonb not null default '{}'::jsonb,
  done_at       timestamptz,
  done_by       text,
  updated_at    timestamptz not null default now(),
  primary key (task_id, occ_date)
);

-- Boîte de réception commune (« À organiser »)
create table if not exists public.inbox_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type         text not null check (type in ('tache','action','admin','achat_maison','courses','repas','projet')),
  title        text not null check (length(trim(title)) > 0),
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);

-- Disponibilités et absences
create table if not exists public.availabilities (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  person       text not null check (person in ('ilona','adrien')),
  kind         text not null check (kind in ('absent','reduite')),
  start_date   date not null,
  end_date     date not null,
  capacity_min int check (capacity_min is null or capacity_min between 0 and 1440),
  note         text,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------
-- Repas, courses, inventaire
-- ---------------------------------------------------------------------
create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  ingredients  jsonb not null default '[]'::jsonb,   -- [{name, qty, unit}]
  servings     int not null default 2 check (servings between 1 and 50),
  prep_min     int check (prep_min is null or prep_min between 0 and 1440),
  notes        text,
  favorite     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date    date not null,
  slot         text not null check (slot in ('dejeuner','diner')),
  recipe_id    uuid references public.recipes(id) on delete set null,
  title        text,
  servings     int not null default 2 check (servings between 1 and 50),
  notes        text,
  no_meal      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, meal_date, slot)
);

create table if not exists public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  qty          numeric,
  unit         text,
  note         text,
  category     text not null default 'autre'
               check (category in ('fruits_legumes','frais','proteines','epicerie_salee','epicerie_sucree','boissons','entretien','hygiene','autre')),
  checked      boolean not null default false,
  checked_at   timestamptz,
  checked_by   text,
  archived     boolean not null default false,
  seed_key     text,
  created_at   timestamptz not null default now(),
  unique (household_id, seed_key)
);

create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  category      text not null default 'autre',
  qty           numeric,
  unit          text,
  location      text not null default 'placards',
  expires_on    date,
  low_threshold numeric,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists tasks_household_idx on public.tasks(household_id);
create index if not exists occ_household_idx on public.task_occurrences(household_id, occ_date);
create index if not exists meals_household_idx on public.meals(household_id, meal_date);
create index if not exists shop_household_idx on public.shopping_items(household_id, archived);

-- updated_at automatique
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists tasks_updated on public.tasks;
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists occ_updated on public.task_occurrences;
create trigger occ_updated before update on public.task_occurrences for each row execute function public.set_updated_at();
drop trigger if exists inv_updated on public.inventory_items;
create trigger inv_updated before update on public.inventory_items for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Sécurité : seules les personnes du foyer voient ses données
-- ---------------------------------------------------------------------
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid());
$$;

alter table public.households enable row level security;
drop policy if exists foyer_select on public.households;
create policy foyer_select on public.households for select to authenticated using (public.is_member(id));
drop policy if exists foyer_update on public.households;
create policy foyer_update on public.households for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
revoke all on public.households from anon, authenticated;
grant select (id, name, settings, created_at) on public.households to authenticated;   -- jamais code_hash
grant update (name, settings) on public.households to authenticated;

alter table public.members enable row level security;
drop policy if exists membres_select on public.members;
create policy membres_select on public.members for select to authenticated using (public.is_member(household_id));
drop policy if exists membres_update on public.members;
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;

alter table public.people enable row level security;
drop policy if exists personnes_select on public.people;
create policy personnes_select on public.people for select to authenticated using (public.is_member(household_id));
drop policy if exists personnes_update on public.people;
create policy personnes_update on public.people for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
revoke all on public.people from anon, authenticated;
grant select on public.people to authenticated;
grant update (daily_capacity_min, preferred_categories, avoided_categories) on public.people to authenticated;

do $$
declare t text;
begin
  foreach t in array array['projects','tasks','task_occurrences','inbox_items','availabilities',
                           'recipes','meals','shopping_items','inventory_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists foyer_all on public.%I', t);
    execute format('create policy foyer_all on public.%I for all to authenticated
                    using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Données initiales (une seule fois par foyer, sans doublon)
-- ---------------------------------------------------------------------
create or replace function public.seed_household(h uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d_today  date := (now() at time zone 'Europe/Paris')::date;
  d_sunday date;
begin
  if coalesce((select (settings->>'seeded')::boolean from households where id = h), false) then
    return;
  end if;
  -- premier dimanche à partir d'aujourd'hui : départ du « une semaine sur deux » (modifiable)
  d_sunday := d_today + ((7 - extract(isodow from d_today)::int) % 7);

  insert into tasks (household_id, seed_key, title, category, status, priority)
  values (h, 'ponctuel_lit', 'Revisser le lit', 'entretien', 'a_organiser', 'normale'),
         (h, 'ponctuel_hellobank', 'Appeler Hello bank! au sujet des frais de carte bancaire', 'administratif', 'a_organiser', 'normale')
  on conflict (household_id, seed_key) do nothing;

  insert into tasks (household_id, seed_key, title, category, description, status, recurrence)
  select h, s.k, s.t, s.c, s.d, 'a_faire',
         case when s.days is null
              then jsonb_build_object('freq','daily','interval',1,'start',d_today,'alternate',true)
              else jsonb_build_object('freq','weekly','interval',s.iv,'days',to_jsonb(s.days),
                                      'start', case when s.iv = 2 then d_sunday else d_today end,
                                      'alternate',true)
         end
  from (values
    ('rec_aspirateur',    'Passer l''aspirateur',                   'menage',    'Entretien rapide', null::int[], 1),
    ('rec_lessive_coul',  'Faire une lessive de couleurs',          'lessive',   null, array[1], 1),
    ('rec_toilettes',     'Nettoyer les toilettes',                 'menage',    null, array[1], 1),
    ('rec_ranger_linge',  'Ranger le linge',                        'rangement', null, array[2], 1),
    ('rec_poussiere',     'Faire la poussière',                     'menage',    'Meubles, étagères et plinthes', array[2], 1),
    ('rec_frigo',         'Nettoyer le réfrigérateur',              'menage',    null, array[2], 1),
    ('rec_serpilliere',   'Passer la serpillière',                  'menage',    null, array[3,5,7], 1),
    ('rec_sdb',           'Nettoyer la salle de bain',              'menage',    'Lavabo, robinetterie, douche, joints et calcaire', array[3], 1),
    ('rec_poubelles',     'Vider les poubelles',                    'menage',    null, array[3,6], 1),
    ('rec_lessive_clair', 'Faire une lessive de linge clair',       'lessive',   null, array[4], 1),
    ('rec_traces',        'Nettoyer les traces sur les murs, les interrupteurs et les portes', 'menage', null, array[4], 1),
    ('rec_vitres',        'Nettoyer les vitres',                    'menage',    null, array[4], 1),
    ('rec_lave_vaisselle','Nettoyer le lave-vaisselle',             'entretien', null, array[5], 1),
    ('rec_valerie',       'Nettoyer Valérie',                       'autre',     null, array[5], 1),
    ('rec_repassage',     'Repasser et ranger le linge',            'repassage', null, array[6], 1),
    ('rec_nicole',        'Nettoyer Nicole, l’aspirateur à main',   'entretien', null, array[6], 1),
    ('rec_voiture',       'Nettoyer et désinfecter la voiture',     'autre',     null, array[7], 1),
    ('rec_lave_linge',    'Nettoyer le lave-linge',                 'entretien', null, array[7], 1),
    ('rec_draps',         'Changer les draps et laver les serviettes de bain', 'lessive', null, array[7], 2)
  ) as s(k, t, c, d, days, iv)
  on conflict (household_id, seed_key) do nothing;

  insert into shopping_items (household_id, seed_key, name, category)
  values (h, 'c_lait_coco',   'Lait de coco',     'boissons'),
         (h, 'c_lait_avoine', 'Lait d’avoine',    'boissons'),
         (h, 'c_cafe',        'Capsules de café', 'boissons'),
         (h, 'c_vanille',     'Sirop de vanille', 'epicerie_sucree'),
         (h, 'c_cuisson',     'Papier cuisson',   'entretien'),
         (h, 'c_film',        'Film étirable',    'entretien'),
         (h, 'c_cotons',      'Cotons-tiges',     'hygiene')
  on conflict (household_id, seed_key) do nothing;

  update households
     set settings = settings || jsonb_build_object('seeded', true, 'seeded_on', d_today)
   where id = h;
end $$;
revoke all on function public.seed_household(uuid) from public, anon, authenticated;

drop function if exists public.create_household(text, text);
drop function if exists public.join_household(text);

-- Le foyer existe-t-il déjà ? (écran de première ouverture)
create or replace function public.household_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from households);
$$;
revoke all on function public.household_exists() from public;
grant execute on function public.household_exists() to anon, authenticated;

-- Toute première ouverture : création du foyer et choix du code
create or replace function public.setup_household(p_person text, p_code text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Session introuvable'; end if;
  if p_person not in ('ilona','adrien') then raise exception 'Personne inconnue'; end if;
  if length(coalesce(trim(p_code), '')) < 4 then raise exception 'Le code du foyer doit contenir au moins 4 caractères'; end if;
  if exists (select 1 from households) then raise exception 'Le foyer existe déjà : saisissez son code'; end if;
  insert into households (name, code_hash) values ('Le QG', crypt(trim(p_code), gen_salt('bf'))) returning id into h;
  insert into people (household_id, person) values (h, 'ilona'), (h, 'adrien') on conflict do nothing;
  insert into members (household_id, user_id, person) values (h, auth.uid(), p_person);
  perform seed_household(h);
  return h;
end $$;
revoke all on function public.setup_household(text, text) from public, anon;
grant execute on function public.setup_household(text, text) to authenticated;

-- Ouverture sur un nouvel appareil : « Je suis Ilona / Adrien » + code du foyer
create or replace function public.enter_household(p_person text, p_code text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare h uuid; hash text;
begin
  if auth.uid() is null then raise exception 'Session introuvable'; end if;
  if p_person not in ('ilona','adrien') then raise exception 'Personne inconnue'; end if;
  select id, code_hash into h, hash from households limit 1;
  if h is null then raise exception 'Le foyer n''existe pas encore'; end if;
  if hash is null or crypt(trim(coalesce(p_code, '')), hash) <> hash then
    perform pg_sleep(1.5);   -- ralentit les essais au hasard
    raise exception 'Code du foyer incorrect';
  end if;
  insert into members (household_id, user_id, person) values (h, auth.uid(), p_person)
  on conflict (household_id, user_id) do update set person = excluded.person, last_seen = now();
  return h;
end $$;
revoke all on function public.enter_household(text, text) from public, anon;
grant execute on function public.enter_household(text, text) to authenticated;

-- Changer le code du foyer (depuis un appareil déjà autorisé)
create or replace function public.change_household_code(p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h uuid;
begin
  select household_id into h from members where user_id = auth.uid();
  if h is null then raise exception 'Appareil non autorisé'; end if;
  if length(coalesce(trim(p_new), '')) < 4 then raise exception 'Le code du foyer doit contenir au moins 4 caractères'; end if;
  update households set code_hash = crypt(trim(p_new), gen_salt('bf')) where id = h;
end $$;
revoke all on function public.change_household_code(text) from public, anon;
grant execute on function public.change_household_code(text) to authenticated;

-- Retirer cet appareil (« changer de personne » ou appareil prêté)
create or replace function public.leave_device() returns void
language sql security definer set search_path = public as $$
  delete from members where user_id = auth.uid();
$$;
revoke all on function public.leave_device() from public, anon;
grant execute on function public.leave_device() to authenticated;

-- ---------------------------------------------------------------------
-- Synchronisation en temps réel
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['households','members','people','projects','tasks','task_occurrences','inbox_items',
                           'availabilities','recipes','meals','shopping_items','inventory_items'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;
