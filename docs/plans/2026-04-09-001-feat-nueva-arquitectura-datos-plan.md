---
title: "feat: Nueva arquitectura de datos — Tablas transaccionales y catálogo"
type: feat
status: active
date: 2026-04-09
origin: docs/brainstorms/nueva-arquitectura-datos-requirements.md
---

# feat: Nueva arquitectura de datos — Dashboard P&L Grupo Temple

## Overview

Reemplazar las tablas `financial_entries` y `transactions` por cuatro tablas nuevas: `catalog_items` (catálogo de clasificación editable), `real_transactions` (detalle completo de facturas), y `planning_entries` (presupuesto + LE unificados). El dashboard y el panel admin se reconstruyen sobre esta nueva base. Los 413 registros de 2026 se migran antes de eliminar las tablas antiguas.

## Problem Frame

El sistema actual almacena datos pre-agregados (`financial_entries`) e importa transacciones en lote desde CSVs sin detalle fiscal. Esto bloquea: (a) el registro en vivo de transacciones con CUIT/IVA/factura, (b) varianzas a nivel de sub-categoría, y (c) la gestión flexible de la taxonomía P&L. (see origin: `docs/brainstorms/nueva-arquitectura-datos-requirements.md`)

## Requirements Trace

- R1–R3: Tabla `catalog_items` con jerarquía Tipo→Categoría→Sub-Categoría, editable desde admin
- R4–R7: Tabla `real_transactions` con campos de libro de compras argentino; entrada manual y CSV
- R8–R11: `planning_entries` (presupuesto + LE) a nivel sub-categoría; entrada manual y CSV
- R12–R15: Dashboard agrega desde nuevas tablas; comparativas, drill-down y Registros actualizados
- R16–R18: Backup, migración de 413 registros, query de reconciliación, cutover secuencial
- R19: RLS en las 4 tablas siguiendo patrón de `002_rls_policies.sql`

## Scope Boundaries

- Sin integración AFIP ni aprobación de facturas
- Sin cambios a la estructura del P&L ni a las filas derivadas (EBITDA, Total Gastos, RDO. NETO — siguen calculadas en frontend)
- `catalog_items` máximo 3 niveles (Tipo / Categoría / Sub-Categoría)
- `DashboardData` shape preservado — componentes de visualización sin cambios

## Context & Research

### Relevant Code and Patterns

- Schema existente: `supabase/migrations/001_initial_schema.sql`, `002_rls_policies.sql`, `003_transactions.sql`
- Patrón RLS (to follow exactly): `(auth.jwt()->'user_metadata'->>'app_role') = 'admin'` para writes
- Patrón de server actions: `assertAdmin()` → `createAdminClient()` (service role) → upsert → `revalidatePath('/dashboard')` — en `src/app/admin/actions.ts`
- Agregación P&L: `src/lib/data/financial.ts` — fetch all rows for year, aggregate en JS con `computeDerived()`
- `DashboardData` shape y `GrupoPL` type: `src/lib/data/types.ts`
- Estructura P&L y `BASE_GRUPOS`: `src/lib/data/pl-structure.ts`
- Hardcoded values a migrar: `VALID_GRUPOS`, `GRUPO_MAP`, `VALID_TIPOS`, `MONTHS` — duplicados en `actions.ts`, `migrate-from-sheets.ts`, componentes
- Drill-down en `src/components/dashboard/PLTable.tsx` — pasa `grupo_pl` value como filtro
- Filtro 'Fuente' en `src/components/dashboard/TransactionsView.tsx` — debe cambiarse a 'Tipo'
- `getAvailableYears()` — actualmente ineficiente, queries all rows de `financial_entries`

### Institutional Learnings

- `docs/solutions/` no existe aún — este plan es el primero. Documentar learnings de RLS + migration al completar.

### External References

- Supabase JS v2 date range filter: `WHERE fecha >= '2026-01-01' AND fecha < '2027-01-01'` (JS client no soporta EXTRACT nativo, usar rango de fechas)

## Key Technical Decisions

