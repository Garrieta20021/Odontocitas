import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Download, ChevronDown } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import { pacientesAPI, type Paciente, type HistoriaEntry } from '../../api/pacientes'
import { exportarPDF } from '../../utils/pdf'

function formatFecha(fecha: string | null | undefined) {
  if (!fecha) return 'Sin registro'
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return 'Sin registro'
  return parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function OdontologoHistoria() {
  const { id } = useParams<{ id?: string }>()
  const [busqueda, setBusqueda] = useState('')
  const [filtroTratamiento, setFiltroTratamiento] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const { data: paciente, loading: loadingPaciente, error: pacienteError } = useAsync<Paciente>(
    () => (id ? pacientesAPI.obtener(id) : Promise.resolve(null as unknown as Paciente)),
    [id]
  )
  const { data: historia, loading: loadingHistoria, error: historiaError } = useAsync<HistoriaEntry[]>(
    () => (id ? pacientesAPI.historia(id) : Promise.resolve([])),
    [id]
  )

  const registros = useMemo(() => historia?.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()) ?? [], [historia])

  // Extraer tipos de tratamiento únicos
  const tiposTratamiento = useMemo(() => {
    const tipos = new Set(registros.map(r => r.tratamiento_realizado))
    return Array.from(tipos).sort()
  }, [registros])

  // Filtrar y agrupar por tipo de tratamiento
  const registrosAgrupados = useMemo(() => {
    let filtered = registros
    
    // Filtrar por búsqueda
    if (busqueda) {
      const query = busqueda.toLowerCase()
      filtered = filtered.filter(r =>
        r.tratamiento_realizado.toLowerCase().includes(query) ||
        r.hallazgos?.toLowerCase().includes(query) ||
        r.notas?.toLowerCase().includes(query) ||
        r.recomendaciones?.toLowerCase().includes(query)
      )
    }

    // Filtrar por tipo de tratamiento
    if (filtroTratamiento) {
      filtered = filtered.filter(r => r.tratamiento_realizado === filtroTratamiento)
    }

    // Agrupar por tipo
    const grouped: Record<string, HistoriaEntry[]> = {}
    filtered.forEach(r => {
      if (!grouped[r.tratamiento_realizado]) {
        grouped[r.tratamiento_realizado] = []
      }
      grouped[r.tratamiento_realizado].push(r)
    })

    return grouped
  }, [registros, busqueda, filtroTratamiento])

  const toggleGroup = (tipo: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }))
  }

  const exportar = async () => {
    if (!paciente) return
    await exportarPDF({
      titulo: 'Historia clínica',
      subtitulo: `Paciente: ${paciente.nombre} · CC ${paciente.cedula}`,
      archivo: `historia-${paciente.cedula}.pdf`,
      notaLegal: 'Documento clínico confidencial (Ley 1581 de 2012 y Resolución 1995 de 1999). Conservación reglamentaria de la historia clínica.',
      bloques: [
        {
          tipo: 'kv',
          titulo: 'Datos del paciente',
          filas: [
            ['Nombre', paciente.nombre],
            ['Cédula', paciente.cedula],
            ['Edad', `${paciente.edad ?? 'N/A'} años`],
            ['Correo', paciente.email || '—'],
            ['EPS', paciente.eps || 'No registrado'],
            ['Grupo sanguíneo', paciente.grupo_sanguineo || 'No registrado'],
            ['Alergias', paciente.alergias?.length ? paciente.alergias.join(', ') : 'Ninguna registrada'],
            ['Medicamentos', paciente.medicamentos || 'No registrado'],
          ],
        },
        {
          tipo: 'tabla',
          titulo: 'Registros clínicos',
          columnas: ['Fecha', 'Tratamiento', 'Odontólogo', 'Hallazgos', 'Recomendaciones', 'Min'],
          filas: registros.length
            ? registros.map(e => [
                formatFecha(e.fecha), e.tratamiento_realizado, e.odontologo_nombre ?? '—',
                e.hallazgos || '—', e.recomendaciones || '—', e.duracion_real ?? 0,
              ])
            : [['—', 'Sin registros clínicos', '—', '—', '—', '0']],
        },
      ],
    })
  }


  if (!id) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-[#D4C4B0] bg-white p-8 text-center">
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-3">Historia clínica</h1>
          <p className="text-sm text-[#8B7355] mb-6">Selecciona un paciente desde la lista de pacientes para ver su historial clínico.</p>
          <Link to="/odontologo/pacientes" className="inline-flex items-center rounded-full bg-[#C17A5A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#A0623F]">Ver pacientes</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#8B7355] mb-3">
            <Link to="/odontologo/pacientes" className="hover:text-[#C17A5A]">← Pacientes</Link>
            <span>/</span>
            <span className="font-medium text-[#3D2B1F]">Historia clínica</span>
          </div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">{paciente?.nombre ?? 'Paciente'}</h1>
          <p className="text-sm text-[#8B7355]">Historial médico y notas clínicas registradas por el equipo de odontología.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} disabled={!paciente} className="flex items-center gap-2 rounded-full border border-[#D4C4B0] bg-white px-4 py-2 text-sm text-[#8B7355] hover:bg-[#F5EFE6] disabled:opacity-50"><Download size={14} /> Exportar PDF</button>
        </div>
      </div>

      {(loadingPaciente || loadingHistoria) ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando historial clínico...</div>
      ) : pacienteError || historiaError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">{pacienteError || historiaError}</div>
      ) : !paciente ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Paciente no encontrado.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#3D2B1F]">{paciente.nombre}</div>
                  <div className="text-xs text-[#8B7355]">CC {paciente.cedula} · {paciente.edad} años · {paciente.email}</div>
                </div>
                <div className="rounded-full bg-[#F5EFE6] px-3 py-1 text-xs font-semibold text-[#3D2B1F]">{paciente.activo ? 'Activo' : 'Inactivo'}</div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">EPS</div>
                  {paciente.eps || 'No registrado'}
                </div>
                <div className="rounded-2xl bg-[#F5EFE6] p-4 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Grupo sanguíneo</div>
                  {paciente.grupo_sanguineo || 'No registrado'}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F9F5EE] p-4 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Alergias</div>
                  {paciente.alergias?.length ? paciente.alergias.join(', ') : 'Ninguna registrada'}
                </div>
                <div className="rounded-2xl bg-[#F9F5EE] p-4 text-sm text-[#3D2B1F]">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Medicamentos</div>
                  {paciente.medicamentos || 'No registrado'}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#D4C4B0] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#3D2B1F]">Registros clínicos</h2>
                  <p className="text-xs text-[#8B7355]">{Object.values(registrosAgrupados).flat().length} entradas</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <input type="text" placeholder="Buscar en hallazgos, notas, recomendaciones..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-2 block">Filtrar por tratamiento</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFiltroTratamiento(null)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filtroTratamiento === null ? 'bg-[#C17A5A] text-white' : 'bg-[#F5EFE6] text-[#8B7355] hover:bg-[#EDE0D4]'}`}>
                      Todos
                    </button>
                    {tiposTratamiento.map(tipo => (
                      <button key={tipo} onClick={() => setFiltroTratamiento(tipo)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filtroTratamiento === tipo ? 'bg-[#C17A5A] text-white' : 'bg-[#F5EFE6] text-[#8B7355] hover:bg-[#EDE0D4]'}`}>
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {Object.keys(registrosAgrupados).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D4C4B0] bg-[#FBF7F2] p-6 text-center text-sm text-[#8B7355]">No hay registros que coincidan con los filtros.</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(registrosAgrupados).map(([tipo, entries]) => (
                    <div key={tipo} className="border border-[#EDE0D4] rounded-2xl overflow-hidden bg-[#FAF7F3]">
                      <button onClick={() => toggleGroup(tipo)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F5EFE6] transition">
                        <div className="flex-1 text-left">
                          <div className="text-sm font-semibold text-[#3D2B1F]">{tipo}</div>
                          <div className="text-xs text-[#8B7355]">{entries.length} registr{entries.length === 1 ? 'o' : 'os'}</div>
                        </div>
                        <ChevronDown size={16} className={`text-[#8B7355] transition-transform ${expandedGroups[tipo] ? 'rotate-180' : ''}`} />
                      </button>

                      {expandedGroups[tipo] && (
                        <div className="border-t border-[#EDE0D4] px-4 py-3 space-y-3 bg-white">
                          {entries.map(entry => (
                            <div key={entry.id} className="rounded-xl border border-[#EDE0D4] bg-[#FBF7F2] p-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
                                <div className="text-xs text-[#8B7355]">{formatFecha(entry.fecha)} · {entry.odontologo_nombre}</div>
                                <div className="text-xs font-semibold text-[#3D2B1F]">{entry.duracion_real ?? 0} min</div>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                {entry.hallazgos && (
                                  <div className="rounded-lg bg-white p-2 text-sm text-[#3D2B1F]">
                                    <div className="text-[9px] text-[#8B7355] uppercase tracking-[.16em] mb-0.5">Hallazgos</div>
                                    {entry.hallazgos}
                                  </div>
                                )}
                                {entry.recomendaciones && (
                                  <div className="rounded-lg bg-white p-2 text-sm text-[#3D2B1F]">
                                    <div className="text-[9px] text-[#8B7355] uppercase tracking-[.16em] mb-0.5">Recomendaciones</div>
                                    {entry.recomendaciones}
                                  </div>
                                )}
                              </div>

                              {entry.notas && (
                                <div className="mt-2 rounded-lg bg-[#EFEFEF] p-2 text-sm text-[#3D2B1F]">
                                  <div className="text-[9px] text-[#8B7355] uppercase tracking-[.16em] mb-0.5">Notas</div>
                                  {entry.notas}
                                </div>
                              )}

                              {entry.materiales_usados && (
                                <div className="mt-2 rounded-lg bg-[#F5EFE6] p-2 text-sm text-[#3D2B1F]">
                                  <div className="text-[9px] text-[#8B7355] uppercase tracking-[.16em] mb-0.5">Materiales</div>
                                  {entry.materiales_usados}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#D4C4B0] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#3D2B1F] mb-3">Resumen del paciente</h2>
              <div className="space-y-3 text-sm text-[#3D2B1F]">
                <div className="flex justify-between"><span className="text-[#8B7355]">Citas totales</span><span>{paciente.total_citas}</span></div>
                <div className="flex justify-between"><span className="text-[#8B7355]">Última visita</span><span>{formatFecha(paciente.ultima_visita ?? '')}</span></div>
                <div className="flex justify-between"><span className="text-[#8B7355]">Teléfono</span><span>{paciente.telefono}</span></div>
                <div className="flex justify-between"><span className="text-[#8B7355]">Email</span><span>{paciente.email}</span></div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
