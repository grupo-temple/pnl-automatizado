---
title: "feat: Navegación unificada y flujo contextual en dashboard P&L"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/ui-estructura-requirements.md
---

# feat: Navegación unificada y flujo contextual

## Overview

Reemplaza las dos barras de navegación actuales (Dashboard/Registros + empresa tabs) por una sola barra `Consolidado | TG | CDS | VA | Registros`. Agrega breadcrumb contextual y botón "← Volver al P&L" en la vista Registros. Sincroniza la empresa activa del dashboard con el filtro inicial de Registros.

## Problem Frame

El dashboard tiene 3 capas de navegación que confunden al usuario: tabs principales, tabs de empresa, y pills de vista. El admin button ya fue resuelto en Ticket 1. El flujo drill-down → Registros → volver al P&L no preserva el contexto. Cuando el usuario cambia de empresa en el dashboard y luego va a Registros, los filtros no reflejan esa empresa.

(ver origin: docs/brainstorms/ui-estructura-requirements.md — Ticket 2)

## Requirements Trace

- R1. Una sola barra de navegación: `Consolidado | TG | CDS | VA | Registros`
- R2. Breadcrumb visible en Registros cuando se llega via drill-down
- R3. Botón "← Volver al P&L" que restaura empresa y mes seleccionado
- R4. La empresa activa del dashboard se refleja en el filtro inicial de Registros

## Scope Boundaries

- No se implementa sidebar ni navegación lateral
- No se implementan permisos por empresa
- El botón Admin en el header ya existe (Ticket 1) — no se toca

## Context & Research

### Archivos relevantes

- `src/components/dashboard/DashboardClient.tsx` — gestiona `activeTab` + `state.company` + `drillDown`; único archivo de estado de navegación
- `src/components/dashboard/TransactionsView.tsx` — recibe `initialCompany`, `initialGrupo`, `initialMonths` como props opcionales
- `src/styles/dashboard.css` — clases `.company-nav`, `.company-tab` ya definen el estilo de tabs
- `src/lib/data/types.ts` — define `CompanySlug = 'tg' | 'cds' | 'va' | 'consolidado'`

### Estado actual de navegación en DashboardClient

```
activeTab: 'dashboard' | 'registros'    ← controla qué vista se muestra
state.company: CompanySlug              ← empresa seleccionada en dashboard
drillDown: { grupoPL, months, company } ← set cuando viene del drill-down
```

Las dos barras actualmente renderizadas:
1. `<nav>` con tabs "Dashboard" | "Registros" (siempre visible)
2. `<nav>` con tabs "Consolidado" | "TG" | "CDS" | "VA" (solo en dashboard)

## Key Technical Decisions

- **Eliminar `activeTab`, derivar la vista del tab seleccionado**: En lugar de mantener `activeTab` separado, la barra unificada mapea `'registros'` como si fuera una empresa más en la selección. Se reemplaza `activeTab` por una función `isRegistros()` que retorna `true` cuando el tab activo es 'registros'. Esto simplifica el estado y elimina la inconsistencia entre `activeTab` y `state.company`.

- **Nuevo estado `activeView: 'dashboard' | 'registros'`**: Reemplaza `activeTab`. Cuando se hace click en un tab de empresa, `activeView` pasa a 'dashboard'. Cuando se hace click en "Registros", `activeView` pasa a 'registros'. `state.company` solo cambia cuando se selecciona una empresa.

- **Sincronizar empresa a Registros via prop, no via filtro interno**: En lugar de que TransactionsView maneje su propio estado de empresa en forma aislada, `DashboardClient` le pasa la empresa activa como `initialCompany` cuando `drillDown` es null. Esto garantiza que el filtro de Registros refleje siempre la empresa del dashboard.

- **Breadcrumb y back button en el header de la tabla, no en el nav**: El breadcrumb y el botón "← Volver" se ubican dentro de la sección de tabla (`.table-card`) de Registros, no en la barra de navegación principal. Esto mantiene el nav limpio y el contexto cerca del contenido.

## High-Level Technical Design

> *Directional guidance, not implementation specification.*