- **`planning_entries` en lugar de dos tablas separadas**: `budget_entries` y `le_entries` se unifican en `planning_entries` con columna `entry_type TEXT CHECK (entry_type IN ('Presupuesto','LE'))`. Mismo patrón que `data_type` en `financial_entries`. Elimina DDL duplicado y simplifica queries. (see origin: Deferred to Planning — R8/R9)
- **Agregación en JS, no SQL GROUP BY**: `getFinancialData()` fetcha todas las filas del año desde `real_transactions` y `planning_entries`, luego agrega en JS igual que hoy. Escala actual (< 5000 filas/año) no requiere vistas materializadas. (see origin: Deferred to Planning — R12)
- **Validación de catálogo en app layer**: `tipo`/`categoria`/`sub_categoria` se almacenan como TEXT en las tablas de transacciones (no FK compuesto de BD). Los server actions validan contra `catalog_items WHERE active = true` antes de INSERT. Consistente con el patrón actual de `grupo_pl` (texto sin CHECK constraint en BD). (see origin: Deferred to Planning — R6/R10)
- **`sociedad` como TEXT con CHECK**: En lugar de FK a `companies(id)`, se usa `sociedad TEXT CHECK (sociedad IN ('TG','CDS','VA'))`. Elimina JOINs en queries de dashboard; el slug ya identifica unívocamente a cada empresa.
- **`DashboardData` shape inmutable**: `getFinancialData()` retorna exactamente el mismo tipo `DashboardData`. Ningún componente visual necesita cambios para el P&L core.
- **`catalog_items.active` para soft-delete**: Columna `BOOLEAN NOT NULL DEFAULT true`. Ítems inactivos no aparecen en formularios de nueva entrada pero siguen siendo válidos en registros históricos.

## Open Questions

### Resolved During Planning

- **`mes` vs `fecha` en `real_transactions`**: `fecha DATE NOT NULL`. Mes/año se derivan con `EXTRACT` o rango de fechas. Los 413 registros migrados usarán el primer día del mes (`year || '-' || LPAD(month, 2, '0') || '-01'`).
- **`budget_entries` vs `le_entries` separadas**: Una sola tabla `planning_entries` con discriminador `entry_type`. (ver Key Technical Decisions)
- **Mecanismo de validación contra catálogo**: App-layer en server actions. (ver Key Technical Decisions)
- **Mapeo `source` → `tipo`**: 'ingresos'→'Ingreso', 'egresos'→'Egreso', 'sueldos'→'Sueldo'. Definido en R17.
- **Cutover**: 3 pasos secuenciales — reconciliación → deploy frontend → DROP. Definido en R18.

### Deferred to Implementation

- Nombres exactos de columnas y constraints en el SQL de migración — derivables del schema actual durante la escritura
- Comportamiento exacto de los filtros en cascada (tipo → categoria → sub_categoria) en los formularios admin — implementar con `useState` encadenado

## High-Level Technical Design

> *Este diagrama ilustra la arquitectura objetivo y es orientación de dirección, no especificación de implementación. El agente implementador debe tratarlo como contexto, no como código a reproducir.*

```mermaid
flowchart TD
    CI[catalog_items\ntipo · categoria · sub_categoria · active]

    RT[real_transactions\nfecha · sociedad · neto\ntipo · categoria · sub_categoria\n+ campos fiscales opcionales]

    PE[planning_entries\nmonth · year · sociedad · entry_type\ntipo · categoria · sub_categoria · monto]

    RT -->|fetch all rows WHERE year\naggregate en JS por sociedad+mes+categoria| GFD["getFinancialData(year)\nretorna DashboardData ← mismo shape de hoy"]
    PE -->|fetch all rows WHERE year| GFD

    GFD -->|props sin cambio| DC[DashboardClient\nPLTable · KPICards · etc.]

    CI -->|validates before INSERT| SA[Server Actions\nactions.ts]
    SA -->|writes| RT
    SA -->|writes| PE
    SA -->|CRUD| CI

    subgraph "Admin Panel"
        SA
        CA[/admin/catalogo\nCRUD catalog_items]
        TE[/admin/transacciones\nManual + CSV → real_transactions]
        PLA[/admin/presupuesto-le\nManual + CSV → planning_entries]
    end
```

**Flujo de agregación en `getFinancialData()`:**

```
// Orientación conceptual — no código literal
FETCH real_transactions WHERE fecha BETWEEN '2026-01-01' AND '2026-12-31'
  → group by sociedad + EXTRACT(month) + categoria
  → sum(neto)
  → produce { [sociedad]: { [categoria]: [12 values] } }

FETCH planning_entries WHERE year = 2026
  → group by sociedad + month + categoria + entry_type
  → sum(monto)
  → produce { [sociedad]: { Presupuesto/LE: { [categoria]: [12 values] } } }

Merge ambos en DashboardData → computeDerived() → consolidado = TG + CDS + VA
```

## Implementation Units

---

- [ ] **Unit 1: Migration 004 — Nuevas tablas y políticas RLS**

**Goal:** Crear las 3 tablas nuevas (`catalog_items`, `real_transactions`, `planning_entries`) con constraints y RLS en Supabase.

**Requirements:** R1, R4, R8, R9, R19

**Dependencies:** Ninguna (puede ejecutarse sobre el schema existente en paralelo, antes del cutover)

**Files:**
- Create: `supabase/migrations/004_new_architecture.sql`

