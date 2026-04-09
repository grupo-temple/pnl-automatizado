---
date: 2026-04-09
topic: nueva-arquitectura-datos
---

# Nueva Arquitectura de Datos — Dashboard P&L Grupo Temple

## Problem Frame

El dashboard actual carga datos desde CSVs en lote hacia tablas de baja granularidad (`transactions`, `financial_entries`). Esto impide el registro en vivo de transacciones con detalle fiscal completo (CUIT, IVA desagregado, factura), y no permite presupuesto ni LE a nivel de sub-categoría. El resultado: varianzas poco detalladas y dependencia de importaciones manuales en lugar de carga operativa continua.

## Arquitectura Target

```
  catalog_items           ← catálogo editable: Tipo → Categoría → Sub-Categoría
       │
       ├─► real_transactions   ← detalle completo de facturas/egresos/ingresos reales
       ├─► budget_entries       ← presupuesto por mes / categoría / sub-categoría
       └─► le_entries           ← LE por mes / categoría / sub-categoría

  Dashboard agrega desde las 3 tablas de datos ↑
  (financial_entries y transactions se eliminan)
```

## Requirements

**Catálogo de clasificación**
- R1. Crear tabla `catalog_items` que almacene la jerarquía Tipo → Categoría → Sub-Categoría. Cada fila representa una combinación válida (ej: Egreso / Gastos Administrativos / Abogados).
- R2. Pre-poblar `catalog_items` con todos los valores que ya existen en el sistema. Los valores de `tipo` deben incluir al menos: `'Ingreso'`, `'Egreso'`, `'Sueldo'`. La taxonomía de categorías (grupos P&L actuales) debe ser revisada y aprobada por el responsable del área antes del sembrado inicial, para detectar inconsistencias en los datos históricos.
- R3. El panel de administración debe permitir agregar, editar y desactivar ítems del catálogo sin tocar código. No se deben eliminar físicamente ítems usados por transacciones, entradas de presupuesto o entradas de LE existentes.

**Tabla de transacciones reales**
- R4. Crear tabla `real_transactions` con los campos del libro de compras/ventas argentino:
  - Identificación: `fecha` (date, NOT NULL — el mes y año se derivan de este campo en las queries), `sociedad`
  - Proveedor/cliente: `razon_social`, `cuit`, `provincia`, `ciudad`, `condicion_iva`, `nro_factura`
  - Importes fiscales: `importe_neto_gravado`, `importe_no_grav`, `iva2`, `iva5`, `iva10`, `iva21`, `iva27`, `iibb`, `percepcion_iva`, `otros_impuestos`, `total_iva`, `total_facturado`
  - Clasificación P&L: `neto`, `tipo`, `categoria`, `sub_categoria`
  - Adicional: `observaciones`
- R5. Los campos de importe fiscal son todos opcionales (nullable). El campo `neto` es el importe que se usa para el P&L.
- R6. Los campos `tipo`, `categoria` y `sub_categoria` deben validar contra `catalog_items`.
- R7. El panel admin debe permitir ingresar transacciones manualmente y cargar en lote por CSV con el mismo formato columnar.

**Tablas de Presupuesto y LE**
- R8. Crear tabla `budget_entries` con campos: `month` (integer 1-12), `year` (integer), `sociedad`, `tipo`, `categoria`, `sub_categoria`, `monto`.
- R9. Crear tabla `le_entries` con la misma estructura que `budget_entries`.
- R10. Los campos `tipo`, `categoria`, `sub_categoria` en ambas tablas deben validar contra `catalog_items`.
- R11. El panel admin debe permitir cargar presupuesto y LE por CSV o por entrada manual fila a fila.

**Dashboard y comparativas**
- R12. El dashboard debe leer desde las nuevas tablas, agregando `real_transactions.neto` por (sociedad, año, mes, categoría) para construir las filas del P&L.
- R13. Las vistas de comparativa (Real vs Ppto, Real vs LE, LE vs Ppto) deben funcionar con los datos de las nuevas tablas.
- R14. El drill-down de P&L debe mostrar las `real_transactions` individuales del grupo/mes seleccionado, con los campos de factura visibles.
- R15. La pestaña Registros debe mostrar todas las columnas relevantes de `real_transactions`, filtrable por sociedad, mes, tipo, categoría y sub-categoría.

**Control de acceso**
- R19. Las 4 nuevas tablas (`catalog_items`, `real_transactions`, `budget_entries`, `le_entries`) deben seguir el patrón RLS existente: SELECT para usuarios autenticados, INSERT/UPDATE/DELETE restringido a `app_role='admin'` en los metadatos JWT, siguiendo el patrón de `supabase/migrations/002_rls_policies.sql`.

