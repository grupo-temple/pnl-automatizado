// ── Tipos de datos para el P&L Dashboard — Grupo Temple ──────────────────────

export type DataType = 'real' | 'ppto' | 'le'

export type CompanySlug = 'tg' | 'cds' | 'va' | 'consolidado'

export type GrupoPL =
  | 'Total Ingresos'
  | 'Sueldos'
  | 'Gastos Personal'
  | 'Gastos Administrativos'
  | 'Gastos Marketing'
  | 'Tercerizados'
  | 'Otros'
  | 'Total Gastos'
  | 'EBITDA'
  | 'RDO. NETO'

// 12 valores mensuales (índices 0-11 = ENE-DIC). null = sin dato.
export type MonthlyValues = (number | null)[]

// Datos de una empresa para un tipo (real/ppto/le)
export type CompanyTypeData = Record<GrupoPL, MonthlyValues>

// Datos de una empresa (los tres tipos)
export interface CompanyData {
  real: CompanyTypeData
  ppto: CompanyTypeData
  le:   CompanyTypeData
}

// Estructura completa de datos del dashboard
export interface DashboardData {
  tg:          CompanyData
  cds:         CompanyData
  va:          CompanyData
  consolidado: CompanyData
}

// Vistas disponibles en el selector
export type ViewMode =
  | 'real'      // Solo real
  | 'ppto'      // Solo presupuesto
  | 'le'        // Solo LE
  | 'comp'      // Real vs Presupuesto
  | 'comp_le'   // Real vs LE
  | 'le_ppto'   // LE vs Presupuesto
  | 'yoy'       // Year-over-Year

export type AccumMode = 'ytd' | 'mes'

// Estado del dashboard
export interface DashboardState {
  company:       CompanySlug
  view:          ViewMode
  accum:         AccumMode
  selectedMonth: number | null  // índice 0-11
}

// Fila cruda de Supabase
export interface FinancialEntryRow {
  company_id: string
  year:       number
  month:      number
  data_type:  'Real' | 'Presupuesto' | 'LE'
  grupo_pl:   string
  amount:     number | null
}

export interface CompanyRow {
  id:   string
  slug: string
  name: string
}

// ── Nuevas tablas — nueva arquitectura de datos ───────────────

export interface CatalogItem {
  id:           string
  tipo:         string
  categoria:    string
  sub_categoria: string | null
  active:       boolean
}

export interface RealTransaction {
  id:                   string
  fecha:                string    // ISO date string 'YYYY-MM-DD'
  sociedad:             string
  razon_social:         string | null
  cuit:                 string | null
  provincia:            string | null
  ciudad:               string | null
  condicion_iva:        string | null
  nro_factura:          string | null
  importe_neto_gravado: number | null
  importe_no_grav:      number | null
  iva2:                 number | null
  iva5:                 number | null
  iva10:                number | null
  iva21:                number | null
  iva27:                number | null
  iibb:                 number | null
  percepcion_iva:       number | null
  otros_impuestos:      number | null
  total_iva:            number | null
  total_facturado:      number | null
  neto:                 number
  tipo:                 string
  categoria:            string
  sub_categoria:        string | null
  observaciones:        string | null
}

export interface PlanningEntry {
  id:           string
  year:         number
  month:        number
  sociedad:     string
  entry_type:   'Presupuesto' | 'LE'
  tipo:         string
  categoria:    string
  sub_categoria: string | null
  monto:        number | null
}
