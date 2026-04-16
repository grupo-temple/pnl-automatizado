// Estructura del P&L — migrada directamente desde pl-dashboard.html
// Define el árbol de secciones, subtotales y resultados que se muestra en la tabla.

export type PLRowType = 'section' | 'subtotal' | 'result'

export interface PLRow {
  id:       string
  label:    string
  type:     PLRowType
  key?:     string    // clave en DashboardData (para subtotales y resultados)
  cls?:     string    // clase CSS adicional
  sign?:    1 | -1    // signo para mostrar el valor (gastos se muestran positivos)
  children?: string[] // labels de líneas de detalle (sin datos en MVP)
}

export const PL_STRUCTURE: PLRow[] = [
  {
    id: 's_ingresos', label: 'INGRESOS', type: 'section', key: 'Total Ingresos', sign: 1,
    children: ['Acuerdos Comerciales','Acuerdos Com Efectivo','FEE Inicial','Merchandising','Royalty Efectivo','Royalty Mensual']
  },
  { id: 'total_ing',   label: 'Total Ingresos',            type: 'subtotal', key: 'Total Ingresos',          cls: 'row-subtotal',      sign: 1  },
  {
    id: 's_sueldos', label: 'SUELDOS', type: 'section', key: 'Sueldos', sign: -1,
    children: ['Sueldo Administración','Sueldo Comercial','Sueldo Gestión','Sueldo Marketing','Sueldo Operaciones','SAC','Cargas Sociales','Bonos Objetivos','Bonos Aperturas']
  },
  { id: 'sub_sueldos', label: 'Subtotal Sueldos',           type: 'subtotal', key: 'Sueldos',                 sign: -1 },
  {
    id: 's_gpers', label: 'GASTOS PERSONAL', type: 'section', key: 'Gastos Personal', sign: -1,
    children: ['Beneficios','Recruiting','Capacitaciones','Desarrollo y Formación','Prepaga','Retenciones Ganancias','Viandas','Viáticos']
  },
  { id: 'sub_gpers',   label: 'Subtotal Gastos Personal',   type: 'subtotal', key: 'Gastos Personal',         sign: -1 },
  {
    id: 's_gadm', label: 'GASTOS ADMINISTRATIVOS', type: 'section', key: 'Gastos Administrativos', sign: -1,
    children: ['Alquiler','Fee Experiencias','Equipamiento','Expensas','Gastos Bancarios','Mantenimiento','Insumos Oficina','Seguro','Servicios','Sistemas de Gestión']
  },
  { id: 'sub_gadm',    label: 'Subtotal Gastos Adm.',       type: 'subtotal', key: 'Gastos Administrativos',  sign: -1 },
  {
    id: 's_gmkt', label: 'GASTOS MARKETING', type: 'section', key: 'Gastos Marketing', sign: -1,
    children: ['Acciones Marketing','Diseño','Fidelización']
  },
  { id: 'sub_gmkt',    label: 'Subtotal Gastos Mkt.',       type: 'subtotal', key: 'Gastos Marketing',        sign: -1 },
  {
    id: 's_terc', label: 'TERCERIZADOS', type: 'section', key: 'Tercerizados', sign: -1,
    children: ['Tercerizados']
  },
  { id: 'sub_terc',    label: 'Subtotal Tercerizados',      type: 'subtotal', key: 'Tercerizados',            sign: -1 },
  { id: 'total_gas',   label: 'TOTAL GASTOS',               type: 'subtotal', key: 'Total Gastos',            cls: 'row-subtotal',      sign: -1 },
  { id: 'ebitda',      label: 'EBITDA',                     type: 'result',   key: 'EBITDA',                  cls: 'row-result-ebitda'  },
  {
    id: 's_imp', label: 'IMPUESTOS Y GASTOS', type: 'section', key: 'Otros', sign: -1,
    children: ['Imp. Ganancias','IIBB']
  },
  { id: 'sub_imp',     label: 'Subtotal Impuestos',         type: 'subtotal', key: 'Otros',                   sign: -1 },
  { id: 'neto',        label: 'RDO. NETO',                  type: 'result',   key: 'RDO. NETO',               cls: 'row-result-neto'    },
  {
    id: 's_div', label: 'DIVIDENDOS', type: 'section', sign: -1,
    children: ['Retiro Socios','Compra USD','Autónomos']
  },
]

// Grupos base que se almacenan en la DB (los demás son derivados)
export const BASE_GRUPOS = [
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
] as const

// Grupos que se usan para calcular Total Gastos
export const GASTO_GRUPOS = [
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
] as const

// Meses para display
export const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'] as const
