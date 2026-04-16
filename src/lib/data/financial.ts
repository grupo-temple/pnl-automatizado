import { createClient } from '@/lib/supabase/server'
import type {
  DashboardData,
  CompanyData,
  CompanyTypeData,
  SubcategoryBreakdown,
  GrupoPL,
} from './types'
import { BASE_GRUPOS, GASTO_GRUPOS } from './pl-structure'

// Mapeo entry_type de planning_entries → clave interna del dashboard
const PLANNING_TYPE_MAP: Record<string, 'ppto' | 'le'> = {
  'Presupuesto': 'ppto',
  'LE':          'le',
}

// Mapeo sociedad DB → clave en DashboardData
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
    sub:  { real: {}, ppto: {}, le: {} },
  }
}

function addSubEntry(breakdown: SubcategoryBreakdown, categoria: string, subcat: string, monthIdx: number, value: number) {
  if (!breakdown[categoria]) breakdown[categoria] = {}
  if (!breakdown[categoria][subcat]) breakdown[categoria][subcat] = Array(12).fill(null)
  const cur = breakdown[categoria][subcat][monthIdx] ?? 0
  breakdown[categoria][subcat][monthIdx] = cur + value
}

function sumSubData(a: SubcategoryBreakdown, b: SubcategoryBreakdown): SubcategoryBreakdown {
  const result: SubcategoryBreakdown = {}
  const cats = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const cat of cats) {
    result[cat] = {}
    const subs = new Set([...Object.keys(a[cat] ?? {}), ...Object.keys(b[cat] ?? {})])
    for (const sub of subs) {
      const va = a[cat]?.[sub] ?? Array(12).fill(null)
      const vb = b[cat]?.[sub] ?? Array(12).fill(null)
      result[cat][sub] = va.map((v, i) => {
        if (v !== null && vb[i] !== null) return v + vb[i]!
        if (v !== null) return v
        if (vb[i] !== null) return vb[i]
        return null
      })
    }
  }
  return result
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
    sub: {
      real: sumSubData(a.sub?.real ?? {}, b.sub?.real ?? {}),
      ppto: sumSubData(a.sub?.ppto ?? {}, b.sub?.ppto ?? {}),
      le:   sumSubData(a.sub?.le   ?? {}, b.sub?.le   ?? {}),
    },
  }
}

/**
 * Obtiene todos los datos financieros de un año desde Supabase
 * y los transforma al formato DashboardData que espera el frontend.
 *
 * Agrega real_transactions (Real) y planning_entries (Presupuesto/LE).
 * Consolidado se calcula como la suma de TG + CDS + VA.
 */
export async function getFinancialData(year: number): Promise<DashboardData> {
  const supabase = await createClient()

  // Fetch transacciones reales del año
  const { data: txRows, error: txError } = await supabase
    .from('real_transactions')
    .select('sociedad, fecha, neto, categoria, sub_categoria')
    .gte('fecha', `${year}-01-01`)
    .lt('fecha', `${year + 1}-01-01`)

  if (txError) {
    console.error('Error fetching real_transactions:', txError.message)
    return buildEmptyDashboardData()
  }

  // Fetch entradas de presupuesto y LE del año
  const { data: planRows, error: planError } = await supabase
    .from('planning_entries')
    .select('sociedad, month, entry_type, categoria, monto, sub_categoria')
    .eq('year', year)

  if (planError) {
    console.error('Error fetching planning_entries:', planError.message)
    return buildEmptyDashboardData()
  }

  const data: DashboardData = buildEmptyDashboardData()

  // Agregar transacciones reales por (sociedad, mes, categoria)
  for (const row of (txRows as any[]) || []) {
    const compKey  = SLUG_MAP[row.sociedad]
    const grupoPL  = row.categoria as GrupoPL
    const monthIdx = new Date(row.fecha + 'T00:00:00').getMonth() // 0-11

    if (!compKey) continue
    if (!BASE_GRUPOS.includes(grupoPL as any)) continue

    const neto = row.neto ?? 0
    const current = data[compKey].real[grupoPL][monthIdx] ?? 0
    data[compKey].real[grupoPL][monthIdx] = current + neto

    if (row.sub_categoria) {
      addSubEntry(data[compKey].sub!.real, grupoPL, row.sub_categoria, monthIdx, neto)
    }
  }

  // Agregar entradas de planificación por (sociedad, mes, entry_type, categoria)
  for (const row of (planRows as any[]) || []) {
    const compKey  = SLUG_MAP[row.sociedad]
    const typeKey  = PLANNING_TYPE_MAP[row.entry_type]
    const grupoPL  = row.categoria as GrupoPL
    const monthIdx = row.month - 1  // DB: 1-12 → índice 0-11

    if (!compKey || !typeKey) continue
    if (monthIdx < 0 || monthIdx > 11) continue
    if (!BASE_GRUPOS.includes(grupoPL as any)) continue

    const monto = row.monto ?? 0
    const current = data[compKey][typeKey][grupoPL][monthIdx] ?? 0
    data[compKey][typeKey][grupoPL][monthIdx] = current + monto

    if (row.sub_categoria) {
      addSubEntry(data[compKey].sub![typeKey], grupoPL, row.sub_categoria, monthIdx, monto)
    }
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
  for (const typeKey of ['real', 'ppto', 'le'] as const) {
    computeDerived(consolidado[typeKey])
  }
  data.consolidado = consolidado

  return data
}

/**
 * Retorna los años que tienen al menos una entrada en real_transactions, ordenados desc.
 */
export async function getAvailableYears(): Promise<number[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('real_transactions')
    .select('fecha')

  if (error || !data) return [new Date().getFullYear()]
  const years = [
    ...new Set(
      (data as { fecha: string }[]).map(r => parseInt(r.fecha.substring(0, 4)))
    ),
  ]
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
