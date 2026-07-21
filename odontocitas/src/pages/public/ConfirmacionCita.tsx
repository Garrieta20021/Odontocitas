import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, Calendar } from 'lucide-react'
import Logo from '../../components/Logo'
import { citasAPI, type CitaPublica } from '../../api/citas'
import { useAsync } from '../../hooks/useAsync'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export default function ConfirmacionCita() {
  const { token } = useParams<{ token: string }>()
  const [estadoLocal, setEstadoLocal] = useState<'pending' | 'confirmed' | 'cancelled'>('pending')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const { data: cita, loading, error, refetch } = useAsync<CitaPublica>(
    () => (token ? citasAPI.obtenerPublica(token) : Promise.reject(new Error('Cita no especificada'))),
    [token]
  )

  const handleAction = async (action: 'confirmar' | 'cancelar') => {
    if (!token) return
    setSaving(true)
    setActionError('')
    try {
      if (action === 'confirmar') {
        await citasAPI.confirmarPublica(token)
        setEstadoLocal('confirmed')
      } else {
        await citasAPI.cancelarPublica(token)
        setEstadoLocal('cancelled')
      }
      refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar la cita.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center text-[#8B7355]">
        Cargando cita...
      </div>
    )
  }

  if (error || !cita) {
    return (
      <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#D4C4B0] p-10 w-96 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#3D2B1F] mb-2">Cita no encontrada</h2>
          <p className="text-sm text-[#8B7355]">{error ?? 'El enlace no corresponde a una cita activa.'}</p>
        </div>
      </div>
    )
  }

  if (estadoLocal === 'confirmed' || cita.estado === 'confirmada') {
    return (
      <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#D4C4B0] p-10 w-96 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#3D2B1F] mb-2">Cita confirmada</h2>
          <p className="text-sm text-[#8B7355]">Nos vemos el {formatFecha(cita.fecha_hora)} a las {formatHora(cita.fecha_hora)}.</p>
        </div>
      </div>
    )
  }

  if (estadoLocal === 'cancelled' || cita.estado === 'cancelada') {
    return (
      <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#D4C4B0] p-10 w-96 text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#3D2B1F] mb-2">Cita cancelada</h2>
          <p className="text-sm text-[#8B7355]">Tu cita ha sido cancelada. Puedes solicitar una nueva cuando lo desees.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6">
          <Logo size="sm" />
          <div>
            <div className="font-bold text-[#3D2B1F]">Odontocitas</div>
            <div className="text-xs text-[#8B7355]">Clinica Sonrisas</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#D4C4B0] p-8 w-80 shadow-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 bg-[#F5EFE6] rounded-xl flex items-center justify-center text-[#C17A5A] mb-3">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl font-bold text-[#3D2B1F] mb-1">Confirma tu cita</h2>
            <p className="text-sm text-[#8B7355] text-center">
              Hola, <span className="font-medium text-[#3D2B1F]">{cita.paciente_nombre}</span>. Tienes una cita programada:
            </p>
          </div>

          <div className="flex gap-3 mb-5">
            <div className="flex-1 bg-[#F5EFE6] rounded-xl p-3 text-center">
              <div className="text-xs text-[#8B7355] mb-1">FECHA</div>
              <div className="text-2xl font-bold text-[#3D2B1F]">{new Date(cita.fecha_hora).getUTCDate()}</div>
              <div className="text-sm text-[#8B7355]">{formatFecha(cita.fecha_hora).replace(/^\d+\s+de\s+/i, '')}</div>
            </div>
            <div className="flex-1 bg-[#F5EFE6] rounded-xl p-3 text-center">
              <div className="text-xs text-[#8B7355] mb-1">HORA</div>
              <div className="text-2xl font-bold text-[#3D2B1F]">{formatHora(cita.fecha_hora)}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm mb-6">
            {[
              ['Tratamiento', cita.tratamiento_nombre || 'Consulta'],
              ['Odontologo', cita.odontologo_nombre],
              ['Duracion', `${cita.tratamiento_duracion ?? cita.duracion_minutos} minutos`],
              ['Estado', cita.estado],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-[#8B7355]">{label}</span>
                <span className="font-medium text-[#3D2B1F] text-right">{value}</span>
              </div>
            ))}
          </div>

          {actionError && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

          <div className="flex gap-2 mb-4">
            <button onClick={() => handleAction('cancelar')} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 border border-[#D4C4B0] text-[#8B7355] py-2.5 rounded-xl text-sm hover:bg-[#F5EFE6] transition-colors disabled:opacity-60">
              <XCircle size={14} /> Cancelar
            </button>
            <button onClick={() => handleAction('confirmar')} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#C17A5A] hover:bg-[#A0623F] text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
              <CheckCircle size={14} /> Confirmar
            </button>
          </div>

          <p className="text-center text-[10px] text-[#8B7355] mt-2">Clinica Sonrisas</p>
        </div>
      </div>
    </div>
  )
}
