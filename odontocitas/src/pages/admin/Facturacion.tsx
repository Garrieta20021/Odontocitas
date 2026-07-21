import { useMemo, useState } from 'react'
import { Download, Plus, TrendingUp, Clock, FileText, DollarSign, X, Check } from 'lucide-react'
import Badge from '../../components/Badge'
import { useAsync } from '../../hooks/useAsync'
import { facturacionAPI, type Factura } from '../../api/facturacion'
import { citasAPI, type Cita } from '../../api/citas'
import { exportarPDF } from '../../utils/pdf'

type Filtro = 'Todas' | 'Pagadas' | 'Pendientes' | 'Vencidas'

const estadoMap: Record<Filtro, string | undefined> = {
  Todas: undefined, Pagadas: 'pagada', Pendientes: 'pendiente', Vencidas: 'vencida',
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatMonto(n: number) { return `$${Number(n).toLocaleString('es-CO')}` }
function formatFecha(f: string) {
  return new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function Facturacion() {
  const [filtro, setFiltro] = useState<Filtro>('Todas')

  const { data: facturas, loading, refetch: refetchFacturas } = useAsync(
    () => facturacionAPI.listar({ estado: estadoMap[filtro] }),
    [filtro]
  )
  const { data: resumen, refetch: refetchResumen } = useAsync(() => facturacionAPI.resumen())
  // Lista completa (sin filtro) para saber qué citas ya tienen factura.
  const { data: todasFacturas, refetch: refetchTodas } = useAsync(() => facturacionAPI.listar())
  const { data: citasCompletadas } = useAsync(() => citasAPI.listar({ estado: 'completada' }))

  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  const refrescar = () => { refetchFacturas(); refetchResumen(); refetchTodas() }

  const citasConFactura = useMemo(
    () => new Set((todasFacturas ?? []).map(f => f.cita_id).filter(Boolean) as string[]),
    [todasFacturas]
  )
  const citasFacturables = useMemo(
    () => (citasCompletadas ?? []).filter(c => !citasConFactura.has(c.id)),
    [citasCompletadas, citasConFactura]
  )

  const marcarPagada = async (f: Factura) => {
    setPagandoId(f.id)
    setFeedback(null)
    try {
      await facturacionAPI.pagar(f.id)
      setFeedback({ type: 'success', message: `Factura ${f.numero} marcada como pagada.` })
      refrescar()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'No se pudo registrar el pago.' })
    } finally {
      setPagandoId(null)
    }
  }

  const exportarPdf = async () => {
    const filas = facturas ?? []
    if (filas.length === 0) {
      setFeedback({ type: 'error', message: 'No hay facturas para exportar.' })
      return
    }
    const totalFacturado = filas.reduce((s, f) => s + Number(f.total), 0)
    const totalPagado = filas.filter(f => f.estado === 'pagada').reduce((s, f) => s + Number(f.total), 0)
    await exportarPDF({
      titulo: 'Relación de facturación',
      subtitulo: `Filtro: ${filtro} · ${filas.length} factura(s)`,
      archivo: `facturas-${new Date().toISOString().slice(0, 10)}.pdf`,
      notaLegal: 'Documento soporte de facturación. Conserve este comprobante según la normativa tributaria vigente (DIAN).',
      bloques: [
        {
          tipo: 'tabla',
          titulo: 'Facturas emitidas',
          columnas: ['N°', 'Paciente', 'Cédula', 'Tratamiento', 'Subtotal', 'Desc.', 'Total', 'Estado', 'Emisión'],
          filas: filas.map(f => [
            f.numero, f.paciente_nombre, f.paciente_cedula, f.tratamiento_nombre ?? '—',
            formatMonto(f.subtotal), formatMonto(f.descuento), formatMonto(f.total),
            capitalize(f.estado), f.fecha_emision ? formatFecha(f.fecha_emision) : '—',
          ]),
        },
        {
          tipo: 'kv',
          titulo: 'Totales',
          filas: [
            ['Facturas', String(filas.length)],
            ['Total facturado', formatMonto(totalFacturado)],
            ['Total pagado', formatMonto(totalPagado)],
            ['Pendiente', formatMonto(totalFacturado - totalPagado)],
          ],
        },
      ],
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Facturación</h1>
          <p className="text-sm text-[#8B7355] mt-0.5">Gestión de pagos y facturación electrónica</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarPdf}
            className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            <Download size={14} /> Exportar PDF
          </button>
          <button onClick={() => { setFeedback(null); setModalAbierto(true) }}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={14} /> Nueva factura
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {feedback.message}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        {[
          { icon: <TrendingUp size={16} />, value: resumen ? formatMonto(resumen.ingresos_mes) : '—', label: 'Ingresos este mes' },
          { icon: <Clock size={16} />, value: resumen ? formatMonto(resumen.pendiente_cobro) : '—', label: 'Pendiente de cobro' },
          { icon: <FileText size={16} />, value: resumen?.total_facturas ?? '—', label: 'Facturas emitidas' },
          { icon: <DollarSign size={16} />, value: resumen ? formatMonto(resumen.cartera_vencida) : '—', label: 'Cartera vencida' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4">
            <div className="w-8 h-8 bg-[#F5EFE6] rounded-lg flex items-center justify-center text-[#C17A5A] mb-3">{s.icon}</div>
            <div className="text-2xl font-bold text-[#3D2B1F]">{s.value}</div>
            <div className="text-sm text-[#8B7355]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE0D4]">
          <h2 className="font-semibold text-[#3D2B1F]">Facturas recientes</h2>
          <div className="flex gap-1">
            {(['Todas', 'Pagadas', 'Pendientes', 'Vencidas'] as Filtro[]).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filtro === f ? 'bg-[#C17A5A] text-white' : 'text-[#8B7355] hover:bg-[#F5EFE6]'
                }`}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-[#C17A5A]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <div className="divide-y divide-[#F5EFE6]">
            {(facturas ?? []).length === 0 ? (
              <div className="text-center py-12 text-[#8B7355] text-sm">No hay facturas</div>
            ) : (facturas ?? []).map(f => (
              <div key={f.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#FDFAF7] transition-colors">
                <div className="w-8 h-8 bg-[#F5EFE6] rounded-lg flex items-center justify-center text-[#C17A5A] flex-shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[#3D2B1F]">{f.paciente_nombre}</div>
                  <div className="text-xs text-[#8B7355]">{f.numero} · {f.tratamiento_nombre ?? 'Sin tratamiento'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#3D2B1F]">{formatMonto(f.total)}</div>
                  <div className="text-xs text-[#8B7355]">{formatFecha(f.fecha_emision)}</div>
                </div>
                <Badge estado={capitalize(f.estado)} />
                {f.estado !== 'pagada' ? (
                  <button
                    onClick={() => marcarPagada(f)}
                    disabled={pagandoId === f.id}
                    className="flex items-center gap-1 bg-[#5A8A6A] hover:bg-[#4A7458] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                  >
                    <Check size={12} /> {pagandoId === f.id ? 'Procesando...' : 'Marcar pagada'}
                  </button>
                ) : (
                  <span className="text-xs text-[#8B7355] w-[104px] text-center flex-shrink-0">
                    {f.fecha_pago ? `Pagada ${formatFecha(f.fecha_pago)}` : 'Pagada'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAbierto && (
        <NuevaFacturaModal
          citas={citasFacturables}
          onClose={() => setModalAbierto(false)}
          onCreated={(numero) => {
            setModalAbierto(false)
            setFeedback({ type: 'success', message: `Factura ${numero} creada.` })
            refrescar()
          }}
          onError={(message) => setFeedback({ type: 'error', message })}
        />
      )}
    </div>
  )
}

function NuevaFacturaModal({
  citas, onClose, onCreated, onError,
}: {
  citas: Cita[]
  onClose: () => void
  onCreated: (numero: string) => void
  onError: (message: string) => void
}) {
  const [citaId, setCitaId] = useState('')
  const [descuento, setDescuento] = useState(0)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cita = citas.find(c => c.id === citaId)
  const subtotal = cita ? Number(cita.tarifa) : 0
  const total = Math.max(0, subtotal - (Number(descuento) || 0))

  const submit = async () => {
    if (!cita) { onError('Selecciona una cita.'); return }
    setGuardando(true)
    try {
      const factura = await facturacionAPI.crear({
        cita_id: cita.id,
        paciente_id: cita.paciente_id,
        subtotal,
        descuento: Number(descuento) || 0,
        total,
        notas: notas || undefined,
      })
      onCreated(factura.numero)
    } catch (err: any) {
      onError(err?.message || 'No se pudo crear la factura.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#D4C4B0] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#3D2B1F]">Nueva factura</h3>
          <button onClick={onClose} className="text-[#8B7355] hover:text-[#3D2B1F]"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8B7355] mb-1 block">Cita completada (sin factura)</label>
            <select value={citaId} onChange={e => setCitaId(e.target.value)}
              className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
              <option value="">Seleccionar cita...</option>
              {citas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.paciente_nombre} · {c.tratamiento_nombre} · {formatFecha(c.fecha_hora)}
                </option>
              ))}
            </select>
            {citas.length === 0 && (
              <p className="text-xs text-[#8B7355] mt-1">No hay citas completadas pendientes de facturar.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8B7355] mb-1 block">Subtotal</label>
              <div className="border border-[#EDE0D4] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] bg-[#F9F5EE]">
                {formatMonto(subtotal)}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8B7355] mb-1 block">Descuento</label>
              <input type="number" min={0} max={subtotal} value={descuento}
                onChange={e => setDescuento(Number(e.target.value))}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A]" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[#F5EFE6] px-3 py-2">
            <span className="text-sm text-[#8B7355]">Total a facturar</span>
            <span className="text-lg font-bold text-[#3D2B1F]">{formatMonto(total)}</span>
          </div>

          <div>
            <label className="text-xs text-[#8B7355] mb-1 block">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
              Cancelar
            </button>
            <button onClick={submit} disabled={!cita || guardando}
              className="flex-1 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium">
              {guardando ? 'Creando...' : 'Crear factura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
