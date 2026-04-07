-- ============================================================
-- Row Level Security — Grupo Temple P&L Dashboard
-- Ejecutar DESPUÉS de 001_initial_schema.sql
-- ============================================================

-- Habilitar RLS en todas las tablas
alter table companies         enable row level security;
alter table financial_entries enable row level security;

-- ── COMPANIES: solo lectura para cualquier usuario autenticado ──
drop policy if exists "companies_select_authenticated" on companies;
create policy "companies_select_authenticated"
  on companies for select
  to authenticated
  using (true);

-- ── FINANCIAL ENTRIES: SELECT para cualquier usuario autenticado ──
drop policy if exists "financial_entries_select_authenticated" on financial_entries;
create policy "financial_entries_select_authenticated"
  on financial_entries for select
  to authenticated
  using (true);

-- ── FINANCIAL ENTRIES: INSERT/UPDATE/DELETE solo para admins ──
-- El rol admin se guarda en: auth.users.raw_user_meta_data->>'app_role' = 'admin'
-- Para asignar: UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"app_role":"admin"}' WHERE email = 'tu@email.com';

drop policy if exists "financial_entries_insert_admin" on financial_entries;
create policy "financial_entries_insert_admin"
  on financial_entries for insert
  to authenticated
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "financial_entries_update_admin" on financial_entries;
create policy "financial_entries_update_admin"
  on financial_entries for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

drop policy if exists "financial_entries_delete_admin" on financial_entries;
create policy "financial_entries_delete_admin"
  on financial_entries for delete
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'app_role') = 'admin'
  );

-- ── ACCESO ANÓNIMO AL DASHBOARD (opcional) ──────────────────
-- Descomenta estas líneas si querés que el dashboard sea público
-- (sin requerir login para VER los datos):
--
-- drop policy if exists "companies_select_anon" on companies;
-- create policy "companies_select_anon"
--   on companies for select to anon using (true);
--
-- drop policy if exists "financial_entries_select_anon" on financial_entries;
-- create policy "financial_entries_select_anon"
--   on financial_entries for select to anon using (true);
