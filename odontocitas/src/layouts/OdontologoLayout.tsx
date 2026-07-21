import { NavLink, useNavigate } from 'react-router-dom'
import { Calendar, Users, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import PageTransition from '../components/PageTransition'

export default function OdontologoLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-[#F5EFE6] overflow-hidden">
      <aside className="w-44 bg-[#F0E8DC] border-r border-[#D4C4B0] flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-[#D4C4B0]">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <div>
              <div className="text-sm font-bold text-[#3D2B1F]">Odontocitas</div>
              <div className="text-xs text-[#8B7355]">Clínica Sonrisas</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2">
          <div className="text-[10px] font-semibold text-[#8B7355] px-2 mb-1 tracking-wider">MI ESPACIO</div>
          {[
            { label: 'Mi agenda', icon: Calendar, to: '/odontologo/agenda' },
            { label: 'Mis pacientes', icon: Users, to: '/odontologo/pacientes' },
          ].map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm mb-0.5 transition-colors ${isActive ? 'bg-[#C17A5A] text-white font-medium' : 'text-[#3D2B1F] hover:bg-[#EDE0D4]'}`
              }>
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#D4C4B0]">
          <div className="flex items-center gap-2">
            <Avatar initials={user?.initials ?? 'DG'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#3D2B1F] truncate">{user?.nombre}</div>
              <div className="text-[10px] text-[#8B7355]">Odontóloga General</div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className="text-[#8B7355] hover:text-[#C17A5A]">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><PageTransition /></main>
    </div>
  )
}
