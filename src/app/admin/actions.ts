'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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


// ── Helper: validar (tipo, categoria, sub_categoria) contra catálogo activo ────
async function validateCatalog(
  adminClient: ReturnType<typeof createAdminClient>,
  tipo: string,
  categoria: string,
  sub_categoria: string | null
): Promise<boolean> {
  let query = adminClient
    .from('catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', tipo)
    .eq('categoria', categoria)
    .eq('active', true)

  if (sub_categoria) {
    query = query.eq('sub_categoria', sub_categoria)
  } else {
    query = query.is('sub_categoria', null)
  }

  const { count } = await query
  return (count ?? 0) > 0
}

// ── CATALOG ITEMS ─────────────────────────────────────────────────────────────

export async function saveCatalogItem(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const tipo          = (formData.get('tipo') as string)?.trim()
  const categoria     = (formData.get('categoria') as string)?.trim()
  const sub_categoria = (formData.get('sub_categoria') as string)?.trim() || null
  const active        = formData.get('active') !== 'false'

  if (!tipo || !categoria) {
    return { success: false, message: 'Tipo y Categoría son requeridos.' }
  }

  const adminClient = createAdminClient()

  // Upsert: ON CONFLICT en (tipo, categoria, COALESCE(sub_categoria, ''))
  const { error } = await adminClient
    .from('catalog_items')
    .upsert(
      { tipo, categoria, sub_categoria, active },
      { onConflict: 'tipo,categoria,sub_categoria' }
    )

  if (error) return { success: false, message: 'Error guardando: ' + error.message }

  revalidatePath('/admin/catalogo')
  return { success: true, message: 'Ítem guardado correctamente.' }
}

export async function deactivateCatalogItem(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const id     = formData.get('id') as string
  const active = formData.get('active') === 'true'  // true = reactivar, false = desactivar

  if (!id) return { success: false, message: 'ID requerido.' }

  const adminClient = createAdminClient()

  // Verificar que no tenga referencias activas (solo si se va a desactivar)
  if (!active) {
    const { data: item } = await adminClient
      .from('catalog_items')
      .select('tipo, categoria, sub_categoria')
      .eq('id', id)
      .single()

    if (item) {
      const refQuery = (table: string) =>
        adminClient
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('tipo', item.tipo)
          .eq('categoria', item.categoria)
          .eq('sub_categoria', item.sub_categoria ?? '')

      const [txRef, plRef] = await Promise.all([
        adminClient
          .from('real_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', item.tipo)
          .eq('categoria', item.categoria),
        adminClient
          .from('planning_entries')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', item.tipo)
          .eq('categoria', item.categoria),
      ])

      const totalRefs = (txRef.count ?? 0) + (plRef.count ?? 0)
      if (totalRefs > 0) {
        return {
          success: false,
          message: `No se puede desactivar: hay ${totalRefs} registro(s) que usan esta clasificación. Puede editarse pero no desactivarse mientras tenga referencias.`,
        }
      }
    }
  }

  const { error } = await adminClient
    .from('catalog_items')
    .update({ active })
    .eq('id', id)

  if (error) return { success: false, message: 'Error actualizando: ' + error.message }

  revalidatePath('/admin/catalogo')
  return { success: true, message: active ? 'Ítem reactivado.' : 'Ítem desactivado.' }
}

// ── REAL TRANSACTIONS ─────────────────────────────────────────────────────────

