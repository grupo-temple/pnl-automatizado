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
