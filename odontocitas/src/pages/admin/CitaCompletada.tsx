import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Download, Plus } from 'lucide-react'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import { facturacionAPI, type Factura } from '../../api/facturacion'
import { pacientesAPI, type HistoriaEntry } from '../../api/pacientes'
import { exportarPDF } from '../../utils/pdf'

function getInitials(nombre: string) {
  return nombre.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()
}

function formatDate(fechaHora: string) {
  const date = new Date(fechaHora)
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatTime(fechaHora: string) {
  const date = new Date(fechaHora)
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
}

export default function CitaCompletada() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [agendando, setAgendando] = useState(false)
  const { data: cita, loading, error } = useAsync<Cita>(() => {
    if (!id) return Promise.reject(new Error('ID de cita inválido'))
    return citasAPI.obtener(id)
  }, [id])
  const { data: historia } = useAsync<HistoriaEntry[]>(
    () => cita?.paciente_id ? pacientesAPI.historia(cita.paciente_id) : Promise.resolve([]),
    [cita?.paciente_id]
  )
  const { data: facturas } = useAsync<Factura[]>(
    () => id ? facturacionAPI.listar({ cita_id: id }) : Promise.resolve([]),
    [id]
  )

  const pacienteNombre = cita?.paciente_nombre ?? 'Paciente'
  const odontologo = cita?.odontologo_nombre ?? 'Odontólogo'
  const tratamiento = cita?.tratamiento_nombre ?? 'Tratamiento'
  const iniciales = useMemo(() => getInitials(pacienteNombre), [pacienteNombre])
  const fechaHora = cita?.fecha_hora ?? new Date().toISOString()
  const registro = useMemo(
    () => (historia ?? []).find(h => h.cita_id === cita?.id) ?? (historia ?? [])[0],
    [historia, cita?.id]
  )
  const factura = facturas?.[0]
  const fechaSeguimiento = useMemo(() => {
    const d = new Date(fechaHora)
    d.setMonth(d.getMonth() + 3)
    return d
  }, [fechaHora])

  const formatMonto = (n: number | string) => `$${Number(n).toLocaleString('es-CO')}`

  const agendarSeguimiento = async () => {
    if (!cita) return
    if (!cita.tratamiento_id) {
      setFeedback({ type: 'error', message: 'La cita no tiene tratamiento asociado para crear seguimiento.' })
      return
    }
    setAgendando(true)
    setFeedback(null)
    try {
      await citasAPI.crear({
        paciente_id: cita.paciente_id,
        odontologo_id: cita.odontologo_id,
        tratamiento_id: cita.tratamiento_id,
        fecha_hora: fechaSeguimiento.toISOString(),
        motivo: `Seguimiento de ${tratamiento}`,
        duracion_minutos: cita.duracion_minutos ?? 45,
      })
      setFeedback({ type: 'success', message: `Seguimiento creado para ${formatDate(fechaSeguimiento.toISOString())}.` })
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo agendar el seguimiento.' })
    } finally {
      setAgendando(false)
    }
  }

  const exportar = async () => {
    if (!cita) return
    await exportarPDF({
      titulo: 'Resumen de cita completada',
      subtitulo: `${pacienteNombre} · ${formatDate(fechaHora)}`,
      archivo: `cita-${cita.id.slice(0, 8)}.pdf`,
      notaLegal: 'Comprobante de atención clínica. Información confidencial protegida por Habeas Data (Ley 1581 de 2012).',
      bloques: [
        {
          tipo: 'kv',
          titulo: 'Detalle de la atención',
          filas: [
            ['Paciente', pacienteNombre],
            ['Cédula', cita.paciente_cedula ?? '—'],
            ['Odontólogo', odontologo],
            ['Tratamiento', tratamiento],
            ['Fecha', formatDate(fechaHora)],
            ['Hora', formatTime(fechaHora)],
            ['Duración', `${cita.duracion_minutos ?? 45} minutos`],
            ['Estado', cita.estado ?? 'completada'],
            ['Materiales', registro?.materiales_usados || 'No registrados'],
            ['Notas', registro?.notas || cita.notas_clinicas || 'No registradas'],
          ],
        },
      ],
    })
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#8B7355]">Cargando cita...</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Error cargando la cita: {error}</div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#3D2B1F]">Resumen de cita completada</h1>
        <div className="flex gap-2">
          <button onClick={exportar} className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            <Download size={14} /> Exportar PDF
          </button>
          <button onClick={agendarSeguimiento} disabled={agendando || !cita} className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={14} /> {agendando ? 'Agendando...' : 'Agendar seguimiento'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {feedback.message}
        </div>
      )}

      {/* Status banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <div>
            <div className="font-semibold text-green-800">Cita completada exitosamente</div>
            <div className="text-sm text-green-600">{formatDate(fechaHora)} · {formatTime(fechaHora)} · {odontologo}</div>
          </div>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Realizada</span>
      </div>

      <div className="flex gap-6">
        {/* Left */}
        <div className="flex-1 space-y-4">
          {/* Paciente */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Paciente atendido</h2>
            <div className="flex items-center gap-3">
                  <Avatar initials={iniciales} size="lg" />
              <div className="flex-1">
                    <div className="font-semibold text-[#3D2B1F] text-lg">{pacienteNombre}</div>
                <div className="text-sm text-[#8B7355]">{cita?.paciente_cedula ?? 'CC no disponible'} · {cita?.duracion_minutos ?? 45} min</div>
              </div>
              <button onClick={() => cita?.paciente_id && navigate(`/admin/pacientes/${cita.paciente_id}/historia`)}
                className="border border-[#D4C4B0] text-[#8B7355] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5EFE6]">
                Ver historia clínica
              </button>
            </div>
          </div>

          {/* Tratamiento */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Tratamiento realizado</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Procedimiento</div>
                    <div className="font-medium text-[#3D2B1F]">{tratamiento}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Duración real</div>
                <div className="font-medium text-[#3D2B1F]">{registro?.duracion_real ?? cita?.duracion_minutos ?? 45} minutos</div>
              </div>
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Odontólogo</div>
                <div className="font-medium text-[#3D2B1F]">{odontologo}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Materiales usados</div>
                <div className="font-medium text-[#3D2B1F]">{registro?.materiales_usados || 'No registrados'}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#8B7355] mb-1">Notas clínicas</div>
              <p className="text-sm text-[#3D2B1F] bg-[#F5EFE6] rounded-lg p-3">
                {registro?.notas || cita?.notas_clinicas || 'No hay notas clínicas registradas para esta cita.'}
              </p>
            </div>
          </div>

          {/* Hallazgos */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Hallazgos y recomendaciones</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-medium text-[#8B7355] mb-2">Hallazgos</div>
                <p className="text-sm text-[#3D2B1F] bg-[#F5EFE6] rounded-lg p-3 min-h-20">
                  {registro?.hallazgos || 'Sin hallazgos registrados.'}
                </p>
              </div>
              <div>
                <div className="text-xs font-medium text-[#8B7355] mb-2">Recomendaciones</div>
                <p className="text-sm text-[#3D2B1F] bg-[#F5EFE6] rounded-lg p-3 min-h-20">
                  {registro?.recomendaciones || 'Sin recomendaciones registradas.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="w-64 space-y-4">
          {/* Factura */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Factura generada</h2>
            {factura ? (
              <>
                <div className="text-center mb-4">
                  <div className="text-xs text-[#C17A5A] mb-1">{factura.numero}</div>
                  <div className="text-3xl font-bold text-[#3D2B1F]">{formatMonto(factura.total)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${factura.estado === 'pagada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {factura.estado}
                  </span>
                </div>
                <div className="border-t border-[#EDE0D4] pt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8B7355]">{factura.tratamiento_nombre || tratamiento}</span>
                    <span className="font-medium">{formatMonto(factura.subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatMonto(factura.total)}</span>
                  </div>
                  {factura.cufe && <div className="pt-2 text-[10px] text-[#8B7355] break-all">CUFE interno: {factura.cufe}</div>}
                </div>
                <button onClick={() => navigate('/admin/facturacion')}
                  className="w-full mt-3 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-xs hover:bg-[#F5EFE6]">
                  Ver factura completa
                </button>
              </>
            ) : (
              <div className="rounded-lg bg-[#F5EFE6] p-4 text-center text-sm text-[#8B7355]">
                Aún no hay factura asociada a esta cita.
              </div>
            )}
          </div>

          {/* Próximo seguimiento */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-3">Próximo seguimiento</h2>
            <p className="text-xs text-[#8B7355] mb-3">Se recomienda agendar control en:</p>
            <div className="text-center mb-3">
              <div className="text-4xl font-bold text-[#C17A5A]">3</div>
              <div className="text-sm font-medium text-[#3D2B1F]">meses</div>
              <div className="text-xs text-[#8B7355] italic">Aproximadamente: {formatDate(fechaSeguimiento.toISOString())}</div>
            </div>
            <button onClick={agendarSeguimiento} disabled={agendando || !cita} className="w-full bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              {agendando ? 'Agendando...' : '+ Agendar seguimiento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
