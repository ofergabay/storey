-- Split the 10-minute hold from saving a quote.
-- Does not insert pool rows and does not update quantities except inside
-- begin_cloud_nine_checkout and release_expired_checkout_holds.
-- Saving a quote stays on create_cloud_nine_quote, which does not touch stock.
-- The buyer starts the hold by calling begin_cloud_nine_checkout(quote_id).

create or replace function public.begin_cloud_nine_checkout(quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote public.checkout_quotes%rowtype;
  existing public.checkout_holds%rowtype;
  free_qty integer;
  buffer_qty integer;
  result jsonb;
begin
  perform set_config('row_security', 'off', true);

  if quote_id is null then
    raise exception 'quote missing';
  end if;

  perform pg_advisory_xact_lock(722211001);

  select saved.*
    into quote
  from public.checkout_quotes as saved
  where saved.id = quote_id
  for update;

  if not found then
    raise exception 'quote missing';
  end if;

  select saved.*
    into existing
  from public.checkout_holds as saved
  where saved.quote_id = quote.id
  for update;

  if found and existing.released_at is null and existing.expires_at > now() then
    result := public.read_cloud_nine_quote(quote.id);
    if result is null then
      raise exception 'quote missing';
    end if;
    return result;
  end if;

  perform public.release_expired_checkout_holds();

  select saved.*
    into existing
  from public.checkout_holds as saved
  where saved.quote_id = quote.id;

  if found then
    raise exception 'hold ended';
  end if;

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

  if free_qty is null or free_qty - coalesce(buffer_qty, 0) < quote.quantity then
    raise exception 'stock changed';
  end if;

  update public.inventory_pools as pool
    set quantity = pool.quantity - quote.quantity
  where pool.offer_id = '22222222-2222-4222-8222-222222222222'
    and pool.warehouse_code = 'PILOT-01'
    and pool.bucket = 'shared_free';

  insert into public.checkout_holds (quote_id, offer_id, quantity, expires_at)
  values (
    quote.id,
    '22222222-2222-4222-8222-222222222222',
    quote.quantity,
    now() + interval '10 minutes'
  );

  result := public.read_cloud_nine_quote(quote.id);
  if result is null then
    raise exception 'quote missing';
  end if;
  return result;
end;
$$;

revoke all on function public.begin_cloud_nine_checkout(uuid) from public, anon, authenticated;
grant execute on function public.begin_cloud_nine_checkout(uuid) to anon, authenticated;

revoke all on function public.create_cloud_nine_quote_with_hold(integer, text, text, text, text) from public, anon, authenticated;
drop function if exists public.create_cloud_nine_quote_with_hold(integer, text, text, text, text);

notify pgrst, 'reload schema';
