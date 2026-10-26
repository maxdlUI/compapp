-- =====================================================================================
-- KREVO: Admin-Rolle und "Estimated Qual" (optionaler öffentlicher Banner)
--
-- Voraussetzung: supabase/001_krevo_profiles.sql ist eingespielt.
-- Einspielen: Supabase Dashboard -> SQL Editor -> New query -> diesen Text einfügen -> Run.
-- Das Skript lässt sich gefahrlos mehrfach ausführen (idempotent) und löscht keine Daten.
--
-- Was es anlegt
--   * public.admins            Wer Administrator ist, über die stabile Nutzer-ID (UUID). Über die API weder les- noch
--                              beschreibbar. Einträge macht nur, wer Zugriff auf den SQL Editor hat (siehe Ende der Datei).
--   * public.is_admin()        Prüft serverseitig, ob der angemeldete Nutzer Administrator ist.
--   * public.estimated_qual    Genau eine Zeile: Schalter, Entwurf, veröffentlichter Stand. Nur Administratoren
--                              können sie lesen und (eingeschränkt) ändern.
--   * public.estimated_qual_public()    Das Einzige, was Besucher abrufen können: der veröffentlichte Stand, aber nur
--                              wenn Estimated Qual eingeschaltet und gültig veröffentlicht ist. Sonst null.
--   * public.estimated_qual_publish()   Veröffentlicht den Entwurf (nur Administratoren, nur gültige Werte).
--   * Storage-Bucket "estimated-qual"   Hintergrundbild. Hochladen und Löschen nur für Administratoren.
--
-- Estimated Qual ist standardmäßig AUS (enabled = false).
-- =====================================================================================

begin;

-- ---------- Admin-Rolle ----------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
-- Ohne Policy und ohne Rechte: über die API kann niemand (auch kein angemeldeter Nutzer) Admins lesen oder anlegen.
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- Läuft mit den Rechten des Eigentümers, damit auch Nutzer ohne Tabellenrechte die Frage "bin ich Admin?" stellen können.
-- Vergleicht ausschließlich die ID aus dem geprüften Anmelde-Token, nie eine vom Client gelieferte Angabe.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

