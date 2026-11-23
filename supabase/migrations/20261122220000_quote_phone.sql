-- Tighten Cloud Nine quote phones to Israeli national numbers.
-- +972 and 00972 are stored as the local 0-prefixed form.
-- Existing quotes are left unchanged.

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
  clean_phone := regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g');
  clean_city := regexp_replace(btrim(coalesce(city, '')), '\s+', ' ', 'g');
  clean_street := regexp_replace(btrim(coalesce(street, '')), '\s+', ' ', 'g');

  if left(clean_phone, 1) = '+' then
    clean_phone := substr(clean_phone, 2);
  end if;
  if left(clean_phone, 5) = '00972' then
    clean_phone := substr(clean_phone, 6);
  elsif left(clean_phone, 3) = '972' then
    clean_phone := substr(clean_phone, 4);
  end if;
  if left(clean_phone, 1) is distinct from '0' then
    clean_phone := '0' || clean_phone;
  end if;

  if char_length(clean_name) < 2 or char_length(clean_name) > 80
    or clean_name ~ '[[:cntrl:]]'
    or clean_phone !~ '^(0(5[0-9]{8}|[23489][0-9]{7}|7[0-9]{8}))$'
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

revoke all on function public.create_cloud_nine_quote(integer, text, text, text, text) from public;
grant execute on function public.create_cloud_nine_quote(integer, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
