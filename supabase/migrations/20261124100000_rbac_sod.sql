-- RBAC and segregation of duties. Review before running.
-- Do not apply this file to storey-dev. It is exercised on a disposable database.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'application') then
    create role application;
  end if;
end $$;

create schema if not exists auth;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'auth' and pg_proc.proname = 'uid'
  ) then
    execute 'create function auth.uid() returns uuid language sql stable as $fn$ select null::uuid $fn$';
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key,
  active_workspace text not null check (active_workspace in ('creator', 'supplier', 'admin'))
);

create table if not exists public.role_assignments (
  user_id uuid not null,
  role text not null check (role in ('creator', 'supplier', 'admin')),
  tenant_id text not null,
  unique (user_id, role, tenant_id)
);

alter table public.role_assignments enable row level security;

drop policy if exists role_assignments_own on public.role_assignments;
create policy role_assignments_own on public.role_assignments
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.role_assignments to authenticated;

create table if not exists public.warehouse_bins (
  id bigint generated always as identity primary key,
  supplier_tenant_id text not null,
  creator_tenant_id text not null,
  bin_code text not null,
  unique (supplier_tenant_id, bin_code)
);

create or replace function public.bin_visible(supplier_tenant text, creator_tenant text)
returns boolean
language plpgsql
stable
as $$
declare
  visible boolean;
begin
  if to_regclass('public.seller_subscriptions') is null then
    return false;
  end if;
  execute
    'select exists (select 1 from public.seller_subscriptions where seller_id::text = $1 and plan_code = ''scale'' and status = ''active'')'
    into visible
    using creator_tenant;
  return coalesce(visible, false)
    and supplier_tenant = current_setting('request.jwt.claim.tenant', true);
end $$;

alter table public.warehouse_bins enable row level security;

drop policy if exists warehouse_bins_select on public.warehouse_bins;
create policy warehouse_bins_select on public.warehouse_bins
  for select to authenticated
  using (public.bin_visible(supplier_tenant_id, creator_tenant_id));

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  creator_tenant_id text not null,
  supplier_tenant_id text not null,
  buyer_name text not null,
  status text not null,
  street text,
  phone text,
  email text,
  retail_agorot integer,
  supplier_cost_agorot integer
);

create or replace view public.creator_order_view as
  select id, creator_tenant_id, buyer_name, status
  from public.orders;

create or replace view public.supplier_fulfillment_view as
  select id, supplier_tenant_id, buyer_name, street, phone, status
  from public.orders;

revoke all on public.orders from anon, authenticated, public;
grant select on public.creator_order_view to authenticated;
grant select on public.supplier_fulfillment_view to authenticated;

create table if not exists public.ledger_entries (
  id bigint generated always as identity primary key,
  account text not null,
  debit_agorot integer not null,
  credit_agorot integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  role text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  action text not null,
  timestamp timestamptz not null default now()
);

alter table public.audit_logs add column if not exists role text;
alter table public.audit_logs add column if not exists before_state jsonb;
alter table public.audit_logs add column if not exists after_state jsonb;
alter table public.audit_logs add column if not exists reason text;
alter table public.audit_logs add column if not exists timestamp timestamptz default now();

create or replace function public.reject_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

drop trigger if exists ledger_entries_append_only on public.ledger_entries;
create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.reject_append_only();

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.reject_append_only();

revoke update, delete on public.ledger_entries from anon, authenticated, application, public;
revoke update, delete on public.audit_logs from anon, authenticated, application, public;
grant insert, select on public.ledger_entries to authenticated;
grant insert, select on public.audit_logs to authenticated, application;
grant insert on public.audit_logs to authenticated;

do $$
begin
  if to_regclass('public.seller_plans') is not null then
    update public.seller_plans
      set name_he = 'מכירה חברתית'
      where code = 'social' and name_he is distinct from 'מכירה חברתית';
    update public.seller_plans
      set name_he = 'שותפות'
      where code = 'scale' and name_he is distinct from 'שותפות';
  end if;
end $$;
