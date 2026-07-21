import { useMemo, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import Badge from '../../components/Badge'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  })
}

export default function DetalleCitaOdontologo() {
  const { id } = useParams<{ id: string }>()
  const { data: cita, loading, error, refetch } = useAsync<Cita>(
    () => (id ? citasAPI.obtener(id) : Promise.reject(new Error('ID de cita inválido'))),
    [id]
  )
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (cita) {
      setNota(cita.notas_clinicas ?? '')
    }
  }, [cita])

  const hasChanges = cita ? cita.notas_clinicas !== nota : false

  const estadoTexto = useMemo(() => {
    if (!cita) return ''
    return cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)
  }, [cita])

  const handleSave = async () => {
    if (!id || !cita) return
    try {
      setSaving(true)
      setStatus(null)
      await citasAPI.actualizar(id, { notas_clinicas: nota })
      setStatus({ type: 'success', message: 'Nota clínica guardada correctamente.' })
      refetch()
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message || 'Error al guardar la nota.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-1">Detalle de cita odontólogo</h1>
          <p className="text-sm text-[#8B7355]">Revisa la información de la cita y agrega notas clínicas para el historial.</p>
        </div>
        <Link to="/odontologo/agenda" className="inline-flex items-center rounded-full bg-[#F5EFE6] px-4 py-2 text-xs font-semibold text-[#3D2B1F] hover:bg-[#EDE0D4]">
          Volver a mi agenda
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando detalle de cita...</div>
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
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Paciente</div>
                {cita.paciente_nombre}
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Cédula</div>
                {cita.paciente_cedula}
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Odontólogo</div>
                {cita.odontologo_nombre}
              </div>
              <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Duración</div>
                {cita.duracion_minutos} min
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[#3D2B1F]">Notas clínicas</h2>
                <p className="text-xs text-[#8B7355]">Registra observaciones que se guardarán en la cita y pueden usarse para la historia clínica.</p>
              </div>
            </div>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={6}
              className="w-full border border-[#D4C4B0] rounded-3xl px-4 py-3 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-[#FBF7F2] resize-none" />
            <div className="rounded-2xl bg-[#FBF7F2] p-4 text-[11px] text-[#8B7355] mb-4">
              <div className="font-semibold text-[#3D2B1F] mb-2">Sigue estos pasos</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Edita o revisa la nota clínica.</li>
                <li>Presiona <span className="font-semibold text-[#3D2B1F]">Guardar nota</span>.</li>
                <li>Haz clic en <span className="font-semibold text-[#3D2B1F]">Abrir historial del paciente</span>.</li>
              </ol>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={handleSave}
                disabled={!cita || !hasChanges || saving}
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors ${cita && hasChanges && !saving ? 'bg-[#C17A5A] text-white hover:bg-[#A0623F]' : 'bg-[#E9E1D5] text-[#8B7355] cursor-not-allowed'}`}>
                Guardar nota
              </button>
              <Link to={`/odontologo/historia/${cita.paciente_id}`} className="inline-flex items-center justify-center rounded-full border border-[#D4C4B0] bg-white px-5 py-3 text-sm font-semibold text-[#3D2B1F] hover:bg-[#F5EFE6] transition-colors">
                Abrir historial del paciente
              </Link>
            </div>
            {status && (
              <div className={`mt-4 rounded-2xl p-3 text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {status.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
