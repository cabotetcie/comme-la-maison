-- Tests de la base : un seul foyer, accès par « Je suis … » + code du foyer,
-- isolement des appareils non autorisés, initialisation sans doublon.
\set ON_ERROR_STOP 1
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000000a'),   -- téléphone d'Adrien
  ('00000000-0000-0000-0000-00000000000b'),   -- téléphone d'Ilona
  ('00000000-0000-0000-0000-00000000000c'),   -- appareil inconnu
  ('00000000-0000-0000-0000-00000000000d')    -- ordinateur d'Ilona
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if public.household_exists() then raise exception 'aucun foyer attendu au départ'; end if;
  begin perform public.setup_household('adrien', 'abc'); raise exception 'code trop court accepté';
  exception when others then if sqlerrm not like '%4 caractères%' then raise; end if; end;
end $$;

-- 1) Première ouverture par Adrien : création du foyer + code
select public.setup_household('adrien', 'framboise') as hid \gset
do $$ begin
  if not public.household_exists() then raise exception 'foyer attendu'; end if;
  if (select count(*) from tasks) <> 21 then raise exception 'attendu 21 tâches, trouvé %', (select count(*) from tasks); end if;
  if (select count(*) from tasks where recurrence is not null) <> 19 then raise exception 'attendu 19 récurrences'; end if;
  if (select count(*) from shopping_items) <> 7 then raise exception 'attendu 7 produits'; end if;
  if (select count(*) from people) <> 2 then raise exception 'Ilona et Adrien attendus'; end if;
  if (select recurrence->>'interval' from tasks where seed_key='rec_draps') <> '2' then raise exception 'draps : une semaine sur deux'; end if;
  if (select extract(isodow from (recurrence->>'start')::date) from tasks where seed_key='rec_draps') <> 7 then raise exception 'draps : départ un dimanche'; end if;
  if (select recurrence->'days' from tasks where seed_key='rec_serpilliere') <> '[3,5,7]'::jsonb then raise exception 'serpillière : mer, ven, dim'; end if;
  if (select description from tasks where seed_key='rec_valerie') is not null then raise exception 'Valérie sans description'; end if;
  raise notice 'OK 1 : foyer créé par « Je suis Adrien » + code, données initiales importées';
end $$;

-- 2) Un deuxième foyer est impossible ; ré-initialisation sans doublon
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin perform public.setup_household('ilona', 'autrecode'); raise exception 'second foyer accepté';
  exception when others then if sqlerrm not like '%existe déjà%' then raise; end if; end;
end $$;
reset role;
update households set settings = '{}'::jsonb;
select public.seed_household(:'hid');
do $$ begin
  if (select count(*) from tasks) <> 21 or (select count(*) from shopping_items) <> 7 then raise exception 'doublons'; end if;
  if (select count(*) from households) <> 1 then raise exception 'un seul foyer attendu'; end if;
  raise notice 'OK 2 : un seul foyer possible, ré-initialisation sans doublon';
end $$;

-- 3) Appareil inconnu : rien de visible, mauvais code refusé
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if (select count(*) from tasks) + (select count(*) from households) + (select count(*) from people) <> 0 then raise exception 'fuite de données'; end if;
  begin perform public.enter_household('ilona', 'mauvais'); raise exception 'mauvais code accepté';
  exception when others then if sqlerrm not like '%incorrect%' then raise; end if; end;
  if exists (select 1 from members) then raise exception 'appareil ajouté malgré le mauvais code'; end if;
  raise notice 'OK 3 : appareil inconnu sans accès, mauvais code refusé';
end $$;
\set ON_ERROR_STOP 0
insert into tasks(household_id, title) values (:'hid', 'intrusion');   -- doit échouer (RLS)
select code_hash from households;                                       -- doit échouer (colonne protégée)
\set ON_ERROR_STOP 1

-- 4) Ilona sur son téléphone puis sur son ordinateur : même code, mêmes données
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.enter_household('ilona', ' framboise ');
insert into shopping_items(household_id, name, category) values (:'hid', 'Tomates', 'fruits_legumes');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select public.enter_household('ilona', 'framboise');
do $$ begin
  if (select person from members where user_id = auth.uid()) <> 'ilona' then raise exception 'Ilona attendue'; end if;
  if (select count(*) from members where person = 'ilona') <> 2 then raise exception 'deux appareils pour Ilona'; end if;
  if not exists (select 1 from shopping_items where name = 'Tomates') then raise exception 'partage KO'; end if;
  raise notice 'OK 4 : Ilona autorisée sur deux appareils, données partagées';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if not exists (select 1 from shopping_items where name = 'Tomates') then raise exception 'Adrien ne voit pas l''ajout d''Ilona'; end if;
  raise notice 'OK 5 : un ajout d''Ilona est visible depuis l''appareil d''Adrien';
end $$;

-- 6) Occurrence : une seule ligne par (tâche, date)
select id as tid from tasks where seed_key = 'rec_aspirateur' \gset
insert into task_occurrences(task_id, occ_date, household_id, status) values (:'tid', '2026-10-08', :'hid', 'termine')
  on conflict (task_id, occ_date) do update set status = excluded.status;
insert into task_occurrences(task_id, occ_date, household_id, moved_to) values (:'tid', '2026-10-08', :'hid', '2026-10-09')
  on conflict (task_id, occ_date) do update set moved_to = excluded.moved_to;
do $$ begin
  if (select count(*) from task_occurrences) <> 1 then raise exception 'doublon d''occurrence'; end if;
  if (select status from task_occurrences) <> 'termine' then raise exception 'statut écrasé'; end if;
  raise notice 'OK 6 : une seule ligne par occurrence';
end $$;

-- 7) Réglages de répartition modifiables, identité non modifiable directement
update people set daily_capacity_min = 90 where person = 'adrien';
\set ON_ERROR_STOP 0
update members set person = 'ilona';                 -- doit échouer
insert into members(household_id, user_id, person) values (:'hid', '00000000-0000-0000-0000-00000000000c', 'adrien');  -- doit échouer
\set ON_ERROR_STOP 1
do $$ begin
  if (select daily_capacity_min from people where person = 'adrien') <> 90 then raise exception 'réglage non enregistré'; end if;
  if (select person from members where user_id = auth.uid()) <> 'adrien' then raise exception 'identité modifiable'; end if;
  raise notice 'OK 7 : réglages modifiables, identité protégée';
end $$;

-- 8) Changement de code, puis retrait d'un appareil
select public.change_household_code('nouveau-code');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin perform public.enter_household('adrien', 'framboise'); raise exception 'ancien code encore accepté';
  exception when others then if sqlerrm not like '%incorrect%' then raise; end if; end;
  perform public.enter_household('adrien', 'nouveau-code');
  perform public.leave_device();
  if (select count(*) from tasks) <> 0 then raise exception 'appareil retiré mais encore autorisé'; end if;
  raise notice 'OK 8 : nouveau code effectif, appareil retiré sans accès';
end $$;
reset role;