**Approach:**
- `catalog_items`: columnas `id UUID PK`, `tipo TEXT NOT NULL`, `categoria TEXT NOT NULL`, `sub_categoria TEXT`, `active BOOLEAN NOT NULL DEFAULT true`, `created_at timestamptz`, `updated_at timestamptz`. UNIQUE constraint en `(tipo, categoria, COALESCE(sub_categoria, ''))` para evitar duplicados.
- `real_transactions`: todos los campos de R4. `fecha DATE NOT NULL`, `sociedad TEXT NOT NULL CHECK (sociedad IN ('TG','CDS','VA'))`, `neto NUMERIC NOT NULL`, `tipo TEXT NOT NULL`, `categoria TEXT NOT NULL`, `sub_categoria TEXT`. Campos fiscales todos `NUMERIC` nullable. Index en `(sociedad, fecha)` para queries por año.
- `planning_entries`: `id UUID PK`, `year INTEGER NOT NULL`, `month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12)`, `sociedad TEXT NOT NULL CHECK (sociedad IN ('TG','CDS','VA'))`, `entry_type TEXT NOT NULL CHECK (entry_type IN ('Presupuesto','LE'))`, `tipo TEXT NOT NULL`, `categoria TEXT NOT NULL`, `sub_categoria TEXT`, `monto NUMERIC`. UNIQUE constraint en `(year, month, sociedad, entry_type, categoria, COALESCE(sub_categoria,''))` para upserts.
- RLS: Para las 3 tablas — SELECT para `authenticated`, INSERT/UPDATE/DELETE para `(auth.jwt()->'user_metadata'->>'app_role') = 'admin'`. Seguir exactamente el patrón de `002_rls_policies.sql`.
- Trigger `set_updated_at()` en `catalog_items` (mismo patrón que `financial_entries`).
- **No** agregar CHECK constraint en `tipo`/`categoria` de las tablas de transacciones — validación en app layer.

**Patterns to follow:**
- `supabase/migrations/001_initial_schema.sql` — estructura de tablas, triggers
- `supabase/migrations/002_rls_policies.sql` — políticas RLS exactas

**Test scenarios:**
- Happy path: Migration SQL se ejecuta sin errores en Supabase Dashboard → SQL Editor
- Happy path: Usuario autenticado (no admin) puede SELECT de las 3 tablas
- Error path: Usuario autenticado (no admin) recibe error al intentar INSERT en cualquier tabla
- Happy path: Usuario admin puede INSERT, UPDATE, DELETE en las 3 tablas
- Edge case: INSERT en `catalog_items` con misma (tipo, categoria, sub_categoria) retorna error de unique constraint

**Verification:**
- Las 3 tablas aparecen en Supabase Table Editor
- RLS habilitado y con las 4 políticas cada una
- `SELECT * FROM catalog_items LIMIT 1` desde anon client falla; desde authenticated client retorna vacío

---

- [ ] **Unit 2: Seed de catalog_items**

**Goal:** Pre-poblar `catalog_items` con los 7 grupos P&L base y sus sub-categorías conocidas de `pl-structure.ts`.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Create: `supabase/migrations/005_seed_catalog.sql`
- Reference: `src/lib/data/pl-structure.ts` (lista completa de section children — sub-categorías conocidas)

**Approach:**
- Insertar las 7 categorías P&L como ítems de nivel "Categoría" para tipo 'Egreso' / 'Sueldo' / 'Ingreso' según corresponda:
  - `tipo='Ingreso'`, `categoria='Total Ingresos'`, `sub_categoria=NULL` + sub-categorías del bloque INGRESOS
  - `tipo='Sueldo'`, `categoria='Sueldos'`, `sub_categoria=NULL` + sub-categorías del bloque SUELDOS
  - `tipo='Egreso'`, `categoria='Gastos Personal'` / 'Gastos Administrativos' / 'Gastos Marketing' / 'Tercerizados' / 'Otros' + respectivas sub-categorías
- Usar `INSERT ... ON CONFLICT DO NOTHING` para hacer el script idempotente (re-ejecutable sin duplicados)
- **Antes de ejecutar**: revisar con el responsable del área que las sub-categorías listan correctamente los valores de `transactions.categoria` actuales (auditoría de R16)

**Patterns to follow:**
- `001_initial_schema.sql` — el INSERT de seed de `companies` al final del script

**Test scenarios:**
- Happy path: `SELECT COUNT(*) FROM catalog_items WHERE active = true` retorna el número esperado de ítems
- Happy path: Los 7 valores de `categoria` cubren exactamente los `BASE_GRUPOS` de `pl-structure.ts`
- Edge case: Re-ejecutar el script no crea duplicados

**Verification:**
- `SELECT tipo, categoria, COUNT(*) FROM catalog_items GROUP BY tipo, categoria ORDER BY tipo, categoria` muestra distribución esperada
- `SELECT DISTINCT categoria FROM catalog_items` = `['Total Ingresos','Sueldos','Gastos Personal','Gastos Administrativos','Gastos Marketing','Tercerizados','Otros']`

