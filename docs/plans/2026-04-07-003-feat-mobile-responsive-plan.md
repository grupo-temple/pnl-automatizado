---
id: "2026-04-07-003"
title: "feat: mobile y responsive — P&L Dashboard"
ticket: "Ticket 3 — Mobile y responsive"
status: "ready"
date: "2026-04-07"
priority: 3
dependencies: ["2026-04-07-001", "2026-04-07-002"]
---

# Ticket 3 — Mobile y responsive

## Overview

Hacer el P&L Dashboard de Grupo Temple completamente funcional en pantallas móviles (375px+) y tablet (640–900px). El objetivo no es "no roto" sino usable: un usuario puede navegar, filtrar y leer datos sin hacer zoom ni scroll horizontal accidental.

Los 4 cambios principales son quirúrgicos: 3 son CSS puro, 1 requiere un pequeño ajuste de estructura React para manejar estado de visibilidad del panel de filtros. Ningún cambio afecta la lógica de negocio, los datos ni las rutas.

---

## Problem Frame

### Síntomas actuales (sin arreglos)

| Pantalla | Problema |
|----------|----------|
| < 640px  | Los 7 pills de Vista se envuelven en 2–3 líneas, empujando el contenido hacia abajo |
| < 640px  | La tabla P&L tiene `min-width: 200px` en la primera columna + columnas numéricas; el usuario no sabe que puede hacer scroll horizontal |
| < 640px  | Los 5 selects + input de búsqueda de Registros se apilan sin jerarquía, ocupan 300px+ de altura |
| < 640px  | El header muestra "Datos hasta: MAR 2026" pero en 375px el texto sale del contenedor o trunca el logo |
| 640–900px | Los pills se ajustan a 2 filas pero no tienen scroll horizontal controlado |

### Causa raíz

`dashboard.css` tiene solo 2 media queries (`@media (max-width: 900px)` y `@media (max-width: 600px)`) que reordenan grids pero no atacan los componentes de navegación/filtro. Los componentes React usan `style` inline para los filtros de Registros y no tienen mecanismo de colapso.

---

## Requirements Trace

| Requisito (docs/brainstorms/ui-estructura-requirements.md) | Implementado en |
|-------------------------------------------------------------|-----------------|
| Mobile < 640px: pills de vista → `<select>` compacto | IU-1 |
| Mobile < 640px: tabla P&L scroll horizontal + indicador visual | IU-2 |
| Mobile < 640px: filtros Registros colapsables | IU-3 |
| Mobile < 640px: ocultar "Datos hasta: MAR YYYY" del header | IU-4 |
| Tablet 640–900px: pills de vista con scroll horizontal | IU-1 |
| Dashboard funcional en 375px+ | todos |

---

## Scope Boundaries

**Dentro de scope:**
- CSS responsive en `src/styles/dashboard.css`
- Ajuste de markup/clases en `DashboardClient.tsx` (pills → select + ocultar last-update)
- Ajuste de markup en `TransactionsView.tsx` (panel colapsable de filtros)
- Wrapper CSS en `PLTable.tsx` (indicador swipe)

**Fuera de scope:**
- App nativa o PWA
- Gestos táctiles avanzados (swipe entre empresas)
- Cambios a la lógica de datos o rutas
- Rediseño del login
- Cambios al modo tablet de KPI cards (ya está en 2 columnas con la media query existente)

---

## Context & Research

### Archivos relevantes

| Archivo | Rol en este ticket |
|---------|-------------------|
| `src/styles/dashboard.css` | Todas las reglas CSS; aquí van las nuevas media queries |
| `src/components/dashboard/DashboardClient.tsx` | Contiene header, nav y filters-bar con pills |
| `src/components/dashboard/TransactionsView.tsx` | Contiene los 5 selects + input de búsqueda inline |
| `src/components/dashboard/PLTable.tsx` | Contiene el wrapper `div[overflowX: auto]` de la tabla |

### Clases CSS actuales relevantes

