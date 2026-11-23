-- The first claim call could return success without changing owner_id when
-- row security hid the Maya row from the function. Publishing had the same gap.
-- Run this once in the Supabase SQL editor.

create or replace function public.claim_demo_seller()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform set_config('row_security', 'off', true);

  select owner_id into current_owner
  from public.sellers
  where slug = 'maya';

  if not found then
    raise exception 'seller missing';
  end if;

  if current_owner is not null and current_owner <> auth.uid() then
    raise exception 'seller already claimed';
  end if;

  update public.sellers
  set owner_id = auth.uid()
  where slug = 'maya'
    and (owner_id is null or owner_id = auth.uid());

  if not found then
    raise exception 'seller was not linked';
  end if;

  return auth.uid();
end;
$$;

create or replace function public.publish_listing(retail_agorot integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  published integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform set_config('row_security', 'off', true);

  if retail_agorot is null or retail_agorot <= 0 then
    raise exception 'invalid price';
  end if;

  update public.seller_listings as listing
  set
    draft_retail_agorot = retail_agorot,
    published_retail_agorot = retail_agorot,
    published_at = now()
  from public.sellers as seller, public.supplier_offers as offer
  where listing.seller_id = seller.id
    and listing.offer_id = offer.id
    and seller.owner_id = auth.uid()
    and seller.slug = 'maya'
    and listing.slug = 'cloud-nine'
    and retail_agorot >= offer.net_wholesale_agorot
  returning listing.published_retail_agorot into published;

  if published is null then
    raise exception 'publish rejected';
  end if;

  return published;
end;
$$;

revoke all on function public.claim_demo_seller() from public, anon, authenticated;
revoke all on function public.publish_listing(integer) from public, anon, authenticated;
grant execute on function public.claim_demo_seller() to authenticated;
grant execute on function public.publish_listing(integer) to authenticated;

notify pgrst, 'reload schema';
