---
title: "feat: Pulido visual del dashboard P&L"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/ui-estructura-requirements.md
---

# feat: Pulido visual del dashboard P&L

## Overview

Mejoras visuales en cuatro áreas concretas del dashboard sin tocar la estructura de navegación (que va en el Ticket 2): botón Admin en el header para usuarios con rol admin, barra de progreso Real vs Presupuesto en los KPI cards, mejor indicador de drill-down en la tabla P&L, y zebra striping en la tabla de Registros.

## Problem Frame

El dashboard funciona correctamente pero tiene oportunidades de mejora visual que aumentan la claridad y el aspecto profesional: el acceso al panel admin es invisible, los KPI cards no comunican avance vs objetivo, el ícono 🔍 es poco claro como indicador de acción, y la tabla de Registros carece de separación visual entre filas.

(ver origin: docs/brainstorms/ui-estructura-requirements.md — Ticket 1)

## Requirements Trace

- R1. Los usuarios admin pueden acceder al panel admin desde el header sin conocer la URL
- R2. Los KPI cards muestran progreso real vs presupuesto de forma visual
- R3. Las filas clickeables del P&L comunican claramente que son interactivas
- R4. La tabla de Registros tiene mejor legibilidad con separación visual entre filas

## Scope Boundaries

- No se toca la estructura de navegación ni se fusionan barras (Ticket 2)
- No se cambia la paleta de colores ni el tema oscuro
- No se rediseña el login ni el panel admin

## Context & Research

### Archivos relevantes

- `src/app/dashboard/page.tsx` — Server Component que fetcha datos; aquí se obtiene el usuario
- `src/components/dashboard/DashboardClient.tsx` — recibe props del server y renderiza header
- `src/components/dashboard/KPICards.tsx` — ya tiene acceso a valores real y ppto/le
- `src/components/dashboard/PLTable.tsx` — ya tiene el prop `onDrillDown` y el span 🔍
- `src/components/dashboard/TransactionsView.tsx` — tabla de registros
- `src/styles/dashboard.css` — todas las clases CSS del dashboard
- `src/lib/supabase/server.ts` — `createClient()` con sesión del usuario

### Patrones existentes

- El rol admin se lee de `user.user_metadata.app_role` (establecido en Supabase con SQL)
- El middleware ya verifica sesión pero no pasa el usuario al componente
- `createClient()` en server components devuelve un cliente con sesión activa; `supabase.auth.getUser()` retorna el usuario autenticado
- Las clases CSS `.kpi-card`, `.kpi-value`, `.delta` ya están en `dashboard.css`
- La tabla `.pl-table` ya tiene `.row-subtotal` y hover definidos

## Key Technical Decisions

- **Pasar isAdmin como prop, no re-fetch en cliente**: El server component fetcha el usuario una vez y pasa `isAdmin: boolean` a DashboardClient. Evita duplicar la lógica de auth en el cliente.
- **Progress bar en KPI card con CSS puro**: Se agrega un elemento `<div>` con ancho calculado en % dentro del KPI card. No requiere librería externa.
- **Reemplazar 🔍 con CSS hover**: En lugar del emoji, se aplica un borde izquierdo de color accent en hover sobre las filas clickeables del P&L. Más limpio y coherente con el design system.
- **Zebra striping vía CSS**: Se agrega `nth-child(even)` en `dashboard.css` para `.pl-table` dentro de `.transactions-table`. No requiere cambios en el componente React.

## Open Questions

### Resolved During Planning

- **¿Dónde mostrar el botón Admin?**: En el header, extremo derecho, antes del badge de año. Solo visible cuando `isAdmin === true`.
- **¿Qué KPI muestra la barra de progreso?**: Los 4 cards — Ingresos, Gastos, EBITDA, Neto — muestran barra vs presupuesto cuando hay datos de ppto. Si no hay ppto, la barra no se renderiza.
- **¿La barra de progreso reemplaza el delta % o se suma?**: Se suma debajo del valor, no reemplaza nada. El delta % existente se mantiene.

