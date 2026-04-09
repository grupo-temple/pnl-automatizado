-- ============================================================
-- GRUPO TEMPLE — Cutover: eliminar tablas antiguas
-- Migration 006: DROP TABLE transactions y financial_entries
--
-- ⚠  EJECUTAR SOLO después de completar los 3 pasos de R18:
--   1. Reconciliación OK (script verify-only sin diferencias)
--   2. Frontend deploiado en Vercel y dashboard verificado
--   3. Backup JSON confirmado en scripts/backup/
--
-- Este archivo NO se ejecuta automáticamente — correrlo manualmente
-- en Supabase Dashboard → SQL Editor.
-- ============================================================

-- Verificación previa (ejecutar primero para confirmar que todo está OK)
-- SELECT COUNT(*) FROM real_transactions;         -- debe ser >= 413
-- SELECT COUNT(*) FROM financial_entries;         -- cantidad antes de eliminar
-- SELECT COUNT(*) FROM planning_entries;          -- cantidad de presupuesto/LE cargado

-- ── ELIMINAR TABLAS ANTIGUAS ───────────────────────────────
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS financial_entries;

-- ── VERIFICACIÓN POST-DROP ─────────────────────────────────
-- Ejecutar estas queries para confirmar que todo está bien:
--
-- \dt                         -- transactions y financial_entries no deben aparecer
-- SELECT COUNT(*) FROM real_transactions;
-- SELECT COUNT(*) FROM planning_entries;
-- SELECT COUNT(*) FROM catalog_items;
