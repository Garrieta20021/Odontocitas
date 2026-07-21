import { ChevronLeft, ChevronRight, RefreshCw, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { odontologosAPI, type Odontologo } from '../../api/odontologos'
import { citasAPI, type Cita } from '../../api/citas'

const SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const ACTIVAS = ['pendiente', 'confirmada', 'reprogramada', 'completada']

function getInitials(nombre: string) {
  return nombre.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// Lunes (00:00 UTC) de la semana que contiene a la fecha dada.
function lunesDe(d: Date): Date {
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function horaUTC(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
}

export default function AsignacionOdontologos() {
  const navigate = useNavigate()
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [odoFiltro, setOdoFiltro] = useState('')
  const [vista, setVista] = useState<'semana' | 'dia'>('semana')
  const [diaIdx, setDiaIdx] = useState(0)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const dias = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(lunes, i)), [lunes])
  const desde = useMemo(() => lunes.toISOString(), [lunes])
  const hasta = useMemo(() => new Date(addDays(lunes, 5).getTime() + 24 * 3600 * 1000 - 1).toISOString(), [lunes])

  const { data: odontologos } = useAsync<Odontologo[]>(() => odontologosAPI.listar())
  const { data: citas, loading, error, refetch } = useAsync<Cita[]>(
    () => citasAPI.listar({
      fecha_desde: desde,
      fecha_hasta: hasta,
      odontologo_id: odoFiltro || undefined,
      limit: 500,
    }),
    [desde, hasta, odoFiltro]
  )

  // Tiempo real: refresca al enfocar la ventana y cada 30 s.
  useEffect(() => {
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(refetch, 30000)
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(id) }
  }, [refetch])

  const lista = odontologos ?? []
  const colorPorOdo = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of lista) m[o.id] = o.color
    return m
  }, [lista])

  const citasActivas = useMemo(() => (citas ?? []).filter(c => ACTIVAS.includes(c.estado)), [citas])

  // Índice: "YYYY-MM-DD|HH:MM" -> citas en esa celda
  const grid = useMemo(() => {
    const m: Record<string, Cita[]> = {}
    for (const c of citasActivas) {
      const key = `${isoDate(new Date(c.fecha_hora))}|${horaUTC(c.fecha_hora)}`
      ;(m[key] ??= []).push(c)
    }
    return m
  }, [citasActivas])

  // Conteo por odontólogo en la semana visible.
  const conteoOdo = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of citasActivas) m[c.odontologo_id] = (m[c.odontologo_id] ?? 0) + 1
    return m
  }, [citasActivas])

  const pendientes = useMemo(
    () => (citas ?? []).filter(c => c.estado === 'pendiente' || c.estado === 'reprogramada').sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora)),
    [citas]
  )

  const diasVisibles = vista === 'semana' ? dias : [dias[diaIdx]]
  const hoyISO = isoDate(new Date())
  const rangoLabel = `${dias[0].toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })} – ${dias[5].toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`

  const confirmarCita = async (id: string) => {
    setConfirmando(id)
    try { await citasAPI.actualizar(id, { estado: 'confirmada' }); refetch() }
    finally { setConfirmando(null) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Disponibilidad semanal</h1>
          <p className="text-xs text-[#8B7355] mt-0.5 flex items-center gap-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> En tiempo real · {rangoLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLunes(l => addDays(l, -7))}
            className="flex items-center gap-1 border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5EFE6]">
            <ChevronLeft size={14} /> Anterior
          </button>
          <button onClick={() => setLunes(lunesDe(new Date()))}
            className="border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5EFE6]">
            Hoy
          </button>
          <button onClick={() => setLunes(l => addDays(l, 7))}
            className="flex items-center gap-1 border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5EFE6]">
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">Error cargando la agenda: {error}</div>}

      {/* Leyenda + filtro */}
      <div className="flex items-center gap-3 mb-4 text-xs text-[#8B7355] flex-wrap">
        <span className="font-medium">Odontólogo:</span>
        <button onClick={() => setOdoFiltro('')}
          className={`px-2 py-0.5 rounded-full border ${odoFiltro === '' ? 'border-[#C17A5A] text-[#C17A5A] bg-[#F5EFE6]' : 'border-transparent'}`}>
          Todos
        </button>
        {lista.map(o => (
          <button key={o.id} onClick={() => setOdoFiltro(f => f === o.id ? '' : o.id)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${odoFiltro === o.id ? 'border-[#C17A5A] bg-[#F5EFE6]' : 'border-transparent'}`}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: o.color }} />
            {o.nombre}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Calendario */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE0D4]">
            <span className="text-sm font-semibold text-[#3D2B1F]">Calendario de citas</span>
            <div className="flex gap-1">
              {(['dia', 'semana'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${vista === v ? 'bg-[#C17A5A] text-white' : 'text-[#8B7355] hover:bg-[#F5EFE6]'}`}>
                  {v === 'dia' ? 'Día' : 'Semana'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#EDE0D4]">
                  <th className="w-16 px-3 py-2 text-left text-[#8B7355]" />
                  {diasVisibles.map((d) => {
                    const idx = dias.indexOf(d)
                    const esHoy = isoDate(d) === hoyISO
                    return (
                      <th key={isoDate(d)}
                        onClick={() => { setDiaIdx(idx); setVista('dia') }}
                        className={`px-2 py-2 text-center font-semibold cursor-pointer hover:bg-[#F5EFE6] ${esHoy ? 'text-[#C17A5A]' : 'text-[#3D2B1F]'}`}>
                        {DIAS_CORTOS[d.getUTCDay()]} {d.getUTCDate()}{esHoy ? ' ●' : ''}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(slot => (
                  <tr key={slot} className="border-b border-[#F5EFE6]">
                    <td className="px-3 py-2 text-[#8B7355] font-medium whitespace-nowrap">{slot}</td>
                    {diasVisibles.map(d => {
                      const cell = grid[`${isoDate(d)}|${slot}`] ?? []
                      return (
                        <td key={isoDate(d)} className="px-1.5 py-1 align-top">
                          {cell.length === 0 ? (
                            <span className="text-gray-300 italic">Libre</span>
                          ) : (
                            <div className="space-y-1">
                              {cell.map(c => (
                                <button key={c.id} onClick={() => navigate(`/admin/agenda/reprogramar/${c.id}`)}
                                  className="w-full rounded-lg px-2 py-1 text-left hover:opacity-90 transition"
                                  style={{ backgroundColor: (colorPorOdo[c.odontologo_id] ?? '#C17A5A') + '22', borderLeft: `3px solid ${colorPorOdo[c.odontologo_id] ?? '#C17A5A'}` }}
                                  title={`${c.tratamiento_nombre} · ${c.estado}`}>
                                  <div className="font-medium text-[#3D2B1F] truncate">{c.paciente_nombre}</div>
                                  {odoFiltro === '' && <div className="text-[#8B7355] truncate">{c.odontologo_nombre}</div>}
                                  {c.estado === 'pendiente' && <div className="text-[10px] text-amber-600">pendiente</div>}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="w-60 space-y-4">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Carga por odontólogo</h3>
            <div className="space-y-3">
              {lista.length === 0 ? (
                <div className="text-xs text-[#8B7355]">Sin odontólogos.</div>
              ) : lista.map(o => (
                <button key={o.id} onClick={() => setOdoFiltro(f => f === o.id ? '' : o.id)}
                  className={`w-full flex items-start gap-2 text-left rounded-lg p-1.5 ${odoFiltro === o.id ? 'bg-[#F5EFE6]' : 'hover:bg-[#F9F5EE]'}`}>
                  <Avatar initials={getInitials(o.nombre)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#3D2B1F] truncate">{o.nombre}</div>
                    <div className="text-[10px] text-[#8B7355] capitalize">{o.especialidad}</div>
                    <div className="text-[10px] text-[#C17A5A]">{conteoOdo[o.id] ?? 0} citas esta semana</div>
                  </div>
                  <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: o.color }} />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Pendientes de confirmar</h3>
            <div className="space-y-2">
              {pendientes.length === 0 ? (
                <div className="text-xs text-[#8B7355]">No hay citas pendientes ni reprogramadas esta semana.</div>
              ) : pendientes.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2 bg-[#F5EFE6] rounded-lg">
                  <Avatar initials={getInitials(c.paciente_nombre)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#3D2B1F] truncate">{c.paciente_nombre}</div>
                    <div className="text-[10px] text-[#8B7355]">
                      {new Date(c.fecha_hora).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })} · {horaUTC(c.fecha_hora)} · {c.tratamiento_nombre}
                      {c.estado === 'reprogramada' && <span className="text-amber-600"> · reprogramada</span>}
                    </div>
                  </div>
                  <button onClick={() => confirmarCita(c.id)} disabled={confirmando === c.id}
                    className="flex items-center gap-1 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded-lg font-medium">
                    <Check size={11} /> {confirmando === c.id ? '...' : 'Confirmar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
