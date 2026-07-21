import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Plus, Trash2 } from 'lucide-react'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { pacientesAPI, type Paciente } from '../../api/pacientes'
import { exportarPDF } from '../../utils/pdf'

type Filtro = 'Todos' | 'Activos' | 'Inactivos'

function getInitials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function Pacientes() {
  const [filtro, setFiltro] = useState<Filtro>('Todos')
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()

  const activoParam = filtro === 'Activos' ? true : filtro === 'Inactivos' ? false : undefined

  const { data: pacientes, loading, refetch } = useAsync(
    () => pacientesAPI.listar({ busqueda: busqueda || undefined, activo: activoParam }),
    [filtro, busqueda]
  )

  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportar = async () => {
    const filas = pacientes ?? []
    if (filas.length === 0) { setError('No hay pacientes para exportar.'); return }
    await exportarPDF({
      titulo: 'Listado de pacientes',
      subtitulo: `${filas.length} paciente(s) · Filtro: ${filtro}`,
      archivo: `pacientes-${new Date().toISOString().slice(0, 10)}.pdf`,
      notaLegal: 'Contiene datos personales protegidos por la Ley 1581 de 2012 (Habeas Data). Uso exclusivo del personal autorizado.',
      bloques: [
        {
          tipo: 'tabla',
          titulo: 'Pacientes registrados',
          columnas: ['Nombre', 'Cédula', 'Edad', 'Teléfono', 'EPS', 'Citas', 'Última visita'],
          filas: filas.map(p => [
            p.nombre, p.cedula, p.edad ?? '—', p.telefono ?? '—',
            p.eps || '—', p.total_citas ?? 0, formatFecha(p.ultima_visita),
          ]),
        },
      ],
    })
  }

  const eliminarPaciente = async (e: React.MouseEvent, p: Paciente) => {
    e.stopPropagation()
    const ok = window.confirm(
      `¿Eliminar permanentemente a ${p.nombre}?\n\nSe borrarán también su usuario de acceso, citas, historia clínica y facturas. Esta acción no se puede deshacer.`
    )
    if (!ok) return
    setEliminandoId(p.id)
    setError(null)
    try {
      await pacientesAPI.eliminar(p.id)
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el paciente.')
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Pacientes</h1>
          <p className="text-sm text-[#C17A5A] mt-0.5">
            {pacientes ? `${pacientes.length} pacientes registrados` : 'Cargando...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            <Download size={14} /> Exportar PDF
          </button>
          <button onClick={() => navigate('/admin/pacientes/nuevo')}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={14} /> Nuevo paciente
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
          <input type="text" placeholder="Buscar por nombre, cédula o teléfono..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D4C4B0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#C17A5A]" />
        </div>
        {(['Todos', 'Activos', 'Inactivos'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === f ? 'bg-[#C17A5A] text-white' : 'bg-white border border-[#D4C4B0] text-[#8B7355] hover:bg-[#F5EFE6]'
            }`}>{f}</button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-[#C17A5A]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(pacientes ?? []).map(p => (
            <div key={p.id}
              onClick={() => navigate(`/admin/pacientes/${p.id}/historia`)}
              className="bg-white rounded-xl border border-[#D4C4B0] p-4 cursor-pointer hover:border-[#C17A5A] hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <Avatar initials={getInitials(p.nombre)} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#3D2B1F] text-sm">{p.nombre}</div>
                  <div className="text-xs text-[#8B7355]">CC {p.cedula} · {p.edad} años</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[#C17A5A]">{p.total_citas} citas</div>
                  <div className="text-[10px] text-[#8B7355]">Últ. {formatFecha(p.ultima_visita)}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EFE6] flex justify-end">
                <button
                  onClick={e => eliminarPaciente(e, p)}
                  disabled={eliminandoId === p.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#A0623F] hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={13} /> {eliminandoId === p.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