---

- [ ] **Unit 3: Script de migración de datos**

**Goal:** Exportar backup de tablas existentes, migrar 413 transacciones a `real_transactions`, ejecutar query de reconciliación.

**Requirements:** R16, R17, R18 (paso 1)

**Dependencies:** Unit 1, Unit 2

**Files:**
- Create: `scripts/migrate-to-new-architecture.ts`

**Approach:**
- El script se ejecuta con `npx ts-node --project tsconfig.json scripts/migrate-to-new-architecture.ts`
- **Paso 1 — Backup**: exportar `transactions` y `financial_entries` a `scripts/backup/transactions_backup_YYYY-MM-DD.json` y `financial_entries_backup_YYYY-MM-DD.json` usando service role client
- **Paso 2 — Migración**: para cada fila de `transactions`, construir fila de `real_transactions`:
  - `fecha = YYYY-MM-01` (primer día del mes, usando `year` + `month` existentes)
  - `sociedad = company.slug` (lookup via `company_id → companies`)
  - `neto = amount`
  - `tipo` = traducción: `source='ingresos'→'Ingreso'`, `'egresos'→'Egreso'`, `'sueldos'→'Sueldo'`
  - `categoria = grupo_pl` (el campo `grupo_pl` existente ES el nuevo campo `categoria`)
  - `sub_categoria = categoria` (el campo `categoria` existente es el nuevo `sub_categoria`)
  - Todos los campos fiscales = NULL
  - INSERT en `real_transactions` usando service role key
- **Paso 3 — Reconciliación**: query que compara `SUM(amount)` por (company_slug, month, grupo_pl) en `transactions` versus `SUM(neto)` por (sociedad, EXTRACT(month FROM fecha), categoria) en `real_transactions`. Imprimir resultado por consola. Fallar con exit code 1 si hay diferencias > 0.01 ARS.
- No eliminar tablas antiguas — eso es Unit 9

**Patterns to follow:**
- `scripts/migrate-from-sheets.ts` — patrón de `.env.local` manual, service role client, `ts-node`

**Test scenarios:**
- Happy path: Script completa sin errores; `SELECT COUNT(*) FROM real_transactions` = 413
- Happy path: Query de reconciliación imprime 0 diferencias
- Error path: Si reconciliación falla (diferencia > 0.01), script sale con código 1 y muestra las filas discrepantes
- Edge case: Re-ejecutar script no duplica registros (usar INSERT ... ON CONFLICT DO NOTHING con un unique index en la clave natural)

**Verification:**
- `SELECT COUNT(*) FROM real_transactions` = 413
- Query de reconciliación muestra 0 diferencias en consola
- Archivos de backup existen en `scripts/backup/`

---

- [ ] **Unit 4: TypeScript — Tipos nuevos y capa de datos actualizada**

**Goal:** Actualizar tipos TypeScript y las funciones `getFinancialData()`, `fetchTransactions()`, `getAvailableYears()` para leer desde las nuevas tablas.

**Requirements:** R12, R13, R15

**Dependencies:** Unit 1 (tablas deben existir)

**Files:**
- Modify: `src/lib/data/types.ts`
- Modify: `src/lib/data/financial.ts`
- Modify: `src/lib/data/transactions.ts`

**Approach:**

**`types.ts`:**
- Agregar tipos nuevos: `CatalogItem`, `RealTransaction`, `PlanningEntry`
- `CatalogItem`: `{ id, tipo, categoria, sub_categoria: string | null, active }`
- `RealTransaction`: todos los campos de `real_transactions` — campos fiscales `number | null`
- `PlanningEntry`: campos de `planning_entries`
- Mantener `DashboardData`, `GrupoPL`, `CompanyData`, etc. sin cambios (el shape del dashboard no varía)

**`financial.ts`:**
- `getFinancialData(year)`:
  1. Fetch `real_transactions WHERE fecha >= '${year}-01-01' AND fecha < '${year+1}-01-01'` — traer `sociedad, fecha, neto, categoria`
  2. Fetch `planning_entries WHERE year = ${year}` — traer `sociedad, month, entry_type, categoria, monto`
  3. Agregar en JS usando el mismo patrón que hoy: por (sociedad, month, categoria), sumar `neto`/`monto`
  4. Construir el mismo `DashboardData` shape que actualmente produce la función
  5. `computeDerived()` y `consolidado` = TG + CDS + VA — sin cambios
- `getAvailableYears()`:
  - Cambiar a `SELECT DISTINCT EXTRACT(year FROM fecha)::integer FROM real_transactions` via RPC o rango de años conocido. Alternativa simple: `real_transactions.select('fecha').then(rows => [...new Set(rows.map(r => new Date(r.fecha).getFullYear()))])`