```
.header              — flex, height: 56px, padding: 0 24px
.header-right        — flex, gap: 12px (contiene year-badge + last-update + btn-admin)
.last-update         — color: var(--text-muted), font-size: 11px
.year-badge          — badge verde con el año

.filters-bar         — flex, flex-wrap: wrap, gap: 16px, padding: 12px 24px
.pill-group          — flex, gap: 4px, flex-wrap: wrap   ← problema: wrapping sin control
.pill                — padding: 4px 12px, border-radius: 20px

.table-card          — border-radius: 10px, overflow: hidden
.pl-table th:first-child — min-width: 200px
.pl-table td         — white-space: nowrap

/* Media queries existentes */
@media (max-width: 900px) { .kpi-row: 2 col; .charts-grid: 1 col }
@media (max-width: 600px) { .kpi-row: 1fr 1fr; .filters-bar gap: 8px }
```

### Estado del CSS móvil hoy

El breakpoint `600px` solo reduce el gap de `.filters-bar`. No hay reglas para:
- Pills/select de vista
- Indicador de scroll horizontal en tablas
- Panel colapsable de filtros
- Visibilidad del `.last-update`

El breakpoint se debe cambiar a `640px` (alineado con Tailwind `sm`) para consistencia con el requirements doc.

---

## Key Technical Decisions

### KD-1: Select nativo vs. componente custom para pills en mobile

**Elegido: `<select>` nativo del browser.**

Razones: accesibilidad inmediata (teclado, lector de pantalla, picker nativo en iOS/Android), cero dependencias nuevas, implementación < 10 líneas. La alternativa (dropdown custom) requeriría portal, z-index management y touch events. El trade-off visual es aceptable para uso interno.

Implementación: en `DashboardClient.tsx` renderizar condicionalmente con CSS (`display: none` en mobile para `.pill-group`, `display: block` para `.view-select-mobile`). El `<select>` vive en el DOM siempre; CSS controla visibilidad según breakpoint. Esto evita un segundo estado React o media query listener en JS.

### KD-2: Indicador de scroll horizontal — CSS vs. componente

**Elegido: CSS puro con pseudo-elemento `::after` + clase wrapper.**

Se agrega la clase `pl-table-wrapper` al `<div overflowX: auto>` en `PLTable.tsx`. En mobile, CSS añade un pseudo-elemento fade-out en el borde derecho y un ícono de swipe fijo dentro del wrapper. Si la tabla no hace overflow (viewport ancho), el indicador no aparece gracias a `overflow: hidden` en el container. No requiere ResizeObserver ni IntersectionObserver.

### KD-3: Filtros colapsables — CSS vs. estado React

**Elegido: estado React (`useState`) en `TransactionsView.tsx`.**

Razón: el panel necesita animar altura y el contenido debe estar en el DOM para no perder los valores de filtro activos al cerrar/abrir. Un checkbox CSS hack sería difícil de mantener. El estado es local al componente, no sube al árbol. Se agrega `filtersOpen: boolean` inicializado en `false` en mobile (siempre `true` en desktop vía CSS que ignora el collapse).

### KD-4: Breakpoints

Usar `640px` como breakpoint mobile (alineado con el requirements doc: "< 640px"). El breakpoint existente `600px` en dashboard.css se mantiene para compatibilidad hacia atrás (ya no afecta pills ni select). Se agrega un nuevo bloque `@media (max-width: 640px)`.

Para tablet: `640px–900px` — el bloque `@media (max-width: 900px)` existente se complementa con reglas específicas de pills.

---

## Implementation Units

### IU-1: Pills de vista → select en mobile + scroll en tablet

**Goal:** En < 640px el selector de vista ocupa una línea. En 640–900px los pills tienen scroll horizontal sin wrap.

**Files:**
- `src/styles/dashboard.css`
- `src/components/dashboard/DashboardClient.tsx`

**Approach:**

En `DashboardClient.tsx`, dentro del `<div className="filters-bar">`, agregar junto al `.pill-group` existente un `<select>` nativo con clase `view-select-mobile`:

```tsx
{/* Select compacto — visible solo en mobile vía CSS */}
<select
  className="view-select-mobile form-select"
  value={state.view}
  onChange={e => setState(s => ({ ...s, view: e.target.value as ViewMode }))}
>
  {(['real','ppto','le','comp','comp_le','le_ppto','yoy'] as ViewMode[]).map(v => (
    <option key={v} value={v}>{viewLabels[v]}</option>
  ))}
</select>
```

