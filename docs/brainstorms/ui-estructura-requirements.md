# UI & Estructura — Grupo Temple P&L Dashboard
**Fecha:** 2026-04-07
**Estado:** Aprobado para planificación

---

## Contexto

El dashboard funciona correctamente pero tiene 4 áreas de mejora identificadas. Se atacan en este orden de prioridad: Visual → Navegación → Mobile → Multi-año.

---

## Ticket 1 — Pulido visual

**Objetivo:** Que el dashboard se vea más profesional y tenga mejor jerarquía visual.

### Problemas actuales
- Las dos barras de navegación seguidas (Dashboard/Registros + empresa tabs) crean ruido visual
- El panel admin no tiene acceso visible desde el dashboard
- Los KPI cards muestran poca información en mucho espacio
- El ícono 🔍 en la tabla P&L es poco claro como indicador de drill-down
- La tabla de Registros muestra filas compactas sin suficiente separación visual

### Qué construir
- Unificar las dos barras de navegación en una sola (ver Ticket 2)
- Agregar enlace/botón "Admin" visible en el header para usuarios admin
- Mejorar los KPI cards: agregar sparkline o mini-barra de progreso vs. presupuesto
- Reemplazar el 🔍 por un tooltip o borde resaltado al hover sobre filas clickeables de P&L
- Mejorar la tabla de Registros: zebra striping sutil, separación clara entre columnas

### Fuera de scope
- Cambio de paleta de colores (el dark theme actual es correcto)
- Rediseño del login

---

## Ticket 2 — Navegación y flujo

**Objetivo:** Reducir la cantidad de controles en pantalla y hacer el flujo más intuitivo.

### Problemas actuales
- Hay 3 capas de navegación: tabs principales (Dashboard/Registros) + tabs empresa + pills de vista
- El usuario no sabe cuándo los filtros afectan qué parte del dashboard
- El drill-down desde P&L → Registros es un salto de contexto abrupto
- No hay forma de volver al P&L desde Registros sin perder el contexto (empresa/mes seleccionado)
- El acceso a `/admin` requiere saber la URL

### Qué construir
- Fusionar las tabs Dashboard/Registros con las tabs de empresa en una barra de navegación única:
  - `Consolidado | TG | CDS | VA | Registros`
- Agregar un breadcrumb cuando el usuario llega a Registros via drill-down:
  `Registros > Total Ingresos · TG · ENE-MAR 2026`
- Agregar botón "← Volver al P&L" que restaura empresa + mes seleccionado
- Agregar acceso a Admin desde el header (solo visible para usuarios con `app_role: admin`)
- Cuando el usuario cambia de empresa en el dashboard, los filtros de Registros deben actualizarse

### Fuera de scope
- Sidebar o navegación lateral (demasiado cambio estructural para esta iteración)
- Permisos por empresa (que TG solo vea TG)

---

## Ticket 3 — Mobile y responsive

**Objetivo:** Que el dashboard sea usable en celular y tablet.

### Problemas actuales
- Los pills de vista se envuelven en múltiples líneas en mobile y son difíciles de tocar
- La tabla P&L es muy ancha y no scrollea horizontalmente de forma obvia
- El grid de charts (gráfico + periodo selector) apila bien en tablet pero en mobile necesita ajuste
- Los filtros de Registros (5 controles + search) se apilan sin un orden claro en mobile
- El header en mobile pierde el texto "Datos hasta: MAR 2026"

### Qué construir
- En mobile (< 640px):
  - Reemplazar los pills de vista por un `<select>` desplegable compacto
  - Mostrar la tabla P&L con scroll horizontal explícito y un indicador visual (ícono de swipe)
  - Colapsar los filtros de Registros en un botón "Filtros" que abre un panel
  - Ocultar el texto "Datos hasta..." del header, mantener solo el año
- En tablet (640-900px):
  - Los pills de vista se muestran en 2 filas con scroll horizontal
  - La tabla P&L mantiene scroll horizontal
- El dashboard completo debe ser funcional (no solo "no roto") en pantallas de 375px+

### Fuera de scope
- App nativa o PWA
- Gestos táctiles avanzados (swipe entre empresas, etc.)

---

## Ticket 4 — Multi-año

**Objetivo:** Poder ver datos de cualquier año y comparar contra el año anterior.

### Problemas actuales
- El dashboard está hardcodeado a `new Date().getFullYear()` en `src/app/dashboard/page.tsx`
- El script de migración requiere pasar `--year` como argumento pero no carga años anteriores automáticamente
- La vista "YoY 2025" no tiene datos reales del año anterior

### Qué construir
- Agregar un selector de año en el header (dropdown con los años disponibles en la DB)
- El dashboard pasa el año seleccionado a `getFinancialData(year)` y `fetchTransactions(year)`
- El selector de año solo muestra años que tienen al menos una entrada en `financial_entries`
- La vista YoY usa datos reales del año anterior si existen, o muestra "—" si no hay datos
- El script `migrate-real.ts` acepta `--year=YYYY` para cargar datos de cualquier año (ya funciona)
- Documentar en README cómo cargar un año anterior

### Fuera de scope
- Comparación de períodos custom (Q1 2025 vs Q1 2026)
- Selector de rango de fechas

---

## Orden de implementación sugerido

| # | Ticket | Razón |
|---|--------|-------|
| 1 | Visual | Mejora inmediata, no requiere cambios estructurales |
| 2 | Navegación | Depende de decisiones tomadas en el pulido visual |
| 3 | Mobile | Mejor hacerlo después de estabilizar la navegación |
| 4 | Multi-año | Funcional independiente, menor impacto en UX diario |

---

## Criterios de éxito globales
- Un usuario nuevo puede entender el flujo sin instrucciones en menos de 2 minutos
- El dashboard es usable en un iPhone 12 (390px) sin zoom
- Se puede consultar cualquier año con datos sin cambiar código
- El drill-down P&L → Registros → Volver al P&L no pierde el contexto
