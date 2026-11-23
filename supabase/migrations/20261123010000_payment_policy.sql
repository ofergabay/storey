-- Local payment workflow tables and atomic commands.
-- Review before running. This file does not change publish_listing,
-- begin_cloud_nine_checkout, quote functions, or inventory_pools.
-- Historic charges stay on the policy stored with them.
-- Apply it only to an isolated local database. Do not run it on storey-dev.

create table if not exists public.payment_policies (
  order_ref text primary key,
  seller_handle text not null,
  policy_version text not null,
  currency text not null default 'ILS' check (currency = 'ILS'),
  charge_agorot integer not null check (charge_agorot >= 0),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_attempts (
  attempt_key text primary key,
  order_ref text not null references public.payment_policies (order_ref),
  provider_ref text unique,
  status text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_commands (
  command_key text primary key,
  payload_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_journals (
  id bigint generated always as identity primary key,
  order_ref text not null references public.payment_policies (order_ref),
  entry_key text not null,
  account text not null,
  debit_agorot integer not null check (debit_agorot >= 0),
  credit_agorot integer not null check (credit_agorot >= 0),
  created_at timestamptz not null default now()
);

create index if not exists payment_journals_entry_idx
  on public.payment_journals (entry_key);

create table if not exists public.payment_provider_events (
  provider_event_id text primary key,
  operation_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_stock (
  sku text primary key,
  free_qty integer not null check (free_qty >= 0),
  committed_qty integer not null check (committed_qty >= 0)
);

create table if not exists public.payment_units (
  order_ref text not null references public.payment_policies (order_ref),
  unit_id text not null,
  supplier_id text not null,
  stage text not null,
  allocation jsonb not null,
  primary key (order_ref, unit_id)
);

create table if not exists public.payment_outbox (
  event_key text primary key,
  order_ref text not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (order_ref, kind)
);

create table if not exists public.payment_inbox (
  provider_event_id text primary key,
  provider_ref text not null,
  operation_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.simulated_provider_charges (
  provider_ref text primary key,
  order_ref text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  status text not null,
  lines jsonb not null
);

create table if not exists public.payment_refund_reservations (
  reservation_key text primary key,
  order_ref text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  path text not null check (path in ('payable', 'recovery')),
  payload_hash text not null
);

create table if not exists public.payment_payout_claims (
  claim_key text primary key,
  order_ref text not null,
  party text not null,
  amount_agorot integer not null check (amount_agorot >= 0),
  status text not null,
  unique (order_ref, party)
);

create table if not exists public.payment_backorders (
  order_ref text not null,
  unit_id text not null,
  deadline timestamptz not null,
  decision text not null check (decision in ('offered', 'accepted', 'rejected', 'timed_out')),
  primary key (order_ref, unit_id)
);

create table if not exists public.payment_inspections (
  inspection_key text primary key,
  order_ref text not null,
  unit_id text not null,
  disposition text not null check (disposition in ('sellable', 'quarantine', 'loss')),
  stock_source text not null,
  refund_agorot integer not null check (refund_agorot >= 0)
);

alter table public.payment_policies enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_commands enable row level security;
alter table public.payment_journals enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.payment_stock enable row level security;
alter table public.payment_units enable row level security;
alter table public.payment_outbox enable row level security;
alter table public.payment_inbox enable row level security;
alter table public.simulated_provider_charges enable row level security;
alter table public.payment_refund_reservations enable row level security;
alter table public.payment_payout_claims enable row level security;
alter table public.payment_backorders enable row level security;
alter table public.payment_inspections enable row level security;

revoke all on public.payment_policies from public, anon, authenticated;
revoke all on public.payment_attempts from public, anon, authenticated;
revoke all on public.payment_commands from public, anon, authenticated;
revoke all on public.payment_journals from public, anon, authenticated;
revoke all on public.payment_provider_events from public, anon, authenticated;
revoke all on public.payment_stock from public, anon, authenticated;
revoke all on public.payment_units from public, anon, authenticated;
revoke all on public.payment_outbox from public, anon, authenticated;
revoke all on public.payment_inbox from public, anon, authenticated;
revoke all on public.simulated_provider_charges from public, anon, authenticated;
revoke all on public.payment_refund_reservations from public, anon, authenticated;
revoke all on public.payment_payout_claims from public, anon, authenticated;
revoke all on public.payment_backorders from public, anon, authenticated;
revoke all on public.payment_inspections from public, anon, authenticated;

create or replace function public.payment_accept_quote(
  p_order text,
  p_seller text,
  p_version text,
  p_charge integer,
  p_snapshot jsonb
) returns text
language plpgsql
as $$
begin
  insert into public.payment_policies (order_ref, seller_handle, policy_version, charge_agorot, snapshot)
  values (p_order, p_seller, p_version, p_charge, p_snapshot);
  insert into public.payment_commands (command_key, payload_hash)
  values ('quote:' || p_order, p_version || ':' || p_charge::text);
  return 'accepted';
exception when unique_violation then
  return 'replay';
end;
$$;

create or replace function public.payment_hold_one(p_buyer text, p_sku text) returns boolean
language plpgsql
as $$
declare
  updated integer;
begin
  update public.payment_stock
    set free_qty = free_qty - 1, committed_qty = committed_qty + 1
    where sku = p_sku and free_qty >= 1;
  get diagnostics updated = row_count;
  if updated <> 1 then
    return false;
  end if;
  insert into public.payment_commands (command_key, payload_hash)
  values ('hold:' || p_buyer, p_sku);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.payment_confirm_capture(
  p_order text,
  p_ref text,
  p_event text,
  p_hash text,
  p_lines jsonb
) returns text
language plpgsql
as $$
declare
  prior text;
  line jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('capture:' || p_order));
  select payload_hash into prior from public.payment_commands where command_key = 'capture:' || p_order;
  if found then
    if prior = p_hash then
      return 'replay';
    end if;
    raise exception 'conflict';
  end if;
  insert into public.payment_commands (command_key, payload_hash) values ('capture:' || p_order, p_hash);
  for line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.payment_journals (order_ref, entry_key, account, debit_agorot, credit_agorot)
    values (
      p_order,
      'capture:' || p_order,
      line->>'account',
      (line->>'debit')::integer,
      (line->>'credit')::integer
    );
  end loop;
  insert into public.payment_outbox (event_key, order_ref, kind, payload)
  values ('fo:' || p_order, p_order, 'fo-release', jsonb_build_object('providerRef', p_ref));
  insert into public.payment_inbox (provider_event_id, provider_ref, operation_id, payload)
  values (p_event, p_ref, 'capture:' || p_order, jsonb_build_object('hash', p_hash));
  update public.payment_attempts set status = 'captured' where provider_ref = p_ref;
  return 'captured';
end;
$$;

create or replace function public.payment_record_unknown(p_order text, p_ref text, p_amount integer, p_lines jsonb) returns text
language plpgsql
as $$
begin
  insert into public.simulated_provider_charges (provider_ref, order_ref, amount_agorot, status, lines)
  values (p_ref, p_order, p_amount, 'captured', p_lines);
  insert into public.payment_attempts (attempt_key, order_ref, provider_ref, status, amount_agorot)
  values ('attempt:' || p_order, p_order, p_ref, 'unknown', p_amount);
  return 'unknown';
end;
$$;

create or replace function public.payment_recover_capture(p_ref text) returns text
language plpgsql
as $$
declare
  charge public.simulated_provider_charges%rowtype;
begin
  select * into charge from public.simulated_provider_charges where provider_ref = p_ref;
  if not found then
    return 'missing';
  end if;
  if charge.status <> 'captured' then
    return 'pending';
  end if;
  return public.payment_confirm_capture(charge.order_ref, charge.provider_ref, 'recover:' || charge.provider_ref, 'recovered', charge.lines);
end;
$$;

create or replace function public.payment_decide_unit(p_unit text, p_action text) returns text
language plpgsql
as $$
declare
  current_stage text;
begin
  select stage into current_stage from public.payment_units where unit_id = p_unit for update;
  if current_stage is null then
    return 'missing';
  end if;
  if current_stage <> 'committed' then
    return current_stage;
  end if;
  if p_action = 'stop' then
    update public.payment_units set stage = 'canceled' where unit_id = p_unit;
    return 'canceled';
  end if;
  update public.payment_units set stage = 'handed' where unit_id = p_unit;
  return 'handed';
end;
$$;

create or replace function public.payment_claim_transfer_after_wait(
  p_order text,
  p_party text,
  p_key text,
  p_amount integer
) returns text
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('exposure:' || p_order));
  perform pg_sleep(0.4);
  return public.payment_claim_transfer(p_order, p_party, p_key, p_amount);
end;
$$;

create or replace function public.payment_claim_transfer(
  p_order text,
  p_party text,
  p_key text,
  p_amount integer
) returns text
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('exposure:' || p_order));
  if exists (select 1 from public.payment_payout_claims where order_ref = p_order and party = p_party) then
    return 'replay';
  end if;
  if exists (select 1 from public.payment_refund_reservations where order_ref = p_order and path = 'payable') then
    return 'blocked';
  end if;
  insert into public.payment_payout_claims (claim_key, order_ref, party, amount_agorot, status)
  values (p_key, p_order, p_party, p_amount, 'claimed');
  return 'claimed';
exception when unique_violation then
  return 'replay';
end;
$$;

create or replace function public.payment_reserve_refund(
  p_order text,
  p_key text,
  p_amount integer
) returns text
language plpgsql
as $$
declare
  path_name text;
begin
  perform pg_advisory_xact_lock(hashtext('exposure:' || p_order));
  if exists (select 1 from public.payment_refund_reservations where reservation_key = p_key) then
    return 'replay';
  end if;
  if exists (select 1 from public.payment_payout_claims where order_ref = p_order) then
    path_name := 'recovery';
  else
    path_name := 'payable';
  end if;
  insert into public.payment_refund_reservations (reservation_key, order_ref, amount_agorot, path, payload_hash)
  values (p_key, p_order, p_amount, path_name, path_name);
  return path_name;
exception when unique_violation then
  return 'replay';
end;
$$;