El `<select>` siempre está en el DOM; CSS controla qué se muestra:

```css
/* En dashboard.css — bloque nuevo @media (max-width: 640px) */
.view-select-mobile { display: none; }          /* oculto por defecto (desktop) */

@media (max-width: 640px) {
  .view-select-mobile { display: block; width: 100%; }
  .pill-group-view    { display: none; }         /* ocultar pills de vista */
}

/* En tablet: pills con scroll horizontal sin wrap */
@media (max-width: 900px) {
  .pill-group-view {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;            /* Firefox */
  }
  .pill-group-view::-webkit-scrollbar { display: none; }
}
```

Para la clase diferenciadora, renombrar el `pill-group` de vista añadiendo `pill-group-view` al className existente en `DashboardClient.tsx` (sin quitar `pill-group`, para mantener estilos base):

```tsx
<div className="pill-group pill-group-view">
  ...
</div>
```

El segundo `pill-group` (Acumulado, 2 pills) no necesita este tratamiento; se deja con `flex-wrap: wrap` normal.

**Test scenarios:**
- En 375px: solo el `<select>` es visible, los pills están ocultos. Cambiar vista actualiza el dashboard.
- En 768px: pills visibles, scroll horizontal, sin wrap. El scrollbar nativo está oculto.
- En 1280px: pills visibles, sin scroll, comportamiento actual.
- Cambiar vista desde el select en mobile produce el mismo resultado que el pill en desktop.

**Verification:**
- DevTools mobile 375px: `.pill-group-view` tiene `display: none`, `.view-select-mobile` tiene `display: block`.
- El valor del select está sincronizado con `state.view`.
- En tablet el `pill-group-view` no hace wrap (inspeccionar `flex-wrap: nowrap`).

---

### IU-2: Tabla P&L — scroll horizontal explícito con indicador visual

**Goal:** En mobile el usuario sabe que la tabla P&L tiene más columnas a la derecha.

**Files:**
- `src/styles/dashboard.css`
- `src/components/dashboard/PLTable.tsx`

**Approach:**

En `PLTable.tsx`, cambiar el wrapper del scroll de `style` inline a clase CSS:

```tsx
{/* Antes */}
<div style={{ overflowX: 'auto' }}>

{/* Después */}
<div className="pl-table-wrapper">
```

En `dashboard.css`:

```css
/* Wrapper base */
.pl-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

/* Indicador fade + ícono de swipe — solo en mobile */
@media (max-width: 640px) {
  .pl-table-wrapper::after {
    content: '← deslizá →';
    display: block;
    text-align: center;
    font-size: 10px;
    color: var(--text-muted);
    padding: 6px 0 2px;
    letter-spacing: 0.3px;
  }

  /* Fade-out derecho para indicar contenido oculto */
  .pl-table-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: calc(100% - 24px); /* excluir la línea de texto */
    background: linear-gradient(to right, transparent, var(--bg-card));
    pointer-events: none;
    z-index: 2;
  }

  /* Reducir padding de celdas en mobile para ganar espacio */
  .pl-table th,
  .pl-table td {
    padding: 6px 8px;
    font-size: 11px;
  }

  .pl-table th:first-child { min-width: 140px; }
}
```

Nota: el fade-out del borde derecho siempre se muestra en mobile. Esto es aceptable porque en mobile la tabla _siempre_ tiene overflow dado el `min-width` de las columnas.

La misma clase `pl-table-wrapper` se puede aplicar al `<div style={{ overflowX: 'auto' }}>` de `TransactionsView.tsx` sin costo adicional.

**Test scenarios:**
- En 375px: texto "← deslizá →" visible debajo de la tabla. Fade visible en borde derecho.
- Scroll horizontal funciona sin obstrucción.
- En desktop: el `::after` y `::before` no aparecen (no hay media query).
- El wrapper de `TransactionsView.tsx` también tiene scroll suave.

**Verification:**
- DevTools: el pseudo-elemento `::after` existe en mobile, no existe en desktop.
- Scroll de la tabla no está bloqueado por el `overflow: hidden` del `.table-card` padre — el `table-card` ya tiene `overflow: hidden` solo en el borde; el wrapper interno maneja el scroll.

---

### IU-3: Filtros de Registros colapsables en mobile

