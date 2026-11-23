-- Storey migration 20261122190000
-- Seller, supplier offer, and seller listing for the Cloud Nine demo.
-- draft_retail_agorot stays separate from published_retail_agorot.
-- There is no stock column. Reading a listing does not change inventory.

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  handle text not null,
  initials text not null,
  owner_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  title text not null,
  summary text not null,
  pack_label text not null,
  pack_size integer not null check (pack_size > 0),
  pack_unit text not null,
  net_wholesale_agorot integer not null check (net_wholesale_agorot >= 0),
  currency text not null default 'ILS' check (currency = 'ILS'),
  created_at timestamptz not null default now()
);

create table if not exists public.seller_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id),
  offer_id uuid not null references public.supplier_offers (id),
  slug text not null,
  draft_retail_agorot integer check (draft_retail_agorot is null or draft_retail_agorot > 0),
  published_retail_agorot integer check (published_retail_agorot is null or published_retail_agorot > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (seller_id, slug)
);

create index if not exists sellers_owner_id_idx on public.sellers (owner_id);

alter table public.sellers enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.seller_listings enable row level security;

drop policy if exists sellers_owner_select on public.sellers;
create policy sellers_owner_select on public.sellers
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists offers_owner_select on public.supplier_offers;
create policy offers_owner_select on public.supplier_offers
  for select to authenticated
  using (
    exists (
      select 1
      from public.seller_listings as listing
      join public.sellers as seller on seller.id = listing.seller_id
      where listing.offer_id = supplier_offers.id
        and seller.owner_id = auth.uid()
    )
  );

drop policy if exists listings_owner_select on public.seller_listings;
create policy listings_owner_select on public.seller_listings
  for select to authenticated
  using (
    exists (
      select 1
      from public.sellers as seller
      where seller.id = seller_listings.seller_id
        and seller.owner_id = auth.uid()
    )
  );

revoke all on table public.sellers from public, anon, authenticated;
revoke all on table public.supplier_offers from public, anon, authenticated;
revoke all on table public.seller_listings from public, anon, authenticated;
grant select on table public.sellers to authenticated;
grant select on table public.supplier_offers to authenticated;
grant select on table public.seller_listings to authenticated;

insert into public.sellers (id, slug, display_name, handle, initials)
values (
  '11111111-1111-4111-8111-111111111111',
  'maya',
  'מאיה לוי',
  '@maya.makes',
  'ML'
)
on conflict (slug) do nothing;

insert into public.supplier_offers (
  id,
  sku,
  title,
  summary,
  pack_label,
  pack_size,
  pack_unit,
  net_wholesale_agorot
)
values (
  '22222222-2222-4222-8222-222222222222',
  'CLOUD-NINE-12',
  'Cloud Nine',
  'תערובת בלונים בגוון לילך לבוקר יום הולדת.',
  'מארז בלונים',
  12,
  'יחידות',
  2400
)
on conflict (sku) do nothing;

insert into public.seller_listings (id, seller_id, offer_id, slug)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'cloud-nine'
)
on conflict (seller_id, slug) do nothing;

create or replace view public.listing_cards
with (security_barrier = true, security_invoker = false) as
select
  seller.slug as seller_slug,
  seller.display_name,
  seller.handle,
  seller.initials,
  listing.slug as listing_slug,
  offer.title,
  offer.summary,
  offer.pack_label,
  offer.pack_size,
  offer.pack_unit,
  listing.published_retail_agorot
from public.seller_listings as listing
join public.sellers as seller on seller.id = listing.seller_id
join public.supplier_offers as offer on offer.id = listing.offer_id;

comment on view public.listing_cards is
  'Public product card. Exposes the published selling price only. Draft price, supplier cost, and seller earnings are not columns.';

revoke all on table public.listing_cards from public, anon, authenticated;
grant select on table public.listing_cards to anon, authenticated;

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
