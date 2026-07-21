import { useNavigate } from 'react-router-dom'
import { Calendar, Users, CreditCard } from 'lucide-react'
import Logo from '../components/Logo'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex flex-col">
      <div className="p-4 border-b border-[#D4C4B0] bg-white flex items-center gap-2">
        <Logo size="sm" />
        <span className="font-bold text-[#3D2B1F]">Odontocitas</span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-[120px] font-bold text-[#EDE0D4] leading-none mb-2">404</div>
          <h1 className="text-2xl font-bold text-[#3D2B1F] mb-2">Página no encontrada</h1>
          <p className="text-[#8B7355] mb-8 max-w-sm">
            La sección que buscas no existe o no tienes permisos para acceder a ella.
          </p>

          <div className="flex gap-3 justify-center mb-8">
            <button onClick={() => navigate(-1)}
              className="border border-[#D4C4B0] bg-white text-[#8B7355] px-4 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
              Volver atrás
            </button>
            <button onClick={() => navigate('/admin/dashboard')}
              className="bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Ir al dashboard
            </button>
          </div>

          <div className="flex gap-3 justify-center">
            {[
              { icon: <Calendar size={16} />, label: 'Agenda', to: '/admin/agenda' },
              { icon: <Users size={16} />, label: 'Pacientes', to: '/admin/pacientes' },
              { icon: <CreditCard size={16} />, label: 'Facturación', to: '/admin/facturacion' },
            ].map(item => (
              <button key={item.label} onClick={() => navigate(item.to)}
                className="flex flex-col items-center gap-1.5 border border-[#D4C4B0] bg-white px-6 py-3 rounded-xl hover:border-[#C17A5A] hover:bg-[#F5EFE6] transition-colors text-[#8B7355]">
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