**Migración de datos existentes**
- R16. **Antes de ejecutar la migración**, exportar una copia de seguridad de `transactions` y `financial_entries` en formato CSV como respaldo. Los 413 registros de `transactions` (datos Real 2026) se migran a `real_transactions`; los campos sin equivalente (razon_social, cuit, importes IVA, etc.) quedan en NULL.
- R17. El script de migración debe mapear con los siguientes valores exactos: `source` → `tipo` (traducción: `'ingresos'` → `'Ingreso'`, `'egresos'` → `'Egreso'`, `'sueldos'` → `'Sueldo'`); `grupo_pl` → `categoria` (el campo `grupo_pl` actual ES el nivel del P&L — en el nuevo schema se llama `categoria`); `categoria` (tabla vieja) → `sub_categoria`; `amount` → `neto`. Para `fecha`: usar el primer día del mes correspondiente (ej: month=3, year=2026 → `'2026-03-01'`).
- R18. Secuencia obligatoria antes del cutover: (1) ejecutar query de reconciliación que compare `SUM(amount)` por (sociedad, mes, grupo_pl) en `transactions` contra `SUM(neto)` por (sociedad, mes, categoria) en `real_transactions` — los totales deben coincidir; (2) hacer deploy del frontend actualizado que lea desde las nuevas tablas y verificar que el dashboard muestra correctamente; (3) recién entonces eliminar `transactions` y `financial_entries`.

## Success Criteria

- Se pueden registrar transacciones en vivo desde el panel admin sin necesidad de preparar un CSV.
- El dashboard muestra el P&L Real, Presupuesto y LE con la misma estructura que hoy, ahora alimentado desde las nuevas tablas.
- Las varianzas Real vs Ppto y Real vs LE funcionan correctamente.
- Un admin puede agregar una nueva sub-categoría desde el panel sin modificar código.
- Los datos de 2026 migrados producen los mismos totales P&L que el sistema anterior.

## Scope Boundaries

- No se construye integración automática con AFIP ni con ningún sistema externo de facturación.
- No se incluye aprobación de facturas ni flujo de autorización; el panel admin es de carga directa.
- El catálogo no tiene jerarquías de más de 3 niveles (Tipo / Categoría / Sub-Categoría).
- No se cambia la estructura del P&L ni sus filas calculadas (EBITDA, RDO. NETO siguen calculados en el frontend).

## Key Decisions

- **Reemplazar en lugar de coexistir**: Eliminar `financial_entries` y `transactions` evita duplicación de datos y fuente de verdad partida. El dashboard se reconstruye sobre las nuevas tablas.
- **Presupuesto y LE a nivel sub-categoría**: Permite varianzas detalladas (ej: Real Abogados vs Presupuesto Abogados), no solo a nivel de grupo P&L.
- **Catálogo editable**: Los tipos/categorías/sub-categorías dejan de estar hardcodeados en SQL y TypeScript; el admin puede gestionarlos.

## Dependencies / Assumptions

- Las 413 transacciones actuales no tienen datos de CUIT, factura ni IVA — esos campos migrarán como NULL.
- El frontend actualmente calcula `Total Gastos`, `EBITDA` y `RDO. NETO` a partir de los grupos P&L; esa lógica no cambia.
- Se asume que `sociedad` en las nuevas tablas sigue siendo TG / CDS / VA (mismo que el campo `slug` en `companies`).
- Los campos `cuit` y `razon_social` son datos fiscales sensibles bajo Ley 25.326 (Argentina). El sistema no los expone públicamente; el acceso queda restringido por las políticas RLS de R19.

## Outstanding Questions

### Resolve Before Planning
_(ninguna — todas las decisiones de producto están tomadas)_

### Decisiones tomadas en refinamiento
- **[R4] `mes` vs `fecha`** → Resuelto: `real_transactions` usa `fecha DATE NOT NULL`; mes/año se derivan en queries. Los registros migrados usarán el primer día del mes.
- **[R17] Mapeo `source` → `tipo`** → Resuelto: 'ingresos'→'Ingreso', 'egresos'→'Egreso', 'sueldos'→'Sueldo'.
- **[R18] Cutover** → Resuelto: secuencia en 3 pasos (reconciliación → deploy frontend → DROP TABLE).

### Deferred to Planning
- [Afecta R12][Técnico] ¿El dashboard agrega on-the-fly con JOIN entre `real_transactions` y `catalog_items`, o se mantiene una tabla de agregados separada para performance?
- [Afecta R6, R10][Técnico] Mecanismo de validación contra `catalog_items`: FK compuesta con UNIQUE constraint en la tabla, trigger de BD, o validación en capa de aplicación.
- [Afecta R8, R9][Técnico] Evaluar si `budget_entries` y `le_entries` deberían unificarse en una tabla con columna `type = 'BUDGET'|'LE'` o mantenerse separadas.
- [Afecta R16][Investigación] Auditar los valores actuales del campo `categoria` en `transactions` para confirmar que mapean correctamente a las sub-categorías del nuevo catálogo.

## Next Steps

→ `/ce:plan` para planificación estructurada de implementación
