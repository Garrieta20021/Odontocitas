import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Plus } from 'lucide-react'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { pacientesAPI, type DienteOdontograma, type HistoriaEntry, type Paciente } from '../../api/pacientes'
import { odontologosAPI, type Odontologo } from '../../api/odontologos'
import { exportarPDF, type BloquePDF } from '../../utils/pdf'

const dientes = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
]
const superior = dientes.slice(0, 16)
const inferior = dientes.slice(16)

const colorDiente: Record<string, string> = {
  caries: 'bg-red-200 border-red-400',
  tratado: 'bg-green-200 border-green-400',
  ausente: 'bg-gray-200 border-gray-400',
  tratamiento: 'bg-amber-200 border-amber-400',
  normal: 'bg-white border-[#D4C4B0]',
}

function getInitials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(fecha: string | null | undefined) {
  if (!fecha) return 'Sin registro'
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return 'Sin registro'
  return parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function HistoriaClinica() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [notaAbierta, setNotaAbierta] = useState(false)

  const { data: paciente, loading: loadingPaciente, error: pacienteError } = useAsync<Paciente>(
    () => (id ? pacientesAPI.obtener(id) : Promise.reject(new Error('Paciente no especificado'))),
    [id]
  )
  const { data: historia, loading: loadingHistoria, error: historiaError, refetch: refetchHistoria } = useAsync<HistoriaEntry[]>(
    () => (id ? pacientesAPI.historia(id) : Promise.resolve([])),
    [id]
  )
  const { data: odontograma, loading: loadingOdontograma } = useAsync<DienteOdontograma[]>(
    () => (id ? pacientesAPI.odontograma(id) : Promise.resolve([])),
    [id]
  )
  const { data: odontologos } = useAsync<Odontologo[]>(() => odontologosAPI.listar())

  const estadoDiente = useMemo(() => {
    const map: Record<number, string> = {}
    odontograma?.forEach(d => { map[d.numero_diente] = d.estado })
    return map
  }, [odontograma])

  const registros = useMemo(
    () => historia?.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()) ?? [],
    [historia]
  )

  const alergias = paciente?.alergias?.filter(Boolean) ?? []
  const enfermedades = paciente?.enfermedades?.filter(Boolean) ?? []

  const exportar = async () => {
    if (!paciente) return
    const bloques: BloquePDF[] = [
      {
        tipo: 'kv',
        titulo: 'Datos del paciente',
        filas: [
          ['Nombre', paciente.nombre],
          ['Cédula', paciente.cedula],
          ['Edad', `${paciente.edad ?? 'N/A'} años`],
          ['Nacimiento', formatFecha(paciente.fecha_nacimiento)],
          ['Teléfono', paciente.telefono || '—'],
          ['Correo', paciente.email || '—'],
          ['EPS', paciente.eps || 'No registrado'],
          ['Grupo sanguíneo', paciente.grupo_sanguineo || 'No registrado'],
        ],
      },
      {
        tipo: 'kv',
        titulo: 'Antecedentes médicos',
        filas: [
          ['Alergias', alergias.length ? alergias.join(', ') : 'Ninguna registrada'],
          ['Enfermedades', enfermedades.length ? enfermedades.join(', ') : 'Ninguna registrada'],
          ['Medicación', paciente.medicamentos || 'No registrada'],
        ],
      },
    ]
    if ((odontograma ?? []).length > 0) {
      bloques.push({
        tipo: 'tabla',
        titulo: 'Odontograma',
        columnas: ['Diente', 'Estado', 'Notas'],
        filas: (odontograma ?? []).map(d => [d.numero_diente, d.estado, d.notas || '—']),
      })
    }
    bloques.push({
      tipo: 'tabla',
      titulo: 'Evolución clínica',
      columnas: ['Fecha', 'Tratamiento', 'Odontólogo', 'Hallazgos', 'Recomendaciones'],
      filas: registros.length
        ? registros.map(e => [
            formatFecha(e.fecha), e.tratamiento_realizado, e.odontologo_nombre ?? '—',
            e.hallazgos || '—', e.recomendaciones || '—',
          ])
        : [['—', 'Sin registros clínicos', '—', '—', '—']],
    })
    await exportarPDF({
      titulo: 'Historia clínica',
      subtitulo: `Paciente: ${paciente.nombre} · CC ${paciente.cedula}`,
      archivo: `historia-${paciente.cedula}.pdf`,
      notaLegal: 'Documento clínico confidencial (Ley 1581 de 2012 y Resolución 1995 de 1999). Conservación reglamentaria de la historia clínica.',
      bloques,
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-sm text-[#8B7355] mb-6">
        <button onClick={() => navigate('/admin/pacientes')} className="flex items-center gap-1 hover:text-[#C17A5A]">
          <ChevronLeft size={14} /> Pacientes
        </button>
        <span>/</span>
        <span className="text-[#3D2B1F] font-medium">{paciente?.nombre ?? 'Historia clinica'}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportar} disabled={!paciente} className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6] disabled:opacity-50">
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {(loadingPaciente || loadingHistoria || loadingOdontograma) ? (
        <div className="bg-white rounded-xl border border-[#D4C4B0] p-8 text-center text-sm text-[#8B7355]">Cargando historia clinica...</div>
      ) : pacienteError || historiaError ? (
        <div className="bg-red-50 rounded-xl border border-red-100 p-8 text-sm text-red-700">{pacienteError || historiaError}</div>
      ) : !paciente ? (
        <div className="bg-white rounded-xl border border-[#D4C4B0] p-8 text-center text-sm text-[#8B7355]">Paciente no encontrado.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-5 mb-4">
            <div className="flex items-center gap-4">
              <Avatar initials={getInitials(paciente.nombre)} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-[#3D2B1F]">{paciente.nombre}</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paciente.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {paciente.activo ? 'Activa' : 'Inactiva'}
                  </span>
                  {alergias.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Alergias: {alergias.join(', ')}</span>
                  )}
                </div>
                <div className="text-sm text-[#8B7355]">CC {paciente.cedula} · {paciente.edad ?? 'N/A'} anos · {paciente.telefono}</div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-xl font-bold text-[#3D2B1F]">{paciente.total_citas ?? 0}</div>
                  <div className="text-xs text-[#8B7355]">Citas totales</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-[#3D2B1F]">{registros.length}</div>
                  <div className="text-xs text-[#8B7355]">Registros</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-[#3D2B1F]">{formatFecha(paciente.ultima_visita).split(' ').slice(0, 2).join(' ')}</div>
                  <div className="text-xs text-[#8B7355]">Ultima visita</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-4">
              <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-[#3D2B1F]">Odontograma</h2>
                  <div className="flex items-center gap-3 text-xs text-[#8B7355]">
                    {[['Caries', 'bg-red-200'], ['Tratado', 'bg-green-200'], ['En tratamiento', 'bg-amber-200'], ['Ausente', 'bg-gray-200']].map(([label, color]) => (
                      <span key={label} className="flex items-center gap-1">
                        <span className={`w-3 h-3 rounded-sm ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-center text-xs text-[#8B7355] mb-1">Superior</div>
                <div className="flex justify-center gap-1 mb-2">
                  {superior.map(d => (
                    <div key={d} title={odontograma?.find(o => o.numero_diente === d)?.notas ?? ''}
                      className={`w-7 h-7 rounded border text-[9px] flex items-center justify-center font-medium ${colorDiente[estadoDiente[d] ?? 'normal']}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-1 mb-1">
                  {inferior.map(d => (
                    <div key={d} title={odontograma?.find(o => o.numero_diente === d)?.notas ?? ''}
                      className={`w-7 h-7 rounded border text-[9px] flex items-center justify-center font-medium ${colorDiente[estadoDiente[d] ?? 'normal']}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="text-center text-xs text-[#8B7355] mt-1">Inferior</div>

                <div className="mt-3 text-xs text-[#8B7355] bg-[#F5EFE6] rounded-lg p-2">
                  {odontograma?.length ? `${odontograma.length} piezas con registro clinico.` : 'Sin hallazgos registrados en odontograma.'}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-[#3D2B1F]">Evolucion clinica</h2>
                  <button onClick={() => setNotaAbierta(true)} className="flex items-center gap-1.5 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    <Plus size={12} /> Agregar nota
                  </button>
                </div>
                {registros.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#D4C4B0] bg-[#FBF7F2] p-6 text-center text-sm text-[#8B7355]">Este paciente aun no tiene registros clinicos.</div>
                ) : (
                  <div className="space-y-4">
                    {registros.map(entry => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="text-right w-24 flex-shrink-0">
                          <div className="text-xs font-medium text-[#C17A5A]">{formatFecha(entry.fecha)}</div>
                        </div>
                        <div className="flex-1 border-l-2 border-[#EDE0D4] pl-3 pb-4">
                          <div className="font-medium text-sm text-[#3D2B1F] mb-1">{entry.tratamiento_realizado}</div>
                          {entry.hallazgos && <p className="text-xs text-[#8B7355] mb-1"><span className="font-medium text-[#3D2B1F]">Hallazgos:</span> {entry.hallazgos}</p>}
                          {entry.notas && <p className="text-xs text-[#8B7355] mb-1">{entry.notas}</p>}
                          {entry.recomendaciones && <p className="text-xs text-[#8B7355] mb-1"><span className="font-medium text-[#3D2B1F]">Recomendaciones:</span> {entry.recomendaciones}</p>}
                          <div className="text-[10px] text-[#8B7355]">{entry.odontologo_nombre ?? 'Sin odontologo'} · Duracion: {entry.duracion_real ?? 0} min</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-56 space-y-4">
              <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
                <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Datos personales</h3>
                <div className="space-y-2 text-xs">
                  {[
                    ['Nacimiento', formatFecha(paciente.fecha_nacimiento)],
                    ['Telefono', paciente.telefono],
                    ['Correo', paciente.email],
                    ['EPS', paciente.eps || 'No registrado'],
                    ['Grupo sanguineo', paciente.grupo_sanguineo || 'No registrado'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="text-[#8B7355]">{label}</span>
                      <span className="font-medium text-[#3D2B1F] text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
                <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Antecedentes medicos</h3>
                <div className="space-y-1.5 text-xs text-[#8B7355]">
                  <div>Alergias: {alergias.length ? alergias.join(', ') : 'Ninguna registrada'}</div>
                  <div>Enfermedades: {enfermedades.length ? enfermedades.join(', ') : 'Ninguna registrada'}</div>
                  <div>Medicacion: {paciente.medicamentos || 'No registrada'}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {notaAbierta && paciente && (
        <NotaClinicaModal
          paciente={paciente}
          odontologos={odontologos ?? []}
          onClose={() => setNotaAbierta(false)}
          onSaved={() => { setNotaAbierta(false); refetchHistoria() }}
        />
      )}
    </div>
  )
}

function NotaClinicaModal({
  paciente,
  odontologos,
  onClose,
  onSaved,
}: {
  paciente: Paciente
  odontologos: Odontologo[]
  onClose: () => void
  onSaved: () => void
}) {
  const [odontologoId, setOdontologoId] = useState(odontologos[0]?.id ?? '')
  const [tratamiento, setTratamiento] = useState('')
  const [hallazgos, setHallazgos] = useState('')
  const [notas, setNotas] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')
  const [materiales, setMateriales] = useState('')
  const [duracion, setDuracion] = useState(45)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!odontologoId) { setError('Selecciona el odontólogo responsable.'); return }
    if (!tratamiento.trim()) { setError('El tratamiento realizado es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      await pacientesAPI.agregarNota(paciente.id, {
        odontologo_id: odontologoId,
        tratamiento_realizado: tratamiento.trim(),
        hallazgos: hallazgos.trim() || undefined,
        notas: notas.trim() || undefined,
        recomendaciones: recomendaciones.trim() || undefined,
        materiales_usados: materiales.trim() || undefined,
        duracion_real: duracion,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la nota clínica.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[#D4C4B0] bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#3D2B1F]">Agregar nota clínica</h3>
            <p className="text-xs text-[#8B7355]">Paciente: {paciente.nombre}</p>
          </div>
          <button onClick={onClose} className="text-[#8B7355] hover:text-[#3D2B1F]">X</button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B7355]">Odontólogo</label>
            <select value={odontologoId} onChange={e => setOdontologoId(e.target.value)} className="w-full rounded-lg border border-[#D4C4B0] bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#C17A5A] focus:outline-none">
              <option value="">Seleccionar...</option>
              {odontologos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8B7355]">Duración real (min)</label>
            <input type="number" min={1} value={duracion} onChange={e => setDuracion(Number(e.target.value))} className="w-full rounded-lg border border-[#D4C4B0] px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#C17A5A] focus:outline-none" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#8B7355]">Tratamiento realizado</label>
            <input value={tratamiento} onChange={e => setTratamiento(e.target.value)} className="w-full rounded-lg border border-[#D4C4B0] px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#C17A5A] focus:outline-none" />
          </div>
          {[
            ['Hallazgos', hallazgos, setHallazgos],
            ['Notas clínicas', notas, setNotas],
            ['Recomendaciones', recomendaciones, setRecomendaciones],
            ['Materiales usados', materiales, setMateriales],
          ].map(([label, value, setter]) => (
            <div key={label as string}>
              <label className="mb-1 block text-xs font-medium text-[#8B7355]">{label as string}</label>
              <textarea value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)} rows={3}
                className="w-full resize-none rounded-lg border border-[#D4C4B0] px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#C17A5A] focus:outline-none" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#D4C4B0] py-2 text-sm text-[#8B7355] hover:bg-[#F5EFE6]">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-[#C17A5A] py-2 text-sm font-medium text-white hover:bg-[#A0623F] disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
