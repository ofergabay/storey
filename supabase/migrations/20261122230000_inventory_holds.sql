-- Inventory tables for Cloud Nine.
-- This file does not insert or change pool quantities.
-- The 24-pack PILOT-01 fixture lives in supabase/seed/dev_pilot_stock.sql.
-- storey-dev already has these tables. Do not re-run this file there.
-- Saving a quote must not hold stock. The separate checkout hold is added in
-- 20261122230100_begin_checkout.sql.

create table if not exists public.inventory_pools (
  id uuid primary key,
  offer_id uuid not null references public.supplier_offers (id),
  warehouse_code text not null,
  bucket text not null check (bucket in ('shared_free', 'safety_buffer')),
  quantity integer not null check (quantity >= 0),
  unique (offer_id, warehouse_code, bucket)
);

create table if not exists public.checkout_holds (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.checkout_quotes (id),
  offer_id uuid not null references public.supplier_offers (id),
  quantity integer not null check (quantity > 0),
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.inventory_pools enable row level security;
alter table public.checkout_holds enable row level security;
revoke all on table public.inventory_pools from public, anon, authenticated;
revoke all on table public.checkout_holds from public, anon, authenticated;

create or replace function public.release_expired_checkout_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
  hold public.checkout_holds%rowtype;
begin
  perform set_config('row_security', 'off', true);

  for hold in
    select saved.*
    from public.checkout_holds as saved
    where saved.released_at is null
      and saved.expires_at <= now()
    order by saved.id
    for update
  loop
    update public.inventory_pools
      set quantity = quantity + hold.quantity
    where offer_id = hold.offer_id
      and warehouse_code = 'PILOT-01'
      and bucket = 'shared_free';

    update public.checkout_holds
      set released_at = now()
    where id = hold.id
      and released_at is null;

    released_count := released_count + hold.quantity;
  end loop;

  return released_count;
end;
$$;

create or replace function public.create_cloud_nine_quote_with_hold(
  quantity integer,
  recipient_name text,
  phone text,
  city text,
  street text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote jsonb;
  quote_id uuid;
  free_qty integer;
  buffer_qty integer;
  requested integer;
  expires_at timestamptz;
begin
  perform set_config('row_security', 'off', true);
  perform pg_advisory_xact_lock(722211001);
  requested := quantity;
  perform public.release_expired_checkout_holds();

  select pool.quantity
    into free_qty
  from public.inventory_pools as pool
  where pool.offer_id = '22222222-2222-4222-8222-222222222222'
    and pool.warehouse_code = 'PILOT-01'
    and pool.bucket = 'shared_free'
  for update;

  select pool.quantity
    into buffer_qty
  from public.inventory_pools as pool
  where pool.offer_id = '22222222-2222-4222-8222-222222222222'
    and pool.warehouse_code = 'PILOT-01'
    and pool.bucket = 'safety_buffer';

  if free_qty is null or requested is null or requested < 1 or free_qty - coalesce(buffer_qty, 0) < requested then
    raise exception 'stock changed';
  end if;

  quote := public.create_cloud_nine_quote(requested, recipient_name, phone, city, street);
  quote_id := (quote->>'id')::uuid;
  expires_at := now() + interval '10 minutes';

  update public.inventory_pools as pool
    set quantity = pool.quantity - requested
  where pool.offer_id = '22222222-2222-4222-8222-222222222222'
    and pool.warehouse_code = 'PILOT-01'
    and pool.bucket = 'shared_free';

  insert into public.checkout_holds (quote_id, offer_id, quantity, expires_at)
  values (
    quote_id,
    '22222222-2222-4222-8222-222222222222',
    requested,
    expires_at
  );

  return quote || jsonb_build_object(
    'hold_quantity', requested,
    'hold_expires_at', expires_at
  );
end;
$$;

create or replace function public.read_cloud_nine_quote(quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote public.checkout_quotes%rowtype;
  hold public.checkout_holds%rowtype;
begin
  perform set_config('row_security', 'off', true);

  select saved.*
    into quote
  from public.checkout_quotes as saved
  join public.seller_listings as listing on listing.id = saved.listing_id
  join public.sellers as seller on seller.id = listing.seller_id
  where saved.id = quote_id
    and seller.slug = 'maya'
    and listing.slug = 'cloud-nine';

  if not found then
    return null;
  end if;

  select saved.*
    into hold
  from public.checkout_holds as saved
  where saved.quote_id = quote.id
    and saved.released_at is null;

  return jsonb_build_object(
    'id', quote.id,
    'quantity', quote.quantity,
    'unit_retail_agorot', quote.unit_retail_agorot,
    'merchandise_agorot', quote.merchandise_agorot,
    'recipient_name', quote.recipient_name,
    'phone', quote.phone,
    'city', quote.city,
    'street', quote.street,
    'hold_quantity', hold.quantity,
    'hold_expires_at', hold.expires_at
  );
end;
$$;

revoke all on function public.release_expired_checkout_holds() from public, anon, authenticated;
revoke all on function public.create_cloud_nine_quote_with_hold(integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.read_cloud_nine_quote(uuid) from public, anon, authenticated;
grant execute on function public.create_cloud_nine_quote_with_hold(integer, text, text, text, text) to anon, authenticated;
grant execute on function public.read_cloud_nine_quote(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
