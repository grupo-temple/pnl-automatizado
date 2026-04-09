-- ============================================================
-- GRUPO TEMPLE — Seed de catalog_items
-- Migration 005: Pre-poblar catálogo con los 7 grupos P&L y sub-categorías
-- Ejecutar DESPUÉS de 004_new_architecture.sql
-- Script idempotente: ON CONFLICT DO NOTHING (re-ejecutable sin duplicados)
-- ============================================================

-- ── INGRESOS ───────────────────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Ingreso', 'Total Ingresos', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Ingresos
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Ingreso', 'Total Ingresos', 'Acuerdos Comerciales'),
  ('Ingreso', 'Total Ingresos', 'Acuerdos Com Efectivo'),
  ('Ingreso', 'Total Ingresos', 'FEE Inicial'),
  ('Ingreso', 'Total Ingresos', 'Merchandising'),
  ('Ingreso', 'Total Ingresos', 'Royalty Efectivo'),
  ('Ingreso', 'Total Ingresos', 'Royalty Mensual')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── SUELDOS ────────────────────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Sueldo', 'Sueldos', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Sueldos
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Sueldo', 'Sueldos', 'Sueldo Administración'),
  ('Sueldo', 'Sueldos', 'Sueldo Comercial'),
  ('Sueldo', 'Sueldos', 'Sueldo Gestión'),
  ('Sueldo', 'Sueldos', 'Sueldo Marketing'),
  ('Sueldo', 'Sueldos', 'Sueldo Operaciones'),
  ('Sueldo', 'Sueldos', 'SAC'),
  ('Sueldo', 'Sueldos', 'Cargas Sociales'),
  ('Sueldo', 'Sueldos', 'Bonos Objetivos'),
  ('Sueldo', 'Sueldos', 'Bonos Aperturas')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── GASTOS PERSONAL ────────────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Personal', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Gastos Personal
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Personal', 'Beneficios'),
  ('Egreso', 'Gastos Personal', 'Recruiting'),
  ('Egreso', 'Gastos Personal', 'Capacitaciones'),
  ('Egreso', 'Gastos Personal', 'Desarrollo y Formación'),
  ('Egreso', 'Gastos Personal', 'Prepaga'),
  ('Egreso', 'Gastos Personal', 'Retenciones Ganancias'),
  ('Egreso', 'Gastos Personal', 'Viandas'),
  ('Egreso', 'Gastos Personal', 'Viáticos')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── GASTOS ADMINISTRATIVOS ─────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Administrativos', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Gastos Administrativos
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Administrativos', 'Alquiler'),
  ('Egreso', 'Gastos Administrativos', 'Fee Experiencias'),
  ('Egreso', 'Gastos Administrativos', 'Equipamiento'),
  ('Egreso', 'Gastos Administrativos', 'Expensas'),
  ('Egreso', 'Gastos Administrativos', 'Gastos Bancarios'),
  ('Egreso', 'Gastos Administrativos', 'Mantenimiento'),
  ('Egreso', 'Gastos Administrativos', 'Insumos Oficina'),
  ('Egreso', 'Gastos Administrativos', 'Seguro'),
  ('Egreso', 'Gastos Administrativos', 'Servicios'),
  ('Egreso', 'Gastos Administrativos', 'Sistemas de Gestión')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── GASTOS MARKETING ───────────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Marketing', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Gastos Marketing
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Gastos Marketing', 'Acciones Marketing'),
  ('Egreso', 'Gastos Marketing', 'Diseño'),
  ('Egreso', 'Gastos Marketing', 'Fidelización')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── TERCERIZADOS ───────────────────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Tercerizados', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categoría de Tercerizados
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Tercerizados', 'Tercerizados')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── OTROS (IMPUESTOS Y GASTOS) ─────────────────────────────
-- Categoría raíz
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Otros', null)
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- Sub-categorías de Otros
insert into catalog_items (tipo, categoria, sub_categoria) values
  ('Egreso', 'Otros', 'Imp. Ganancias'),
  ('Egreso', 'Otros', 'IIBB')
on conflict (tipo, categoria, (coalesce(sub_categoria, ''))) do nothing;

-- ── VERIFICACIÓN ───────────────────────────────────────────
-- Ejecutar estas queries para confirmar el seed:
--
-- SELECT tipo, categoria, COUNT(*) as total
-- FROM catalog_items
-- GROUP BY tipo, categoria
-- ORDER BY tipo, categoria;
--
-- Resultado esperado:
--   Egreso  | Gastos Administrativos | 11  (raíz + 10 sub)
--   Egreso  | Gastos Marketing       |  4  (raíz +  3 sub)
--   Egreso  | Gastos Personal        |  9  (raíz +  8 sub)
--   Egreso  | Otros                  |  3  (raíz +  2 sub)
--   Egreso  | Tercerizados           |  2  (raíz +  1 sub)
--   Ingreso | Total Ingresos         |  7  (raíz +  6 sub)
--   Sueldo  | Sueldos                | 10  (raíz +  9 sub)
--   Total                            | 46
