import { useMemo, useState, type ReactNode } from 'react'
import { Bell, Check, AlertTriangle, X, Phone, Mail, MessageCircle, CalendarPlus } from 'lucide-react'
import Badge from '../../components/Badge'
import { useAsync } from '../../hooks/useAsync'
import { notificacionesAPI, type ResumenNotificaciones } from '../../api/notificaciones'
import type { Notificacion } from '../../api/notificaciones'
import { citasAPI } from '../../api/citas'
import { pacientesAPI, type Paciente } from '../../api/pacientes'

const iconMap: Record<string, ReactNode> = {
  solicitud: <CalendarPlus size={14} className="text-[#C17A5A]" />,
  recordatorio: <Bell size={14} className="text-blue-600" />,
  confirmacion: <Check size={14} className="text-green-600" />,
  alerta: <AlertTriangle size={14} className="text-amber-600" />,
  cancelacion: <X size={14} className="text-red-600" />,
  enviado: <Phone size={14} className="text-gray-500" />,
}

const bgMap: Record<string, string> = {
  solicitud: 'bg-[#F5EFE6]',
  recordatorio: 'bg-blue-50',
  confirmacion: 'bg-green-50',
  alerta: 'bg-amber-50',
  cancelacion: 'bg-red-50',
  enviado: 'bg-gray-50',
}

const estadoLabelMap: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Realizada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
}

type FiltroTab = 'Todas' | 'Sin leer' | 'Recordatorios' | 'Confirmaciones' | 'Sistema'
const TABS: FiltroTab[] = ['Todas', 'Sin leer', 'Recordatorios', 'Confirmaciones', 'Sistema']