### Deferred to Implementation

- El ancho exacto de la barra de progreso cuando el real supera el 100% del ppto (overflow vs capped at 100% — decisión de implementación).

## Implementation Units

- [ ] **Unit 1: Pasar isAdmin desde el server y mostrar botón Admin en header**

**Goal:** Los usuarios admin ven un botón "Admin" en el header del dashboard que los lleva a `/admin`.

**Requirements:** R1

**Dependencies:** Ninguna

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/styles/dashboard.css`

**Approach:**
- En `dashboard/page.tsx`, llamar a `supabase.auth.getUser()` después de `createClient()` y derivar `isAdmin = user?.user_metadata?.app_role === 'admin'`
- Pasar `isAdmin` como prop a `DashboardClient`
- En `DashboardClient`, renderizar en el header un `<a href="/admin">` con estilo de botón pequeño cuando `isAdmin === true`
- El botón va en `.header-right`, antes del `.year-badge`

**Patterns to follow:**
- `src/app/dashboard/page.tsx` ya llama a `createClient()` — agregar `getUser()` en el mismo bloque
- Estilo: seguir `.btn-sm` existente en `dashboard.css`

**Test scenarios:**
- Happy path: usuario con `app_role: admin` ve el botón "Admin" en el header
- Edge case: usuario sin `app_role` (viewer) no ve el botón
- Edge case: si `getUser()` falla o devuelve null, `isAdmin` cae a `false` sin romper el render

**Verification:**
- Login como admin → botón visible en header → click lleva a `/admin`
- Login como usuario sin rol → botón no visible

---

- [ ] **Unit 2: Barra de progreso Real vs Presupuesto en KPI cards**

**Goal:** Cada KPI card muestra una barra delgada debajo del valor que indica qué porcentaje del presupuesto se alcanzó.

**Requirements:** R2

**Dependencies:** Ninguna

**Files:**
- Modify: `src/components/dashboard/KPICards.tsx`
- Modify: `src/styles/dashboard.css`

**Approach:**
- En `KPICards.tsx`, calcular `progress = displayVal / cmpVal * 100` para cada KPI, capeado entre 0 y 150
- Renderizar `<div class="kpi-progress-track"><div class="kpi-progress-fill" style={{width: min(progress, 100) + '%'}} /></div>` debajo de `.kpi-meta`
- Si `cmpVal` es null (sin presupuesto), no renderizar la barra
- En `dashboard.css`, definir `.kpi-progress-track` (fondo oscuro, altura 3px, border-radius) y `.kpi-progress-fill` (color por clase: ingresos/gastos/ebitda/neto, transición width)
- Cuando `progress > 100%`, cambiar el color del fill a `--warning` para indicar que se superó el presupuesto (en gastos esto es malo, en ingresos es bueno — mismo color por simplicidad en esta iteración)
- Agregar debajo de la barra un label pequeño: "X% del ppto" en color muted

**Patterns to follow:**
- `.var-bar-track` y `.var-bar-fill` en `dashboard.css` — mismo concepto visual
- La paleta de colores por clase (ingresos/gastos/ebitda/neto) ya existe en los KPI cards

**Test scenarios:**
- Happy path: con datos de ppto cargados, la barra muestra el % correcto
- Edge case: sin datos de ppto (`cmpVal === null`), la barra no se renderiza
- Edge case: real > ppto, la barra se muestra al 100% con color warning
- Edge case: real = 0, la barra se muestra al 0%

**Verification:**
- Con datos de Real cargados y sin Presupuesto: barra no aparece
- Con ambos cargados: barra muestra proporción correcta y label "X% del ppto"

---

- [ ] **Unit 3: Indicador visual de drill-down en tabla P&L**

**Goal:** Reemplazar el emoji 🔍 por un indicador CSS más limpio que comunique que la fila es clickeable.

**Requirements:** R3

**Dependencies:** Ninguna

**Files:**
- Modify: `src/components/dashboard/PLTable.tsx`
- Modify: `src/styles/dashboard.css`

**Approach:**
- En `PLTable.tsx`, reemplazar el `<span>🔍</span>` por un `<span class="drill-icon">↗</span>` o simplemente removerlo
- En `dashboard.css`, para las filas con `onDrillDown` activo, agregar en hover un borde izquierdo de 2px solid `var(--accent)` usando la clase `.row-drillable`
- Agregar clase `row-drillable` en el `<tr>` cuando `canDrill === true`
- En hover de `.row-drillable`, mostrar el borde izquierdo accent y un cursor pointer
- Agregar `title="Ver registros"` al `<tr>` para accesibilidad básica (ya está en el código)

**Patterns to follow:**
- `.row-section-header:hover` ya usa `background: rgba(0,212,170,0.1)` — mismo patrón de hover accent
- `.row-subtotal` ya tiene sus estilos base definidos

**Test scenarios:**
- Happy path: filas clickeables muestran borde accent en hover
- Edge case: filas no clickeables (Total Gastos, EBITDA, RDO. NETO) no muestran el indicador
- Test expectation: none para lógica de negocio — es puramente visual

**Verification:**
- Hover sobre "Total Ingresos" → borde izquierdo verde visible
- Hover sobre "EBITDA" → sin indicador de drill-down

---

- [ ] **Unit 4: Zebra striping y polish en tabla de Registros**

**Goal:** La tabla de Registros es más fácil de leer con alternancia de color en filas y mejor espaciado de columnas.

**Requirements:** R4

**Dependencies:** Ninguna

**Files:**
- Modify: `src/styles/dashboard.css`
- Modify: `src/components/dashboard/TransactionsView.tsx`

**Approach:**
- Agregar clase `transactions-table` al `<table>` en `TransactionsView.tsx`
- En `dashboard.css`, definir `.transactions-table tbody tr:nth-child(even) td` con `background: rgba(26,37,64,0.4)` (zebra sutil, coherente con el tema oscuro)
- Aumentar el `padding` de las celdas `td` a `9px 14px` para mejor respiración
- Para la columna "Descripción", agregar `max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` para evitar que filas largas rompan el layout
- Agregar `border-left: 1px solid rgba(30,45,69,0.3)` entre columnas para separación visual sutil

**Patterns to follow:**
- `.pl-table tr:hover td` ya usa `rgba(26,37,64,0.5)` — usar tono similar para zebra
- Las celdas de `.pl-table` ya tienen `padding: 7px 12px` — escalar levemente

**Test scenarios:**
- Test expectation: none — cambios puramente visuales. Verificar visualmente que el zebra striping no rompe el contraste en tema oscuro y que el texto ellipsis funciona con descripciones largas.

**Verification:**
- La tabla de Registros muestra filas pares con fondo levemente distinto
- Descripciones largas se truncan con "..." sin romper el layout

## System-Wide Impact

- **Interaction graph:** Ningún callback o middleware afectado. Los cambios son additive (props nuevos, clases CSS nuevas).
- **Error propagation:** Si `getUser()` falla en el server, `isAdmin` cae a `false` — el dashboard sigue funcionando normalmente.
- **Unchanged invariants:** La lógica de datos (financial_entries, transactions), el auth flow, y la estructura de componentes no cambian.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `getUser()` agrega latencia al server render | La llamada se puede hacer en paralelo con `getFinancialData` usando `Promise.all` |
| La barra de progreso no tiene datos de ppto aún cargados | La barra se oculta cuando `cmpVal === null` — sin impacto visual |

## Sources & References

- **Origin document:** [docs/brainstorms/ui-estructura-requirements.md](docs/brainstorms/ui-estructura-requirements.md)
- Código relevante: `src/components/dashboard/KPICards.tsx`, `src/components/dashboard/PLTable.tsx`, `src/styles/dashboard.css`
- Patrón de barra de progreso: `.var-bar-track` / `.var-bar-fill` en `dashboard.css`
