-- ============================================================
-- GRUPO TEMPLE — Nueva Arquitectura de Datos
-- Migration 004: catalog_items, real_transactions, planning_entries
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── CATALOG ITEMS ──────────────────────────────────────────
-- Catálogo editable de clasificación: Tipo → Categoría → Sub-Categoría
-- Cada fila representa una combinación válida (ej: Egreso / Gastos Administrativos / Abogados)
create table if not exists catalog_items (
  id           uuid        primary key default gen_random_uuid(),
  tipo         text        not null,
  categoria    text        not null,
  sub_categoria text,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Evitar duplicados: (tipo, categoria, sub_categoria) debe ser único
  -- COALESCE para tratar NULL y '' como equivalentes en el constraint
  unique (tipo, categoria, (coalesce(sub_categoria, '')))
);

-- Trigger para actualizar updated_at automáticamente
drop trigger if exists trg_catalog_items_updated_at on catalog_items;
create trigger trg_catalog_items_updated_at
  before update on catalog_items
  for each row execute function set_updated_at();

-- ── REAL TRANSACTIONS ──────────────────────────────────────
-- Registro completo de facturas / egresos / ingresos reales
-- Campos fiscales según libro de compras/ventas argentino (todos opcionales)
create table if not exists real_transactions (
  id                  uuid        primary key default gen_random_uuid(),

  -- Identificación principal
  fecha               date        not null,
  sociedad            text        not null check (sociedad in ('TG', 'CDS', 'VA')),

  -- Proveedor / cliente (opcionales)
  razon_social        text,
  cuit                text,
  provincia           text,
  ciudad              text,
  condicion_iva       text,
  nro_factura         text,

  -- Importes fiscales (todos opcionales)
  importe_neto_gravado numeric,
  importe_no_grav      numeric,
  iva2                 numeric,
  iva5                 numeric,
  iva10                numeric,
  iva21                numeric,
  iva27                numeric,
  iibb                 numeric,
  percepcion_iva       numeric,
  otros_impuestos      numeric,
  total_iva            numeric,
  total_facturado      numeric,

  -- Importe P&L (requerido)
  neto                 numeric     not null,

  -- Clasificación P&L (validada en app layer contra catalog_items)
  tipo                 text        not null,
  categoria            text        not null,
  sub_categoria        text,

  -- Adicional
  observaciones        text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Índice para queries de dashboard (filtrar por sociedad + año)
create index if not exists idx_real_transactions_sociedad_fecha
  on real_transactions (sociedad, fecha);

-- Índice para queries de registros (filtrar por año)
create index if not exists idx_real_transactions_fecha
  on real_transactions (fecha);

-- Trigger updated_at
drop trigger if exists trg_real_transactions_updated_at on real_transactions;
create trigger trg_real_transactions_updated_at
  before update on real_transactions
  for each row execute function set_updated_at();

-- ── PLANNING ENTRIES ───────────────────────────────────────
-- Presupuesto y LE unificados en una tabla con discriminador entry_type
-- Una fila por: año × mes × sociedad × tipo_plan × categoria × sub_categoria
create table if not exists planning_entries (
  id            uuid        primary key default gen_random_uuid(),
  year          integer     not null,
  month         integer     not null check (month between 1 and 12),
  sociedad      text        not null check (sociedad in ('TG', 'CDS', 'VA')),
  entry_type    text        not null check (entry_type in ('Presupuesto', 'LE')),

  -- Clasificación P&L (validada en app layer contra catalog_items)
  tipo          text        not null,
  categoria     text        not null,
  sub_categoria text,

  monto         numeric,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Unicidad para upserts: no puede haber dos filas para la misma combinación
  unique (year, month, sociedad, entry_type, categoria, (coalesce(sub_categoria, '')))
);

-- Índice para queries de dashboard (filtrar por año)
create index if not exists idx_planning_entries_year_sociedad
  on planning_entries (year, sociedad, entry_type);

-- Trigger updated_at
drop trigger if exists trg_planning_entries_updated_at on planning_entries;
create trigger trg_planning_entries_updated_at
  before update on planning_entries
  for each row execute function set_updated_at();

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
-- Patrón idéntico a 002_rls_policies.sql

alter table catalog_items    enable row level security;
alter table real_transactions enable row level security;
alter table planning_entries  enable row level security;

-- catalog_items
drop policy if exists "catalog_items_select_authenticated" on catalog_items;
create policy "catalog_items_select_authenticated"
  on catalog_items for select
  to authenticated
  using (true);

drop policy if exists "catalog_items_insert_admin" on catalog_items;
create policy "catalog_items_insert_admin"
  on catalog_items for insert
  to authenticated
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "catalog_items_update_admin" on catalog_items;
create policy "catalog_items_update_admin"
  on catalog_items for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "catalog_items_delete_admin" on catalog_items;
create policy "catalog_items_delete_admin"
  on catalog_items for delete
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

-- real_transactions
drop policy if exists "real_transactions_select_authenticated" on real_transactions;
create policy "real_transactions_select_authenticated"
  on real_transactions for select
  to authenticated
  using (true);

drop policy if exists "real_transactions_insert_admin" on real_transactions;
create policy "real_transactions_insert_admin"
  on real_transactions for insert
  to authenticated
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "real_transactions_update_admin" on real_transactions;
create policy "real_transactions_update_admin"
  on real_transactions for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "real_transactions_delete_admin" on real_transactions;
create policy "real_transactions_delete_admin"
  on real_transactions for delete
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

-- planning_entries
drop policy if exists "planning_entries_select_authenticated" on planning_entries;
create policy "planning_entries_select_authenticated"
  on planning_entries for select
  to authenticated
  using (true);

drop policy if exists "planning_entries_insert_admin" on planning_entries;
create policy "planning_entries_insert_admin"
  on planning_entries for insert
  to authenticated
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "planning_entries_update_admin" on planning_entries;
create policy "planning_entries_update_admin"
  on planning_entries for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "planning_entries_delete_admin" on planning_entries;
create policy "planning_entries_delete_admin"
  on planning_entries for delete
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );
