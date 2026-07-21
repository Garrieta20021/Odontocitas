import { useEffect } from 'react'
import { Calendar, Users, DollarSign, MessageSquare, Plus, ChevronLeft, ChevronRight, Bot, TrendingUp, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { dashboardAPI } from '../../api/dashboard'

const calDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const calNums = [
  [null, null, null, null, null, null, 1],
  [2, 3, 4, 5, 6, 7, 8],
  [9, 10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22],
  [23, 24, 25, 26, 27, 28, 29],
  [30, 31, null, null, null, null, null],
]
const highlighted = [4, 11, 13, 19, 25, 26, 29]

const colors = ['#C17A5A', '#5A8A6A', '#C4943A', '#B85450', '#4A7A9B', '#8A5A9B']

function formatHora(fechaHora: string) {
  const d = new Date(fechaHora)
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
}

function formatFechaCorta(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

function etiquetaAccion(accion: string | null) {
  if (!accion) return 'Conversación activa'
  return accion.replace(/_/g, ' ')
}

function getInitials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function saludoPorHora(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const primerNombre = user?.nombre.split(' ')[0] ?? 'equipo'

  const { data: metricas, refetch: refetchMetricas } = useAsync(() => dashboardAPI.metricas())
  const { data: whatsapp, refetch: refetchWhatsapp } = useAsync(() => dashboardAPI.whatsapp())
  const { data: citasHoy, refetch: refetchCitasHoy } = useAsync(() => dashboardAPI.citasHoy())
  const { data: tratamientosMesAPI, refetch: refetchTratamientos } = useAsync(() => dashboardAPI.tratamientosMes())

  // Al volver a la pestaña/ventana, refrescar para reflejar citas recién completadas.
  useEffect(() => {
    const onFocus = () => {
      refetchMetricas()
      refetchWhatsapp()
      refetchCitasHoy()
      refetchTratamientos()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetchMetricas, refetchWhatsapp, refetchCitasHoy, refetchTratamientos])

  const tratamientos = (tratamientosMesAPI && tratamientosMesAPI.length > 0)
    ? tratamientosMesAPI.map((t, i) => ({ ...t, color: colors[i % colors.length] }))
    : []

  const maxCantidad = tratamientos.length > 0
    ? tratamientos.reduce((max, t) => Math.max(max, t.cantidad), 1)
    : 1

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">{saludoPorHora()}, {primerNombre} ☀️</h1>
          <p className="text-sm text-[#C17A5A] mt-0.5">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8B7355] bg-white border border-[#D4C4B0] px-3 py-1.5 rounded-lg">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <button onClick={() => navigate('/admin/agenda')}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} /> Nueva cita
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <StatCard icon={<Calendar size={16} />} value={metricas?.citas_hoy ?? '—'} label="Citas hoy" />
        <StatCard icon={<Users size={16} />} value={metricas?.pacientes_activos ?? '—'} label="Pacientes activos" />
        <StatCard icon={<DollarSign size={16} />}
          value={metricas ? `$${(metricas.ingresos_mes / 1000000).toFixed(1)}M` : '—'}
          label="Ingresos del mes" />
        <StatCard icon={<MessageSquare size={16} />}
          value={metricas?.pendientes_confirmar ?? '—'}
          label="Pendientes de confirmar" />
      </div>

      {/* WhatsApp / Chatbot */}
      <div className="bg-white rounded-xl border border-[#D4C4B0] p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-[#C17A5A]" />
            <h2 className="font-semibold text-[#3D2B1F]">Chatbot WhatsApp</h2>
          </div>
          <span className="text-xs text-[#8B7355]">
            {whatsapp?.periodo.etiqueta ?? 'Este mes'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg bg-[#F5EFE6] p-3">
            <div className="text-xs text-[#8B7355]">Conversaciones activas</div>
            <div className="text-2xl font-bold text-[#3D2B1F]">{whatsapp?.conversaciones_activas ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[#F5EFE6] p-3">
            <div className="text-xs text-[#8B7355]">Citas creadas por WhatsApp</div>
            <div className="text-2xl font-bold text-[#5A8A6A]">{whatsapp?.citas_creadas ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[#F5EFE6] p-3">
            <div className="text-xs text-[#8B7355]">Citas canceladas por WhatsApp</div>
            <div className="text-2xl font-bold text-[#B85450]">{whatsapp?.citas_canceladas ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[#F5EFE6] p-3">
            <div className="flex items-center gap-1 text-xs text-[#8B7355]">
              <TrendingUp size={12} /> Tasa de conversión
            </div>
            <div className="text-2xl font-bold text-[#C17A5A]">
              {whatsapp ? `${whatsapp.tasa_conversion}%` : '—'}
            </div>
            <div className="text-[10px] text-[#8B7355] mt-1">
              {whatsapp ? `${whatsapp.citas_creadas} citas / ${whatsapp.contactos_unicos} contactos` : ''}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-2">Conversaciones activas</h3>
            {!whatsapp?.conversaciones?.length ? (
              <div className="text-sm text-[#8B7355] py-4 text-center border border-dashed border-[#D4C4B0] rounded-lg">
                No hay conversaciones activas en este momento
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {whatsapp.conversaciones.map((c) => (
                  <div key={c.telefono} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#FAF7F2]">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#3D2B1F] truncate">
                        {c.nombre ?? c.telefono}
                      </div>
                      <div className="text-xs text-[#8B7355] capitalize">
                        {c.rol} · {etiquetaAccion(c.ultima_accion)}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#8B7355] whitespace-nowrap">
                      {formatFechaCorta(c.actualizado_en)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-2">Actividad reciente del bot</h3>
            {!whatsapp?.citas_recientes?.length ? (
              <div className="text-sm text-[#8B7355] py-4 text-center border border-dashed border-[#D4C4B0] rounded-lg">
                Aún no hay citas creadas o canceladas por WhatsApp este mes
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {whatsapp.citas_recientes.map((c) => (
                  <div key={`${c.id}-${c.tipo_evento}`} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF7F2]">
                    {c.tipo_evento === 'creada' ? (
                      <MessageSquare size={14} className="text-[#5A8A6A] mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-[#B85450] mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#3D2B1F] truncate">
                        {c.paciente_nombre}
                      </div>
                      <div className="text-xs text-[#8B7355]">
                        {c.tipo_evento === 'creada' ? 'Cita creada' : 'Cita cancelada'}
                        {c.tratamiento_nombre ? ` · ${c.tratamiento_nombre}` : ''}
                      </div>
                      <div className="text-[10px] text-[#8B7355]">
                        Cita: {formatFechaCorta(c.fecha_hora)} · Evento: {formatFechaCorta(c.evento_en)}
                      </div>
                    </div>
                    <Badge estado={c.estado.charAt(0).toUpperCase() + c.estado.slice(1)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Citas del día */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#3D2B1F]">Citas de hoy</h2>
            <button onClick={() => navigate('/admin/agenda')} className="text-xs text-[#C17A5A] hover:underline">
              Ver todas
            </button>
          </div>

          {!citasHoy || citasHoy.length === 0 ? (
            <div className="text-center py-8 text-[#8B7355] text-sm">
              No hay citas programadas para hoy
            </div>
          ) : (
            <div className="space-y-2">
              {(citasHoy as Array<Record<string, string>>).map((c) => (
                <div key={c.id}
                  onClick={() => navigate(`/admin/agenda/completada/${c.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F5EFE6] transition-colors cursor-pointer">
                  <div className="text-center w-14 flex-shrink-0">
                    <div className="text-xs font-bold text-[#3D2B1F]">{formatHora(c.fecha_hora)}</div>
                  </div>
                  <Avatar initials={getInitials(c.paciente_nombre)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#3D2B1F]">{c.paciente_nombre}</div>
                    <div className="text-xs text-[#8B7355]">{c.tratamiento_nombre} · {c.odontologo_nombre}</div>
                  </div>
                  <Badge estado={c.estado.charAt(0).toUpperCase() + c.estado.slice(1)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="w-64 space-y-4">
          {/* Calendar */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <div className="flex items-center justify-between mb-3">
              <button className="text-[#8B7355] hover:text-[#C17A5A]"><ChevronLeft size={14} /></button>
              <span className="text-sm font-semibold text-[#3D2B1F]">
                {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </span>
              <button className="text-[#8B7355] hover:text-[#C17A5A]"><ChevronRight size={14} /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {calDays.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-[#8B7355] py-1">{d}</div>
              ))}
            </div>
            {calNums.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day, di) => (
                  <div key={di} className={`text-center text-xs py-1 rounded-full cursor-pointer transition-colors ${
                    day === new Date().getDate() ? 'bg-[#C17A5A] text-white font-bold' :
                    day && highlighted.includes(day) ? 'font-semibold text-[#C17A5A]' :
                    day ? 'text-[#3D2B1F] hover:bg-[#F5EFE6]' : ''
                  }`}>
                    {day ?? ''}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Tratamientos del mes */}
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Tratamientos del mes</h3>
            <div className="space-y-2">
              {tratamientos.map(t => (
                <div key={t.nombre}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#8B7355]">{t.nombre}</span>
                    <span className="font-medium text-[#3D2B1F]">{(t as { cantidad: number }).cantidad}</span>
                  </div>
                  <div className="h-1.5 bg-[#F5EFE6] rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${((t as { cantidad: number }).cantidad / maxCantidad) * 100}%`, backgroundColor: t.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
