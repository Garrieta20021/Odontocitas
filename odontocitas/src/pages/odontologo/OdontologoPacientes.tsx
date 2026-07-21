import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import Avatar from '../../components/Avatar'
import { useAsync } from '../../hooks/useAsync'
import { pacientesAPI, type Paciente } from '../../api/pacientes'

function getInitials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(fecha: string | null) {
  if (!fecha) return 'Sin registro'
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function OdontologoPacientes() {
  const [busqueda, setBusqueda] = useState('')
  const { data: pacientes, loading, error } = useAsync<Paciente[]>(
    () => pacientesAPI.listar({ busqueda: busqueda || undefined }),
    [busqueda]
  )

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-1">Pacientes</h1>
          <p className="text-sm text-[#8B7355] max-w-2xl">Accede a los pacientes asignados y revisa su historial clínico.</p>
        </div>
        <div className="text-sm text-[#8B7355]">{loading ? 'Cargando pacientes...' : `${pacientes?.length ?? 0} pacientes`}</div>
      </div>

      <div className="relative max-w-md mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar paciente por nombre, cédula o email..."
          className="w-full pl-10 pr-3 py-2 border border-[#D4C4B0] rounded-lg bg-white text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A]" />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">Cargando pacientes...</div>
      ) : !pacientes || pacientes.length === 0 ? (
        <div className="rounded-xl border border-[#D4C4B0] bg-white p-8 text-center text-sm text-[#8B7355]">No se encontraron pacientes. Ajusta tu búsqueda o espera a nuevas asignaciones.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pacientes.map(p => (
            <Link key={p.id} to={`/odontologo/historia/${p.id}`} className="block rounded-3xl border border-[#D4C4B0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-4 mb-4">
                <Avatar initials={getInitials(p.nombre)} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#3D2B1F] truncate">{p.nombre}</div>
                  <div className="text-xs text-[#8B7355] truncate">CC {p.cedula}</div>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-[#3D2B1F]">
                <div className="rounded-2xl bg-[#F5EFE6] p-3">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Última visita</div>
                  {formatFecha(p.ultima_visita)}
                </div>
                <div className="rounded-2xl bg-[#F5EFE6] p-3">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Historial</div>
                  {p.total_citas} citas
                </div>
                <div className="rounded-2xl bg-[#F5EFE6] p-3">
                  <div className="text-[10px] text-[#8B7355] uppercase tracking-[.16em] mb-1">Estado</div>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