-- ---------- Estimated Qual: Einstellungen (genau eine Zeile) ----------
create table if not exists public.estimated_qual (
  id               smallint primary key default 1 check (id = 1),
  enabled          boolean not null default false,
  -- Entwurf (nur für Administratoren sichtbar)
  draft_points     integer,
  draft_image      text,
  draft_updated_at timestamptz,
  -- veröffentlichter Stand (wird nur über estimated_qual_publish() gesetzt)
  published_points integer,
  published_image  text,
  published_at     timestamptz,
  published_by     uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  constraint estimated_qual_draft_points_range     check (draft_points is null or draft_points between 1 and 999999),
  constraint estimated_qual_published_points_range check (published_points is null or published_points between 1 and 999999),
  -- Bilddateien heißen <UUID>.jpg|png|webp und liegen im Bucket estimated-qual (keine fremden Pfade oder Adressen)
  constraint estimated_qual_draft_image_format     check (draft_image is null or draft_image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  constraint estimated_qual_published_image_format check (published_image is null or published_image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  constraint estimated_qual_published_consistent   check ((published_points is null) = (published_at is null))
);
insert into public.estimated_qual (id) values (1) on conflict (id) do nothing;   -- Standard: aus, nichts veröffentlicht

create or replace function public.estimated_qual_touch()
returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if (new.draft_points, new.draft_image) is distinct from (old.draft_points, old.draft_image) then
    new.draft_updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists estimated_qual_touch on public.estimated_qual;
create trigger estimated_qual_touch before update on public.estimated_qual
  for each row execute function public.estimated_qual_touch();

-- Zugriffsschutz: nur Administratoren lesen und ändern. Geändert werden dürfen nur Schalter und Entwurf.
alter table public.estimated_qual enable row level security;
drop policy if exists estimated_qual_admin_select on public.estimated_qual;
create policy estimated_qual_admin_select on public.estimated_qual
  for select to authenticated using (public.is_admin());
drop policy if exists estimated_qual_admin_update on public.estimated_qual;
create policy estimated_qual_admin_update on public.estimated_qual
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Bewusst keine Policy für insert/delete: die Zeile ist fest vorhanden.
revoke all on table public.estimated_qual from anon, authenticated;
grant select on table public.estimated_qual to authenticated;
grant update (enabled, draft_points, draft_image) on table public.estimated_qual to authenticated;   -- veröffentlichte Spalten nur per RPC

-- ---------- Öffentliche Anzeige: nur der veröffentlichte Stand, nur wenn eingeschaltet und gültig ----------
create or replace function public.estimated_qual_public()
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
           when q.enabled and q.published_points between 1 and 999999
           then jsonb_build_object('points', q.published_points, 'image', q.published_image, 'published_at', q.published_at)
         end
  from public.estimated_qual q
  where q.id = 1;
$$;

-- ---------- Veröffentlichen: Entwurf -> veröffentlichter Stand ----------
create or replace function public.estimated_qual_publish()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.estimated_qual;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.estimated_qual
     set published_points = draft_points,
         published_image  = draft_image,
         published_at     = now(),
         published_by     = (select auth.uid())
   where id = 1 and draft_points between 1 and 999999
   returning * into r;
  if not found then
    raise exception 'no_valid_draft' using errcode = 'P0001';
  end if;
  return jsonb_build_object('points', r.published_points, 'image', r.published_image, 'published_at', r.published_at);
end;
$$;

-- Funktionsrechte: Standard von Supabase (alles offen) zurücknehmen, dann gezielt vergeben
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.estimated_qual_touch() from public, anon, authenticated;
revoke all on function public.estimated_qual_public() from public, anon, authenticated;
revoke all on function public.estimated_qual_publish() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.estimated_qual_public() to anon, authenticated;
grant execute on function public.estimated_qual_publish() to authenticated;   -- prüft is_admin() selbst

-- ---------- Bildspeicher (Supabase Storage) ----------
-- Öffentlicher Bucket: Besucher laden das veröffentlichte Bild über seine Adresse. Hochladen, Ersetzen und Löschen
-- dürfen nur Administratoren (Policies unten). Dateityp und Größe prüft der Storage-Dienst serverseitig.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estimated-qual', 'estimated-qual', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists estimated_qual_images_select on storage.objects;
create policy estimated_qual_images_select on storage.objects
  for select to authenticated using (bucket_id = 'estimated-qual' and public.is_admin());

drop policy if exists estimated_qual_images_insert on storage.objects;
create policy estimated_qual_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'estimated-qual' and public.is_admin()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');

drop policy if exists estimated_qual_images_update on storage.objects;
create policy estimated_qual_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'estimated-qual' and public.is_admin())
  with check (bucket_id = 'estimated-qual' and public.is_admin()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');

drop policy if exists estimated_qual_images_delete on storage.objects;
create policy estimated_qual_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'estimated-qual' and public.is_admin());

commit;

-- =====================================================================================
-- ADMIN FESTLEGEN (einmalig, von Hand im SQL Editor; nicht Teil der automatischen Ausführung)
--
-- Variante A: über deine E-Mail-Adresse. Die Datenbank sucht die interne Nutzer-ID (UUID) heraus und speichert nur diese.
--   Ersetze DEINE@EMAIL durch die Adresse, mit der du dich bei KREVO angemeldet hast, und führe aus:
--
--   insert into public.admins (user_id)
--   select id from auth.users where lower(email) = lower('DEINE@EMAIL')
--   on conflict do nothing;
--
-- Variante B: über die Nutzer-ID (Supabase: Authentication -> Users -> Spalte "User UID"):
--
--   insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000000');
--
-- Prüfen (muss genau deine Adresse zeigen):
--
--   select a.user_id, u.email from public.admins a join auth.users u on u.id = a.user_id;
--
-- Admin wieder entziehen:
--
--   delete from public.admins where user_id = '00000000-0000-0000-0000-000000000000';
-- =====================================================================================
