/**
 * Script de migración: mueve los 413 registros de `transactions` (Real 2026)
 * a la nueva tabla `real_transactions`.
 *
 * USO:
 *   npx ts-node --project tsconfig.json scripts/migrate-to-new-architecture.ts
 *
 * FLAGS:
 *   --verify-only   Solo ejecuta la reconciliación (paso 3), sin backup ni migración.
 *                   Usar antes del cutover en Unit 9.
 *
 * PASOS:
 *   1. Backup: exporta `transactions` y `financial_entries` a scripts/backup/
 *   2. Migración: inserta filas en `real_transactions` (idempotente)
 *   3. Reconciliación: compara SUM(amount) vs SUM(neto) por sociedad+mes+categoria.
 *      Sale con código 1 si hay diferencias > $0.01
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Cargar variables de entorno ──────────────────────────────
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

const VERIFY_ONLY = process.argv.includes('--verify-only')

// Mapeo source → tipo (R17)
const SOURCE_TO_TIPO: Record<string, string> = {
  ingresos: 'Ingreso',
  egresos:  'Egreso',
  sueldos:  'Sueldo',
}

// ── Helpers ──────────────────────────────────────────────────
function padMonth(m: number): string {
  return String(m).padStart(2, '0')
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function backupPath(table: string): string {
  const dir = path.join(process.cwd(), 'scripts', 'backup')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${table}_backup_${today()}.json`)
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('\n🏛  Migración nueva arquitectura de datos — Grupo Temple')
  console.log('─'.repeat(55))
  if (VERIFY_ONLY) {
    console.log('🔍 Modo --verify-only: solo reconciliación\n')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ── Cargar tabla companies ──────────────────────────────────
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, slug')
  if (compErr || !companies) {
    console.error('❌ Error cargando companies:', compErr?.message)
    process.exit(1)
  }
  const slugById: Record<string, string> = {}
  for (const c of companies) slugById[c.id] = c.slug

  // ── PASO 1: Backup ──────────────────────────────────────────
  if (!VERIFY_ONLY) {
    console.log('📦 Paso 1 — Backup de tablas existentes...')

    const { data: txData, error: txErr } = await supabase
      .from('transactions')
      .select('*')
    if (txErr) {
      console.error('❌ Error leyendo transactions:', txErr.message)
      process.exit(1)
    }
    const txBackup = backupPath('transactions')
    fs.writeFileSync(txBackup, JSON.stringify(txData, null, 2))
    console.log(`   ✔ transactions (${txData?.length ?? 0} filas) → ${txBackup}`)

    const { data: feData, error: feErr } = await supabase
      .from('financial_entries')
      .select('*')
    if (feErr) {
      console.error('❌ Error leyendo financial_entries:', feErr.message)
      process.exit(1)
    }
    const feBackup = backupPath('financial_entries')
    fs.writeFileSync(feBackup, JSON.stringify(feData, null, 2))
    console.log(`   ✔ financial_entries (${feData?.length ?? 0} filas) → ${feBackup}`)

    // ── PASO 2: Migración ────────────────────────────────────
    console.log('\n🔄 Paso 2 — Migrando transactions → real_transactions...')

    // Verificar si ya fue migrado
    const { count: existingCount, error: countErr } = await supabase
      .from('real_transactions')
      .select('*', { count: 'exact', head: true })
    if (countErr) {
      console.error('❌ Error verificando real_transactions:', countErr.message)
      process.exit(1)
    }
    if ((existingCount ?? 0) > 0) {
      console.log(`   ℹ real_transactions ya tiene ${existingCount} registros — omitiendo inserción.`)
      console.log('     Para re-migrar, vaciá la tabla primero (TRUNCATE real_transactions).')
    } else {
      // Cargar todas las transactions
      const { data: txRows, error: txLoadErr } = await supabase
        .from('transactions')
        .select('*')
      if (txLoadErr || !txRows) {
        console.error('❌ Error leyendo transactions para migrar:', txLoadErr?.message)
        process.exit(1)
      }

      // Solo migramos las de tipo 'Real' (data_type='Real')
      const realRows = txRows.filter(r => r.data_type === 'Real')
      console.log(`   Registros Real encontrados: ${realRows.length}`)

      let ok = 0, errs = 0

      // Insertar en lotes de 100
      const BATCH = 100
      for (let i = 0; i < realRows.length; i += BATCH) {
        const batch = realRows.slice(i, i + BATCH)
        const toInsert = batch.map(row => {
          const sociedad = slugById[row.company_id]
          if (!sociedad) {
            console.warn(`   ⚠ company_id ${row.company_id} no encontrado — fila omitida`)
            return null
          }
          const tipo = SOURCE_TO_TIPO[row.source]
          if (!tipo) {
            console.warn(`   ⚠ source "${row.source}" no mapeado — fila omitida`)
            return null
          }
          return {
            fecha:        `${row.year}-${padMonth(row.month)}-01`,
            sociedad,
            neto:         row.amount,
            tipo,
            categoria:    row.grupo_pl,           // grupo_pl → categoria
            sub_categoria: row.categoria ?? null, // categoria vieja → sub_categoria
            observaciones: row.descripcion ?? null,
            // Todos los campos fiscales quedan en NULL
          }
        }).filter(Boolean)

        const { error: insertErr } = await supabase
          .from('real_transactions')
          .insert(toInsert as object[])

        if (insertErr) {
          console.error(`   ❌ Error en lote ${i}-${i + BATCH}:`, insertErr.message)
          errs += batch.length
        } else {
          ok += toInsert.length
        }
      }

      console.log(`   ✔ Insertados: ${ok} | Errores: ${errs}`)
      if (errs > 0) {
        console.error('   ❌ Hubo errores en la inserción. Corregir antes de continuar.')
        process.exit(1)
      }
    }
  }

  // ── PASO 3: Reconciliación ───────────────────────────────────
  console.log('\n🔢 Paso 3 — Reconciliación de totales...')

  // Cargar sumas de transactions (fuente de verdad)
  const { data: oldSums, error: oldSumErr } = await supabase
    .from('transactions')
    .select('company_id, month, grupo_pl, amount')
    .eq('data_type', 'Real')
  if (oldSumErr || !oldSums) {
    console.error('❌ Error leyendo transactions para reconciliación:', oldSumErr?.message)
    process.exit(1)
  }

  // Agregar sumas antiguas: { sociedad_mes_grupo → total }
  const oldTotals: Record<string, number> = {}
  for (const row of oldSums) {
    const sociedad = slugById[row.company_id]
    if (!sociedad) continue
    const key = `${sociedad}|${row.month}|${row.grupo_pl}`
    oldTotals[key] = (oldTotals[key] ?? 0) + (row.amount ?? 0)
  }

  // Cargar sumas de real_transactions
  const { data: newSums, error: newSumErr } = await supabase
    .from('real_transactions')
    .select('sociedad, fecha, neto, categoria')
  if (newSumErr || !newSums) {
    console.error('❌ Error leyendo real_transactions para reconciliación:', newSumErr?.message)
    process.exit(1)
  }

  // Agregar sumas nuevas: { sociedad_mes_categoria → total }
  const newTotals: Record<string, number> = {}
  for (const row of newSums) {
    const month = new Date(row.fecha).getUTCMonth() + 1
    const key = `${row.sociedad}|${month}|${row.categoria}`
    newTotals[key] = (newTotals[key] ?? 0) + (row.neto ?? 0)
  }

  // Comparar
  const allKeys = new Set([...Object.keys(oldTotals), ...Object.keys(newTotals)])
  const diffs: Array<{ key: string; old: number; new: number; diff: number }> = []

  for (const key of allKeys) {
    const oldVal = oldTotals[key] ?? 0
    const newVal = newTotals[key] ?? 0
    const diff = Math.abs(oldVal - newVal)
    if (diff > 0.01) {
      diffs.push({ key, old: oldVal, new: newVal, diff })
    }
  }

  if (diffs.length === 0) {
    console.log('   ✅ Reconciliación OK — 0 diferencias entre transactions y real_transactions')
  } else {
    console.error(`\n   ❌ ${diffs.length} diferencia(s) encontrada(s):`)
    console.error('   Clave (sociedad|mes|categoria)                old_sum      new_sum      diff')
    console.error('   ' + '─'.repeat(80))
    for (const d of diffs) {
      const [soc, mes, cat] = d.key.split('|')
      const label = `${soc.padEnd(4)} | mes ${mes.padStart(2)} | ${cat}`
      console.error(
        `   ${label.padEnd(45)} ${String(d.old.toFixed(2)).padStart(12)} ${String(d.new.toFixed(2)).padStart(12)} ${String(d.diff.toFixed(2)).padStart(12)}`
      )
    }
    console.error('\n   ⛔ No continuar con el cutover hasta resolver estas diferencias.')
    console.error('      Revisar backup en scripts/backup/ para identificar las filas afectadas.\n')
    process.exit(1)
  }

  console.log('\n✅ Script completado exitosamente.')
  console.log('   Próximo paso: ejecutar el frontend actualizado y verificar el dashboard.')
  console.log('   Luego ejecutar 006_drop_old_tables.sql para completar el cutover.\n')
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