export async function saveTransaction(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const fecha        = formData.get('fecha') as string
  const sociedad     = formData.get('sociedad') as string
  const netoStr      = formData.get('neto') as string
  const tipo         = (formData.get('tipo') as string)?.trim()
  const categoria    = (formData.get('categoria') as string)?.trim()
  const sub_categoria = (formData.get('sub_categoria') as string)?.trim() || null

  if (!fecha || !sociedad || !netoStr || !tipo || !categoria) {
    return { success: false, message: 'Fecha, Sociedad, Neto, Tipo y Categoría son requeridos.' }
  }

  const neto = parseNum(netoStr)
  if (neto === null) return { success: false, message: 'Neto inválido.' }
  if (!['TG', 'CDS', 'VA'].includes(sociedad)) return { success: false, message: 'Sociedad inválida.' }

  const adminClient = createAdminClient()

  // Validar contra catálogo
  const valid = await validateCatalog(adminClient, tipo, categoria, sub_categoria)
  if (!valid) {
    return { success: false, message: `La combinación Tipo="${tipo}", Categoría="${categoria}", Sub-Categoría="${sub_categoria ?? 'ninguna'}" no existe en el catálogo activo.` }
  }

  const row: Record<string, unknown> = {
    fecha, sociedad, neto, tipo, categoria, sub_categoria,
    razon_social:         formData.get('razon_social') || null,
    cuit:                 formData.get('cuit') || null,
    provincia:            formData.get('provincia') || null,
    ciudad:               formData.get('ciudad') || null,
    condicion_iva:        formData.get('condicion_iva') || null,
    nro_factura:          formData.get('nro_factura') || null,
    observaciones:        formData.get('observaciones') || null,
    importe_neto_gravado: parseNum(formData.get('importe_neto_gravado') as string),
    importe_no_grav:      parseNum(formData.get('importe_no_grav') as string),
    iva2:                 parseNum(formData.get('iva2') as string),
    iva5:                 parseNum(formData.get('iva5') as string),
    iva10:                parseNum(formData.get('iva10') as string),
    iva21:                parseNum(formData.get('iva21') as string),
    iva27:                parseNum(formData.get('iva27') as string),
    iibb:                 parseNum(formData.get('iibb') as string),
    percepcion_iva:       parseNum(formData.get('percepcion_iva') as string),
    otros_impuestos:      parseNum(formData.get('otros_impuestos') as string),
    total_iva:            parseNum(formData.get('total_iva') as string),
    total_facturado:      parseNum(formData.get('total_facturado') as string),
  }

  const { error } = await adminClient.from('real_transactions').insert(row)
  if (error) return { success: false, message: 'Error guardando: ' + error.message }

  revalidatePath('/dashboard')
  return { success: true, message: 'Transacción guardada correctamente.' }
}

export async function uploadTransactionsCSV(formData: FormData): Promise<{
  success: boolean
  message: string
  inserted?: number
  errors?: number
  errorRows?: string[]
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const file = formData.get('csv') as File | null
  if (!file || file.size === 0) return { success: false, message: 'No se seleccionó archivo.' }
  if (file.size > 2 * 1024 * 1024) return { success: false, message: 'El archivo supera 2 MB.' }

  const content = await file.text()
  const rows = parseCSV(content)
  if (rows.length < 2) return { success: false, message: 'El CSV parece vacío o mal formateado.' }

  // Columnas esperadas (en orden)
  const headers = rows[0].map(h => h.toLowerCase().trim())
  const col = (name: string) => headers.indexOf(name)

  const REQ_COLS = ['fecha', 'sociedad', 'neto', 'tipo', 'categoria']
  const missing = REQ_COLS.filter(c => col(c) < 0)
  if (missing.length > 0) {
    return { success: false, message: `Columnas requeridas faltantes: ${missing.join(', ')}` }
  }

  const adminClient = createAdminClient()

  // Cargar catálogo activo para validación
  const { data: catalog } = await adminClient
    .from('catalog_items')
    .select('tipo, categoria, sub_categoria')
    .eq('active', true)

  const catalogSet = new Set(
    (catalog ?? []).map((c: any) => `${c.tipo}|${c.categoria}|${c.sub_categoria ?? ''}`)
  )

  // Validar todas las filas primero
  const errorRows: string[] = []
  const dataRows = rows.slice(1).filter(r => r.some(c => c))

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const tipo         = row[col('tipo')]?.trim()
    const categoria    = row[col('categoria')]?.trim()
    const sub_cat      = row[col('sub_categoria')]?.trim() || ''
    const sociedad     = row[col('sociedad')]?.trim()

    if (!tipo || !categoria || !sociedad) {
      errorRows.push(`Fila ${i + 2}: tipo, categoria o sociedad vacíos`)
      continue
    }
    if (!['TG', 'CDS', 'VA'].includes(sociedad)) {
      errorRows.push(`Fila ${i + 2}: sociedad "${sociedad}" inválida`)
      continue
    }
    const key = `${tipo}|${categoria}|${sub_cat}`
    if (!catalogSet.has(key)) {
      errorRows.push(`Fila ${i + 2}: clasificación "${tipo} / ${categoria} / ${sub_cat || 'sin sub-cat'}" no en catálogo`)
    }
  }

  if (errorRows.length > 0) {
    return {
      success: false,
      message: `Archivo rechazado: ${errorRows.length} fila(s) con errores. Corregí el CSV y volvé a subir.`,
      errorRows,
    }
  }

  // Insertar en lotes
  const toInsert = dataRows.map(row => ({
    fecha:                row[col('fecha')]?.trim(),
    sociedad:             row[col('sociedad')]?.trim(),
    neto:                 parseNum(row[col('neto')]),
    tipo:                 row[col('tipo')]?.trim(),
    categoria:            row[col('categoria')]?.trim(),
    sub_categoria:        row[col('sub_categoria')]?.trim() || null,
    razon_social:         row[col('razon_social')]?.trim() || null,
    cuit:                 row[col('cuit')]?.trim() || null,
    nro_factura:          row[col('nro_factura')]?.trim() || null,
    importe_neto_gravado: parseNum(row[col('importe_neto_gravado')]),
    importe_no_grav:      parseNum(row[col('importe_no_grav')]),
    iva21:                parseNum(row[col('iva21')]),
    total_iva:            parseNum(row[col('total_iva')]),
    total_facturado:      parseNum(row[col('total_facturado')]),
    observaciones:        row[col('observaciones')]?.trim() || null,
  }))

  const BATCH = 100
  let inserted = 0, errors = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await adminClient
      .from('real_transactions')
      .insert(toInsert.slice(i, i + BATCH))
    if (error) errors += Math.min(BATCH, toInsert.length - i)
    else inserted += Math.min(BATCH, toInsert.length - i)
  }

  if (inserted > 0) revalidatePath('/dashboard')

  return {
    success: errors === 0,
    message: errors === 0
      ? `Carga exitosa: ${inserted} transacciones importadas.`
      : `Carga parcial: ${inserted} ok, ${errors} con errores.`,
    inserted,
    errors,
  }
}

