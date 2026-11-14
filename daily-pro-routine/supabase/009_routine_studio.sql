-- Repline Routine Studio: the public routines and their blocks live in the database.
-- Every publish is a new version (the newest row is live). Everyone can read; only dev accounts can publish
-- or restore. Pictures for blocks go to the public storage bucket "set-images" (upload only for devs).
-- Safe to run more than once.

create table if not exists public.routine_catalog (
  id bigint generated always as identity primary key,
  data jsonb not null check (jsonb_typeof(data -> 'sets') = 'object' and jsonb_typeof(data -> 'goals') = 'array'),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.routine_catalog enable row level security;
drop policy if exists "catalog read" on public.routine_catalog;
create policy "catalog read" on public.routine_catalog for select to anon, authenticated using (true);

create or replace function public.is_dev_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_dev from public.profiles where id = auth.uid()), false);
$$;

-- Publish a new version. Returns its id.
create or replace function public.publish_catalog(d jsonb, note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare nid bigint;
begin
  if not public.is_dev_user() then raise exception 'not_dev'; end if;
  if jsonb_typeof(d -> 'sets') <> 'object' or jsonb_typeof(d -> 'goals') <> 'array' or jsonb_array_length(d -> 'goals') = 0 then raise exception 'bad_catalog'; end if;
  if octet_length(d::text) > 900000 then raise exception 'too_big'; end if;
  insert into public.routine_catalog (data, note, created_by) values (d, left(note, 140), auth.uid()) returning id into nid;
  -- keep the last 100 versions
  delete from public.routine_catalog where id < (select min(id) from (select id from public.routine_catalog order by id desc limit 100) k);
  return nid;
end; $$;

-- Recent versions for the studio.
create or replace function public.catalog_versions()
returns table (id bigint, created_at timestamptz, username text, note text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.created_at, p.username, c.note from public.routine_catalog c left join public.profiles p on p.id = c.created_by
  where public.is_dev_user() order by c.id desc limit 30;
$$;

-- Make an older version live again (as a new version, so nothing is lost).
create or replace function public.restore_catalog(vid bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare nid bigint;
begin
  if not public.is_dev_user() then raise exception 'not_dev'; end if;
  insert into public.routine_catalog (data, note, created_by)
    select data, 'Restored version ' || vid, auth.uid() from public.routine_catalog where id = vid returning id into nid;
  if nid is null then raise exception 'not_found'; end if;
  return nid;
end; $$;

revoke all on function public.publish_catalog(jsonb, text), public.catalog_versions(), public.restore_catalog(bigint) from public, anon;
grant execute on function public.publish_catalog(jsonb, text), public.catalog_versions(), public.restore_catalog(bigint) to authenticated;

-- ---------- Pictures ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('set-images', 'set-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "set images read" on storage.objects;
drop policy if exists "set images dev upload" on storage.objects;
drop policy if exists "set images dev update" on storage.objects;
drop policy if exists "set images dev delete" on storage.objects;
create policy "set images read" on storage.objects for select to anon, authenticated using (bucket_id = 'set-images');
create policy "set images dev upload" on storage.objects for insert to authenticated with check (bucket_id = 'set-images' and public.is_dev_user());
create policy "set images dev update" on storage.objects for update to authenticated using (bucket_id = 'set-images' and public.is_dev_user());
create policy "set images dev delete" on storage.objects for delete to authenticated using (bucket_id = 'set-images' and public.is_dev_user());
