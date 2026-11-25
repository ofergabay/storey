-- PayMe callback and financial-operation dedupe.
-- Review before running. This file does not change inventory_pools,
-- publish_listing, begin_cloud_nine_checkout, or stored pay-2026-11 rows.
-- Apply it only to an isolated local database. Do not run it on storey-dev.

create table if not exists public.payment_payme_callbacks (
  callback_key text primary key,
  sale_id text not null,
  order_ref text not null
);

create table if not exists public.payment_payme_operations (
  operation_key text primary key,
  sale_id text not null,
  order_ref text not null,
  amount_agorot integer not null check (amount_agorot >= 0)
);

alter table public.payment_payme_callbacks enable row level security;
alter table public.payment_payme_operations enable row level security;
revoke all on public.payment_payme_callbacks from public, anon, authenticated;
revoke all on public.payment_payme_operations from public, anon, authenticated;

create or replace function public.payment_payme_callback(p_key text, p_sale text, p_order text)
returns text
language plpgsql
as $$
begin
  insert into public.payment_payme_callbacks (callback_key, sale_id, order_ref)
  values (p_key, p_sale, p_order)
  on conflict (callback_key) do nothing;
  if not found then
    return 'replay';
  end if;
  return 'recorded';
end;
$$;

create or replace function public.payment_payme_claim(p_key text, p_sale text, p_order text, p_amount integer)
returns text
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('payme:' || p_key));
  if exists (select 1 from public.payment_payme_operations where operation_key = p_key) then
    return 'replay';
  end if;
  insert into public.payment_payme_operations (operation_key, sale_id, order_ref, amount_agorot)
  values (p_key, p_sale, p_order, p_amount);
  return 'claimed';
end;
$$;