// ── PLANNING ENTRIES ──────────────────────────────────────────────────────────

export async function savePlanningEntry(formData: FormData): Promise<{
  success: boolean
  message: string
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const entry_type   = formData.get('entry_type') as string
  const year         = parseInt(formData.get('year') as string)
  const month        = parseInt(formData.get('month') as string)
  const sociedad     = formData.get('sociedad') as string
  const tipo         = (formData.get('tipo') as string)?.trim()
  const categoria    = (formData.get('categoria') as string)?.trim()
  const sub_categoria = (formData.get('sub_categoria') as string)?.trim() || null
  const montoStr     = formData.get('monto') as string

  if (!entry_type || isNaN(year) || isNaN(month) || !sociedad || !tipo || !categoria) {
    return { success: false, message: 'Todos los campos obligatorios son requeridos.' }
  }
  if (!['Presupuesto', 'LE'].includes(entry_type)) return { success: false, message: 'Tipo de plan inválido.' }
  if (!['TG', 'CDS', 'VA'].includes(sociedad)) return { success: false, message: 'Sociedad inválida.' }
  if (month < 1 || month > 12) return { success: false, message: 'Mes inválido.' }

  const monto = parseNum(montoStr)

  const adminClient = createAdminClient()

  const valid = await validateCatalog(adminClient, tipo, categoria, sub_categoria)
  if (!valid) {
    return { success: false, message: `La combinación Tipo="${tipo}", Categoría="${categoria}" no existe en el catálogo activo.` }
  }

  const { error } = await adminClient
    .from('planning_entries')
    .upsert(
      { entry_type, year, month, sociedad, tipo, categoria, sub_categoria, monto },
      { onConflict: 'year,month,sociedad,entry_type,categoria,sub_categoria' }
    )

  if (error) return { success: false, message: 'Error guardando: ' + error.message }

  revalidatePath('/dashboard')
  return { success: true, message: 'Entrada guardada correctamente.' }
}