**Goal:** En mobile los filtros de Registros se muestran ocultos por defecto detrás de un botón "Filtros". Al tocar el botón, aparece el panel completo.

**Files:**
- `src/styles/dashboard.css`
- `src/components/dashboard/TransactionsView.tsx`

**Approach:**

En `TransactionsView.tsx`, agregar un estado local:

```tsx
const [filtersOpen, setFiltersOpen] = useState(false)
```

Envolver los 5 selects + input en un `<div>` con clase condicional:

```tsx
{/* BOTÓN TOGGLE — solo visible en mobile vía CSS */}
<div className="filters-mobile-toggle">
  <button
    className="btn-sm filters-toggle-btn"
    onClick={() => setFiltersOpen(o => !o)}
  >
    {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
    {hasActiveFilters && !filtersOpen && (
      <span className="filters-active-dot" />
    )}
  </button>
</div>

{/* PANEL DE FILTROS */}
<div className={`filters-panel${filtersOpen ? ' filters-panel-open' : ''}`}>
  {/* ...selects e input existentes... */}
</div>
```

Donde `hasActiveFilters` es:
```tsx
const hasActiveFilters = empresa !== 'todas' || grupo !== 'todos' || source !== 'todos' || mes !== 'todos' || search !== ''
```

En `dashboard.css`:

```css
/* Desktop: siempre visible, toggle oculto */
.filters-mobile-toggle { display: none; }
.filters-panel         { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

@media (max-width: 640px) {
  .filters-mobile-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .filters-toggle-btn {
    font-size: 13px;
    padding: 7px 16px;
    border-radius: 8px;
    position: relative;
  }

  /* Punto indicador de filtros activos */
  .filters-active-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    margin-left: 6px;
    vertical-align: middle;
  }

  /* Panel colapsado por defecto en mobile */
  .filters-panel {
    display: none;
    flex-direction: column;
    gap: 8px;
  }

  /* Panel abierto */
  .filters-panel.filters-panel-open {
    display: flex;
  }

  /* Selects ocupan ancho completo en mobile */
  .filters-panel .form-input,
  .filters-panel select {
    width: 100%;
  }
}
```

El panel mantiene su estado (valores de filtro) cuando se cierra y reabre, porque el estado React es local al componente y persiste independientemente de `display: none`.

**Test scenarios:**
- En 375px: solo el botón "Filtros" es visible. Al tocar, aparecen los 5 controles en columna.
- Si hay filtros activos y el panel está cerrado, aparece el punto verde junto al botón.
- Limpiar filtros desde dentro del panel funciona igual que antes.
- En desktop: el botón toggle está oculto, el panel visible siempre (comportamiento actual).
- Drill-down desde P&L hacia Registros: el panel debe abrirse automáticamente si hay `initialGrupo` (agregar `useState(!!initialGrupo)` para este caso).

**Verification:**
- DevTools 375px: `.filters-mobile-toggle` tiene `display: flex`, `.filters-panel` tiene `display: none` (cerrado) o `display: flex` (abierto).
- Cambiar un filtro, cerrar el panel, reabrir: el filtro sigue aplicado.
- El `hasActiveFilters` refleja correctamente el estado de todos los controles.

---

### IU-4: Ocultar "Datos hasta: MAR YYYY" en mobile

**Goal:** En < 640px el header muestra solo el año (badge verde), sin el texto de última actualización.

**Files:**
- `src/styles/dashboard.css`
- `src/components/dashboard/DashboardClient.tsx`

**Approach:**

El elemento `.last-update` ya existe. Solo se necesita una regla CSS:

```css
@media (max-width: 640px) {
  .last-update { display: none; }
}
```

Adicionalmente, en mobile el header puede quedar apretado si hay botón Admin + año + logo. Agregar:

```css
@media (max-width: 640px) {
  .header { padding: 0 16px; }
  .logo span { display: none; }   /* ocultar "· Dashboard P&L" del subtítulo */
}
```

Esto deja en el header móvil: `GRUPO TEMPLE` | [Admin si aplica] | `2026`.

No se necesita cambio en el JSX de `DashboardClient.tsx` — el elemento ya tiene la clase `.last-update` en la línea:
```tsx
<span className="last-update">
  {monthsWithData.length > 0 ? `Datos hasta: ...` : 'Sin datos cargados'}
</span>
```

