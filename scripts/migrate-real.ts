/**
 * Script de migración desde los 3 Google Sheets de Grupo Temple.
 *
 * ARCHIVOS REQUERIDOS (exportar cada hoja como CSV):
 *   scripts/data/ingresos.csv  — hoja de Ingresos
 *   scripts/data/egresos.csv   — hoja de Egresos
 *   scripts/data/sueldos.csv   — hoja de Sueldos
 *
 * USO:
 *   npx ts-node --project tsconfig.json scripts/migrate-real.ts
 *
 * COLUMNAS ESPERADAS:
 *   ingresos: MES | ... | Neto | Clasificacion | Sociedad
 *   egresos:  MES | ... | Neto | Rubro | ... | Sociedad
 *   sueldos:  Periodo | ... | Monto | Tipo | Negocio
 *
 * FORMATO DE MES: ENE:2026, FEB:2026, etc.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Leer .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) process.env[key.trim()] = valueParts.join('=').trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

// ── MAPEOS ──────────────────────────────────────────────────────────────────

const MES_MAP: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
}

// Rubro (egresos) → grupo_pl en DB
const RUBRO_MAP: Record<string, string> = {
  'Sueldos':               'Sueldos',
  'Gastos Personal':       'Gastos Personal',
  'Gastos Administrativos':'Gastos Administrativos',
  'Gastos Marketing':      'Gastos Marketing',
  'Tercerizados':          'Tercerizados',
  'Impuestos y Gastos':    'Otros',
  'Otros':                 'Otros',
  // DIVIDENDOS se ignora — no forma parte del P&L
}

// ── HELPERS ─────────────────────────────────────────────────────────────────

function parseMes(raw: string): { month: number; year: number } | null {
  // Soporta: "ENE:2026", "ENE-2026", "ENE 2026", "ENE/2026"
  const parts = raw.trim().toUpperCase().split(/[:\-\s\/]/)
  if (parts.length < 2) return null
  const month = MES_MAP[parts[0]]
  const year  = parseInt(parts[1])
  if (!month || isNaN(year)) return null
  return { month, year }
}

function parseNum(s: string): number | null {
  if (!s || s.trim() === '' || s.trim() === '-' || s.trim() === '—') return null
  // Eliminar puntos de miles y reemplazar coma decimal
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(l => l.trim())
  return lines.map(line => {
    const result: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if ((c === ',' || c === ';') && !inQ) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    result.push(cur.trim())
    return result
  })
}

function getIdx(headers: string[], name: string): number {
  return headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase())
}

// Clave de agregación: empresa|año|mes|grupo_pl
type AggKey = string
const aggMap = new Map<AggKey, number>()

function addAmount(empresa: string, year: number, month: number, grupoPL: string, amount: number | null) {
  if (amount === null) return
  const key = `${empresa}|${year}|${month}|${grupoPL}`
  aggMap.set(key, (aggMap.get(key) ?? 0) + amount)
}

// ── PROCESAR INGRESOS ────────────────────────────────────────────────────────

function processIngresos(csvPath: string): number {
  console.log('\n📥 Procesando Ingresos...')
  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)
  const headers = rows[0].map(h => h.toLowerCase().trim())

  const mesIdx      = getIdx(headers, 'mes')
  const netoIdx     = getIdx(headers, 'neto')
  const sociedadIdx = getIdx(headers, 'sociedad')

  if (mesIdx < 0 || netoIdx < 0 || sociedadIdx < 0) {
    console.error('❌ Ingresos: faltan columnas MES, Neto o Sociedad')
    process.exit(1)
  }

  let count = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const parsed   = parseMes(row[mesIdx] || '')
    const sociedad = (row[sociedadIdx] || '').trim().toUpperCase()
    const neto     = parseNum(row[netoIdx] || '')

    if (!parsed || !['TG', 'CDS', 'VA'].includes(sociedad)) continue

    addAmount(sociedad, parsed.year, parsed.month, 'Total Ingresos', neto)
    count++
  }
  console.log(`   ${count} filas leídas`)
  return count
}

// ── PROCESAR EGRESOS ─────────────────────────────────────────────────────────

function processEgresos(csvPath: string): number {
  console.log('\n📤 Procesando Egresos...')
  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)
  const headers = rows[0].map(h => h.toLowerCase().trim())

  const mesIdx       = getIdx(headers, 'mes')
  const netoIdx      = getIdx(headers, 'neto')
  const categoriaIdx = getIdx(headers, 'categoria')
  const sociedadIdx  = getIdx(headers, 'sociedad')

  if (mesIdx < 0 || netoIdx < 0 || categoriaIdx < 0 || sociedadIdx < 0) {
    console.error('❌ Egresos: faltan columnas MES, Neto, Categoria o Sociedad')
    process.exit(1)
  }

  let count = 0, skipped = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const parsed    = parseMes(row[mesIdx] || '')
    const sociedad  = (row[sociedadIdx] || '').trim().toUpperCase()
    const categoria = (row[categoriaIdx] || '').trim()
    const neto      = parseNum(row[netoIdx] || '')
    const grupoPL   = RUBRO_MAP[categoria]

    if (!parsed || !['TG', 'CDS', 'VA'].includes(sociedad)) continue

    if (!grupoPL) {
      // Rubro no mapeado (ej: DIVIDENDOS) — ignorar
      skipped++
      continue
    }

    addAmount(sociedad, parsed.year, parsed.month, grupoPL, neto)
    count++
  }
  console.log(`   ${count} filas leídas, ${skipped} ignoradas (DIVIDENDOS u otros)`)
  return count
}

// ── PROCESAR SUELDOS ─────────────────────────────────────────────────────────

function processSueldos(csvPath: string): number {
  console.log('\n💼 Procesando Sueldos...')
  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)

  // Buscar la fila de headers (puede no ser la primera si hay filas vacías al inicio)
  const headerRowIdx = rows.findIndex(row =>
    row.some(cell => cell.toLowerCase().trim() === 'periodo')
  )
  if (headerRowIdx < 0) {
    console.warn('⚠ Sueldos: no se encontró la fila de headers — saltando')
    return 0
  }

  const headers = rows[headerRowIdx].map(h => h.toLowerCase().trim())

  const periodoIdx = getIdx(headers, 'periodo')
  const montoIdx   = getIdx(headers, 'monto')
  const negocioIdx = getIdx(headers, 'negocio')

  if (periodoIdx < 0 || montoIdx < 0 || negocioIdx < 0) {
    console.warn('⚠ Sueldos: faltan columnas Periodo, Monto o Negocio — saltando')
    return 0
  }

  let count = 0
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const parsed  = parseMes(row[periodoIdx] || '')
    const negocio = (row[negocioIdx] || '').trim().toUpperCase()
    const monto   = parseNum(row[montoIdx] || '')

    if (!parsed || !['TG', 'CDS', 'VA'].includes(negocio)) continue

    addAmount(negocio, parsed.year, parsed.month, 'Sueldos', monto)
    count++
  }
  console.log(`   ${count} filas leídas`)
  return count
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const dataDir = path.join(process.cwd(), 'scripts', 'data')

  const ingresosPath = path.join(dataDir, 'ingresos.csv')
  const egresosPath  = path.join(dataDir, 'egresos.csv')
  const sueldosPath  = path.join(dataDir, 'sueldos.csv')

  // Procesar los tres sheets (cada uno es opcional)
  if (fs.existsSync(ingresosPath)) {
    processIngresos(ingresosPath)
  } else {
    console.log('\n⚠ ingresos.csv no encontrado — saltando')
  }

  if (fs.existsSync(egresosPath)) {
    processEgresos(egresosPath)
  } else {
    console.log('\n⚠ egresos.csv no encontrado — saltando')
  }

  if (fs.existsSync(sueldosPath)) {
    processSueldos(sueldosPath)
  } else {
    console.log('\n⚠ sueldos.csv no encontrado — saltando')
  }

  if (aggMap.size === 0) {
    console.error('\n❌ No se encontraron datos para insertar.')
    process.exit(1)
  }

  console.log(`\n📊 Total de combinaciones empresa/mes/grupo: ${aggMap.size}`)

  // Conectar a Supabase
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // Obtener IDs de empresas
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, slug')
  if (compError || !companies) {
    console.error('❌ Error obteniendo empresas:', compError?.message)
    process.exit(1)
  }
  const companyIdMap: Record<string, string> = {}
  for (const c of companies) companyIdMap[c.slug] = c.id

  // Preparar filas para upsert
  const toInsert = []
  for (const [key, amount] of aggMap) {
    const [empresa, yearStr, monthStr, grupoPL] = key.split('|')
    const companyId = companyIdMap[empresa]
    if (!companyId) continue

    toInsert.push({
      company_id: companyId,
      year:       parseInt(yearStr),
      month:      parseInt(monthStr),
      data_type:  'Real',
      grupo_pl:   grupoPL,
      amount,
    })
  }

  // Upsert en lotes de 100
  let inserted = 0, errors = 0
  const BATCH = 100
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase
      .from('financial_entries')
      .upsert(batch, {
        onConflict: 'company_id,year,month,data_type,grupo_pl',
        ignoreDuplicates: false,
      })
    if (error) {
      console.error(`❌ Error en lote ${i / BATCH + 1}:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
    }
  }

  console.log(`\n✅ Migración completada:`)
  console.log(`   Registros insertados/actualizados: ${inserted}`)
  console.log(`   Errores:                           ${errors}`)
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
