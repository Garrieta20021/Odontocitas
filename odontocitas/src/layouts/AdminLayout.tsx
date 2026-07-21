import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, Users, CreditCard, Package, BarChart2, Bell, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { notificacionesAPI } from '../api/notificaciones'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import PageTransition from '../components/PageTransition'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard', group: 'PRINCIPAL' },
  { label: 'Agenda', icon: Calendar, to: '/admin/agenda', group: 'ATENCIÓN' },
  { label: 'Pacientes', icon: Users, to: '/admin/pacientes', group: 'ATENCIÓN' },
  { label: 'Facturación', icon: CreditCard, to: '/admin/facturacion', group: 'ADMINISTRACIÓN' },
  { label: 'Inventario', icon: Package, to: '/admin/inventario', group: 'ADMINISTRACIÓN' },
  { label: 'Reportes', icon: BarChart2, to: '/admin/reportes', group: 'ADMINISTRACIÓN' },
  { label: 'Notificaciones', icon: Bell, to: '/admin/notificaciones', group: 'SISTEMA' },
  { label: 'Configuración', icon: Settings, to: '/admin/configuracion', group: 'SISTEMA' },
]

const groups = ['PRINCIPAL', 'ATENCIÓN', 'ADMINISTRACIÓN', 'SISTEMA']

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sinLeer, setSinLeer] = useState(0)

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      try {
        const resumen = await notificacionesAPI.resumen()
        if (activo) setSinLeer(resumen?.sin_leer ?? 0)
      } catch {
        if (activo) setSinLeer(0)
      }
    }
    cargar()
    const onFocus = () => cargar()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(cargar, 30000)
    return () => { activo = false; window.removeEventListener('focus', onFocus); window.clearInterval(id) }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#F5EFE6] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-44 bg-[#F0E8DC] border-r border-[#D4C4B0] flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-[#D4C4B0]">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <div>
              <div className="text-sm font-bold text-[#3D2B1F]">Odontocitas</div>
              <div className="text-xs text-[#8B7355]">Clínica Sonrisas</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {groups.map(group => {
            const items = navItems.filter(i => i.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="mb-3">
                <div className="text-[10px] font-semibold text-[#8B7355] px-2 mb-1 tracking-wider">{group}</div>
                {items.map(item => {
                  const badge = item.to === '/admin/notificaciones' ? sinLeer : 0
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm mb-0.5 transition-colors ${
                          isActive
                            ? 'bg-[#C17A5A] text-white font-medium'
                            : 'text-[#3D2B1F] hover:bg-[#EDE0D4]'
                        }`
                      }
                    >
                      <item.icon size={15} />
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 && (
                        <span className="bg-[#C17A5A] text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-[#D4C4B0]">
          <div className="flex items-center gap-2">
            <Avatar initials={user?.initials ?? 'AG'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#3D2B1F] truncate">{user?.nombre}</div>
              <div className="text-[10px] text-[#8B7355]">Administradora</div>
            </div>
            <button onClick={handleLogout} className="text-[#8B7355] hover:text-[#C17A5A] transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <PageTransition />
      </main>
    </div>
  )
}
