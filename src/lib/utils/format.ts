// Utilidades de formato — migradas desde pl-dashboard.html

/**
 * Formato compacto: $1.2M, $500K, $1.5B
 */
export function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
}

/**
 * Formato completo con separadores de miles: $1.234.567
 */
export function fmtFull(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return '$' + Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

/**
 * Porcentaje: val / base × 100, con 1 decimal
 */
export function pct(val: number | null, base: number | null): string {
  if (!base || base === 0 || val === null || val === undefined) return '—'
  return (val / base * 100).toFixed(1) + '%'
}

/**
 * Delta porcentual entre a y b: (a - b) / |b| × 100
 * Retorna null si b es 0 o null.
 */
export function delta(a: number | null, b: number | null): number | null {
  if (b === null || b === undefined || b === 0) return null
  if (a === null || a === undefined) return null
  return (a - b) / Math.abs(b) * 100
}

/**
 * Sumar un array de valores mensuales para los índices dados.
 * Retorna null si no hay ningún valor no-null en esos índices.
 */
export function sumMonths(values: (number | null)[], monthIndexes: number[]): number | null {
  let total = 0
  let hasData = false
  for (const m of monthIndexes) {
    const v = values[m]
    if (v !== null && v !== undefined) {
      total += v
      hasData = true
    }
  }
  return hasData ? total : null
}
