import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, User, Circle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'
import Logo from '../components/Logo'
import { destinoTrasLogin } from '../utils/authRoutes'

type RoleOption = { id: UserRole; label: string; desc: string; icon: React.ReactNode }

const roles: RoleOption[] = [
  { id: 'admin', label: 'Administrativo', desc: 'Gestión completa de citas, pacientes y facturación', icon: <User size={16} /> },
  { id: 'odontologo', label: 'Odontólogo', desc: 'Agenda personal, historial clínico y observaciones', icon: <Circle size={16} /> },
  { id: 'paciente', label: 'Paciente', desc: 'Portal de citas, historial y notificaciones personales', icon: <User size={16} /> },
]

export default function Login() {
  const [rol, setRol] = useState<UserRole>('admin')
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname

  // Limpiar sesión previa al abrir la pantalla de login.
  useEffect(() => {
    logout()
  }, [logout])

  const handleRolChange = (r: UserRole) => {
    setRol(r)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(cedula, password, rol)
      navigate(destinoTrasLogin(rol, fromPath), { replace: true, state: {} })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex">
      {/* Left - Form */}
      <div className="w-80 bg-white border-r border-[#D4C4B0] flex flex-col p-8 justify-center">
        <div className="flex items-center gap-2 mb-8">
          <Logo size="sm" />
          <div>
            <div className="text-sm font-bold text-[#3D2B1F]">Odontocitas</div>
            <div className="text-xs text-[#8B7355]">Sistema de Gestión Odontológica</div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-[#3D2B1F] mb-1">Bienvenido de nuevo</h1>
        <p className="text-sm text-[#8B7355] mb-6">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-2 block">Ingresando como</label>
            <div className="flex gap-1">
              {roles.map(r => (
                <button key={r.id} type="button" onClick={() => handleRolChange(r.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    rol === r.id
                      ? 'bg-[#C17A5A] text-white border-[#C17A5A]'
                      : 'bg-white text-[#8B7355] border-[#D4C4B0] hover:border-[#C17A5A]'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Número de identificación</label>
            <input type="text" value={cedula} onChange={e => setCedula(e.target.value)}
              className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Contraseña</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white pr-10" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355]">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {loading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Verificando...' : 'Ingresar al sistema'}
          </button>

          <p className="text-center text-xs text-[#8B7355]">
            ¿Olvidaste tu contraseña?{' '}
            <span className="text-[#C17A5A] cursor-pointer hover:underline">Recuperar acceso</span>
          </p>
        </form>
      </div>

      {/* Right - Info */}
      <div className="flex-1 flex items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-8 right-8 w-32 h-32 bg-[#EDE0D4] rounded-full opacity-60" />
        <div className="absolute bottom-12 left-8 w-20 h-20 bg-[#EDE0D4] rounded-full opacity-40" />
        <div className="max-w-md relative z-10">
          <h2 className="text-3xl font-bold text-[#3D2B1F] mb-4">
            Gestión odontológica <em className="text-[#C17A5A] not-italic">inteligente</em> y sin fricciones
          </h2>
          <p className="text-[#8B7355] mb-8">
            Acceso personalizado según tu rol. Cada perfil tiene su propio espacio de trabajo optimizado para sus tareas diarias.
          </p>
          <div className="space-y-3">
            {roles.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-4 border border-[#D4C4B0] flex items-center gap-3">
                <div className="w-8 h-8 bg-[#F5EFE6] rounded-lg flex items-center justify-center text-[#C17A5A]">{r.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-[#3D2B1F]">{r.label}</div>
                  <div className="text-xs text-[#8B7355]">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