```
Estado en DashboardClient:
  activeView: 'dashboard' | 'registros'   (reemplaza activeTab)
  drillDown: { grupoPL, months, company } | null
  state: { company, view, accum, selectedMonth }

Nav unificada (siempre visible):
  [Consolidado] [TG] [CDS] [VA] [Registros]
   ↓ click empresa    ↓ click Registros
   activeView='dashboard'  activeView='registros'
   state.company=slug      state.company no cambia

Vista Registros sin drill-down:
  initialCompany = state.company   ← sincronizado
  initialGrupo = undefined
  initialMonths = undefined

Vista Registros con drill-down:
  initialCompany = drillDown.company
  initialGrupo = drillDown.grupoPL
  initialMonths = drillDown.months
  + breadcrumb + botón volver

Volver al P&L:
  drillDown = null
  activeView = 'dashboard'
  state.company = drillDown.company (restaurar)
```

## Implementation Units

- [ ] **Unit 1: Barra de navegación unificada**

**Goal:** Reemplazar las dos barras nav por una sola con `Consolidado | TG | CDS | VA | Registros`.

**Requirements:** R1

**Dependencies:** Ninguna (puede ejecutarse independientemente)

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/styles/dashboard.css`

**Approach:**
- Reemplazar `activeTab` por `activeView: 'dashboard' | 'registros'` en el estado local del componente
- Eliminar el primer `<nav>` (Dashboard/Registros tabs)
- En el segundo `<nav>` (company tabs), agregar un tab "Registros" al final de la lista
- Cuando se hace click en un tab de empresa: `activeView = 'dashboard'`, `state.company = slug`
- Cuando se hace click en "Registros": `activeView = 'registros'` (sin cambiar `state.company`)
- El tab activo en el nav es: la empresa actual si `activeView === 'dashboard'`, o "Registros" si `activeView === 'registros'`
- La renderización condicional (filtros, charts, tabla P&L vs TransactionsView) pasa a usar `activeView`
- El nav de empresa tabs se muestra siempre (no solo cuando `activeTab === 'dashboard'`)
- Los pills de Vista y Acumulado solo se muestran cuando `activeView === 'dashboard'`

**Patterns to follow:**
- `.company-nav` y `.company-tab.active` ya existen en `dashboard.css` — el tab Registros usa la misma clase
- El tab Registros puede llevar una clase adicional `.tab-registros` para diferenciación visual sutil (borde izquierdo separador)

**Test scenarios:**
- Happy path: click en "TG" → activeView='dashboard', company=tg, nav muestra TG activo
- Happy path: click en "Registros" → activeView='registros', company no cambia, nav muestra Registros activo
- Happy path: estando en Registros, click en "CDS" → activeView='dashboard', company=cds, se muestra el dashboard de CDS
- Edge case: drill-down desde P&L → activeView='registros', nav muestra Registros activo
- Edge case: refrescar la página → estado vuelve al default (Consolidado, dashboard)

**Verification:**
- Solo una barra de navegación visible en todo momento
- El tab activo refleja correctamente la vista actual
- Los filtros de Vista/Acumulado no aparecen cuando Registros está activo

---

- [ ] **Unit 2: Breadcrumb y botón Volver al P&L en Registros**

**Goal:** Cuando el usuario llega a Registros via drill-down, ver el contexto (grupo, empresa, período) y poder volver al P&L sin perder la empresa y mes seleccionados.

**Requirements:** R2, R3

**Dependencies:** Unit 1 completado

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/styles/dashboard.css`

**Approach:**
- Cuando `drillDown !== null`, mostrar sobre la tabla de Registros un breadcrumb:
  `← Volver al P&L  /  Registros > {drillDown.grupoPL} · {companyLabel[drillDown.company]} · {monthRange} {year}`
- El botón "← Volver" ejecuta: `setDrillDown(null)`, `setActiveView('dashboard')`, `setState(s => ({...s, company: drillDown.company}))`
- Esto restaura exactamente la empresa y el período que tenía el usuario antes del drill-down
- Cuando `drillDown === null` (Registros accedido directamente), no se muestra breadcrumb ni botón volver
- El breadcrumb va dentro del header de `.table-card` existente (mismo lugar donde actualmente está el título de Registros)

**Patterns to follow:**
- El header de `.table-card` con `.table-header-bar` ya tiene un side para el título y otro para botones — el breadcrumb va en el título, el botón volver va en el lado de los botones
- `.btn-sm` para el botón volver

