-- Tests de la base : accès au foyer depuis les deux comptes, isolement,
-- initialisation sans doublon, contraintes anti-doublon.
\set ON_ERROR_STOP 1
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local')
on conflict do nothing;

-- 1) Adrien crée le foyer
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household('Le QG', 'adrien') as hid \gset
do $$ begin
  if (select count(*) from tasks) <> 21 then raise exception 'attendu 21 tâches initiales, trouvé %', (select count(*) from tasks); end if;
  if (select count(*) from tasks where recurrence is not null) <> 19 then raise exception 'attendu 19 récurrences'; end if;
  if (select count(*) from shopping_items) <> 7 then raise exception 'attendu 7 produits'; end if;
  if (select recurrence->>'interval' from tasks where seed_key='rec_draps') <> '2' then raise exception 'draps : une semaine sur deux'; end if;
  if (select extract(isodow from (recurrence->>'start')::date) from tasks where seed_key='rec_draps') <> 7 then raise exception 'draps : départ un dimanche'; end if;
  if (select recurrence->'days' from tasks where seed_key='rec_serpilliere') <> '[3,5,7]'::jsonb then raise exception 'serpillière : mer, ven, dim'; end if;
  if (select description from tasks where seed_key='rec_valerie') is not null then raise exception 'Valérie ne doit pas avoir de description'; end if;
  raise notice 'OK 1 : foyer créé et données initiales importées (21 tâches, 7 produits)';
end $$;

-- 2) Ré-initialisation : aucun doublon
reset role;
select public.seed_household(:'hid');
update households set settings = '{}'::jsonb where id = :'hid';   -- force un 2e passage complet
select public.seed_household(:'hid');
do $$ begin
  if (select count(*) from tasks) <> 21 or (select count(*) from shopping_items) <> 7 then
    raise exception 'doublons après ré-initialisation'; end if;
  raise notice 'OK 2 : ré-initialisation sans doublon';
end $$;

-- 3) Le 2e compte ne voit rien avant d'avoir rejoint
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from tasks) <> 0 then raise exception 'fuite de données avant invitation'; end if;
  raise notice 'OK 3 : aucune donnée visible sans invitation';
end $$;

-- 4) Ilona rejoint avec le code
reset role;
select invite_code as code from households where id = :'hid' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.join_household(lower(:'code')) as joined \gset
do $$ begin
  if (select person from members where user_id = auth.uid()) <> 'ilona' then raise exception 'Ilona attendue'; end if;
  if (select count(*) from tasks) <> 21 then raise exception 'Ilona doit voir les tâches du foyer'; end if;
  raise notice 'OK 4 : Ilona a rejoint le foyer et voit les mêmes données';
end $$;

-- 5) Écriture par Ilona, lecture par Adrien (données partagées)
insert into shopping_items(household_id, name, category) values (:'hid', 'Tomates', 'fruits_legumes');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if not exists (select 1 from shopping_items where name = 'Tomates') then raise exception 'partage KO'; end if;
  raise notice 'OK 5 : un ajout d''Ilona est visible par Adrien';
end $$;

-- 6) Un 3e compte : foyer complet, aucune donnée, écriture refusée
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin
    perform public.join_household((select 'X'));
    raise exception 'code invalide accepté';
  exception when others then
    if sqlerrm not like '%introuvable%' then raise; end if;
  end;
  if (select count(*) from tasks) + (select count(*) from households) <> 0 then raise exception 'fuite vers un tiers'; end if;
  raise notice 'OK 6 : un compte extérieur ne voit rien';
end $$;
\set ON_ERROR_STOP 0
select public.join_household(:'code');   -- doit échouer : foyer complet
insert into tasks(household_id, title) values (:'hid', 'intrusion');   -- doit échouer : RLS
\set ON_ERROR_STOP 1

-- 7) Occurrence : clé unique (tâche, date) => upsert sans doublon
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select id as tid from tasks where seed_key = 'rec_aspirateur' \gset
insert into task_occurrences(task_id, occ_date, household_id, status) values (:'tid', '2026-10-08', :'hid', 'termine')
  on conflict (task_id, occ_date) do update set status = excluded.status;
insert into task_occurrences(task_id, occ_date, household_id, moved_to) values (:'tid', '2026-10-08', :'hid', '2026-10-09')
  on conflict (task_id, occ_date) do update set moved_to = excluded.moved_to;
do $$ begin
  if (select count(*) from task_occurrences) <> 1 then raise exception 'doublon d''occurrence'; end if;
  if (select status from task_occurrences) <> 'termine' then raise exception 'upsert partiel a écrasé le statut'; end if;
  raise notice 'OK 7 : une seule ligne par occurrence';
end $$;

-- 8) Un membre ne peut pas changer son identité ni le code
\set ON_ERROR_STOP 0
update members set person = 'ilona' where user_id = auth.uid();
update households set invite_code = 'AAAAAA';
\set ON_ERROR_STOP 1
do $$ begin
  if (select person from members where user_id = auth.uid()) <> 'adrien' then raise exception 'identité modifiable'; end if;
  raise notice 'OK 8 : identité et code protégés';
end $$;
update members set daily_capacity_min = 90 where user_id = auth.uid();
reset role;
