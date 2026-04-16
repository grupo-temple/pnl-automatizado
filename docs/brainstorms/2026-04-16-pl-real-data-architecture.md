# P&L Real — Arquitectura de Datos desde Cero

**Fecha:** 2026-04-16  
**Estado:** Aprobado — listo para planificación

---

## Problema

El dashboard necesita mostrar el P&L real de Grupo Temple (TG, CDS, VA) con datos reales cargados vía CSV. La implementación anterior fue compleja y generó errores en el mapeo de subcategorías. Se reinicia desde cero con una arquitectura simple y bien definida.

## Objetivo

Construir el flujo completo: **tablas maestras → importación CSV → P&L con detalle de subcategorías**.

---

## Tablas maestras

### Sociedades
Representa las entidades legales del grupo. Administrable desde la UI.

| Campo   | Tipo    | Descripción                  |
|---------|---------|------------------------------|
| id      | uuid PK | generado                     |
| codigo  | text    | TG / CDS / VA (único)        |
| nombre  | text    | Nombre completo               |
| active  | boolean | Visible en el dashboard       |

Datos iniciales: TG (Temple Group), CDS (nombre real), VA (nombre real).

### Catálogo P&L
Define las combinaciones válidas de clasificación. Editable y extensible desde la UI por administradores.

| Campo         | Tipo    | Descripción                          |
|---------------|---------|--------------------------------------|
| id            | uuid PK | generado                             |
| tipo          | text    | `Ingreso` o `Gasto`                  |
| categoria     | text    | Nivel 2 — mapea a grupo P&L          |
| sub_categoria | text    | Nivel 3 — detalle dentro de categoría |
| active        | boolean | Si aparece como opción válida         |

Restricción: (tipo, categoria, sub_categoria) debe ser único.  
Desde la UI se pueden agregar nuevas combinaciones y editar las existentes.

**Categorías que mapean al P&L:**

| Categoría              | Grupo P&L        |
|------------------------|------------------|
| Total Ingresos         | INGRESOS         |
| Sueldos                | SUELDOS          |
| Gastos Personal        | GASTOS PERSONAL  |
| Gastos Administrativos | GASTOS ADM.      |
| Gastos Marketing       | GASTOS MKT.      |
| Tercerizados           | TERCERIZADOS     |
| Otros                  | IMPUESTOS/OTROS  |

---

## Transacciones

Una fila por transacción importada desde CSV.

| Campo         | Tipo      | Descripción                              |
|---------------|-----------|------------------------------------------|
| id            | uuid PK   | generado                                 |
| fecha         | date      | Fecha de la transacción (1° del mes si el CSV solo da mes/año) |
| sociedad      | text      | TG / CDS / VA — validado contra sociedades |
| tipo          | text      | Ingreso / Gasto                           |
| categoria     | text      | Validado contra catálogo                  |
| sub_categoria | text      | Validado contra catálogo                  |
| monto         | numeric   | Valor neto en ARS                         |
| observaciones | text      | Opcional                                  |
| fuente        | text      | `ingresos` / `egresos` / `sueldos` (trazabilidad) |

Los campos fiscales (IVA, IIBB, percepción) quedan fuera del alcance inicial.

---

## Importación CSV

### Archivos soportados

Los 3 CSVs de Grupo Temple tienen estructura equivalente:

| CSV       | Delimitador | Columna fecha | Columna monto | Columna sociedad |
|-----------|-------------|---------------|---------------|------------------|
| ingresos  | `;`         | Mes           | Neto          | Sociedad         |
| egresos   | `,`         | MES           | Neto          | Sociedad         |
| sueldos   | `,`         | Periodo       | Monto         | Negocio          |

Todos tienen: `Tipo`, `Categoria`, `Sub-Categoria`.

### Flujo de importación

1. Usuario sube el CSV desde la UI
2. El sistema detecta automáticamente el delimitador y las columnas
3. Se muestra preview de las primeras filas con el mapeo detectado
4. Se valida cada fila contra el catálogo (sociedad, tipo/categoria/sub_categoria)
5. Las filas inválidas se muestran como advertencias — el usuario decide si importar igualmente o corregir el catálogo primero
6. Al confirmar: las transacciones del período importado se borran y se reinsertan (idempotente)

### Identificación del período a reemplazar

Al importar, se eliminan las transacciones existentes que coincidan con `(sociedad, año, mes, fuente)` antes de reinsertar. Esto permite correr el mismo archivo varias veces sin duplicar.

---

## P&L

### Vista principal

Tabla con filas expandibles:

```
INGRESOS                         [▶]    $ 654.976.158
  Acuerdos Comerciales                  $ 412.223.015
  Royalty Mensual                       $  98.000.000
  ...
Total Ingresos                         $ 654.976.158

SUELDOS                          [▶]    $ 180.000.000
  Sueldo Comercial                      $  45.000.000
  ...
```

- Las secciones muestran el total del período seleccionado
- Al expandir aparecen las subcategorías con sus montos
- Las subcategorías sin datos muestran `—`

### Períodos

- Selector de mes individual o acumulado YTD
- El año se selecciona en el header

### Sociedades

- Selector de sociedad: TG / CDS / VA / Consolidado
- Consolidado = suma de las tres

---

## Alcance inicial (v1)

**Incluye:**
- Tablas maestras: sociedades y catálogo (CRUD desde UI)
- Importación CSV de los 3 archivos
- P&L Real con detalle de subcategorías
- Vista por sociedad y consolidado

**Fuera de alcance:**
- Presupuesto (Ppto) y LE
- Campos fiscales (IVA, IIBB)
- Comparaciones YoY
- Gráficos y KPIs

---

## Criterios de éxito

1. Un archivo CSV se puede importar sin tocar código
2. Si una subcategoría del CSV no existe en el catálogo, el usuario lo ve claramente y puede agregarlo antes de confirmar
3. El P&L muestra totales correctos por categoría y detalle correcto por subcategoría
4. Importar el mismo archivo dos veces no duplica datos
