-- Maya's signed-in owner can list Cloud Nine quotes.
-- The list includes the saved selling price and the address the customer entered.
-- It does not include supplier cost, draft price, or seller earnings.
-- Reading the list does not change stock.

create or replace function public.list_cloud_nine_quotes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.sellers
    where slug = 'maya'
      and owner_id = auth.uid()
  ) then
    raise exception 'not owner';
  end if;

  perform set_config('row_security', 'off', true);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', saved.id,
          'created_at', saved.created_at,
          'quantity', saved.quantity,
          'unit_retail_agorot', saved.unit_retail_agorot,
          'merchandise_agorot', saved.merchandise_agorot,
          'recipient_name', saved.recipient_name,
          'phone', saved.phone,
          'city', saved.city,
          'street', saved.street
        )
        order by saved.created_at desc
      )
      from public.checkout_quotes as saved
      join public.seller_listings as listing on listing.id = saved.listing_id
      join public.sellers as seller on seller.id = listing.seller_id
      where seller.slug = 'maya'
        and seller.owner_id = auth.uid()
        and listing.slug = 'cloud-nine'
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_cloud_nine_quotes() from public, anon, authenticated;
grant execute on function public.list_cloud_nine_quotes() to authenticated;

notify pgrst, 'reload schema';
