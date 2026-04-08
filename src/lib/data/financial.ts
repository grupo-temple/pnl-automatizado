import { createClient } from '@/lib/supabase/server'
import type {
  DashboardData,
  CompanyData,
  CompanyTypeData,
  GrupoPL,
  MonthlyValues,
  FinancialEntryRow,
} from './types'
import { BASE_GRUPOS, GASTO_GRUPOS } from './pl-structure'

// Mapeo data_type del DB → clave interna del dashboard
const TYPE_MAP: Record<string, keyof CompanyData> = {
  'Real':        'real',
  'Presupuesto': 'ppto',
  'LE':          'le',
}

// Mapeo slug DB → clave en DashboardData
const SLUG_MAP: Record<string, keyof Omit<DashboardData, 'consolidado'>> = {
  'TG':  'tg',
  'CDS': 'cds',
  'VA':  'va',
}

function buildEmptyTypeData(): CompanyTypeData {
  const keys: GrupoPL[] = [
    'Total Ingresos', 'Sueldos', 'Gastos Personal',
    'Gastos Administrativos', 'Gastos Marketing', 'Tercerizados',
    'Otros', 'Total Gastos', 'EBITDA', 'RDO. NETO',
  ]
  const result = {} as CompanyTypeData
  for (const k of keys) {
    result[k] = Array(12).fill(null)
  }
  return result
}

function buildEmptyCompanyData(): CompanyData {
  return {
    real: buildEmptyTypeData(),
    ppto: buildEmptyTypeData(),
    le:   buildEmptyTypeData(),
  }
}

/**
 * Calcula Total Gastos, EBITDA y RDO. NETO para un CompanyTypeData.
 * Estos valores son derivados — no se almacenan en DB.
 */
function computeDerived(d: CompanyTypeData): void {
  for (let m = 0; m < 12; m++) {
    // Total Gastos = suma de los grupos de gasto
    const gastoVals = GASTO_GRUPOS.map(k => d[k as GrupoPL]?.[m]).filter(v => v !== null) as number[]
    const totalGastos = gastoVals.length ? gastoVals.reduce((a, b) => a + b, 0) : null

    const ingresos = d['Total Ingresos']?.[m] ?? null
    const otros    = d['Otros']?.[m] ?? 0

    const ebitda = (ingresos !== null && totalGastos !== null)
      ? ingresos - totalGastos
      : null

    const rdoNeto = ebitda !== null ? ebitda - otros : null

    d['Total Gastos'][m] = totalGastos
    d['EBITDA'][m]       = ebitda
    d['RDO. NETO'][m]    = rdoNeto
  }
}

/**
 * Suma dos CompanyTypeData mes a mes (para calcular Consolidado).
 */
function sumTypeData(a: CompanyTypeData, b: CompanyTypeData): CompanyTypeData {
  const result = buildEmptyTypeData()
  const keys = Object.keys(a) as GrupoPL[]
  for (const k of keys) {
    for (let m = 0; m < 12; m++) {
      const va = a[k]?.[m]
      const vb = b[k]?.[m]
      if (va !== null && vb !== null) result[k][m] = va + vb
      else if (va !== null)           result[k][m] = va
      else if (vb !== null)           result[k][m] = vb
      else                            result[k][m] = null
    }
  }
  return result
}

function sumCompanyData(a: CompanyData, b: CompanyData): CompanyData {
  return {
    real: sumTypeData(a.real, b.real),
    ppto: sumTypeData(a.ppto, b.ppto),
    le:   sumTypeData(a.le,   b.le),
  }
}

/**
 * Obtiene todos los datos financieros de un año desde Supabase
 * y los transforma al formato DashboardData que espera el frontend.
 *
 * Consolidado se calcula como la suma de TG + CDS + VA.
 */
export async function getFinancialData(year: number): Promise<DashboardData> {
  const supabase = await createClient()

  // JOIN para obtener el slug de la empresa junto a cada entrada
  const { data: rows, error } = await supabase
    .from('financial_entries')
    .select(`
      company_id,
      year,
      month,
      data_type,
      grupo_pl,
      amount,
      companies!inner(slug)
    `)
    .eq('year', year)

  if (error) {
    console.error('Error fetching financial data:', error.message)
    // Retornar estructura vacía en caso de error (la UI mostrará "—")
    return buildEmptyDashboardData()
  }

  const data: DashboardData = buildEmptyDashboardData()

  for (const row of (rows as any[]) || []) {
    const slug     = row.companies?.slug as string
    const compKey  = SLUG_MAP[slug]
    const typeKey  = TYPE_MAP[row.data_type]
    const grupoPL  = row.grupo_pl as GrupoPL
    const monthIdx = row.month - 1  // DB: 1-12 → índice 0-11

    if (!compKey || !typeKey) continue
    if (monthIdx < 0 || monthIdx > 11) continue
    if (!BASE_GRUPOS.includes(grupoPL as any)) continue

    data[compKey][typeKey][grupoPL][monthIdx] = row.amount ?? null
  }

  // Calcular derivados para cada empresa y tipo
  for (const compKey of ['tg', 'cds', 'va'] as const) {
    for (const typeKey of ['real', 'ppto', 'le'] as const) {
      computeDerived(data[compKey][typeKey])
    }
  }

  // Calcular Consolidado = TG + CDS + VA
  let consolidado = sumCompanyData(data.tg, data.cds)
  consolidado = sumCompanyData(consolidado, data.va)
  // Los derivados del consolidado se calculan desde los BASE_GRUPOS sumados
  for (const typeKey of ['real', 'ppto', 'le'] as const) {
    computeDerived(consolidado[typeKey])
  }
  data.consolidado = consolidado

  return data
}

/**
 * Retorna los años que tienen al menos una entrada en financial_entries, ordenados desc.
 */
export async function getAvailableYears(): Promise<number[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .select('year')

  if (error || !data) return [new Date().getFullYear()]
  const years = [...new Set((data as { year: number }[]).map(r => r.year))]
  return years.sort((a, b) => b - a)
}

/**
 * Retorna los índices de meses que tienen datos reales en al menos una empresa.
 */
export function getMonthsWithData(data: DashboardData): number[] {
  const withData = new Set<number>()
  for (const compKey of ['tg', 'cds', 'va'] as const) {
    const vals = data[compKey].real['Total Ingresos']
    for (let m = 0; m < 12; m++) {
      if (vals[m] !== null && vals[m] !== 0) withData.add(m)
    }
  }
  return [...withData].sort((a, b) => a - b)
}

function buildEmptyDashboardData(): DashboardData {
  return {
    tg:          buildEmptyCompanyData(),
    cds:         buildEmptyCompanyData(),
    va:          buildEmptyCompanyData(),
    consolidado: buildEmptyCompanyData(),
  }
}
