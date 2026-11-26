-- Repline: a Discord DM from the Repline bot when a dev gifts a plan.
-- dev_gift() now calls the "remind" edge function right away (with {"gifts": true}); the function claims every
-- new gift notice (dm_at) and sends the DM once. The 5-minute cron picks up anything that was missed.
-- Safe to run more than once.

alter table public.notices add column if not exists dm_at timestamptz;
-- Gifts made before this change already showed in the app: don't DM them now.
update public.notices set dm_at = created_at where kind = 'gift' and dm_at is null;

create or replace function public.dev_gift(discord_name text, gift_plan text, months integer, note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid; tname text; sender text;
begin
  select username into sender from public.profiles where id = me and is_dev;
  if not found then raise exception 'not_dev'; end if;
  if gift_plan not in ('standard', 'pro') or months is null or months < 1 or months > 12 then raise exception 'bad_input'; end if;
  select id, username into target, tname from public.profiles where lower(username) = lower(trim(both '@' from trim(discord_name))) limit 1;
  if target is null then raise exception 'not_found'; end if;
  perform public.grant_plan(target, gift_plan, months * 30);
  insert into public.notices (user_id, kind, payload) values (target, 'gift',
    jsonb_build_object('plan', gift_plan, 'months', months, 'from', sender, 'note', nullif(left(trim(coalesce(note, '')), 140), '')));
  insert into public.rewards (user_id, kind, period) values (target, 'gift', now()::text) on conflict do nothing;
  -- Send the Discord DM now (runs after this transaction commits; a failure here never blocks the gift).
  begin
    perform net.http_post(
      url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/remind',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"gifts": true}'::jsonb
    );
  exception when others then null;
  end;
  return jsonb_build_object('username', tname, 'until', (select bonus_until from public.profiles where id = target));
end; $$;
revoke all on function public.dev_gift(text, text, integer, text) from public, anon;
grant execute on function public.dev_gift(text, text, integer, text) to authenticated;
