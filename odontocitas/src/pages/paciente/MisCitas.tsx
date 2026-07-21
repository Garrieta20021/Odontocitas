import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI, type Cita } from '../../api/citas'
import { odontologosAPI, type HorarioDisponible } from '../../api/odontologos'
import Badge from '../../components/Badge'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  })
}

function fechaISO(fecha: string) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'UTC' })
}

const CANCELABLES = ['pendiente', 'confirmada', 'reprogramada']
const REPROGRAMABLES = ['pendiente', 'confirmada', 'reprogramada']

export default function MisCitas() {
  const { user } = useAuth()
  const { data: citas, loading, error, refetch } = useAsync<Cita[]>(
    () => user?.perfilId ? citasAPI.listar({ paciente_id: user.perfilId }) : Promise.resolve([]),
    [user?.perfilId]
  )

  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [reprogramar, setReprogramar] = useState<Cita | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const proximas = useMemo(() => citas?.filter(c => new Date(c.fecha_hora).getTime() >= Date.now()) ?? [], [citas])
  const pasadas = useMemo(() => citas?.filter(c => new Date(c.fecha_hora).getTime() < Date.now()) ?? [], [citas])

  const cancelarCita = async (e: React.MouseEvent, cita: Cita) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('¿Seguro que deseas cancelar esta cita?')) return
    setCancelandoId(cita.id)
    setCancelError(null)
    try {
      await citasAPI.cancelarPropia(cita.id)
      refetch()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'No se pudo cancelar la cita.')
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-1">Mis citas</h1>
          <p className="text-sm text-[#8B7355]">Consulta el estado de todas tus citas programadas y revisa tu historial inmediato.</p>
        </div>
        <div className="text-sm text-[#8B7355]">
          {loading ? 'Cargando citas...' : `${proximas.length} próximas · ${pasadas.length} pasadas`}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
      )}
      {cancelError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{cancelError}</div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-100 p-4 text-sm text-green-700">{aviso}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando tu historial de citas...</div>
      ) : !citas || citas.length === 0 ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">No se encontraron citas registradas. Solicita una cita para empezar.</div>
      ) : (
        <div className="grid gap-4">
          {citas.map(cita => (
            <Link key={cita.id} to={`/paciente/citas/${cita.id}`} className="block rounded-2xl border border-[#D4C4B0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#3D2B1F]">{cita.tratamiento_nombre}</div>
                  <div className="text-xs text-[#8B7355]">{formatFecha(cita.fecha_hora)} · {cita.odontologo_nombre}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge estado={cita.estado} />
                  {REPROGRAMABLES.includes(cita.estado) && new Date(cita.fecha_hora).getTime() >= Date.now() && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setAviso(null); setReprogramar(cita) }}
                      className="rounded-lg border border-[#D4C4B0] px-2.5 py-1 text-xs font-medium text-[#3D2B1F] hover:bg-[#F5EFE6]"
                    >
                      Reprogramar
                    </button>
                  )}
                  {CANCELABLES.includes(cita.estado) && new Date(cita.fecha_hora).getTime() >= Date.now() && (
                    <button
                      onClick={e => cancelarCita(e, cita)}
                      disabled={cancelandoId === cita.id}
                      className="rounded-lg border border-[#D4C4B0] px-2.5 py-1 text-xs font-medium text-[#A0623F] hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelandoId === cita.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                  <span className="text-xs font-medium text-[#8B7355]">Ver detalles</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#F5EFE6] p-3 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Odontólogo</div>
                  {cita.odontologo_nombre}
                </div>
                <div className="rounded-xl bg-[#F5EFE6] p-3 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Duración</div>
                  {cita.duracion_minutos} min
                </div>
              </div>

              {cita.motivo && (
                <div className="mt-4 rounded-xl bg-[#F9F5EE] p-4 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Motivo</div>
                  {cita.motivo}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {reprogramar && (
        <ReprogramarModal
          cita={reprogramar}
          onClose={() => setReprogramar(null)}
          onDone={() => {
            setReprogramar(null)
            setAviso('Solicitud de reprogramación enviada. El administrador la revisará y confirmará.')
            refetch()
          }}
        />
      )}
    </div>
  )
}

function ReprogramarModal({ cita, onClose, onDone }: { cita: Cita; onClose: () => void; onDone: () => void }) {
  const [fecha, setFecha] = useState(fechaISO(cita.fecha_hora))
  const [hora, setHora] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const { data: disponibilidad, loading } = useAsync<HorarioDisponible[]>(
    () => (cita.odontologo_id && fecha ? odontologosAPI.disponibilidad(cita.odontologo_id, fecha) : Promise.resolve([])),
    [cita.odontologo_id, fecha]
  )

  const horarios = useMemo(
    () => disponibilidad?.filter(h => h.disponible).map(h => h.hora) ?? [],
    [disponibilidad]
  )

  const submit = async () => {
    if (!hora) { setError('Selecciona un horario disponible.'); return }
    setGuardando(true)
    setError('')
    try {
      await citasAPI.reprogramarPropia(cita.id, { fecha_hora: `${fecha}T${hora}:00` })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reprogramar la cita.')
    } finally {
      setGuardando(false)
    }
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#D4C4B0] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#3D2B1F]">Reprogramar cita</h3>
          <button onClick={onClose} className="text-[#8B7355] hover:text-[#3D2B1F]"><X size={18} /></button>
        </div>

        <div className="rounded-xl bg-[#F5EFE6] p-3 text-sm text-[#3D2B1F] mb-4">
          <div className="font-semibold">{cita.tratamiento_nombre}</div>
          <div className="text-xs text-[#8B7355]">{cita.odontologo_nombre} · actual: {formatFecha(cita.fecha_hora)}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8B7355] mb-1 block">Nueva fecha</label>
            <input type="date" value={fecha} min={hoy} onChange={e => { setFecha(e.target.value); setHora('') }}
              className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A]" />
          </div>

          <div>
            <label className="text-xs text-[#8B7355] mb-1 block">Horario disponible</label>
            {loading ? (
              <div className="text-xs text-[#8B7355]">Buscando disponibilidad...</div>
            ) : horarios.length === 0 ? (
              <div className="text-xs text-[#8B7355]">No hay horarios disponibles ese día. Prueba otra fecha.</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map(h => (
                  <button key={h} type="button" onClick={() => setHora(h)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      hora === h ? 'bg-[#C17A5A] text-white border-[#C17A5A]' : 'bg-white text-[#3D2B1F] border-[#D4C4B0] hover:bg-[#F5EFE6]'
                    }`}>{h}</button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}

          <p className="text-[11px] text-[#8B7355]">
            La nueva fecha quedará pendiente de aprobación del administrador.
          </p>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
              Cancelar
            </button>
            <button onClick={submit} disabled={!hora || guardando}
              className="flex-1 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium">
              {guardando ? 'Enviando...' : 'Solicitar reprogramación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