**Test scenarios:**
- En 375px con admin: header muestra "GRUPO TEMPLE" + "Admin" + badge año. Texto "Datos hasta" oculto.
- En 375px sin admin: header muestra "GRUPO TEMPLE" + badge año.
- En 768px: texto "Datos hasta" visible.
- El badge del año siempre visible en todos los breakpoints.

**Verification:**
- DevTools 375px: `.last-update` tiene `computed display: none`.
- El layout del header no se rompe en 320px (iPhone SE antiguo).

---

## System-Wide Impact

| Área | Impacto |
|------|---------|
| `dashboard.css` | Se agregan ~80 líneas al final del archivo, en 2 bloques `@media`. No se modifican reglas existentes. |
| `DashboardClient.tsx` | +1 `<select>` nativo en el DOM, +1 clase `pill-group-view`, sin cambios de estado ni props. |
| `TransactionsView.tsx` | +1 `useState(filtersOpen)`, +2 elementos wrapper DOM, sin cambios a la lógica de filtrado. |
| `PLTable.tsx` | Cambio de `style={{ overflowX: 'auto' }}` a `className="pl-table-wrapper"`. Sin cambio de lógica. |
| Otros componentes | No afectados. KPICards, EvolutionChart, PeriodSelector, VarianceBars ya se adaptan con las media queries existentes (grid 1 columna en < 900px). |
| Performance | Sin impacto. No hay nuevas dependencias, listeners ni re-renders adicionales. |
| SEO/Accesibilidad | El `<select>` nativo mejora accesibilidad en mobile vs. los botones pill. El indicador de scroll usa texto visible (`::after`), no solo ícono. |

---

## Risks

### R-1: El `overflow: hidden` de `.table-card` bloquea el scroll horizontal
**Probabilidad:** Media. El `.table-card` tiene `overflow: hidden` para el `border-radius`. Si el wrapper interno intenta hacer scroll y el padre tiene `overflow: hidden`, el scroll se bloquea en Safari iOS.

**Mitigación:** Verificar en Safari iOS 16+. Si ocurre, cambiar `.table-card` a `overflow: visible` y replicar el `border-radius` con `clip-path: inset(0 round 10px)`, o mover el `border-radius` a un wrapper exterior.

### R-2: El pseudo-elemento `::after` en `.pl-table-wrapper` interfiere con el layout
**Probabilidad:** Baja. El `::after` es `display: block` y suma altura al wrapper. Si el `table-card` tiene `overflow: hidden`, el texto podría quedar recortado.

**Mitigación:** Dar al `.pl-table-wrapper` un `padding-bottom: 24px` en mobile para dar espacio al texto `::after`.

### R-3: Drill-down desde P&L no abre el panel de filtros automáticamente
**Probabilidad:** Alta sin la mitigación. Un usuario hace drill-down en mobile, llega a Registros con filtros pre-aplicados, pero el panel está cerrado. No ve los filtros activos y no entiende por qué hay pocos registros.

**Mitigación:** En `TransactionsView.tsx`, inicializar `filtersOpen` como `!!initialGrupo` en lugar de `false`. Así, si viene de un drill-down con grupo pre-aplicado, el panel empieza abierto.

```tsx
const [filtersOpen, setFiltersOpen] = useState(!!initialGrupo)
```

### R-4: El select nativo de "Vista" desincronizado con los pills al redimensionar
**Probabilidad:** Baja. Si el usuario está en desktop con los pills, reduce la ventana a mobile, usa el select, y luego agranda la ventana: el estado `state.view` es compartido, así que el pill activo correcto se marcará. No hay desincronización real, solo visual — ambos controles leen del mismo `state.view`.

**Mitigación:** Ninguna necesaria. La sincronización está garantizada por el estado compartido.

### R-5: `.filters-panel` con `display: none` en mobile no es anunciado por lectores de pantalla
**Probabilidad:** Baja para el caso de uso (dashboard interno). Sin embargo, es técnicamente incorrecto.

**Mitigación:** Agregar `aria-hidden={!filtersOpen}` al panel y `aria-expanded={filtersOpen}` al botón toggle. Mejora la accesibilidad sin complejidad adicional.
