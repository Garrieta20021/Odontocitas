import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { pacientesAPI, type HistoriaEntry } from '../../api/pacientes'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  })
}

export default function HistorialPaciente() {
  const { user } = useAuth()
  const { data: historia, loading, error } = useAsync<HistoriaEntry[]>(
    () => user?.perfilId ? pacientesAPI.historia(user.perfilId) : Promise.resolve([]),
    [user?.perfilId]
  )
  const [filtroTratamiento, setFiltroTratamiento] = useState('Todos')

  const ordenada = useMemo(() => historia?.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()) ?? [], [historia])

  const tratamientos = useMemo(() => {
    const tipos = Array.from(new Set(ordenada.map(entry => entry.tratamiento_realizado)))
    return ['Todos', ...tipos]
  }, [ordenada])

  const historialesFiltrados = useMemo(() => {
    if (filtroTratamiento === 'Todos') return ordenada
    return ordenada.filter(entry => entry.tratamiento_realizado === filtroTratamiento)
  }, [ordenada, filtroTratamiento])

  const gruposPorTratamiento = useMemo(() => {
    const mapa = new Map<string, HistoriaEntry[]>()
    historialesFiltrados.forEach(entry => {
      const key = entry.tratamiento_realizado || 'Sin tratamiento'
      const grupo = mapa.get(key) ?? []
      grupo.push(entry)
      mapa.set(key, grupo)
    })
    return Array.from(mapa.entries())
  }, [historialesFiltrados])

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#3D2B1F] mb-1">Historial clínico</h1>
            <p className="text-sm text-[#8B7355] max-w-2xl">Revisa tus tratamientos registrados, notas de odontólogo y recomendaciones de seguimiento.</p>
          </div>
          <div className="text-sm text-[#8B7355]">{loading ? 'Cargando historial...' : `${ordenada.length} registros`}</div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tratamientos.map(t => (
            <button key={t} type="button" onClick={() => setFiltroTratamiento(t)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${filtroTratamiento === t ? 'bg-[#C17A5A] text-white' : 'bg-[#F5EFE6] text-[#3D2B1F] hover:bg-[#EDE0D4]'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando registros médicos...</div>
      ) : !ordenada || ordenada.length === 0 ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">No hay registros clínicos disponibles aún.</div>
      ) : (
        <div className="space-y-6">
          {gruposPorTratamiento.map(([tratamiento, entries]) => (
            <section key={tratamiento} className="rounded-3xl border border-[#D4C4B0] bg-white p-5 shadow-sm">
              {filtroTratamiento === 'Todos' && (
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#3D2B1F]">{tratamiento}</div>
                    <div className="text-xs text-[#8B7355]">{entries.length} registro{entries.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-xs text-[#8B7355] bg-[#F5EFE6] rounded-full px-3 py-1">Filtrado por categoría</div>
                </div>
              )}

              <div className="space-y-4">
                {entries.map(entry => (
                  <div key={entry.id} className="rounded-2xl border border-[#EDE0D4] bg-[#FBF7F2] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[#3D2B1F]">{entry.tratamiento_realizado}</div>
                        <div className="text-xs text-[#8B7355]">{formatFecha(entry.fecha)} · {entry.odontologo_nombre}</div>
                      </div>
                      <div className="text-xs text-[#8B7355] rounded-full bg-white px-3 py-1">Duración {entry.duracion_real ?? 0} min</div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-4 text-sm text-[#3D2B1F]">
                        <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Hallazgos</div>
                        {entry.hallazgos || 'Sin hallazgos registrados'}
                      </div>
                      <div className="rounded-xl bg-white p-4 text-sm text-[#3D2B1F]">
                        <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Recomendaciones</div>
                        {entry.recomendaciones || 'Sin recomendaciones adicionales'}
                      </div>
                    </div>

                    {entry.notas && (
                      <div className="mt-4 rounded-xl bg-[#EFEFEF] p-4 text-sm text-[#3D2B1F]">
                        <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Notas</div>
                        {entry.notas}
                      </div>
                    )}

                    {entry.materiales_usados && (
                      <div className="mt-4 rounded-xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                        <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-2">Materiales usados</div>
                        {entry.materiales_usados}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
