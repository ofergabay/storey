-- Development fixture only. This file is not a schema migration.
-- It inserts the Cloud Nine pilot pool when those rows are absent.
-- It does not update a pool that already exists, so it cannot reset stock.
-- 24 shared packs in PILOT-01 is an unverified stand-in, not a warehouse attestation.
-- Do not run this on a database whose quantities already came from this fixture
-- or from a warehouse count. A missing pool is the only case that adds rows.

insert into public.inventory_pools (id, offer_id, warehouse_code, bucket, quantity)
select
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'PILOT-01',
  'shared_free',
  24
where not exists (
  select 1
  from public.inventory_pools
  where offer_id = '22222222-2222-4222-8222-222222222222'
    and warehouse_code = 'PILOT-01'
    and bucket = 'shared_free'
);

insert into public.inventory_pools (id, offer_id, warehouse_code, bucket, quantity)
select
  '55555555-5555-4555-8555-555555555555',
  '22222222-2222-4222-8222-222222222222',
  'PILOT-01',
  'safety_buffer',
  0
where not exists (
  select 1
  from public.inventory_pools
  where offer_id = '22222222-2222-4222-8222-222222222222'
    and warehouse_code = 'PILOT-01'
    and bucket = 'safety_buffer'
);