**`transactions.ts`:**
- `fetchTransactions(year)`:
  - Cambiar query a `real_transactions WHERE fecha >= '${year}-01-01' AND fecha < '${year+1}-01-01'`
  - Retornar tipo `RealTransaction[]` (en lugar del tipo `Transaction[]` anterior)
  - Mantener ordenamiento por `fecha ASC`

**Patterns to follow:**
- Patrón de Supabase SSR client: `src/lib/supabase/server.ts` — `createClient()`
- Patrón de transformación existente en `financial.ts` — `transformToCompanyData()` y `computeDerived()`

**Test scenarios:**
- Happy path: `getFinancialData(2026)` retorna `DashboardData` con los mismos totales que antes de la migración (verificar vs backup)
- Happy path: `fetchTransactions(2026)` retorna los 413 registros con campos correctos
- Edge case: `getFinancialData()` para un año sin datos retorna estructura vacía (sin error)
- Edge case: `getAvailableYears()` retorna `[2026]` después de la migración

**Verification:**
- Dashboard carga en `/dashboard` y muestra los mismos totales que antes de la migración
- `getAvailableYears()` retorna los años correctos
- No errores de TypeScript en `tsc --noEmit`

---

- [ ] **Unit 5: Admin panel — Gestión del catálogo**

**Goal:** Nueva ruta `/admin/catalogo` con CRUD completo para `catalog_items`.

**Requirements:** R3

**Dependencies:** Unit 1, Unit 4 (tipo `CatalogItem`)

**Files:**
- Create: `src/app/admin/catalogo/page.tsx`
- Create: `src/components/admin/CatalogManager.tsx`
- Modify: `src/app/admin/actions.ts` — agregar `saveCatalogItem`, `deactivateCatalogItem`
- Modify: `src/app/admin/page.tsx` — agregar enlace a `/admin/catalogo`

**Approach:**
- `CatalogManager.tsx`: tabla que lista todos los ítems con columnas `Tipo | Categoría | Sub-Categoría | Estado`. Botones por fila: Editar (modal o inline), Desactivar/Reactivar.
- Formulario de nuevo ítem: selects encadenados (Tipo → filtra opciones de Categoría → filtra Sub-Categoría) usando los valores existentes + campo libre para crear nuevos
- **Regla de desactivación** (en `deactivateCatalogItem`): antes de desactivar, verificar que no existan `real_transactions` ni `planning_entries` activos que referencien ese (tipo, categoria, sub_categoria). Si existen, retornar error descriptivo.
- `saveCatalogItem`: upsert con ON CONFLICT en la UNIQUE key; actualiza `updated_at`

**Patterns to follow:**
- `src/app/admin/entry/page.tsx` + `src/components/admin/ManualEntryForm.tsx` — patrón Server Component + Client Component con server action
- `src/app/admin/actions.ts` — patrón `assertAdmin()` + `createAdminClient()` + `revalidatePath()`

**Test scenarios:**
- Happy path: Crear ítem nuevo con tipo='Egreso', categoria='Gastos Admin', sub_categoria='Nuevo Proveedor' → aparece en tabla con estado Activo
- Happy path: Editar sub_categoria de un ítem existente → se actualiza en tabla
- Error path: Intentar desactivar ítem con transacciones existentes → error descriptivo, ítem permanece activo
- Happy path: Desactivar ítem sin referencias → estado cambia a Inactivo
- Happy path: Reactivar ítem → estado vuelve a Activo

**Verification:**
- Lista `/admin/catalogo` muestra todos los ítems sembrados en Unit 2
- Los formularios de transacciones en Units 6/7 no muestran ítems inactivos en dropdowns

---

- [ ] **Unit 6: Admin panel — Entrada de transacciones reales**

**Goal:** Nueva ruta `/admin/transacciones` con formulario de entrada manual y carga CSV para `real_transactions`.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 1, Unit 4, Unit 5

**Files:**
- Create: `src/app/admin/transacciones/page.tsx`
- Create: `src/components/admin/TransactionEntryForm.tsx`
- Create: `src/components/admin/TransactionCSVUpload.tsx`
- Modify: `src/app/admin/actions.ts` — agregar `saveTransaction`, `uploadTransactionsCSV`
- Modify: `src/app/admin/page.tsx` — agregar enlace

**Approach:**

