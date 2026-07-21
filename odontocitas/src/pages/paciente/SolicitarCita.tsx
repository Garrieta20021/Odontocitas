import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI } from '../../api/citas'
import { odontologosAPI, type Odontologo, type HorarioDisponible } from '../../api/odontologos'
import { tratamientosAPI, type Tratamiento } from '../../api/tratamientos'

export default function SolicitarCita() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [odontologoId, setOdontologoId] = useState('')
  const [tratamientoId, setTratamientoId] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [hora, setHora] = useState('08:00')
  const [motivo, setMotivo] = useState('Consulta odontológica general')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: odontologos } = useAsync<Odontologo[]>(() => odontologosAPI.listar())
  const { data: tratamientos } = useAsync<Tratamiento[]>(() => tratamientosAPI.listar())
  const { data: disponibilidad } = useAsync<HorarioDisponible[]>(
    () => (odontologoId && fecha ? odontologosAPI.disponibilidad(odontologoId, fecha) : Promise.resolve([])),
    [odontologoId, fecha]
  )

  useEffect(() => {
    if (odontologos && odontologos.length > 0 && !odontologoId) {
      setOdontologoId(odontologos[0].id)
    }
  }, [odontologos, odontologoId])

  useEffect(() => {
    if (tratamientos && tratamientos.length > 0 && !tratamientoId) {
      setTratamientoId(tratamientos[0].id)
    }
  }, [tratamientos, tratamientoId])

  const horariosDisponibles = useMemo(
    () => disponibilidad?.filter(h => h.disponible).map(h => h.hora) ?? [],
    [disponibilidad]
  )

  useEffect(() => {
    if (horariosDisponibles.length > 0 && !horariosDisponibles.includes(hora)) {
      setHora(horariosDisponibles[0])
    }
  }, [horariosDisponibles, hora])

  const tratamientoSeleccionado = useMemo(
    () => tratamientos?.find(t => t.id === tratamientoId),
    [tratamientos, tratamientoId]
  )

  const handleSubmit = async () => {
    if (!user?.perfilId || !odontologoId || !tratamientoId || !fecha || !hora) {
      setStatus({ type: 'error', message: 'Completa todos los campos para enviar la solicitud.' })
      return
    }

    setSaving(true)
    setStatus(null)

    try {
      await citasAPI.crear({
        paciente_id: user.perfilId,
        odontologo_id: odontologoId,
        tratamiento_id: tratamientoId,
        fecha_hora: `${fecha}T${hora}:00`,
        motivo,
        duracion_minutos: tratamientoSeleccionado?.duracion_minutos ?? 45,
      })
      navigate('/paciente/portal')
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Error al enviar la solicitud.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Nueva solicitud de cita</h1>
        <p className="text-sm text-[#8B7355] mt-0.5">Completa el formulario para solicitar tu cita. Recibirás confirmación por correo electrónico.</p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-6">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Datos de la solicitud</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Tratamiento</label>
              <select value={tratamientoId} onChange={e => setTratamientoId(e.target.value)}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                {tratamientos?.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Odontólogo</label>
              <select value={odontologoId} onChange={e => setOdontologoId(e.target.value)}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                {odontologos?.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre} · {o.especialidad}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8B7355] mb-1 block">Hora</label>
                <div className="grid grid-cols-4 gap-1">
                  {horariosDisponibles.length > 0 ? (
                    horariosDisponibles.map(h => (
                      <button key={h} type="button" onClick={() => setHora(h)}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${hora === h ? 'bg-[#C17A5A] text-white' : 'bg-[#F5EFE6] text-[#3D2B1F] hover:bg-[#EDE0D4]'}`}>
                        {h}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-4 text-xs text-[#8B7355] py-2">No hay horarios disponibles para esta fecha.</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Motivo de la cita</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white resize-none" />
            </div>
          </div>
        </div>

        <div className="w-56">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4 sticky top-6">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Resumen</h3>
            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-[#8B7355]">Paciente</span>
                <span className="font-medium text-[#3D2B1F] text-right">{user?.nombre ?? 'Paciente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B7355]">Odontólogo</span>
                <span className="font-medium text-[#3D2B1F] text-right">{odontologos?.find(o => o.id === odontologoId)?.nombre ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B7355]">Fecha</span>
                <span className="font-medium text-[#3D2B1F] text-right">{fecha}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B7355]">Hora</span>
                <span className="font-medium text-[#3D2B1F] text-right">{hora}</span>
              </div>
            </div>
            {status && (
              <div className={`rounded-lg p-3 text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {status.message}
              </div>
            )}
            <button onClick={handleSubmit}
              disabled={saving || horariosDisponibles.length === 0}
              className="w-full bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors mb-2">
              {saving ? 'Enviando...' : 'Enviar solicitud'}
            </button>
            <button onClick={() => navigate('/paciente/portal')}
              className="w-full border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
              Volver al portal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
