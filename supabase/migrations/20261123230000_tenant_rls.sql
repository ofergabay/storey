-- Tenant isolation for orders, buyer addresses, the ledger, and audit logs.
-- Review before running. Do not apply this file to storey-dev from the app.
-- Direct selects stay limited to the signed-in tenant. Raw phone and street
-- are not granted to creator or supplier roles.

create table if not exists public.supplier_tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references auth.users (id) on delete set null,
  warehouse_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.sellers (id) on delete set null,
  supplier_id uuid references public.supplier_tenants (id) on delete set null,
  warehouse_code text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders (id) on delete cascade,
  quote_id uuid references public.checkout_quotes (id) on delete set null,
  phone text not null,
  street text not null,
  city text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  tenant_id uuid,
  action text not null,
  detail text not null
);

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.supplier_tenants enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_admins enable row level security;
alter table public.checkout_quotes enable row level security;
alter table public.payment_journals enable row level security;
alter table public.payment_policies enable row level security;

revoke all on table public.supplier_tenants from public, anon, authenticated;
revoke all on table public.commerce_orders from public, anon, authenticated;
revoke all on table public.shipping_addresses from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.system_admins from public, anon, authenticated;
revoke all on table public.checkout_quotes from public, anon, authenticated;
revoke all on table public.payment_journals from public, anon, authenticated;
revoke all on table public.payment_policies from public, anon, authenticated;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.system_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_system_admin() from public, anon, authenticated;
grant execute on function public.is_system_admin() to authenticated;

drop policy if exists supplier_tenants_owner_select on public.supplier_tenants;
create policy supplier_tenants_owner_select on public.supplier_tenants
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists commerce_orders_seller_select on public.commerce_orders;
create policy commerce_orders_seller_select on public.commerce_orders
  for select to authenticated
  using (
    exists (
      select 1 from public.sellers as seller
      where seller.id = commerce_orders.seller_id
        and seller.owner_id = auth.uid()
    )
  );

drop policy if exists commerce_orders_supplier_select on public.commerce_orders;
create policy commerce_orders_supplier_select on public.commerce_orders
  for select to authenticated
  using (
    exists (
      select 1 from public.supplier_tenants as tenant
      where tenant.id = commerce_orders.supplier_id
        and tenant.owner_id = auth.uid()
        and tenant.warehouse_code = commerce_orders.warehouse_code
    )
  );

drop policy if exists audit_logs_actor_select on public.audit_logs;
create policy audit_logs_actor_select on public.audit_logs
  for select to authenticated
  using (actor_id = auth.uid() or public.is_system_admin());

drop policy if exists payment_policies_seller_select on public.payment_policies;
create policy payment_policies_seller_select on public.payment_policies
  for select to authenticated
  using (
    exists (
      select 1 from public.sellers as seller
      where seller.owner_id = auth.uid()
        and (seller.handle = payment_policies.seller_handle or seller.slug = payment_policies.seller_handle)
    )
    or public.is_system_admin()
  );

drop policy if exists payment_journals_tenant_select on public.payment_journals;
create policy payment_journals_tenant_select on public.payment_journals
  for select to authenticated
  using (
    exists (
      select 1
      from public.payment_policies as policy
      join public.sellers as seller
        on seller.handle = policy.seller_handle or seller.slug = policy.seller_handle
      where policy.order_ref = payment_journals.order_ref
        and seller.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.payment_units as unit
      join public.supplier_tenants as tenant on tenant.id::text = unit.supplier_id
      where unit.order_ref = payment_journals.order_ref
        and tenant.owner_id = auth.uid()
    )
    or public.is_system_admin()
  );

grant select on table public.supplier_tenants to authenticated;
grant select on table public.commerce_orders to authenticated;
grant select on table public.audit_logs to authenticated;
grant select on table public.payment_policies to authenticated;
grant select on table public.payment_journals to authenticated;

create or replace view public.shipping_addresses_masked
with (security_invoker = true) as
select
  id,
  order_id,
  quote_id,
  city,
  case when char_length(phone) >= 2 then '•••' || right(phone, 2) else '•••' end as phone,
  'רחוב מוסתר' as street,
  created_at
from public.shipping_addresses;

revoke all on table public.shipping_addresses_masked from public, anon, authenticated;

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
    select 1 from public.sellers
    where slug = 'maya' and owner_id = auth.uid()
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
          'phone', case when char_length(saved.phone) >= 2 then '•••' || right(saved.phone, 2) else '•••' end,
          'city', saved.city,
          'street', 'רחוב מוסתר'
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
