---
title: "feat: Importación CSV limpia y tablas maestras P&L"
type: feat
status: active
date: 2026-04-16
origin: docs/brainstorms/2026-04-16-pl-real-data-architecture.md
---

# feat: Importación CSV limpia y tablas maestras P&L

## Overview

Construcción del flujo de datos completo del dashboard P&L desde cero: se limpian las tablas legacy, se adapta la DB para soportar idempotencia por fuente, y se construye un importador CSV que entiende los 3 formatos reales de Grupo Temple (ingresos, egresos, sueldos) con detección automática de delimitador, preview de validación, y gestión de tablas maestras (sociedades y catálogo) desde la UI.

## Problem Frame

El importador anterior asumía una estructura de columnas que no coincide con los exports reales de los sistemas de Grupo Temple. Las tablas legacy (`financial_entries`, `transactions`) coexisten con la nueva arquitectura generando confusión. No existe el campo `fuente` en `real_transactions`, lo que impide reimportaciones idempotentes. El catálogo y las sociedades necesitan ser editables desde la UI sin tocar código.

(ver origin: docs/brainstorms/2026-04-16-pl-real-data-architecture.md)

## Requirements Trace

- R1. Un CSV de Grupo Temple se importa desde la UI sin tocar código
- R2. Si una `sub_categoria` del CSV no existe en el catálogo, el usuario lo ve y puede agregarlo antes de confirmar
- R3. El P&L muestra totales correctos por `categoria` y detalle por `sub_categoria` al expandir
- R4. Importar el mismo archivo dos veces no duplica datos
- R5. Las sociedades y el catálogo son editables desde la UI

## Scope Boundaries

- Solo P&L Real — no Presupuesto ni LE
- Sin campos fiscales (IVA, IIBB, percepciones)
- Sin comparaciones YoY ni gráficos de evolución
- Sin cambios al sistema de auth (email/password + app_role)

### Deferred to Separate Tasks

- Integrar Presupuesto y LE al dashboard
- Exportar P&L a Excel/PDF
- Agregar campos fiscales a las transacciones

## Context & Research

### Relevant Code and Patterns

- `src/components/admin/TransactionCSVUpload.tsx` — patrón upload + Server Action + preview
- `src/app/admin/actions.ts` → `uploadTransactionsCSV()` — patrón de validación contra catálogo + batch insert
- `src/components/admin/CatalogManager.tsx` — patrón CRUD inline con Server Actions
- `src/lib/data/financial.ts` → `getFinancialData()` — ya lee de `real_transactions`, no necesita cambios
- `src/lib/data/pl-structure.ts` — `PL_STRUCTURE`, `BASE_GRUPOS` ya correctos, sin cambios
- `supabase/migrations/006_drop_old_tables.sql` — base para el cleanup, consolidar en migration 007
- `supabase/migrations/005_seed_catalog.sql` — patrón de seed idempotente con `ON CONFLICT DO NOTHING`

### Estado actual de la DB

La nueva arquitectura (migrations 004/005) ya está completa y funciona:
- `catalog_items` — 46 items, Tipo/Categoria/Sub-Categoria ✓
- `real_transactions` — fecha, sociedad, tipo, categoria, sub_categoria, neto ✓
- `planning_entries` — existente, fuera de alcance v1

Las tablas legacy (`financial_entries`, `transactions`, `companies`) siguen existiendo pero ya no se usan.

### Formatos CSV de Grupo Temple

| Campo DB      | ingresos (`;`) | egresos (`,`) | sueldos (`,`)  |
|---------------|----------------|---------------|----------------|
| fecha         | Mes            | MES           | Periodo        |
| monto         | Neto           | Neto          | Monto          |
| sociedad      | Sociedad       | Sociedad      | Negocio        |
| tipo          | Tipo           | Tipo          | Tipo           |
| categoria     | Categoria      | Categoria     | Categoria      |
| sub_categoria | Sub-Categoria  | Sub-Categoria | Sub-Categoria  |
| observaciones | Observaciones  | Observaciones | Observacion    |

