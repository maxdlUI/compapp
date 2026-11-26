-- Repline 1.10: new wheel items. Overlay skins (Windows app), timer ring styles and sound packs.
-- They join the normal item pool of spin_drop() automatically. Gold skin stays exclusive (Pro forever only).
-- Safe to run more than once.

alter table public.drop_items drop constraint if exists drop_items_kind_check;
alter table public.drop_items add constraint drop_items_kind_check
  check (kind in ('theme', 'bg', 'title', 'color', 'skin', 'ring', 'sound'));

insert into public.drop_items (id, kind, name, value, exclusive) values
  ('skin_neon',     'skin',  'Neon overlay',      'neon',    false),
  ('skin_carbon',   'skin',  'Carbon overlay',    'carbon',  false),
  ('skin_glass',    'skin',  'Glass overlay',     'glass',   false),
  ('skin_gold',     'skin',  'Gold overlay',      'gold',    true),
  ('ring_neon',     'ring',  'Neon timer ring',   'neon',    false),
  ('ring_bold',     'ring',  'Bold timer ring',   'bold',    false),
  ('ring_thin',     'ring',  'Thin timer ring',   'thin',    false),
  ('ring_pulse',    'ring',  'Pulse timer ring',  'pulse',   false),
  ('sound_coin',    'sound', 'Coin sound pack',   'coin',    false),
  ('sound_victory', 'sound', 'Victory sound pack','victory', false),
  ('sound_synth',   'sound', 'Synth sound pack',  'synth',   false),
  ('sound_horn',    'sound', 'Air horn sound pack','horn',   false)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, value = excluded.value, exclusive = excluded.exclusive;

-- Pro forever also gets the gold overlay (next to gold theme and gold name)
create or replace function public.grant_gold_skin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.item = 'theme_gold' then
    insert into public.user_items (user_id, item) values (new.user_id, 'skin_gold') on conflict do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists user_items_gold_skin on public.user_items;
create trigger user_items_gold_skin after insert on public.user_items for each row execute function public.grant_gold_skin();
insert into public.user_items (user_id, item) select user_id, 'skin_gold' from public.user_items where item = 'theme_gold' on conflict do nothing;