**Formulario manual** (`TransactionEntryForm`): ~20 campos agrupados en 3 secciones:
1. **Clasificación P&L** (requeridos): selects encadenados Tipo → Categoría → Sub-Categoría (cargados desde `catalog_items WHERE active=true`), campo Sociedad, campo Fecha, campo Neto
2. **Datos del proveedor** (opcionales): Razón Social, CUIT, Provincia, Ciudad, Condición IVA, Nro. Factura
3. **Desglose fiscal** (opcionales): IVA2, IVA5, IVA10, IVA21, IVA27, IIBB, Percepción IVA, Otros Impuestos, Total IVA, Total Facturado, Observaciones

**CSV upload** (`TransactionCSVUpload`):
- Columnas esperadas (en orden): `fecha,sociedad,neto,tipo,categoria,sub_categoria,razon_social,cuit,nro_factura,importe_neto_gravado,importe_no_grav,iva21,total_iva,total_facturado,observaciones` (campo `sub_categoria` puede estar vacío)
- Parser reutilizable (extender el existente en `actions.ts`)
- Validación fila a fila: (tipo, categoria, sub_categoria) debe existir en `catalog_items WHERE active=true`
- Comportamiento en error: rechazar archivo completo si alguna fila tiene catalog_items no encontrado; mostrar lista de filas problemáticas
- INSERT por lotes; llamar `revalidatePath('/dashboard')` al finalizar

**`saveTransaction`** en actions.ts:
- `assertAdmin()`
- Validar (tipo, categoria, sub_categoria) contra `catalog_items WHERE active=true`
- Insert en `real_transactions` con `createAdminClient()`
- `revalidatePath('/dashboard')`

**Patterns to follow:**
- `src/app/admin/upload/page.tsx` + `CSVUploadForm.tsx` — patrón de file input + server action
- `src/app/admin/actions.ts` `uploadCSV` — parser CSV existente, patrón de validación

**Test scenarios:**
- Happy path: Ingresar transacción manual con solo Fecha + Sociedad + Neto + Tipo + Categoría → INSERT exitoso, aparece en dashboard al recargar
- Happy path: Ingresar transacción con todos los campos fiscales → todos los valores guardados correctamente
- Error path: Seleccionar tipo/categoria que no existen en catálogo activo → error de validación antes de INSERT
- Error path: CSV con una fila con categoria inválida → rechazo del archivo completo con mensaje indicando la fila problemática
- Happy path: CSV bien formado con 10 filas → INSERT de 10 registros en `real_transactions`
- Edge case: CSV con campo `sub_categoria` vacío → INSERT válido con `sub_categoria = NULL`

**Verification:**
- Transacción ingresada manualmente aparece en pestaña Registros del dashboard
- Total del mes en dashboard P&L aumenta en el valor `neto` ingresado
- CSV de prueba con 5 filas válidas se procesa exitosamente

---

- [ ] **Unit 7: Admin panel — Entrada de presupuesto y LE**

**Goal:** Nueva ruta `/admin/presupuesto-le` con formulario de entrada manual y carga CSV para `planning_entries`.

**Requirements:** R10, R11

**Dependencies:** Unit 1, Unit 4, Unit 5

**Files:**
- Create: `src/app/admin/presupuesto-le/page.tsx`
- Create: `src/components/admin/PlanningEntryForm.tsx`
- Create: `src/components/admin/PlanningCSVUpload.tsx`
- Modify: `src/app/admin/actions.ts` — agregar `savePlanningEntry`, `uploadPlanningCSV`
- Modify: `src/app/admin/page.tsx` — agregar enlace

**Approach:**

**Formulario manual** (`PlanningEntryForm`): campos simples — selector Tipo de Plan (Presupuesto/LE), selector Año, selector Mes, selector Sociedad, selects encadenados Tipo → Categoría → Sub-Categoría, campo Monto.

**CSV upload** (`PlanningCSVUpload`):
- Columnas: `entry_type,year,month,sociedad,tipo,categoria,sub_categoria,monto`
- Comportamiento de re-carga (upsert): `ON CONFLICT (year, month, sociedad, entry_type, categoria, COALESCE(sub_categoria,'')) DO UPDATE SET monto = EXCLUDED.monto` — re-cargar el presupuesto del año sobreescribe los valores existentes
- Validar (tipo, categoria, sub_categoria) contra catálogo activo — mismo patrón que Unit 6

**`savePlanningEntry`**: upsert con ON CONFLICT (mismo key que arriba)

**Patterns to follow:**
- `TransactionCSVUpload` de Unit 6 — patrón de validación de catálogo
- `ManualEntryForm.tsx` existente — select + server action

**Test scenarios:**
- Happy path: Ingresar presupuesto ENE 2026, TG, Gastos Admin, Abogados, $100.000 → aparece en comparativa Real vs Ppto del dashboard
- Happy path: Re-cargar mismo mes/categoría con nuevo monto → valor actualizado (upsert, no duplicado)
- Error path: CSV con sociedad inválida ('XX') → rechazo con mensaje de error
- Happy path: CSV de presupuesto completo (12 meses × 7 categorías × 3 empresas = 252 filas) → INSERT exitoso

