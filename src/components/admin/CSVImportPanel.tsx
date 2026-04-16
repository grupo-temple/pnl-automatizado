'use client'

import { useState, useTransition, useRef } from 'react'
import type { Fuente, ParsedRow, ParseResult } from '@/app/admin/importar/actions'
import { parseTempleCSV, importConfirm } from '@/app/admin/importar/actions'

const FUENTES: { value: Fuente; label: string }[] = [
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'egresos',  label: 'Egresos'  },
  { value: 'sueldos',  label: 'Sueldos'  },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function CSVImportPanel() {
  const [isParsing,    startParse]  = useTransition()
  const [isImporting,  startImport] = useTransition()

  const [fuente,  setFuente]  = useState<Fuente>('ingresos')
  const [result,  setResult]  = useState<ParseResult | null>(null)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setResult(null)
    setMsg(null)
    startParse(async () => {
      try {
        const res = await parseTempleCSV(fd)
        setResult(res)
      } catch (err: any) {
        setMsg({ text: err.message ?? 'Error al parsear el archivo', ok: false })
      }
    })
  }

  function handleImport() {
    if (!result?.valid.length) return
    setMsg(null)
    startImport(async () => {
      try {
        const { inserted } = await importConfirm(result.valid, fuente)
        setMsg({ text: `Importación exitosa: ${inserted} transacciones cargadas`, ok: true })
        setResult(null)
        if (fileRef.current) fileRef.current.value = ''
      } catch (err: any) {
        setMsg({ text: err.message ?? 'Error al importar', ok: false })
      }
    })
  }

  return (
    <div>
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.ok ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Step 1: select fuente + file */}
      <form onSubmit={handleFile}>
        <input type="hidden" name="fuente" value={fuente} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Tipo de archivo
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {FUENTES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  className="btn-sm"
                  style={{
                    background: fuente === f.value ? 'var(--accent)' : undefined,
                    color:      fuente === f.value ? '#fff' : undefined,
                    fontWeight: fuente === f.value ? 700 : 400,
                  }}
                  onClick={() => { setFuente(f.value); setResult(null); setMsg(null) }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Archivo CSV
            </label>
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".csv,.txt"
              required
              className="form-input"
              style={{ padding: '6px 10px', cursor: 'pointer' }}
            />
          </div>

          <button
            type="submit"
            className="btn-sm"
            disabled={isParsing}
            style={{ background: 'var(--accent)', color: '#fff', height: 38, whiteSpace: 'nowrap' }}
          >
            {isParsing ? 'Procesando…' : 'Analizar archivo'}
          </button>
        </div>
      </form>

      {/* Step 2: preview + errors */}
      {result && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Pill label="Total filas" value={result.totalRows} color="var(--text-muted)" />
            <Pill label="Válidas"     value={result.valid.length}   color="var(--success)" />
            <Pill label="Con errores" value={result.invalid.length} color={result.invalid.length ? 'var(--danger)' : 'var(--text-muted)'} />
          </div>

          {/* Preview table */}
          {result.preview.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Primeras {result.preview.length} filas válidas:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="pl-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Fecha</th>
                      <th style={{ textAlign: 'left' }}>Sociedad</th>
                      <th style={{ textAlign: 'left' }}>Tipo</th>
                      <th style={{ textAlign: 'left' }}>Categoría</th>
                      <th style={{ textAlign: 'left' }}>Sub-Categoría</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.map((row, i) => (
                      <tr key={i}>
                        <td>{row.fecha}</td>
                        <td>{row.sociedad}</td>
                        <td>{row.tipo}</td>
                        <td>{row.categoria}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{row.sub_categoria || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(row.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invalid rows */}
          {result.invalid.length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: 14, marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>
                {result.invalid.length} fila(s) con errores (no se importarán)
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {result.invalid.map(inv => (
                  <div key={inv.rowNum} style={{ fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Fila {inv.rowNum}:</span>
                    <span style={{ color: 'var(--danger)' }}>{inv.errors.join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm */}
          {result.valid.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn-sm"
                disabled={isImporting}
                onClick={handleImport}
                style={{ background: 'var(--success)', color: '#fff', fontWeight: 700 }}
              >
                {isImporting ? 'Importando…' : `Confirmar importación (${result.valid.length} filas)`}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Se reemplazarán los datos existentes para los mismos períodos y fuente
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No hay filas válidas para importar. Revisá los errores arriba.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-hover)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}
