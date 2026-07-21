import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function LoadingScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/login'), 2500)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-[#D4C4B0] p-10 w-80 flex flex-col items-center gap-4">
        <Logo size="lg" />
        <div className="text-center">
          <div className="text-xl font-bold text-[#3D2B1F]">Odontocitas</div>
          <div className="text-sm text-[#8B7355] mt-1">Cargando tu espacio de trabajo...</div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#EDE0D4] rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-[#C17A5A] rounded-full animate-[progress_2.5s_ease-in-out_forwards]" style={{ width: '100%', animation: 'none', transition: 'width 2.5s ease' }} />
        </div>
        <div className="text-xs text-[#8B7355]">Verificando sesión...</div>

        {/* Skeleton */}
        <div className="w-full bg-[#F5EFE6] rounded-xl p-3 border border-[#EDE0D4]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-[#EDE0D4] rounded-full animate-pulse" />
            <div className="h-3 bg-[#EDE0D4] rounded w-24 animate-pulse" />
          </div>
          <div className="flex gap-2 mb-3">
            <div className="h-6 bg-[#EDE0D4] rounded w-16 animate-pulse" />
            <div className="h-6 bg-[#EDE0D4] rounded w-16 animate-pulse" />
            <div className="h-6 bg-[#EDE0D4] rounded w-16 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-[#EDE0D4] rounded w-full animate-pulse" />
            <div className="h-2 bg-[#EDE0D4] rounded w-3/4 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