Formato de fecha: `ENE:2026`, `FEB:2026`, etc. → mapear a `YYYY-MM-01`.
Formato de monto: `$ 1.234.567,89` o `1234567` → parsear eliminando `$`, espacios, puntos de miles, coma decimal.

### Institucional

- PapaParse 5.5.2 está instalado (`package.json`) pero no se usa en ningún componente — usar aquí en lugar del parser manual que falló con valores que contienen comas.

## Key Technical Decisions

- **PapaParse para CSV parsing**: Maneja auto-detección de delimitador, campos quoted, BOM, y valores con comas dentro — el parser manual falló con los montos formateados de Grupo Temple.
- **`fuente` como column text con check constraint**: `check (fuente in ('ingresos', 'egresos', 'sueldos'))` en `real_transactions`. Simple, sin enum de Postgres, fácil de extender.
- **Idempotencia por `(sociedad, año, mes, fuente)`**: Al confirmar import, primero DELETE donde coincidan los 4 campos, luego INSERT. Permite reimportar el mismo archivo sin duplicar.
- **Preview en dos pasos**: Una Server Action parsea y valida (no escribe en DB), devuelve `{ valid, invalid }`. El componente muestra el preview. Una segunda action hace el DELETE+INSERT al confirmar.
- **`sociedades` sin FK en `real_transactions`**: La tabla `sociedades` existe para el CRUD UI, pero `real_transactions.sociedad` sigue siendo `text check`. Evita migraciones complejas en datos existentes.
- **Migration 007 consolida todo**: Una sola migration que agrega `fuente`, crea `sociedades`, y dropea las tablas legacy.

## High-Level Technical Design

> *Esto ilustra el enfoque propuesto y es guía direccional para revisión, no especificación de implementación.*

