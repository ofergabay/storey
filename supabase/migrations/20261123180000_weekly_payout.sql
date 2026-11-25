-- Weekly payout claims for weekly-2026-11.
-- Review before running. This file does not change inventory_pools,
-- publish_listing, begin_cloud_nine_checkout, or stored pay-2026-11 rows.
-- Apply it only to an isolated local database. Do not run it on storey-dev.

create table if not exists public.payment_delivery_events (
  order_ref text not null,
  parcel_id text not null,
  event_key text not null,
  primary key (order_ref, parcel_id)
);

create table if not exists public.payment_weekly_open (
  balance_key text primary key,
  beneficiary text not null,
  order_ref text not null,
  creator_id text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  freight_agorot integer not null check (freight_agorot >= 0),
  status text not null check (status in ('open', 'reserved', 'paid'))
);

create table if not exists public.payment_weekly_payouts (
  payout_key text primary key,
  beneficiary text not null,
  week_key text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  instruction_ref text not null,
  bank_ref text,
  lines jsonb not null,
  unique (beneficiary, week_key)
);

alter table public.payment_delivery_events enable row level security;
alter table public.payment_weekly_open enable row level security;
alter table public.payment_weekly_payouts enable row level security;

revoke all on public.payment_delivery_events from public, anon, authenticated;
revoke all on public.payment_weekly_open from public, anon, authenticated;
revoke all on public.payment_weekly_payouts from public, anon, authenticated;

create or replace function public.payment_mark_delivered(
  p_order text,
  p_parcel text,
  p_event text
) returns text
language plpgsql
as $$
begin
  insert into public.payment_delivery_events (order_ref, parcel_id, event_key)
  values (p_order, p_parcel, p_event);
  return 'delivered';
exception when unique_violation then
  return 'replay';
end;
$$;

create or replace function public.payment_weekly_payout(
  p_beneficiary text,
  p_week text,
  p_instruction text
) returns text
language plpgsql
as $$
declare
  total integer;
  detail jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('weekly:' || p_beneficiary));
  if exists (
    select 1 from public.payment_weekly_payouts
    where beneficiary = p_beneficiary and week_key = p_week
  ) then
    return 'replay';
  end if;
  select coalesce(sum(amount_agorot), 0), coalesce(jsonb_agg(jsonb_build_object(
    'balance', balance_key,
    'order', order_ref,
    'creator', creator_id,
    'amount', amount_agorot,
    'freight', freight_agorot
  )), '[]'::jsonb)
    into total, detail
  from public.payment_weekly_open
  where beneficiary = p_beneficiary and status = 'open';
  if total < 1 then
    return 'empty';
  end if;
  insert into public.payment_weekly_payouts (
    payout_key, beneficiary, week_key, amount_agorot, instruction_ref, lines
  ) values (
    p_beneficiary || ':' || p_week, p_beneficiary, p_week, total, p_instruction, detail
  );
  update public.payment_weekly_open
    set status = 'paid'
    where beneficiary = p_beneficiary and status = 'open';
  return 'paid';
exception when unique_violation then
  return 'replay';
end;
$$;

create or replace function public.payment_weekly_refund(
  p_beneficiary text,
  p_balance text,
  p_key text
) returns text
language plpgsql
as $$
declare
  current_status text;
begin
  perform pg_advisory_xact_lock(hashtext('weekly:' || p_beneficiary));
  select status into current_status
  from public.payment_weekly_open
  where balance_key = p_balance and beneficiary = p_beneficiary
  for update;
  if current_status is null then
    return 'missing';
  end if;
  if current_status = 'reserved' then
    return 'replay';
  end if;
  if current_status = 'paid' then
    insert into public.payment_refund_reservations (reservation_key, order_ref, amount_agorot, path, payload_hash)
    values (p_key, p_balance, 0, 'recovery', 'recovery')
    on conflict (reservation_key) do nothing;
    return 'recovery';
  end if;
  update public.payment_weekly_open set status = 'reserved' where balance_key = p_balance;
  insert into public.payment_refund_reservations (reservation_key, order_ref, amount_agorot, path, payload_hash)
  values (p_key, p_balance, 0, 'payable', 'payable');
  return 'payable';
exception when unique_violation then
  return 'replay';
end;
$$;
