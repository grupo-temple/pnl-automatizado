-- ============================================================
-- GRUPO TEMPLE — Arquitectura limpia
-- Migration 007: fuente en real_transactions + tabla sociedades + drop legacy
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. COLUMNA fuente EN real_transactions ─────────────────
-- Nullable para compatibilidad con registros existentes.
-- Los nuevos imports vía UI siempre llevan fuente.
alter table real_transactions
  add column if not exists fuente text
  check (fuente in ('ingresos', 'egresos', 'sueldos'));

-- Índice para queries de idempotencia (delete por sociedad+año+mes+fuente)
create index if not exists idx_real_transactions_fuente
  on real_transactions (fuente, sociedad, fecha);

-- ── 2. TABLA sociedades ────────────────────────────────────
create table if not exists sociedades (
  id      uuid    primary key default gen_random_uuid(),
  codigo  text    not null unique,
  nombre  text    not null,
  active  boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger updated_at
drop trigger if exists trg_sociedades_updated_at on sociedades;
create trigger trg_sociedades_updated_at
  before update on sociedades
  for each row execute function set_updated_at();

-- RLS — mismo patrón que catalog_items
alter table sociedades enable row level security;

drop policy if exists "sociedades_select_authenticated" on sociedades;
create policy "sociedades_select_authenticated"
  on sociedades for select
  to authenticated
  using (true);

drop policy if exists "sociedades_insert_admin" on sociedades;
create policy "sociedades_insert_admin"
  on sociedades for insert
  to authenticated
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "sociedades_update_admin" on sociedades;
create policy "sociedades_update_admin"
  on sociedades for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "sociedades_delete_admin" on sociedades;
create policy "sociedades_delete_admin"
  on sociedades for delete
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

-- Seed inicial — idempotente
insert into sociedades (codigo, nombre) values
  ('TG',  'Temple Group'),
  ('CDS', 'Casa de Subastas'),
  ('VA',  'Vinos & Alimentos')
on conflict (codigo) do nothing;

-- ── 3. DROP TABLAS LEGACY ──────────────────────────────────
-- Verificar antes de correr:
--   SELECT COUNT(*) FROM real_transactions;  -- debe tener datos
--   SELECT COUNT(*) FROM planning_entries;   -- debe tener datos
--   SELECT COUNT(*) FROM catalog_items;      -- debe tener 46+ items

drop table if exists transactions;
drop table if exists financial_entries;
drop table if exists companies;

-- ── VERIFICACIÓN POST-MIGRATION ────────────────────────────
-- Ejecutar para confirmar:
--   select column_name from information_schema.columns
--     where table_name = 'real_transactions' and column_name = 'fuente';
--   select count(*) from sociedades;  -- debe ser 3
--   select count(*) from catalog_items;
--   select count(*) from real_transactions;
