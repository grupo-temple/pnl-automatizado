-- ============================================================
-- GRUPO TEMPLE — P&L Dashboard Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ── COMPANIES ──────────────────────────────────────────────
-- Solo TG, CDS, VA. Consolidado se calcula (no se almacena).
create table if not exists companies (
  id   uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

insert into companies (slug, name) values
  ('TG',  'TG'),
  ('CDS', 'CDS'),
  ('VA',  'VA')
on conflict (slug) do nothing;

-- ── FINANCIAL ENTRIES ──────────────────────────────────────
-- Una fila por: empresa × año × mes × tipo × grupo_pl
-- data_type: 'Real' | 'Presupuesto' | 'LE' (Last Estimate)
-- grupo_pl:  los 7 grupos del P&L (ver GRUPO_MAP del dashboard original)
create table if not exists financial_entries (
  id         uuid        primary key default gen_random_uuid(),
  company_id uuid        not null references companies(id) on delete cascade,
  year       integer     not null,
  month      integer     not null check (month between 1 and 12),
  data_type  text        not null check (data_type in ('Real', 'Presupuesto', 'LE')),
  grupo_pl   text        not null,
  amount     numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Unicidad: no puede haber dos filas para la misma combinación
  unique (company_id, year, month, data_type, grupo_pl)
);

-- Índice para acelerar queries del dashboard (filtrar por año + tipo)
create index if not exists idx_financial_entries_year_type
  on financial_entries (year, data_type, company_id);

-- Trigger para actualizar updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_financial_entries_updated_at on financial_entries;
create trigger trg_financial_entries_updated_at
  before update on financial_entries
  for each row execute function set_updated_at();

-- ── COMENTARIOS SOBRE GRUPOS P&L VÁLIDOS ───────────────────
comment on column financial_entries.grupo_pl is
  'Valores válidos: ''Total Ingresos'', ''Sueldos'', ''Gastos Personal'', ''Gastos Administrativos'', ''Gastos Marketing'', ''Tercerizados'', ''Otros''';
