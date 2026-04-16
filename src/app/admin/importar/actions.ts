'use server'

import Papa from 'papaparse'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Fuente = 'ingresos' | 'egresos' | 'sueldos'

export interface ParsedRow {
  fecha: string       // ISO date: YYYY-MM-01
  sociedad: string
  tipo: string
  categoria: string
  sub_categoria: string
  monto: number
  fuente: Fuente
}

export interface InvalidRow {
  rowNum: number
  raw: Record<string, string>
  errors: string[]
}

export interface ParseResult {
  valid: ParsedRow[]
  invalid: InvalidRow[]
  preview: ParsedRow[]
  totalRows: number
}

const MES_MAP: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

// Maps canonical field → possible CSV column names (lowercased)
const ALIAS: Record<string, string[]> = {
  fecha:         ['mes', 'periodo', 'fecha', 'month'],
  monto:         ['neto', 'monto', 'importe', 'total'],
  sociedad:      ['sociedad', 'negocio', 'empresa'],
  tipo:          ['tipo'],
  categoria:     ['categoria', 'categoría'],
  sub_categoria: ['sub-categoria', 'sub_categoria', 'subcategoria', 'clasificacion', 'clasificación'],
}

function findCol(headers: string[], key: string): string | undefined {
  const aliases = ALIAS[key] ?? [key]
  return headers.find(h => aliases.includes(h.toLowerCase().trim()))
}

function parseFecha(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()

  // "ENE:2026" or "ENE-2026" or "ENE 2026"
  const m1 = s.match(/^([a-záéíóú]+)[:\-\s]+(\d{4})$/i)
  if (m1) {
    const mes = MES_MAP[m1[1].toLowerCase()]
    const year = parseInt(m1[2])
    if (mes && year) return `${year}-${String(mes).padStart(2, '0')}-01`
  }

  // "01/2026" or "2026/01"
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (m2) {
    const mes = parseInt(m2[1])
    const year = parseInt(m2[2])
    if (mes >= 1 && mes <= 12 && year > 2000) return `${year}-${String(mes).padStart(2, '0')}-01`
  }

  // "2026-01-01" already ISO
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m3) return s

  return null
}

function parseMonto(raw: string): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '—') return null
  // Remove currency symbols, spaces, then convert AR decimal comma
  const cleaned = raw.replace(/[$ ]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  if (user.user_metadata?.app_role !== 'admin') throw new Error('Sin permisos de admin')
  return user
}

export async function parseTempleCSV(formData: FormData): Promise<ParseResult> {
  await assertAdmin()

  const file = formData.get('file') as File | null
  const fuente = formData.get('fuente') as Fuente | null

  if (!file || !fuente) throw new Error('Faltan parámetros: file y fuente son requeridos')

  const content = await file.text()

  // PapaParse with auto-delimiter detection
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.toLowerCase().trim(),
  })

  const rows = parsed.data as Record<string, string>[]
  if (!rows.length) return { valid: [], invalid: [], preview: [], totalRows: 0 }

  const headers = Object.keys(rows[0])

  const fecCol  = findCol(headers, 'fecha')
  const monCol  = findCol(headers, 'monto')
  const socCol  = findCol(headers, 'sociedad')
  const tipCol  = findCol(headers, 'tipo')
  const catCol  = findCol(headers, 'categoria')
  const subCol  = findCol(headers, 'sub_categoria')

  // Load catalog for validation
  const supabase = await createClient()
  const { data: catalogRows } = await supabase
    .from('catalog_items')
    .select('tipo, categoria, sub_categoria')
    .eq('active', true)

  const catalogSet = new Set<string>(
    (catalogRows ?? []).map(r => `${r.tipo}|${r.categoria}|${r.sub_categoria ?? ''}`)
  )

  const validSociedades = new Set(['TG', 'CDS', 'VA'])

  const valid: ParsedRow[] = []
  const invalid: InvalidRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []

    const rawFecha    = fecCol  ? row[fecCol]  : ''
    const rawMonto    = monCol  ? row[monCol]  : ''
    const rawSociedad = socCol  ? row[socCol]  : ''
    const rawTipo     = tipCol  ? row[tipCol]  : ''
    const rawCat      = catCol  ? row[catCol]  : ''
    const rawSub      = subCol  ? row[subCol]  : ''

    const fecha = parseFecha(rawFecha)
    if (!fecha) errors.push(`Fecha inválida: "${rawFecha}"`)

    const monto = parseMonto(rawMonto)
    if (monto === null) errors.push(`Monto inválido: "${rawMonto}"`)

    const sociedad = rawSociedad.trim().toUpperCase()
    if (!validSociedades.has(sociedad)) errors.push(`Sociedad desconocida: "${rawSociedad}"`)

    const tipo = rawTipo.trim()
    const categoria = rawCat.trim()
    const sub_categoria = rawSub.trim()

    const catalogKey = `${tipo}|${categoria}|${sub_categoria}`
    if (tipo && categoria && !catalogSet.has(catalogKey)) {
      errors.push(`No está en catálogo: ${tipo} / ${categoria} / ${sub_categoria || '—'}`)
    }

    if (errors.length) {
      invalid.push({ rowNum: i + 2, raw: row, errors })
    } else {
      valid.push({
        fecha: fecha!,
        sociedad,
        tipo,
        categoria,
        sub_categoria,
        monto: monto!,
        fuente,
      })
    }
  }

  return {
    valid,
    invalid,
    preview: valid.slice(0, 5),
    totalRows: rows.length,
  }
}

export async function importConfirm(
  rows: ParsedRow[],
  fuente: Fuente,
): Promise<{ inserted: number }> {
  await assertAdmin()
  if (!rows.length) return { inserted: 0 }

  const adminClient = await createAdminClient()

  // Group by (sociedad, year, month) to build delete scope
  const periods = new Map<string, { sociedad: string; year: number; month: number }>()
  for (const r of rows) {
    const year  = parseInt(r.fecha.substring(0, 4))
    const month = parseInt(r.fecha.substring(5, 7))
    const key   = `${r.sociedad}|${year}|${month}`
    if (!periods.has(key)) periods.set(key, { sociedad: r.sociedad, year, month })
  }

  // DELETE existing rows for each (sociedad, year, month, fuente)
  for (const { sociedad, year, month } of periods.values()) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to   = `${year}-${String(month).padStart(2, '0')}-01`
    const { error } = await adminClient
      .from('real_transactions')
      .delete()
      .eq('sociedad', sociedad)
      .eq('fecha', from)
      .eq('fuente', fuente)

    if (error) throw new Error(`Error borrando período ${sociedad} ${from}: ${error.message}`)
  }

  // INSERT in batches of 100
  const insertRows = rows.map(r => ({
    fecha:         r.fecha,
    sociedad:      r.sociedad,
    tipo:          r.tipo,
    categoria:     r.categoria,
    sub_categoria: r.sub_categoria || null,
    neto:          r.monto,
    fuente,
  }))

  const BATCH = 100
  for (let i = 0; i < insertRows.length; i += BATCH) {
    const batch = insertRows.slice(i, i + BATCH)
    const { error } = await adminClient.from('real_transactions').insert(batch)
    if (error) throw new Error(`Error insertando batch ${i / BATCH + 1}: ${error.message}`)
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin/importar')

  return { inserted: insertRows.length }
}