```
┌─────────────────────────────────────────────────────┐
│                    FLUJO DE IMPORT                   │
│                                                       │
│  [Usuario elige fuente + sube CSV]                   │
│          │                                            │
│          ▼                                            │
│  Server Action: parseTempleCSV()                     │
│  ├── PapaParse (auto-detect delimiter)               │
│  ├── Normalizar headers (alias map)                  │
│  ├── Parsear fechas (ENE:2026 → 2026-01-01)          │
│  ├── Parsear montos ($1.234,56 → 1234.56)            │
│  └── Validar contra catalog_items                    │
│          │                                            │
│          ▼                                            │
│  Preview UI                                           │
│  ├── ✓ Filas válidas (N)                             │
│  ├── ⚠ Filas con sub_categoria desconocida (N)       │
│  └── [Confirmar] [Cancelar]                           │
│          │                                            │
│          ▼                                            │
│  Server Action: importConfirm()                      │
│  ├── DELETE WHERE sociedad+año+mes+fuente            │
│  └── INSERT batch (100 rows)                         │
│                                                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    MODELO DE DATOS                   │
│                                                       │
│  sociedades          catalog_items                   │
│  ──────────          ───────────────────             │
│  id uuid PK          id uuid PK                      │
│  codigo text (único) tipo text                       │
│  nombre text         categoria text                  │
│  active boolean      sub_categoria text              │
│                      active boolean                  │
│                                                       │
│  real_transactions (campo nuevo: fuente)             │
│  ─────────────────────────────────────────           │
│  fecha date                                          │
│  sociedad text (TG/CDS/VA)                           │
│  tipo text                                           │
│  categoria text  ──────────────────► P&L             │
│  sub_categoria text                  agregación      │
│  monto numeric                       por categoria   │
│  fuente text (ingresos/egresos/sueldos)              │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## Implementation Units

---

- [ ] **Unit 1: Migration 007 — fuente + sociedades + drop legacy**

**Goal:** Una sola migration que deja la DB limpia: agrega `fuente` a `real_transactions`, crea la tabla `sociedades` con seed inicial, y dropea las tablas legacy.

**Requirements:** R4, R5

**Dependencies:** Ninguna — ejecutar antes de todos los demás units.

**Files:**
- Create: `supabase/migrations/007_clean_rebuild.sql`

**Approach:**
- `ALTER TABLE real_transactions ADD COLUMN fuente text CHECK (fuente IN ('ingresos', 'egresos', 'sueldos'))` — nullable para compatibilidad con registros existentes
- Crear `sociedades (id uuid PK, codigo text UNIQUE, nombre text, active boolean)` con RLS idéntico al patrón de `catalog_items` (SELECT authenticated, INSERT/UPDATE/DELETE admin)
- Seed `sociedades` con TG, CDS, VA y sus nombres reales con `ON CONFLICT DO NOTHING`
- DROP TABLE `transactions`, `financial_entries`, `companies` — en ese orden (respetar FKs si existen)
- Incluir comentario: ejecutar en Supabase SQL Editor

**Test scenarios:**
- Happy path: migration corre sin errores en DB limpia
- Idempotencia: si se corre dos veces, el seed no duplica sociedades
- Datos existentes: registros pre-existentes en `real_transactions` quedan con `fuente = NULL` (no rompe nada)

**Verification:**
- Las tablas `financial_entries`, `transactions`, `companies` no existen
- `real_transactions` tiene columna `fuente` nullable
- `sociedades` tiene 3 filas: TG, CDS, VA

---

- [ ] **Unit 2: Server Action — parseTempleCSV y importConfirm**

**Goal:** Dos Server Actions: una que parsea y valida un CSV de Grupo Temple sin escribir en DB (devuelve preview), y otra que ejecuta el DELETE+INSERT al confirmar.

**Requirements:** R1, R2, R4

**Dependencies:** Unit 1 (columna `fuente` debe existir)

**Files:**
- Create: `src/app/admin/import/actions.ts`

**Approach:**

*`parseTempleCSV(formData: FormData)`*:
- Extrae `file` y `fuente` del FormData
- Usa PapaParse con `{ header: true, skipEmptyLines: true, dynamicTyping: false }` — PapaParse auto-detecta el delimitador
- Normaliza headers a lowercase+trim para el alias map
- Alias map de headers:
  - fecha: `['mes', 'periodo']` → parsear `ENE:2026` usando `MES_MAP` → `YYYY-MM-01`
  - monto: `['neto', 'monto']` → eliminar `$`, espacios, puntos, convertir coma a punto → `parseFloat`
  - sociedad: `['sociedad', 'negocio']` → `.toUpperCase()`
  - tipo, categoria: directo (mismos nombres)
  - sub_categoria: `['sub-categoria', 'sub_categoria']`
  - observaciones: `['observaciones', 'observacion']`
- Valida cada fila contra `catalog_items` (fetch al inicio, comparación in-memory)
- Valida sociedad contra `['TG', 'CDS', 'VA']`
- Devuelve `{ valid: ParsedRow[], invalid: InvalidRow[], preview: ParsedRow[] }`
  - `invalid` incluye razón: `'sociedad_desconocida'` | `'clasificacion_no_en_catalogo'` | `'monto_invalido'` | `'fecha_invalida'`
  - `preview` = primeras 10 filas válidas para mostrar en UI

*`importConfirm(rows: ParsedRow[], fuente: string)`*:
- Determina los (sociedad, año, mes) únicos en `rows`
- Para cada combinación: DELETE FROM `real_transactions` WHERE sociedad=... AND EXTRACT(YEAR FROM fecha)=... AND EXTRACT(MONTH FROM fecha)=... AND fuente=...
- INSERT en lotes de 100 las filas válidas incluyendo `fuente`
- Devuelve `{ inserted: number, errors: string[] }`

**Patterns to follow:**
- `src/app/admin/actions.ts` → `uploadTransactionsCSV()` — patrón validación + batch insert
- `scripts/migrate-real.ts` → `MES_MAP`, `parseNum` — lógica de parseo existente

**Test scenarios:**
- Happy path: CSV de ingresos con 50 filas válidas → 50 inserted
- Auto-detect delimiter: CSV con `;` y CSV con `,` ambos parsean correctamente
- Monto con formato `$ 1.234.567,89` → `1234567.89`
- Monto `$6.790.554` (sin decimales) → `6790554`
- Fecha `ENE:2026` → `2026-01-01`, `DIC:2025` → `2025-12-01`
- Fila con `sub_categoria` no en catálogo → aparece en `invalid` con razón
- Fila con sociedad `TEMPLE` (desconocida) → aparece en `invalid`
- Reimport: correr el mismo CSV dos veces → mismo count de registros, sin duplicados
- CSV vacío o sin headers reconocibles → error claro devuelto

**Verification:**
- `parseTempleCSV` con los 3 CSVs de Grupo Temple devuelve 0 filas inválidas (suponiendo catálogo correcto)
- `importConfirm` + reimport = mismo resultado

---

- [ ] **Unit 3: UI — Página de importación CSV (3 tabs)**

**Goal:** Página `/admin/importar` con 3 tabs (Ingresos / Egresos / Sueldos), file input, preview de validación, advertencias de filas inválidas, y botón de confirmar.

**Requirements:** R1, R2

**Dependencies:** Unit 2

**Files:**
- Create: `src/app/admin/importar/page.tsx`
- Create: `src/components/admin/CSVImportPanel.tsx`

**Approach:**

*`page.tsx`*: Server Component que verifica rol admin, renderiza 3 tabs (o un selector de fuente) que cargan `CSVImportPanel` con la fuente correcta.

*`CSVImportPanel.tsx`* (Client Component):
- Estado: `idle` → `previewing` → `importing` → `done`
- En `idle`: file input `<input type="file" accept=".csv">`
- Al seleccionar archivo: llamar `parseTempleCSV` via Server Action → pasar a `previewing`
- En `previewing`:
  - Tabla con primeras 10 filas: fecha | sociedad | tipo | categoria | sub_categoria | monto
  - Resumen: "✓ N filas válidas · ⚠ M filas con advertencias"
  - Si hay `invalid`: lista de advertencias colapsable con razón por fila
  - Botones: `[Confirmar import]` (importa solo válidas) / `[Cancelar]`
  - Si hay inválidas: texto "Las filas con advertencias no se importarán. Agregá las clasificaciones al catálogo y volvé a importar."
- En `importing`: spinner
- En `done`: "✅ N transacciones importadas" + botón "Importar otro archivo"

**Patterns to follow:**
- `src/components/admin/TransactionCSVUpload.tsx` — estructura general del flujo
- `src/components/admin/CatalogManager.tsx` — estilos de tabla admin

**Test scenarios:**
- Happy path: subir CSV válido → preview correcto → confirmar → mensaje de éxito
- CSV con filas inválidas: se ven las advertencias, confirmar importa solo las válidas
- Archivo que no es CSV (o malformado): error claro sin crash
- Tab incorrecto (ej: subir sueldos en tab Ingresos): las advertencias de catálogo guían al usuario

**Verification:**
- Los 3 CSVs de Grupo Temple se pueden importar sin errores desde la UI
- Las filas con `sub_categoria` desconocida aparecen como advertencias, no bloquean el import de las demás

---

- [ ] **Unit 4: UI — CRUD Sociedades**

**Goal:** Página `/admin/sociedades` para ver, agregar y editar las sociedades (TG, CDS, VA y futuras).

**Requirements:** R5

**Dependencies:** Unit 1 (tabla `sociedades` debe existir)

**Files:**
- Create: `src/app/admin/sociedades/page.tsx`
- Create: `src/components/admin/SociedadesManager.tsx`
- Modify: `src/app/admin/actions.ts` — agregar `saveSociedad`, `toggleSociedadActive`

**Approach:**

*`SociedadesManager.tsx`* (Client Component, patrón idéntico a `CatalogManager`):
- Tabla: Código | Nombre | Activo | Acciones
- Fila de "Nueva sociedad": inputs inline para codigo y nombre + botón Guardar
- Cada fila existente: editar nombre, toggle activo
- Server Actions: `saveSociedad({ codigo, nombre })`, `toggleSociedadActive(id)`

*Agregar link en layout admin*: `/admin/sociedades` en el nav.

**Patterns to follow:**
- `src/components/admin/CatalogManager.tsx` — idéntico en estructura y estilo
- `src/app/admin/actions.ts` → `saveCatalogItem()` — patrón de Server Action con validación de rol

**Test scenarios:**
- Happy path: agregar sociedad nueva → aparece en tabla
- Editar nombre: cambio persiste en DB
- Toggle activo: estado se refleja inmediatamente
- Rol no-admin: acciones retornan error sin crash

**Verification:**
- Las 3 sociedades iniciales (TG, CDS, VA) aparecen con sus nombres correctos
- Se puede agregar una cuarta y vuelve a aparecer en el dashboard selector

---

- [ ] **Unit 5: Cleanup — remover legacy**

**Goal:** Eliminar el código que referencia las tablas legacy (`financial_entries`, `transactions`, `companies`) para dejar el codebase limpio.

**Requirements:** (no agrega funcionalidad, reduce deuda)

**Dependencies:** Units 1-4 completos y validados en producción

**Files:**
- Delete: `src/app/admin/upload/page.tsx`
- Delete: `src/app/admin/entry/page.tsx`
- Delete: `src/components/admin/CSVUploadForm.tsx`
- Delete: `src/components/admin/ManualEntryForm.tsx`
- Modify: `src/app/admin/actions.ts` — remover `uploadCSV()`, `saveEntry()`, `deleteEntry()`
- Modify: `src/lib/data/types.ts` — remover `FinancialEntryRow`, `CompanyRow`
- Modify: `src/app/admin/layout.tsx` (o donde esté el nav) — remover links a `/upload` y `/entry`

**Approach:**
- Buscar toda referencia a `financial_entries`, `transactions` (tabla old), `companies` en el código TypeScript
- Verificar que ningún componente activo importe los archivos a borrar antes de deletear

**Test scenarios:**
- Test expectation: none — es eliminación de dead code. Verificación es visual + TypeScript build sin errores.

**Verification:**
- `npx tsc --noEmit` sin errores
- Rutas `/admin/upload` y `/admin/entry` devuelven 404
- El dashboard principal carga correctamente

---

## System-Wide Impact

- **`financial.ts`**: No necesita cambios — ya lee de `real_transactions` y `catalog_items`
- **`PLTable.tsx`**: No necesita cambios — ya soporta subcategorías expandibles
- **`DashboardClient.tsx`**: No necesita cambios — orchestrator funciona igual
- **`getAvailableYears()`**: Fetcha todos los `fecha` para obtener años — seguirá funcionando, optimizable en el futuro
- **Datos existentes**: Registros en `real_transactions` con `fuente = NULL` seguirán siendo leídos por el dashboard correctamente. La idempotencia de import solo aplica a filas con `fuente` definida.
- **Invariantes sin cambiar**: Auth, RLS, selector de período, selector de empresa, consolidado — nada de esto cambia

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration 007 dropea tablas con datos | Verificar que nadie use `financial_entries` antes de correr. Los backups JSON en `scripts/backup/` existen. |
| PapaParse no detecta correctamente el delimitador | Fallback: leer primera línea y contar `;` vs `,` manualmente si PapaParse falla |
| Sub-categorías del CSV no están en el catálogo | El preview muestra advertencias, el usuario puede ir a Catálogo a agregarlas antes de confirmar (R2) |
| Datos existentes con `fuente = NULL` quedan "huérfanos" para reimport | Documentar: los registros sin fuente deben borrarse manualmente si se quiere reimportar limpio |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-16-pl-real-data-architecture.md](docs/brainstorms/2026-04-16-pl-real-data-architecture.md)
- Patrón CSV upload: `src/components/admin/TransactionCSVUpload.tsx`
- Patrón Server Actions admin: `src/app/admin/actions.ts`
- Patrón CRUD maestras: `src/components/admin/CatalogManager.tsx`
- PapaParse docs: https://www.papaparse.com/docs
- Migration base cleanup: `supabase/migrations/006_drop_old_tables.sql`
