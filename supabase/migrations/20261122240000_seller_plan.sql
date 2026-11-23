-- Organization membership and the zero-price Social Seller development plan.
-- Does not insert inventory or change pool quantities.
-- A zero-rate plan activates without a charge. Branded and Scale stay without a price
-- until a commercial rate is approved, so this migration cannot subscribe Maya to them.
-- Existing subscription rows are left in place.

create table if not exists public.organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  role text not null check (role in ('owner', 'member')),
  primary key (organization_id, user_id)
);

create table if not exists public.seller_plans (
  code text primary key check (code in ('social', 'branded', 'scale')),
  name_he text not null,
  price_agorot integer check (price_agorot is null or price_agorot >= 0),
  can_publish boolean not null,
  can_campaign boolean not null,
  can_dedicate boolean not null
);

create table if not exists public.seller_subscriptions (
  seller_id uuid primary key references public.sellers (id),
  organization_id uuid not null references public.organizations (id),
  plan_code text not null references public.seller_plans (code),
  status text not null check (status in ('active', 'inactive')),
  price_agorot integer not null check (price_agorot >= 0),
  activated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.seller_plans enable row level security;
alter table public.seller_subscriptions enable row level security;
revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_members from public, anon, authenticated;
revoke all on table public.seller_plans from public, anon, authenticated;
revoke all on table public.seller_subscriptions from public, anon, authenticated;

insert into public.seller_plans (code, name_he, price_agorot, can_publish, can_campaign, can_dedicate)
values
  ('social', 'מוכרת חברתית', 0, true, false, false),
  ('branded', 'חנות מותג', null, true, true, false),
  ('scale', 'שותפת קנה מידה', null, true, true, true)
on conflict (code) do nothing;

insert into public.organizations (id, name)
values ('66666666-6666-4666-8666-666666666666', 'מאיה לוי')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
select
  '66666666-6666-4666-8666-666666666666',
  seller.owner_id,
  'owner'
from public.sellers as seller
where seller.slug = 'maya'
  and seller.owner_id is not null
on conflict do nothing;

insert into public.seller_subscriptions (seller_id, organization_id, plan_code, status, price_agorot)
select
  seller.id,
  '66666666-6666-4666-8666-666666666666',
  'social',
  'active',
  0
from public.sellers as seller
where seller.slug = 'maya'
  and not exists (
    select 1
    from public.seller_subscriptions as sub
    where sub.seller_id = seller.id
  );

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

  insert into public.organization_members (organization_id, user_id, role)
  values ('66666666-6666-4666-8666-666666666666', auth.uid(), 'owner')
  on conflict do nothing;

  insert into public.seller_subscriptions (seller_id, organization_id, plan_code, status, price_agorot)
  select
    seller.id,
    '66666666-6666-4666-8666-666666666666',
    'social',
    'active',
    0
  from public.sellers as seller
  where seller.slug = 'maya'
    and seller.owner_id = auth.uid()
    and not exists (
      select 1
      from public.seller_subscriptions as sub
      where sub.seller_id = seller.id
    );

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

  if not exists (
    select 1
    from public.sellers as seller
    join public.seller_subscriptions as sub on sub.seller_id = seller.id
    join public.seller_plans as plan on plan.code = sub.plan_code
    where seller.owner_id = auth.uid()
      and seller.slug = 'maya'
      and sub.status = 'active'
      and plan.can_publish
      and plan.price_agorot = 0
      and sub.price_agorot = 0
  ) then
    raise exception 'plan required';
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

create or replace function public.seller_plan_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_name text;
  plan_code text;
  plan_name text;
  plan_price integer;
  sub_price integer;
  plan_publish boolean;
  sub_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform set_config('row_security', 'off', true);

  select
    org.name,
    plan.code,
    plan.name_he,
    plan.price_agorot,
    sub.price_agorot,
    plan.can_publish,
    sub.status
  into org_name, plan_code, plan_name, plan_price, sub_price, plan_publish, sub_status
  from public.sellers as seller
  left join public.seller_subscriptions as sub on sub.seller_id = seller.id
  left join public.seller_plans as plan on plan.code = sub.plan_code
  left join public.organizations as org on org.id = sub.organization_id
  where seller.slug = 'maya'
    and seller.owner_id = auth.uid();

  if not found then
    return jsonb_build_object('can_publish', false);
  end if;

  return jsonb_build_object(
    'organization_name', org_name,
    'plan_code', plan_code,
    'plan_name_he', plan_name,
    'price_agorot', sub_price,
    'can_publish', coalesce(
      sub_status = 'active' and plan_publish and plan_price = 0 and sub_price = 0,
      false
    ),
    'status', sub_status
  );
end;
$$;

revoke all on function public.claim_demo_seller() from public, anon, authenticated;
revoke all on function public.publish_listing(integer) from public, anon, authenticated;
revoke all on function public.seller_plan_status() from public, anon, authenticated;
grant execute on function public.claim_demo_seller() to authenticated;
grant execute on function public.publish_listing(integer) to authenticated;
grant execute on function public.seller_plan_status() to authenticated;

notify pgrst, 'reload schema';
