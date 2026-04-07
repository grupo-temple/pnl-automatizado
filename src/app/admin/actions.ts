'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Grupos válidos en la DB
const VALID_GRUPOS = new Set([
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
])

// Mapeo nombre del Sheet → clave interna
const GRUPO_MAP: Record<string, string> = {
  'Total Ingresos':        'Total Ingresos',
  'Subtotal Sueldos':      'Sueldos',
  'Subtotal G. Personal':  'Gastos Personal',
  'Subtotal G. Adm.':      'Gastos Administrativos',
  'Subtotal G. Mkt.':      'Gastos Marketing',
  'Subtotal Tercerizados': 'Tercerizados',
  'Subtotal Otros':        'Otros',
}

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const VALID_TIPOS = new Set(['Real', 'Presupuesto', 'LE'])

// ── Verificar que el usuario es admin ─────────────────────────────────────────
async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const role = user.user_metadata?.app_role
  if (role !== 'admin') throw new Error('Sin permisos de admin')
  return user
}

function parseNum(s: string): number | null {
  if (!s || s === '' || s === '—' || s === '-') return null
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(l => l.trim())
  return lines.map(line => {
    const result: string[] = []
    let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++ } else inQ=!inQ }
      else if (c === ',' && !inQ) { result.push(cur.trim()); cur='' }
      else cur += c
    }
    result.push(cur.trim())
    return result
  })
}

// ── Subir CSV ─────────────────────────────────────────────────────────────────
export async function uploadCSV(formData: FormData): Promise<{
  success: boolean
  message: string
  inserted?: number
  skipped?: number
  errors?: number
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const file = formData.get('csv') as File | null
  const yearStr = formData.get('year') as string
  const year = parseInt(yearStr)

  if (!file || file.size === 0) return { success: false, message: 'No se seleccionó archivo.' }
  if (isNaN(year) || year < 2000 || year > 2099) return { success: false, message: 'Año inválido.' }
  if (file.size > 1024 * 1024) return { success: false, message: 'El archivo supera 1 MB.' }

  const content = await file.text()
  const rows = parseCSV(content)
  if (rows.length < 2) return { success: false, message: 'El CSV parece vacío o mal formateado.' }

  const headers = rows[0].map(h => h.toLowerCase().trim())
  const grupoIdx   = headers.findIndex(h => h === 'grupo_pl')
  const empresaIdx = headers.findIndex(h => h === 'empresa')
  const tipoIdx    = headers.findIndex(h => h === 'tipo')
  const monthIdxs  = MONTHS.map(m => headers.findIndex(h => h === m.toLowerCase()))

  if (grupoIdx < 0 || empresaIdx < 0 || tipoIdx < 0) {
    return { success: false, message: 'El CSV debe tener columnas: grupo_pl, empresa, tipo, ENE, FEB, ..., DIC' }
  }

  const adminClient = createAdminClient()

  // Obtener IDs de empresas
  const { data: companies } = await adminClient.from('companies').select('id, slug')
  if (!companies) return { success: false, message: 'Error obteniendo empresas.' }
  const compIdMap: Record<string, string> = {}
  for (const c of companies) compIdMap[c.slug] = c.id

  let inserted = 0, skipped = 0, errors = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const grupoRaw  = (row[grupoIdx] || '').trim()
    const empresa   = (row[empresaIdx] || '').trim()
    const tipoRaw   = (row[tipoIdx] || '').trim()

    // Ignorar Consolidado (se calcula)
    if (empresa === 'Consolidado') { skipped++; continue }

    const grupo = GRUPO_MAP[grupoRaw] ?? (VALID_GRUPOS.has(grupoRaw) ? grupoRaw : null)
    const tipo  = VALID_TIPOS.has(tipoRaw) ? tipoRaw : null
    const companyId = compIdMap[empresa]

    if (!grupo || !tipo || !companyId) { skipped++; continue }

    for (let m = 0; m < 12; m++) {
      const colIdx = monthIdxs[m]
      if (colIdx < 0) continue
      const amount = parseNum(row[colIdx] || '')

      const { error } = await adminClient
        .from('financial_entries')
        .upsert(
          { company_id: companyId, year, month: m + 1, data_type: tipo, grupo_pl: grupo, amount },
          { onConflict: 'company_id,year,month,data_type,grupo_pl' }
        )

      if (error) errors++
      else inserted++
    }
  }

  if (inserted > 0) revalidatePath('/dashboard')

  return {
    success: errors === 0,
    message: errors === 0
      ? `Carga exitosa: ${inserted} registros procesados.`
      : `Carga parcial: ${inserted} ok, ${errors} errores, ${skipped} ignorados.`,
    inserted,
    skipped,
    errors,
  }
}

// ── Guardar entrada manual ────────────────────────────────────────────────────
export async function saveEntry(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const empresa  = formData.get('empresa')  as string
  const year     = parseInt(formData.get('year') as string)
  const month    = parseInt(formData.get('month') as string)
  const tipo     = formData.get('tipo')     as string
  const grupo    = formData.get('grupo_pl') as string
  const amountStr = formData.get('amount')  as string

  if (!empresa || isNaN(year) || isNaN(month) || !tipo || !grupo) {
    return { success: false, message: 'Campos requeridos incompletos.' }
  }
  if (!VALID_TIPOS.has(tipo)) return { success: false, message: 'Tipo inválido.' }
  if (!VALID_GRUPOS.has(grupo)) return { success: false, message: 'Grupo P&L inválido.' }
  if (month < 1 || month > 12) return { success: false, message: 'Mes inválido.' }

  const amount = parseNum(amountStr)

  const adminClient = createAdminClient()
  const { data: comp } = await adminClient
    .from('companies').select('id').eq('slug', empresa).single()
  if (!comp) return { success: false, message: `Empresa "${empresa}" no encontrada.` }

  const { error } = await adminClient
    .from('financial_entries')
    .upsert(
      { company_id: comp.id, year, month, data_type: tipo, grupo_pl: grupo, amount },
      { onConflict: 'company_id,year,month,data_type,grupo_pl' }
    )

  if (error) return { success: false, message: 'Error guardando: ' + error.message }

  revalidatePath('/dashboard')
  return { success: true, message: 'Registro guardado correctamente.' }
}

// ── Eliminar entrada ──────────────────────────────────────────────────────────
export async function deleteEntry(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const id = formData.get('id') as string
  if (!id) return { success: false, message: 'ID requerido.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('financial_entries')
    .delete()
    .eq('id', id)

  if (error) return { success: false, message: 'Error eliminando: ' + error.message }

  revalidatePath('/dashboard')
  return { success: true, message: 'Registro eliminado.' }
}
