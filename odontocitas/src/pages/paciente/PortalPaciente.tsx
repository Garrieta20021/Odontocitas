import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Badge from '../../components/Badge'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import { useAuth } from '../../context/AuthContext'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  })
}

export default function PortalPaciente() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: citas, loading } = useAsync<Cita[]>(() => citasAPI.listar())

  const citasOrdenadas = useMemo(() => {
    if (!citas) return []
    return [...citas].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  }, [citas])

  const proximas = useMemo(() => citasOrdenadas.filter(c => c.estado !== 'cancelada'), [citasOrdenadas])
  const siguiente = proximas.find(c => new Date(c.fecha_hora).getTime() >= Date.now()) ?? proximas[0]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#C17A5A] rounded-full flex items-center justify-center text-white font-bold">{user?.initials ?? 'PU'}</div>
          <div>
            <h1 className="text-xl font-bold text-[#3D2B1F]">¡Hola, {user?.nombre.split(' ')[0] ?? 'Paciente'}! 👋</h1>
            <p className="text-sm text-[#8B7355]">
              {siguiente ? (
                <>Tu próxima cita es el <span className="text-[#C17A5A] font-medium">{formatFecha(siguiente.fecha_hora)}</span> con <span className="text-[#C17A5A] font-medium">{siguiente.odontologo_nombre}</span>.</>
              ) : (
                <>Aún no tienes citas programadas. Agenda tu primera consulta.</>
              )}
            </p>
          </div>
        </div>
        <button onClick={() => navigate('/paciente/solicitar')}
          className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={14} /> Agendar nueva cita
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[#3D2B1F]">Resumen de tus citas</h2>
              <p className="text-xs text-[#8B7355]">Tus próximas visitas y estado de cada atención.</p>
            </div>
            <span className="text-xs text-[#C17A5A] font-medium">{loading ? 'Cargando...' : `${proximas.length} citas`}</span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-[#8B7355]">Cargando citas...</div>
          ) : proximas.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#8B7355]">No hay citas activas. Solicita una cita para empezar.</div>
          ) : (
            <div className="space-y-3">
              {proximas.map(cita => (
                <div key={cita.id} className="p-4 rounded-xl bg-[#F5EFE6] border border-[#EDE0D4]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#3D2B1F]">{cita.tratamiento_nombre}</div>
                      <div className="text-xs text-[#8B7355]">{formatFecha(cita.fecha_hora)} · {cita.odontologo_nombre}</div>
                    </div>
                    <Badge estado={cita.estado} />
                  </div>
                  <div className="text-[11px] text-[#8B7355] mt-3">Profesional: {cita.odontologo_nombre} · Cedula: {cita.odontologo_id}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-64 space-y-4">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Detalles de la próxima cita</h3>
            {siguiente ? (
              <div className="space-y-3 text-sm text-[#3D2B1F]">
                <div className="text-xs text-[#8B7355]">Fecha</div>
                <div className="font-semibold">{formatFecha(siguiente.fecha_hora)}</div>
                <div className="text-xs text-[#8B7355]">Odontólogo</div>
                <div className="font-semibold">{siguiente.odontologo_nombre}</div>
                <div className="text-xs text-[#8B7355]">Tratamiento</div>
                <div className="font-semibold">{siguiente.tratamiento_nombre}</div>
                <div className="text-xs text-[#8B7355]">Motivo</div>
                <div className="text-sm text-[#8B7355]">{siguiente.motivo || 'No registrado'}</div>
              </div>
            ) : (
              <div className="text-sm text-[#8B7355]">No hay cita seleccionada todavía.</div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Acciones rápidas</h3>
            <button onClick={() => navigate('/paciente/solicitar')}
              className="w-full bg-[#C17A5A] hover:bg-[#A0623F] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Solicitar nueva cita
            </button>
            <button onClick={() => navigate('/paciente/informacion')}
              className="w-full border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
              Ver información del consultorio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
