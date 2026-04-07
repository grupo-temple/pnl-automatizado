/**
 * Script one-shot: importa datos históricos desde un CSV exportado del Google Sheet.
 *
 * USO:
 *   1. Exportar el Google Sheet (hoja P&L_RESUMEN) como CSV:
 *      Archivo → Descargar → CSV (.csv, hoja actual)
 *   2. Guardar el archivo como: scripts/data/pl-resumen.csv
 *   3. Copiar .env.example a .env.local y completar las variables
 *   4. Ejecutar: npx ts-node --project tsconfig.json scripts/migrate-from-sheets.ts
 *
 * FORMATO ESPERADO DEL CSV:
 *   grupo_pl,empresa,tipo,ENE,FEB,MAR,ABR,MAY,JUN,JUL,AGO,SEP,OCT,NOV,DIC
 *   Total Ingresos,TG,Real,1000000,1200000,...
 *   Total Ingresos,TG,Presupuesto,1100000,1150000,...
 *   ...
 *
 * El año se pasa como argumento: --year=2026 (default: año actual)
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Leer variables de entorno del .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

// Parsear argumento --year
const yearArg = process.argv.find(a => a.startsWith('--year='))
const YEAR = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear()

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

// Grupos válidos (deben coincidir con el Sheet y con la DB)
const VALID_GRUPOS = new Set([
  'Total Ingresos',
  'Sueldos',
  'Gastos Personal',
  'Gastos Administrativos',
  'Gastos Marketing',
  'Tercerizados',
  'Otros',
])

// Mapeo nombre en el Sheet → clave interna
const GRUPO_MAP: Record<string, string> = {
  'Total Ingresos':        'Total Ingresos',
  'Subtotal Sueldos':      'Sueldos',
  'Subtotal G. Personal':  'Gastos Personal',
  'Subtotal G. Adm.':      'Gastos Administrativos',
  'Subtotal G. Mkt.':      'Gastos Marketing',
  'Subtotal Tercerizados': 'Tercerizados',
  'Subtotal Otros':        'Otros',
}

const EMPRESA_MAP: Record<string, string> = {
  'TG': 'TG', 'CDS': 'CDS', 'VA': 'VA',
}

const TIPO_MAP: Record<string, string> = {
  'Real': 'Real', 'Presupuesto': 'Presupuesto', 'LE': 'LE',
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
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (c === ',' && !inQ) {
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

async function main() {
  const csvPath = path.join(process.cwd(), 'scripts', 'data', 'pl-resumen.csv')
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ No se encontró el archivo CSV en: ${csvPath}`)
    console.error('   Exportá el Sheet y guardalo ahí antes de ejecutar el script.')
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)

  if (rows.length < 2) {
    console.error('❌ El CSV parece estar vacío o mal formateado.')
    process.exit(1)
  }

  // Header row
  const headers = rows[0].map(h => h.toLowerCase().trim())
  const grupoIdx  = headers.findIndex(h => h === 'grupo_pl')
  const empresaIdx = headers.findIndex(h => h === 'empresa')
  const tipoIdx   = headers.findIndex(h => h === 'tipo')
  const monthIdxs = MONTHS.map(m => headers.findIndex(h => h === m.toLowerCase()))

  if (grupoIdx < 0 || empresaIdx < 0 || tipoIdx < 0) {
    console.error('❌ El CSV debe tener columnas: grupo_pl, empresa, tipo, ENE, FEB, ..., DIC')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // Obtener IDs de empresas
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, slug')
  if (compError || !companies) {
    console.error('❌ Error obteniendo empresas de Supabase:', compError?.message)
    process.exit(1)
  }
  const companyIdMap: Record<string, string> = {}
  for (const c of companies) companyIdMap[c.slug] = c.id

  let inserted = 0, updated = 0, skipped = 0, errors = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const grupoRaw  = row[grupoIdx] || ''
    const empresa   = EMPRESA_MAP[(row[empresaIdx] || '').trim()]
    const tipoRaw   = (row[tipoIdx] || '').trim()
    const tipo      = TIPO_MAP[tipoRaw]
    const grupo     = GRUPO_MAP[grupoRaw.trim()] || (VALID_GRUPOS.has(grupoRaw.trim()) ? grupoRaw.trim() : null)

    if (!empresa || !tipo || !grupo) {
      console.warn(`  ⚠ Fila ${i + 1} ignorada (empresa="${row[empresaIdx]}", tipo="${tipoRaw}", grupo="${grupoRaw}")`)
      skipped++
      continue
    }

    if (empresa === 'Consolidado') {
      skipped++
      continue // Consolidado se calcula, no se importa
    }

    const companyId = companyIdMap[empresa]
    if (!companyId) {
      console.warn(`  ⚠ Empresa "${empresa}" no encontrada en DB`)
      skipped++
      continue
    }

    // Insertar una fila por mes
    for (let m = 0; m < 12; m++) {
      const colIdx = monthIdxs[m]
      if (colIdx < 0) continue
      const amount = parseNum(row[colIdx] || '')

      const { error } = await supabase
        .from('financial_entries')
        .upsert({
          company_id: companyId,
          year: YEAR,
          month: m + 1,
          data_type: tipo,
          grupo_pl: grupo,
          amount,
        }, {
          onConflict: 'company_id,year,month,data_type,grupo_pl',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error(`  ❌ Error en fila ${i + 1}, mes ${m + 1}:`, error.message)
        errors++
      } else {
        inserted++
      }
    }
  }

  console.log(`\n✅ Migración completada para año ${YEAR}:`)
  console.log(`   Filas procesadas: ${inserted}`)
  console.log(`   Ignoradas:        ${skipped}`)
  console.log(`   Errores:          ${errors}`)
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
