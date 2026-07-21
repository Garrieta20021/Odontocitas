import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import Avatar from '../../components/Avatar'

const horarios = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00']

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

export default function ReprogramarCita() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: cita, loading, error } = useAsync<Cita>(() => {
    if (!id) return Promise.reject(new Error('ID de cita inválido'))
    return citasAPI.obtener(id)
  }, [id])

  const [horaSeleccionada, setHoraSeleccionada] = useState('09:00')
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('Solicitud del paciente')
  const [observaciones, setObservaciones] = useState('Paciente solicita cambio por compromisos laborales.')

  useEffect(() => {
    if (!cita) return
    const fechaDate = new Date(cita.fecha_hora)
    setFecha(fechaDate.toISOString().slice(0, 10))
    setHoraSeleccionada(fechaDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }))
  }, [cita])

  const pacienteNombre = cita?.paciente_nombre ?? 'Paciente'
  const odontologo = cita?.odontologo_nombre ?? 'Odontólogo'
  const tratamiento = cita?.tratamiento_nombre ?? 'Tratamiento'
  const iniciales = getInitials(pacienteNombre)

  const handleGuardar = async () => {
    if (!id || !cita) return
    const fechaHora = `${fecha}T${horaSeleccionada}:00`
    await citasAPI.actualizar(id, { fecha_hora: fechaHora, odontologo_id: cita.odontologo_id })
    navigate('/admin/agenda')
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#8B7355]">Cargando cita...</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Error cargando la cita: {error}</div>
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#8B7355] mb-6">
        <button onClick={() => navigate('/admin/agenda')} className="flex items-center gap-1 hover:text-[#C17A5A]">
          <ChevronLeft size={14} /> Agenda
        </button>
        <span>/</span>
        <span className="text-[#3D2B1F] font-medium">Reprogramar cita — {pacienteNombre}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate('/admin/agenda')}
            className="border border-[#D4C4B0] bg-white text-[#8B7355] px-4 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            Cancelar
          </button>
          <button onClick={handleGuardar}
            className="bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Guardar nueva fecha
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left - Original + Motivo */}
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#3D2B1F]">Cita original</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente de reprogramar</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials={iniciales} size="md" />
              <div>
                <div className="font-semibold text-[#3D2B1F]">{pacienteNombre}</div>
                <div className="text-xs text-[#8B7355]">{cita?.paciente_cedula ?? 'CC no disponible'} · {cita?.duracion_minutos ?? 45} min</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Tratamiento</div>
                <div className="font-medium text-[#3D2B1F]">{tratamiento}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Odontólogo</div>
                <div className="font-medium text-[#3D2B1F]">{odontologo}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B7355] mb-0.5">Fecha original</div>
                <div className="font-medium text-red-500 line-through">{formatDate(cita?.fecha_hora ?? '')} — {formatTime(cita?.fecha_hora ?? '')}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Motivo de reprogramación</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Motivo</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)}
                  className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                  <option>Solicitud del paciente</option>
                  <option>Emergencia médica</option>
                  <option>Disponibilidad del odontólogo</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
                  className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white resize-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="w-80">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
            <h2 className="font-semibold text-[#3D2B1F] mb-4">Nueva fecha y hora</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Nueva fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Odontólogo</label>
                <select className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                  <option>{odontologo}</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-medium text-[#8B7355] mb-2">Horarios disponibles — {fecha ? formatDate(`${fecha}T00:00:00`) : 'Selecciona una fecha'}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {horarios.map(h => (
                  <button key={h} onClick={() => setHoraSeleccionada(h)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      horaSeleccionada === h
                        ? 'bg-[#C17A5A] text-white'
                        : 'bg-[#F5EFE6] text-[#3D2B1F] hover:bg-[#EDE0D4]'
                    }`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#F5EFE6] rounded-lg p-3 text-xs text-[#8B7355]">
              <div className="font-medium text-[#3D2B1F] mb-1">
                Nueva cita seleccionada: {fecha ? formatDate(`${fecha}T${horaSeleccionada}:00`) : 'Selecciona una fecha'} · {formatTime(`${fecha}T${horaSeleccionada}:00`)} · {odontologo}
              </div>
              Se enviará notificación automática al paciente.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
