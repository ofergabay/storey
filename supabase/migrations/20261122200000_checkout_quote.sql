-- Checkout quote for the published Cloud Nine listing.
-- Merchandise total is the published pack price times quantity.
-- Tax, freight, payment, and stock are not stored and are not changed.

create table if not exists public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.seller_listings (id),
  quantity integer not null check (quantity between 1 and 20),
  unit_retail_agorot integer not null check (unit_retail_agorot > 0),
  merchandise_agorot integer not null check (merchandise_agorot > 0),
  recipient_name text not null check (char_length(recipient_name) between 2 and 80),
  phone text not null check (char_length(phone) between 9 and 15),
  city text not null check (char_length(city) between 2 and 40),
  street text not null check (char_length(street) between 2 and 80),
  created_at timestamptz not null default now(),
  check (merchandise_agorot = unit_retail_agorot * quantity)
);

alter table public.checkout_quotes enable row level security;

revoke all on table public.checkout_quotes from public, anon, authenticated;

create or replace function public.create_cloud_nine_quote(
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
  listing_id uuid;
  unit_price integer;
  merchandise integer;
  clean_name text;
  clean_phone text;
  clean_city text;
  clean_street text;
  quote_id uuid;
begin
  perform set_config('row_security', 'off', true);

  if quantity is null or quantity < 1 or quantity > 20 then
    raise exception 'invalid quantity';
  end if;

  clean_name := regexp_replace(btrim(coalesce(recipient_name, '')), '\s+', ' ', 'g');
  clean_phone := regexp_replace(coalesce(phone, ''), '[[:space:]-]', '', 'g');
  clean_city := regexp_replace(btrim(coalesce(city, '')), '\s+', ' ', 'g');
  clean_street := regexp_replace(btrim(coalesce(street, '')), '\s+', ' ', 'g');

  if char_length(clean_name) < 2 or char_length(clean_name) > 80
    or clean_name ~ '[[:cntrl:]]'
    or clean_phone !~ '^(0[0-9]{8,9}|\+972[0-9]{8,9})$'
    or char_length(clean_city) < 2 or char_length(clean_city) > 40
    or clean_city ~ '[[:cntrl:]]'
    or char_length(clean_street) < 2 or char_length(clean_street) > 80
    or clean_street ~ '[[:cntrl:]]' then
    raise exception 'invalid details';
  end if;

  select listing.id, listing.published_retail_agorot
    into listing_id, unit_price
  from public.seller_listings as listing
  join public.sellers as seller on seller.id = listing.seller_id
  where seller.slug = 'maya'
    and listing.slug = 'cloud-nine';

  if listing_id is null or unit_price is null or unit_price <= 0 then
    raise exception 'listing inactive';
  end if;

  if unit_price > 2000000000 / quantity then
    raise exception 'invalid quantity';
  end if;

  merchandise := unit_price * quantity;

  insert into public.checkout_quotes (
    listing_id,
    quantity,
    unit_retail_agorot,
    merchandise_agorot,
    recipient_name,
    phone,
    city,
    street
  )
  values (
    listing_id,
    quantity,
    unit_price,
    merchandise,
    clean_name,
    clean_phone,
    clean_city,
    clean_street
  )
  returning id into quote_id;

  return jsonb_build_object(
    'id', quote_id,
    'quantity', quantity,
    'unit_retail_agorot', unit_price,
    'merchandise_agorot', merchandise,
    'recipient_name', clean_name,
    'phone', clean_phone,
    'city', clean_city,
    'street', clean_street
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

  return jsonb_build_object(
    'id', quote.id,
    'quantity', quote.quantity,
    'unit_retail_agorot', quote.unit_retail_agorot,
    'merchandise_agorot', quote.merchandise_agorot,
    'recipient_name', quote.recipient_name,
    'phone', quote.phone,
    'city', quote.city,
    'street', quote.street
  );
end;
$$;

revoke all on function public.create_cloud_nine_quote(integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.read_cloud_nine_quote(uuid) from public, anon, authenticated;
grant execute on function public.create_cloud_nine_quote(integer, text, text, text, text) to anon, authenticated;
grant execute on function public.read_cloud_nine_quote(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