**Verification:**
- Vista "Real vs Presupuesto" del dashboard muestra varianzas después de cargar datos de presupuesto
- `SELECT COUNT(*) FROM planning_entries WHERE entry_type='Presupuesto' AND year=2026` = número de filas cargadas
- Re-carga del mismo CSV no duplica registros

---

- [ ] **Unit 8: Dashboard — Actualización de TransactionsView y drill-down**

**Goal:** Actualizar `TransactionsView` para mostrar campos de `real_transactions` y reemplazar filtro 'Fuente' por 'Tipo'. Actualizar drill-down en `PLTable`.

**Requirements:** R14, R15

**Dependencies:** Unit 4

**Files:**
- Modify: `src/components/dashboard/TransactionsView.tsx`
- Modify: `src/components/dashboard/PLTable.tsx`

**Approach:**

**`TransactionsView.tsx`:**
- Columnas visibles: Fecha, Sociedad, Categoría, Sub-Categoría, Tipo, Razón Social, Nro. Factura, Neto (+ columnas colapsables opcionales para campos fiscales)
- Reemplazar filtro 'Fuente' (`tx.source`) por filtro 'Tipo' (`tx.tipo`)
- El filtro de 'Grupo P&L' (`tx.grupo_pl`) pasa a llamarse 'Categoría' (`tx.categoria`) — mismos valores, solo renombramiento
- Mantener filtros de Sociedad, Mes, búsqueda por texto (buscar en `razon_social` + `cuit` + `nro_factura` + `observaciones`)
- Pasar tipo `RealTransaction[]` en lugar de `Transaction[]`

**`PLTable.tsx`:**
- Cambiar la prop que se pasa a `TransactionsView` al hacer drill-down: `grupo_pl → categoria` (mismo valor, diferente nombre de campo)
- La lista de exclusión (`['Total Gastos', 'EBITDA', 'RDO. NETO']`) no cambia

**Patterns to follow:**
- `TransactionsView.tsx` existente — patrón de filtros con `useState`, columnas con `table`

**Test scenarios:**
- Happy path: Click en fila "Gastos Administrativos" de enero → TransactionsView muestra solo transacciones con `categoria='Gastos Administrativos'` y `EXTRACT(month FROM fecha)=1`
- Happy path: Filtrar por Tipo='Egreso' → solo muestran transacciones con `tipo='Egreso'`
- Happy path: Buscar "Abogado" → filtra por `razon_social`, `cuit` y `observaciones`
- Edge case: Registros migrados (sin razon_social ni cuit) muestran campos vacíos sin error
- Edge case: Click en fila "EBITDA" no activa drill-down (sigue excluido)

**Verification:**
- Drill-down desde PLTable muestra transacciones correctas para el grupo y mes
- Filtro de Tipo muestra las 3 opciones ('Ingreso', 'Egreso', 'Sueldo')
- Columnas Razón Social y Nro. Factura visibles en Registros

---

- [ ] **Unit 9: Cutover — Reconciliación, deploy y limpieza**

**Goal:** Ejecutar la secuencia de cutover de R18: reconciliación → deploy del frontend → eliminación de tablas antiguas.

**Requirements:** R16, R18

**Dependencies:** Units 1–8 completos y deploiados en Vercel

**Files:**
- Create: `supabase/migrations/006_drop_old_tables.sql`
- Delete: `scripts/migrate-from-sheets.ts` (obsoleto)
- Modify: `src/app/admin/actions.ts` — eliminar `saveEntry`, `deleteEntry`, `uploadCSV` (para `financial_entries`)

**Approach:**

**Paso 1 — Reconciliación final** (antes del deploy):
- Ejecutar `scripts/migrate-to-new-architecture.ts` una última vez en modo solo-reconciliación (flag `--verify-only`)
- Confirmar 0 diferencias entre totales de `transactions` y `real_transactions`

**Paso 2 — Deploy**:
- `git push` a `main` con todos los cambios de Units 4–8
- Vercel detecta el push y hace deploy automático
- Verificar que dashboard carga en URL de producción y muestra los mismos totales

**Paso 3 — Limpieza**:
- Ejecutar `006_drop_old_tables.sql` en Supabase Dashboard → SQL Editor:
  ```sql
  DROP TABLE transactions;
  DROP TABLE financial_entries;
  ```
- Eliminar server actions obsoletos (`saveEntry`, `deleteEntry`, `uploadCSV` para financial_entries)
- `git push` final

**No hay rollback automático** — el backup JSON de Unit 3 permite restaurar si fuera necesario.

**Patterns to follow:**
- `supabase/migrations/` — ejecutar SQL manualmente en Supabase Dashboard o via CLI

