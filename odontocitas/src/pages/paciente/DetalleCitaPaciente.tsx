import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import Badge from '../../components/Badge'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  })
}

export default function DetalleCitaPaciente() {
  const { id } = useParams<{ id: string }>()
  const { data: cita, loading, error } = useAsync<Cita>(
    () => (id ? citasAPI.obtener(id) : Promise.reject(new Error('ID de cita inválido'))),
    [id]
  )

  const estadoTexto = useMemo(() => {
    if (!cita) return ''
    return cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)
  }, [cita])

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-1">Detalle de la cita</h1>
          <p className="text-sm text-[#8B7355]">Revisa la información completa de tu cita y su estado actual.</p>
        </div>
        <Link to="/paciente/mis-citas" className="inline-flex items-center rounded-full bg-[#F5EFE6] px-4 py-2 text-xs font-semibold text-[#3D2B1F] hover:bg-[#EDE0D4]">
          Volver a Mis citas
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando detalles de la cita...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">{error}</div>
      ) : !cita ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cita no encontrada.</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[#3D2B1F]">{cita.tratamiento_nombre}</div>
                <div className="text-xs text-[#8B7355]">{formatFecha(cita.fecha_hora)}</div>
              </div>
              <Badge estado={estadoTexto} size="md" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Odontólogo</div>
                {cita.odontologo_nombre}
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Duración</div>
                {cita.duracion_minutos} min
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Paciente</div>
                {cita.paciente_nombre}
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Cédula</div>
                {cita.paciente_cedula}
              </div>
            </div>
          </div>

          {cita.motivo && (
            <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold text-[#8B7355] uppercase tracking-[.16em] mb-3">Motivo</div>
              <p className="text-sm text-[#3D2B1F]">{cita.motivo}</p>
            </div>
          )}

          <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-[#8B7355] uppercase tracking-[.16em] mb-2">Notas clínicas</div>
                <p className="text-sm text-[#3D2B1F]">{cita.notas_clinicas || 'No hay notas clínicas adicionales.'}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#8B7355] uppercase tracking-[.16em] mb-2">Tarifa</div>
                <p className="text-sm text-[#3D2B1F]">${cita.tarifa.toLocaleString('es-CO')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