**Test scenarios:**
- Happy path con drill-down: breadcrumb visible con grupo, empresa y período correcto; click en "← Volver" restaura empresa y mes en el dashboard
- Happy path sin drill-down: no se muestra breadcrumb ni botón volver
- Edge case: drill-down desde Consolidado → breadcrumb muestra "Consolidado" correctamente
- Edge case: drill-down desde mes individual (accum=mes) → el breadcrumb muestra el mes correcto y volver restaura ese mes

**Verification:**
- Drill-down desde "Total Ingresos" de TG en MAR → Registros muestra breadcrumb `Registros > Total Ingresos · TG · MAR 2026`
- Click en "← Volver" → dashboard muestra TG con MAR seleccionado
- Ir a Registros directo desde el tab → sin breadcrumb

---

- [ ] **Unit 3: Sincronizar empresa activa a filtro inicial de Registros**

**Goal:** Cuando el usuario navega a Registros directamente (sin drill-down), el filtro de empresa en la tabla refleja la empresa activa del dashboard.

**Requirements:** R4

**Dependencies:** Unit 1 completado

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/components/dashboard/TransactionsView.tsx`

**Approach:**
- En `DashboardClient`, cuando pasa a Registros sin drill-down, pasar `initialCompany={state.company}` a `TransactionsView`
- `TransactionsView` ya recibe `initialCompany` como prop — el cambio es que ahora siempre se pasa (no solo en drill-down)
- Cuando `initialCompany === 'consolidado'`, el select de empresa en TransactionsView debe mostrar "Todas las empresas" (consolidado = todas)
- En `TransactionsView`, agregar lógica: si `initialCompany === 'consolidado'` → `setEmpresa('todas')`
- El filtro de empresa en TransactionsView sigue siendo editable después de la inicialización

**Patterns to follow:**
- `TransactionsView` ya tiene el `useState` de `empresa` inicializado desde `initialCompany` — extender el mismo patrón
- `useMemo` para derivar el valor inicial una sola vez (no re-sincronizar en cada render)

**Test scenarios:**
- Happy path: estando en TG dashboard, click en Registros → filtro de empresa muestra "TG"
- Happy path: estando en Consolidado, click en Registros → filtro de empresa muestra "Todas las empresas"
- Happy path: estando en VA, click en Registros, cambiar filtro a "TG" manualmente → el cambio se mantiene (no se resetea)
- Edge case: navegar Registros → Dashboard CDS → Registros → filtro muestra CDS (inicialización con nuevo valor)

**Verification:**
- Cambiar de empresa en el dashboard y navegar a Registros siempre muestra la empresa correcta pre-seleccionada
- Cambiar el filtro manualmente en Registros no se resetea al volver y volver a entrar

## System-Wide Impact

- **Interaction graph:** Solo afecta `DashboardClient.tsx` (estado) y `TransactionsView.tsx` (props). No hay callbacks externos, middleware, ni side effects de datos.
- **State lifecycle risks:** Al eliminar `activeTab` e introducir `activeView`, hay riesgo de que referencias al estado anterior queden sin actualizar. Verificar que todos los condicionales de renderización se migran a `activeView`.
- **Unchanged invariants:** El flujo de datos (getFinancialData, fetchTransactions, Supabase) no cambia. El admin button del header (Ticket 1) no se toca. La lógica de drill-down (setDrillDown) se mantiene.
- **Integration coverage:** El flujo completo Dashboard → drill-down → Registros → Volver al P&L debe verificarse manualmente end-to-end ya que involucra estado de React que atraviesa múltiples renders.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Renombrar `activeTab` a `activeView` puede dejar referencias huérfanas | Buscar todas las ocurrencias de `activeTab` en DashboardClient antes y después del cambio |
| La sincronización empresa→Registros puede causar re-renders innecesarios | Usar `useMemo` para el valor inicial; el `useState` en TransactionsView solo se inicializa una vez |
| El breadcrumb con empresa "consolidado" puede verse raro | Usar `companyLabel['consolidado'] = 'Consolidado'` — ya existe el mapeo |

## Sources & References

- **Origin document:** [docs/brainstorms/ui-estructura-requirements.md](docs/brainstorms/ui-estructura-requirements.md)
- Estado actual: `src/components/dashboard/DashboardClient.tsx`
- Props de TransactionsView: `src/components/dashboard/TransactionsView.tsx`
- Estilos de tabs: `src/styles/dashboard.css` — `.company-nav`, `.company-tab`