**Test scenarios:**
- Happy path: Reconciliación retorna 0 diferencias antes del deploy
- Happy path: Dashboard en producción muestra los mismos KPIs después del deploy
- Happy path: Panel admin `/admin/transacciones` permite ingresar transacciones nuevas después del cutover
- Error path: Si reconciliación muestra diferencias → no continuar; investigar en backup JSON

**Verification:**
- `\dt` en Supabase Dashboard no muestra `transactions` ni `financial_entries`
- Dashboard P&L en producción muestra datos correctos
- Logs de Vercel no muestran errores de "relation does not exist"

---

## System-Wide Impact

- **Interaction graph:** `revalidatePath('/dashboard')` en todas las server actions nuevas — mismo patrón existente. ISR de 300s en `/dashboard/page.tsx` no necesita cambios.
- **Error propagation:** Server actions retornan `{ error: string }` en caso de fallo — patrón existente. Formularios muestran error al usuario.
- **State lifecycle risks:** Entre Unit 3 (migración) y Unit 9 (cutover), ambas fuentes de datos coexisten. `getFinancialData()` solo lee de una fuente a la vez — durante Units 4-8, el dashboard lee de las nuevas tablas (con datos migrados) mientras admin sigue con acceso a las viejas. No hay doble escritura.
- **API surface parity:** `DashboardData` shape preservado — todos los componentes de visualización (`PLTable`, `KPICards`, `EvolutionChart`, `VarianceBars`, `PeriodSelector`) quedan sin tocar.
- **Integration coverage:** La pestaña Registros usa datos de `fetchTransactions()` — debe actualizar en sync con el cambio de Unit 4 + Unit 8.
- **Unchanged invariants:** `GrupoPL` TypeScript type permanece (usado en `pl-structure.ts` y `PLTable`). `MONTHS` array y lógica de cálculo de EBITDA/RDO.NETO sin cambios. Ruta `/dashboard` e ISR sin cambios.
- **`getAvailableYears()` inefficiency**: Actualmente fetcha todas las filas de `financial_entries`. En Unit 4, reemplazar por una query selectiva de years distintos en `real_transactions`.

## Phased Delivery

### Fase 1 — Base de datos y migración (sin impacto en producción)
Units 1, 2, 3 — Las tablas nuevas se crean y los datos se migran. Producción sigue usando las tablas antiguas. Reversible.

### Fase 2 — Capa TypeScript y admin panel
Units 4, 5, 6, 7 — El código del frontend se actualiza para leer/escribir en nuevas tablas. Requiere que Fase 1 esté completa.

### Fase 3 — UI del dashboard y cutover
Units 8, 9 — Actualización de TransactionsView y eliminación de tablas antiguas. Irreversible después de Unit 9.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Backup JSON de Unit 3 se corrompe | Exportar también como CSV; verificar checksum antes del cutover |
| Reconciliación falla (diferencia > 0.01) | No continuar al deploy; investigar fila por fila con backup JSON |
| Vercel falla el deploy por error de TypeScript | `tsc --noEmit` debe pasar localmente antes de push |
| `catalog_items` sembrado con valores incorrectos | Auditoría con el responsable del área antes de Unit 3; el seed es idempotente y corregible |
| Performance de `getFinancialData()` degradada | Agregar index en `real_transactions(sociedad, fecha)` en Unit 1; monitorear en Vercel Analytics |
| Formularios admin muestran items de catálogo obsoletos (cache) | Llamar `revalidatePath('/admin/catalogo')` en `saveCatalogItem` |

## Documentation / Operational Notes

- Después del cutover, documentar en `docs/solutions/` el patrón de migración de datos (script de backup + reconciliación).
- El script `scripts/migrate-from-sheets.ts` queda obsoleto y se elimina en Unit 9.
- Nueva URL de admin para transacciones: `/admin/transacciones`. Actualizar cualquier guía de uso interno.
- Variables de entorno en Vercel: no cambian — siguen siendo las mismas 4 variables de Supabase.

## Sources & References

- **Origin document:** [`docs/brainstorms/nueva-arquitectura-datos-requirements.md`](docs/brainstorms/nueva-arquitectura-datos-requirements.md)
- Schema existente: `supabase/migrations/001_initial_schema.sql`, `002_rls_policies.sql`, `003_transactions.sql`
- Capa de datos actual: `src/lib/data/financial.ts`, `src/lib/data/transactions.ts`, `src/lib/data/types.ts`
- Panel admin actual: `src/app/admin/actions.ts`, `src/components/admin/ManualEntryForm.tsx`, `src/components/admin/CSVUploadForm.tsx`
- P&L structure: `src/lib/data/pl-structure.ts`
- Dashboard: `src/components/dashboard/PLTable.tsx`, `src/components/dashboard/TransactionsView.tsx`