export async function uploadPlanningCSV(formData: FormData): Promise<{
  success: boolean
  message: string
  inserted?: number
  errors?: number
  errorRows?: string[]
}> {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { success: false, message: e.message }
  }

  const file = formData.get('csv') as File | null
  if (!file || file.size === 0) return { success: false, message: 'No se seleccionó archivo.' }
  if (file.size > 2 * 1024 * 1024) return { success: false, message: 'El archivo supera 2 MB.' }

  const content = await file.text()
  const rows = parseCSV(content)
  if (rows.length < 2) return { success: false, message: 'El CSV parece vacío o mal formateado.' }

  const headers = rows[0].map(h => h.toLowerCase().trim())
  const col = (name: string) => headers.indexOf(name)

  const REQ_COLS = ['entry_type', 'year', 'month', 'sociedad', 'tipo', 'categoria', 'monto']
  const missing = REQ_COLS.filter(c => col(c) < 0)
  if (missing.length > 0) {
    return { success: false, message: `Columnas requeridas faltantes: ${missing.join(', ')}` }
  }

  const adminClient = createAdminClient()

  const { data: catalog } = await adminClient
    .from('catalog_items')
    .select('tipo, categoria, sub_categoria')
    .eq('active', true)

  const catalogSet = new Set(
    (catalog ?? []).map((c: any) => `${c.tipo}|${c.categoria}|${c.sub_categoria ?? ''}`)
  )

  const errorRows: string[] = []
  const dataRows = rows.slice(1).filter(r => r.some(c => c))

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const entry_type = row[col('entry_type')]?.trim()
    const sociedad   = row[col('sociedad')]?.trim()
    const tipo       = row[col('tipo')]?.trim()
    const categoria  = row[col('categoria')]?.trim()
    const sub_cat    = row[col('sub_categoria')]?.trim() || ''
    const year       = parseInt(row[col('year')])
    const month      = parseInt(row[col('month')])

    if (!['Presupuesto', 'LE'].includes(entry_type ?? '')) {
      errorRows.push(`Fila ${i + 2}: entry_type "${entry_type}" inválido (debe ser Presupuesto o LE)`)
      continue
    }
    if (!['TG', 'CDS', 'VA'].includes(sociedad ?? '')) {
      errorRows.push(`Fila ${i + 2}: sociedad "${sociedad}" inválida`)
      continue
    }
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      errorRows.push(`Fila ${i + 2}: year/month inválidos`)
      continue
    }
    const key = `${tipo}|${categoria}|${sub_cat}`
    if (!catalogSet.has(key)) {
      errorRows.push(`Fila ${i + 2}: clasificación "${tipo} / ${categoria} / ${sub_cat || 'sin sub-cat'}" no en catálogo`)
    }
  }

  if (errorRows.length > 0) {
    return {
      success: false,
      message: `Archivo rechazado: ${errorRows.length} fila(s) con errores.`,
      errorRows,
    }
  }

  const toUpsert = dataRows.map(row => ({
    entry_type:   row[col('entry_type')]?.trim(),
    year:         parseInt(row[col('year')]),
    month:        parseInt(row[col('month')]),
    sociedad:     row[col('sociedad')]?.trim(),
    tipo:         row[col('tipo')]?.trim(),
    categoria:    row[col('categoria')]?.trim(),
    sub_categoria: row[col('sub_categoria')]?.trim() || null,
    monto:        parseNum(row[col('monto')]),
  }))

  const BATCH = 100
  let inserted = 0, errors = 0
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const { error } = await adminClient
      .from('planning_entries')
      .upsert(
        toUpsert.slice(i, i + BATCH),
        { onConflict: 'year,month,sociedad,entry_type,categoria,sub_categoria' }
      )
    if (error) errors += Math.min(BATCH, toUpsert.length - i)
    else inserted += Math.min(BATCH, toUpsert.length - i)
  }

  if (inserted > 0) revalidatePath('/dashboard')

  return {
    success: errors === 0,
    message: errors === 0
      ? `Carga exitosa: ${inserted} entradas importadas (upsert — existentes actualizadas).`
      : `Carga parcial: ${inserted} ok, ${errors} con errores.`,
    inserted,
    errors,
  }
}

// ── Sociedades ────────────────────────────────────────────────────────────────

export async function saveSociedad(formData: FormData): Promise<{ success: boolean; message: string }> {
  await assertAdmin()

  const codigo = (formData.get('codigo') as string | null)?.trim().toUpperCase()
  const nombre = (formData.get('nombre') as string | null)?.trim()

  if (!codigo || !nombre) return { success: false, message: 'Código y nombre son requeridos' }
  if (!/^[A-Z0-9]{1,10}$/.test(codigo)) return { success: false, message: 'Código: solo letras/números, máx 10 caracteres' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('sociedades')
    .insert({ codigo, nombre })

  if (error) {
    if (error.code === '23505') return { success: false, message: `Ya existe una sociedad con código "${codigo}"` }
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/sociedades')
  return { success: true, message: `Sociedad "${codigo}" creada` }
}

export async function toggleSociedadActive(formData: FormData): Promise<{ success: boolean; message: string }> {
  await assertAdmin()

  const id     = formData.get('id') as string | null
  const active = formData.get('active') === 'true'

  if (!id) return { success: false, message: 'ID requerido' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('sociedades')
    .update({ active })
    .eq('id', id)

  if (error) return { success: false, message: error.message }

  revalidatePath('/admin/sociedades')
  revalidatePath('/dashboard')
  return { success: true, message: `Sociedad ${active ? 'activada' : 'desactivada'}` }
}
