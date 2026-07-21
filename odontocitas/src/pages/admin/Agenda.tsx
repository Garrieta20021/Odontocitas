import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Download, Eye, Edit2, MoreHorizontal, Calendar } from 'lucide-react'
import Badge from '../../components/Badge'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { citasAPI } from '../../api/citas'
import type { Cita } from '../../api/citas'
import { exportarPDF } from '../../utils/pdf'

type Filtro = 'Todas' | 'Confirmadas' | 'Pendientes' | 'Canceladas'

const estadoMap: Record<Filtro, string | undefined> = {
  Todas: undefined,
  Confirmadas: 'confirmada',
  Pendientes: 'pendiente',
  Canceladas: 'cancelada',
}

function formatFecha(fechaHora: string) {
  return new Date(fechaHora).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function formatHora(fechaHora: string) {
  return new Date(fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function getInitials(nombre: string) { return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() }

export default function Agenda() {
  const [filtro, setFiltro] = useState<Filtro>('Todas')
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()

  const { data: citas, loading } = useAsync(
    () => citasAPI.listar({ estado: estadoMap[filtro] }),
    [filtro]
  )

  const filtered = (citas ?? []).filter(c =>
    c.paciente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.tratamiento_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const noResults = !loading && filtered.length === 0

  const exportar = async () => {
    if (filtered.length === 0) return
    await exportarPDF({
      titulo: 'Agenda de citas',
      subtitulo: `Filtro: ${filtro} · ${filtered.length} cita(s)`,
      archivo: `agenda-${new Date().toISOString().slice(0, 10)}.pdf`,
      notaLegal: 'Programación clínica de uso interno. Contiene datos de pacientes protegidos por Habeas Data.',
      bloques: [
        {
          tipo: 'tabla',
          titulo: 'Citas programadas',
          columnas: ['Fecha', 'Hora', 'Paciente', 'Odontólogo', 'Tratamiento', 'Estado'],
          filas: filtered.map(c => [
            formatFecha(c.fecha_hora), formatHora(c.fecha_hora), c.paciente_nombre,
            c.odontologo_nombre, c.tratamiento_nombre ?? '—', capitalize(c.estado),
          ]),
        },
      ],
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Agenda de citas</h1>
          <p className="text-sm text-[#8B7355] mt-0.5">Gestiona todas las citas de la clínica</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            <Download size={14} /> Exportar PDF
          </button>
          <button onClick={() => navigate('/admin/agenda/asignar')}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Calendar size={14} /> Calendario
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
          <input type="text" placeholder="Buscar paciente o tratamiento..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D4C4B0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#C17A5A]" />
        </div>
        {(['Todas', 'Confirmadas', 'Pendientes', 'Canceladas'] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === f ? 'bg-[#C17A5A] text-white' : 'bg-white border border-[#D4C4B0] text-[#8B7355] hover:bg-[#F5EFE6]'
            }`}>{f}</button>
        ))}
        <button className="flex items-center gap-1.5 border border-[#D4C4B0] bg-white text-[#8B7355] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5EFE6]">
          <Filter size={13} /> Filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-[#C17A5A]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EDE0D4]">
                {['PACIENTE', 'TRATAMIENTO', 'ODONTÓLOGO', 'FECHA', 'HORA', 'ESTADO', 'ACCIONES'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-[#8B7355] px-4 py-3 tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {noResults ? (
                <tr><td colSpan={7}>
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="w-12 h-12 bg-[#F5EFE6] rounded-xl flex items-center justify-center mb-3">
                      <Search size={20} className="text-[#8B7355]" />
                    </div>
                    <p className="font-medium text-[#3D2B1F] mb-1">No se encontraron citas</p>
                    <p className="text-sm text-[#8B7355] mb-4">Intenta con otro término o crea una nueva cita.</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setBusqueda(''); setFiltro('Todas') }}
                        className="border border-[#D4C4B0] px-3 py-1.5 rounded-lg text-sm text-[#8B7355] hover:bg-[#F5EFE6]">
                        Limpiar filtros
                      </button>
                      <button onClick={() => navigate('/admin/agenda/asignar')}
                        className="bg-[#C17A5A] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        + Nueva cita
                      </button>
                    </div>
                  </div>
                </td></tr>
              ) : (
                filtered.map((c: Cita) => (
                  <tr key={c.id} className="border-b border-[#F5EFE6] hover:bg-[#FDFAF7] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar initials={getInitials(c.paciente_nombre)} size="sm" />
                        <span className="text-sm font-medium text-[#3D2B1F]">{c.paciente_nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#3D2B1F]">{c.tratamiento_nombre}</td>
                    <td className="px-4 py-3 text-sm text-[#8B7355]">{c.odontologo_nombre}</td>
                    <td className="px-4 py-3 text-sm text-[#8B7355]">{formatFecha(c.fecha_hora)}</td>
                    <td className="px-4 py-3 text-sm text-[#8B7355]">{formatHora(c.fecha_hora)}</td>
                    <td className="px-4 py-3"><Badge estado={capitalize(c.estado)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/admin/agenda/completada/${c.id}`)}
                          className="p-1.5 rounded-lg hover:bg-[#F5EFE6] text-[#8B7355] hover:text-[#C17A5A]"><Eye size={14} /></button>
                        <button onClick={() => navigate(`/admin/agenda/reprogramar/${c.id}`)}
                          className="p-1.5 rounded-lg hover:bg-[#F5EFE6] text-[#8B7355] hover:text-[#C17A5A]"><Edit2 size={14} /></button>
                        {c.estado !== 'cancelada' && (
                          <button className="p-1.5 rounded-lg hover:bg-[#F5EFE6] text-[#8B7355] hover:text-[#C17A5A]">
                            <MoreHorizontal size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
