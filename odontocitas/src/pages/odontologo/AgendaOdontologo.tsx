import { CheckCircle, Clock, AlertCircle, Save, Check, CheckCheck, X } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'

function formatDate(date: Date) {
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' })
}

// Las citas se almacenan como hora de pared en UTC, por lo que el rango del
// día/semana también se calcula en UTC para que coincida con lo mostrado.
function buildDateRange(selectedDate: string, viewMode: 'day' | 'week') {
  const [y, m, d] = selectedDate.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const end = new Date(start)

  if (viewMode === 'week') {
    const day = start.getUTCDay()
    const diffToMonday = (day + 6) % 7
    start.setUTCDate(start.getUTCDate() - diffToMonday)
    end.setUTCDate(start.getUTCDate() + 6)
  }
  end.setUTCHours(23, 59, 59, 999)

  return {
    fecha_desde: start.toISOString(),
    fecha_hasta: end.toISOString(),
    label: viewMode === 'week'
      ? `${formatDate(start)} - ${formatDate(end)}`
      : formatDate(start),
  }
}

export default function AgendaOdontologo() {
  const [nota, setNota] = useState('')
  const [selected, setSelected] = useState(0)
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = buildDateRange(selectedDate, mode)
  const { data: citas, loading, refetch: refetchCitas } = useAsync<Cita[]>(
    () => citasAPI.listar({ fecha_desde: range.fecha_desde, fecha_hasta: range.fecha_hasta }),
    [range.fecha_desde, range.fecha_hasta]
  )

  // Todas las citas confirmadas del odontólogo de hoy en adelante, sin depender
  // del día seleccionado, para que siempre sean visibles al aceptarlas el admin.
  const inicioHoy = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])
  const { data: proximasConfirmadas, refetch: refetchProximas } = useAsync<Cita[]>(
    () => citasAPI.listar({ estado: 'confirmada', fecha_desde: inicioHoy }),
    [inicioHoy]
  )
  const proximasOrdenadas = useMemo(
    () => [...(proximasConfirmadas ?? [])].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()),
    [proximasConfirmadas]
  )

  const irACita = (c: Cita) => {
    setMode('day')
    setSelectedDate(new Date(c.fecha_hora).toLocaleDateString('en-CA', { timeZone: 'UTC' }))
  }

  const citasOrdenadas = useMemo(() => {
    if (!citas) return []
    return [...citas].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  }, [citas])

  const navigate = useNavigate()
  const cita = citasOrdenadas[selected]
  const total = citasOrdenadas.length
  const confirmadas = useMemo(() => citasOrdenadas.filter(c => c.estado === 'confirmada').length, [citasOrdenadas])
  const pendientes = useMemo(() => citasOrdenadas.filter(c => c.estado !== 'confirmada' && c.estado !== 'cancelada').length, [citasOrdenadas])

  useEffect(() => {
    setSelected(0)
  }, [range.fecha_desde, range.fecha_hasta])

  useEffect(() => {
    setNota(cita?.notas_clinicas ?? '')
    setStatus(null)
    setAutoSaveStatus('idle')
  }, [cita])

  const hasChanges = cita ? cita.notas_clinicas !== nota : false

  // Autosave con debounce
  useEffect(() => {
    if (!cita || !hasChanges) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    setAutoSaveStatus('saving')

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await citasAPI.actualizar(cita.id, { notas_clinicas: nota })
        setAutoSaveStatus('saved')
        // Limpiar el indicador después de 2 segundos
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (err) {
        setAutoSaveStatus('idle')
        setStatus({ type: 'error', message: 'Error al guardar automáticamente' })
      }
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [nota, cita])

  const handleSave = async () => {
    if (!cita) return
    setSaving(true)
    try {
      setStatus(null)
      await citasAPI.actualizar(cita.id, { notas_clinicas: nota })
      setStatus({ type: 'success', message: 'Nota clínica guardada correctamente.' })
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message || 'Error al guardar la nota.' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangeStatus = async (newStatus: 'completada' | 'cancelada') => {
    if (!cita) return
    try {
      setStatus(null)
      await citasAPI.actualizar(cita.id, { estado: newStatus })
      setStatus({ 
        type: 'success', 
        message: newStatus === 'completada' ? 'Cita marcada como completada.' : 'Cita cancelada.' 
      })
      // Refrescar datos sin recargar toda la página (conserva la fecha seleccionada)
      refetchCitas()
      refetchProximas()
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message || `Error al ${newStatus === 'completada' ? 'completar' : 'cancelar'} la cita.` })
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Agenda de {mode === 'day' ? 'día' : 'semana'}</h1>
          <p className="text-sm text-[#8B7355] mt-0.5">Tienes {total} cita{total === 1 ? '' : 's'} programada{total === 1 ? '' : 's'} para {mode === 'day' ? 'el día' : 'la semana'}.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#8B7355] uppercase tracking-[.18em]">Fecha</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="border border-[#D4C4B0] rounded-lg bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A]" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMode('day')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'day' ? 'bg-[#C17A5A] text-white' : 'bg-white text-[#3D2B1F] border border-[#D4C4B0] hover:bg-[#F5EFE6]'}`}>
              Día
            </button>
            <button onClick={() => setMode('week')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'week' ? 'bg-[#C17A5A] text-white' : 'bg-white text-[#3D2B1F] border border-[#D4C4B0] hover:bg-[#F5EFE6]'}`}>
              Semana
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <span className="text-sm text-[#8B7355]">Periodo: {range.label}</span>
      </div>

      <div className="flex gap-4 mb-6">
        {[
          { icon: <Clock size={16} />, value: total, label: mode === 'day' ? 'Citas hoy' : 'Citas semana' },
          { icon: <CheckCircle size={16} />, value: confirmadas, label: 'Confirmadas' },
          { icon: <AlertCircle size={16} />, value: pendientes, label: 'Pendientes' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F5EFE6] rounded-lg flex items-center justify-center text-[#C17A5A]">{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-[#3D2B1F]">{s.value}</div>
              <div className="text-xs text-[#8B7355]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDE0D4] flex items-center justify-between">
            <span className="font-semibold text-[#3D2B1F]">Agenda {mode === 'day' ? 'del día' : 'de la semana'}</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#8B7355]">Cargando citas...</div>
          ) : citasOrdenadas.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#8B7355]">No hay citas para este periodo.</div>
          ) : (
            <div className="divide-y divide-[#F5EFE6]">
              {citasOrdenadas.map((c, i) => (
                <div key={c.id} onClick={() => setSelected(i)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selected === i ? 'bg-[#F5EFE6]' : 'hover:bg-[#FDFAF7]'}`}>
                  <div className="text-center w-12 flex-shrink-0">
                    <div className="text-sm font-bold text-[#3D2B1F]">{new Date(c.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</div>
                  </div>
                  <Avatar initials={c.paciente_nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[#3D2B1F]">{c.paciente_nombre}</div>
                    <div className="text-xs text-[#8B7355]">{c.tratamiento_nombre} · {c.duracion_minutos} min</div>
                    <div className="text-[10px] text-[#8B7355]">{c.paciente_cedula}</div>
                  </div>
                  <Badge estado={c.estado} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-72 space-y-4">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#3D2B1F]">Próximas citas confirmadas</h3>
              <span className="text-xs font-semibold text-[#C17A5A]">{proximasOrdenadas.length}</span>
            </div>
            {proximasOrdenadas.length === 0 ? (
              <div className="text-xs text-[#8B7355]">No tienes citas confirmadas próximas.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto">
                {proximasOrdenadas.map(c => (
                  <button key={c.id} type="button" onClick={() => irACita(c)}
                    className="w-full text-left rounded-lg border border-[#EDE0D4] hover:border-[#C17A5A] px-3 py-2 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#3D2B1F]">
                        {new Date(c.fecha_hora).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}
                      </span>
                      <span className="text-xs text-[#8B7355]">
                        {new Date(c.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                      </span>
                    </div>
                    <div className="text-xs text-[#3D2B1F] truncate">{c.paciente_nombre}</div>
                    <div className="text-[10px] text-[#8B7355] truncate">{c.tratamiento_nombre}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Detalle de la cita</h3>
            {cita ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar initials={cita.paciente_nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()} size="md" />
                  <div>
                    <div className="font-semibold text-sm text-[#3D2B1F]">{cita.paciente_nombre}</div>
                    <div className="text-xs text-[#8B7355]">{cita.paciente_cedula}</div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-xs font-medium text-[#8B7355] mb-1">Observaciones de la cita</div>
                  <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
                    placeholder="Escribe aquí los hallazgos, recomendaciones o notas clínicas..."
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-xs text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white resize-none" />
                </div>
                <div className="rounded-2xl bg-[#FBF7F2] p-3 text-[11px] text-[#8B7355] mb-3">
                  <div className="font-semibold text-[#3D2B1F] mb-2">Flujo rápido</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Selecciona una cita en la agenda.</li>
                    <li>Edita la nota clínica en el panel.</li>
                    <li>Presiona <span className="font-semibold text-[#3D2B1F]">Guardar nota</span>.</li>
                    <li>Haz clic en <span className="font-semibold text-[#3D2B1F]">Ver detalles</span>.</li>
                    <li>Abre el historial del paciente desde el detalle.</li>
                  </ol>
                </div>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <button type="button" onClick={handleSave}
                    disabled={!cita || !hasChanges || saving}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${cita && hasChanges && !saving ? 'bg-[#C17A5A] hover:bg-[#A0623F] text-white' : 'bg-[#E9E1D5] text-[#8B7355] cursor-not-allowed'}`}>
                    <Save size={12} /> Guardar nota
                  </button>
                  <button type="button" onClick={() => cita && navigate(`/odontologo/citas/${cita.id}`)}
                    className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-xs hover:bg-[#F5EFE6]">
                    Ver detalles
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {cita?.estado === 'confirmada' && (
                    <>
                      <button type="button" onClick={() => handleChangeStatus('completada')}
                        className="flex items-center justify-center gap-1 rounded-lg bg-green-100 hover:bg-green-200 py-1.5 text-xs font-medium text-green-700 transition-colors">
                        <CheckCheck size={12} /> Completar
                      </button>
                      <button type="button" onClick={() => handleChangeStatus('cancelada')}
                        className="flex items-center justify-center gap-1 rounded-lg bg-red-100 hover:bg-red-200 py-1.5 text-xs font-medium text-red-700 transition-colors">
                        <X size={12} /> Cancelar
                      </button>
                    </>
                  )}
                </div>
                {autoSaveStatus === 'saving' && (
                  <div className="mt-2 rounded-2xl bg-blue-50 p-2.5 text-xs text-blue-700 border border-blue-100 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                    Guardando automáticamente...
                  </div>
                )}
                {autoSaveStatus === 'saved' && (
                  <div className="mt-2 rounded-2xl bg-green-50 p-2.5 text-xs text-green-700 border border-green-100 flex items-center gap-2">
                    <Check size={12} />
                    Guardado automáticamente
                  </div>
                )}
                {status && (
                  <div className={`mt-3 rounded-2xl p-3 text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {status.message}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-[#8B7355]">Selecciona una cita para ver los detalles.</div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Información básica</h3>
            <div className="text-sm text-[#8B7355] space-y-2">
              <div className="flex justify-between">
                <span>Citas confirmadas</span>
                <span className="font-semibold text-[#3D2B1F]">{confirmadas}</span>
              </div>
              <div className="flex justify-between">
                <span>En espera</span>
                <span className="font-semibold text-[#3D2B1F]">{pendientes}</span>
              </div>
              <div className="flex justify-between">
                <span>Duración estándar</span>
                <span className="font-semibold text-[#3D2B1F]">45 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