function formatTime(createdAt?: string) {
  if (!createdAt) return 'Hace un momento'
  const date = new Date(createdAt)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Hace unos segundos'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function Notificaciones() {
  const { data: notificaciones, loading, error, refetch } = useAsync<Notificacion[]>(() => notificacionesAPI.listar())
  const { data: resumen, refetch: refetchResumen } = useAsync<ResumenNotificaciones>(() => notificacionesAPI.resumen())
  const { data: pacientes } = useAsync<Paciente[]>(() => pacientesAPI.listar())

  const [actingId, setActingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tab, setTab] = useState<FiltroTab>('Todas')

  const [pacienteId, setPacienteId] = useState('')
  const [mensajeManual, setMensajeManual] = useState('')
  const [envio, setEnvio] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const sinLeer = useMemo(() => notificaciones?.filter(n => !n.leido).length ?? 0, [notificaciones])

  const filtradas = useMemo(() => {
    const lista = notificaciones ?? []
    switch (tab) {
      case 'Sin leer': return lista.filter(n => !n.leido)
      case 'Recordatorios': return lista.filter(n => n.tipo === 'recordatorio')
      case 'Confirmaciones': return lista.filter(n => n.tipo === 'confirmacion')
      case 'Sistema': return lista.filter(n => n.tipo === 'solicitud' || n.tipo === 'cancelacion' || n.tipo === 'alerta')
      default: return lista
    }
  }, [notificaciones, tab])

  const refrescar = () => { refetch(); refetchResumen() }

  const handleMarcarTodo = async () => {
    await notificacionesAPI.marcarTodasLeidas()
    refrescar()
  }

  const responderSolicitud = async (n: Notificacion, estado: 'confirmada' | 'cancelada') => {
    if (!n.cita_id) return
    setActingId(n.id)
    setActionError(null)
    try {
      await citasAPI.actualizar(n.cita_id, { estado })
      await notificacionesAPI.marcarLeido(n.id)
      refrescar()
    } catch (err: any) {
      setActionError(err?.message || 'No se pudo procesar la solicitud.')
    } finally {
      setActingId(null)
    }
  }

  const enviarRecordatorio = async (canal: string) => {
    if (!pacienteId) {
      setEnvio({ type: 'error', message: 'Selecciona un paciente.' })
      return
    }
    setEnviando(true)
    setEnvio(null)
    try {
      await notificacionesAPI.enviarRecordatorio({ paciente_id: pacienteId, canal, mensaje: mensajeManual || undefined })
      setEnvio({ type: 'success', message: 'Recordatorio enviado.' })
      setMensajeManual('')
      refrescar()
    } catch (err: any) {
      setEnvio({ type: 'error', message: err?.message || 'No se pudo enviar el recordatorio.' })
    } finally {
      setEnviando(false)
    }
  }

  const resumenItems: [string, number][] = [
    ['Recordatorios enviados', resumen?.recordatorios ?? 0],
    ['Confirmaciones', resumen?.confirmaciones ?? 0],
    ['Solicitudes', resumen?.solicitudes ?? 0],
    ['Cancelaciones', resumen?.cancelaciones ?? 0],
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Centro de notificaciones</h1>
          <p className="text-sm text-[#8B7355] mt-0.5">{sinLeer} notificación(es) sin leer</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMarcarTodo}
            disabled={loading || sinLeer === 0}
            className="border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Marcar todo como leído
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Notifications list */}
        <div className="flex-1">
          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-[#C17A5A] text-white' : 'bg-white border border-[#D4C4B0] text-[#8B7355] hover:bg-[#F5EFE6]'
              }`}>
                {t === 'Sin leer' ? `Sin leer (${sinLeer})` : t}
              </button>
            ))}
          </div>

          {error && <div className="text-sm text-red-600 mb-4">Error cargando notificaciones: {error}</div>}
          {actionError && <div className="text-sm text-red-600 mb-4">{actionError}</div>}

          <div className="space-y-2">
            {filtradas.map(n => {
              const esSolicitudPendiente = n.tipo === 'solicitud' && n.cita_estado === 'pendiente'
              const estadoLabel = n.cita_estado ? estadoLabelMap[n.cita_estado] ?? '' : ''
              return (
              <div
                key={n.id}
                className={`bg-white rounded-xl border border-[#D4C4B0] p-4 transition-colors ${!n.leido ? 'border-l-4 border-l-[#C17A5A]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bgMap[n.tipo] ?? 'bg-gray-50'}`}>
                    {iconMap[n.tipo] ?? <Bell size={14} className="text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-sm text-[#3D2B1F]">{n.titulo}</div>
                      <div className="flex items-center gap-2">
                        {estadoLabel && <Badge estado={estadoLabel} />}
                        {!n.leido && <span className="w-2 h-2 bg-[#C17A5A] rounded-full" />}
                      </div>
                    </div>
                    <p className="text-xs text-[#8B7355] mb-1">{n.descripcion}</p>
                    <div className="text-[10px] text-[#8B7355]">{formatTime(n.created_at)}</div>

                    {esSolicitudPendiente && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => responderSolicitud(n, 'confirmada')}
                          disabled={actingId === n.id}
                          className="flex items-center gap-1 bg-[#5A8A6A] hover:bg-[#4A7458] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Check size={12} /> {actingId === n.id ? 'Procesando...' : 'Aceptar'}
                        </button>
                        <button
                          onClick={() => responderSolicitud(n, 'cancelada')}
                          disabled={actingId === n.id}
                          className="flex items-center gap-1 border border-[#D4C4B0] text-[#A0623F] hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <X size={12} /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )
            })}
            {!loading && filtradas.length === 0 && (
              <div className="text-sm text-[#8B7355] bg-white rounded-xl border border-[#D4C4B0] p-6 text-center">
                No hay notificaciones en esta vista.
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-64 space-y-4">
          {/* Resumen */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Resumen del día</h3>
            <div className="space-y-2 text-xs">
              {resumenItems.map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[#8B7355]">{l}</span>
                  <span className="font-bold text-[#3D2B1F]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enviar manual */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Enviar recordatorio manual</h3>
            <div className="mb-3">
              <label className="text-xs text-[#8B7355] mb-1 block">Paciente</label>
              <select value={pacienteId} onChange={e => setPacienteId(e.target.value)}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-xs text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                <option value="">Seleccionar paciente...</option>
                {(pacientes ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="text-xs text-[#8B7355] mb-1 block">Mensaje (opcional)</label>
              <textarea value={mensajeManual} onChange={e => setMensajeManual(e.target.value)} rows={2}
                placeholder="Se usará un mensaje por defecto si lo dejas vacío"
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-xs text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white resize-none" />
            </div>
            {envio && (
              <div className={`mb-3 rounded-lg p-2 text-xs ${envio.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {envio.message}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => enviarRecordatorio('email')} disabled={enviando}
                className="flex-1 flex items-center justify-center gap-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-xs hover:bg-[#F5EFE6] disabled:opacity-50">
                <Mail size={12} /> Email
              </button>
              <button onClick={() => enviarRecordatorio('sms')} disabled={enviando}
                className="flex-1 flex items-center justify-center gap-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-xs hover:bg-[#F5EFE6] disabled:opacity-50">
                <MessageCircle size={12} /> SMS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
