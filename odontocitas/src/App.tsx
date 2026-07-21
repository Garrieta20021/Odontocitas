import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { redirectMap } from './utils/authRoutes'

// Auth
import Login from './pages/Login'

// Admin layout
import AdminLayout from './layouts/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Agenda from './pages/admin/Agenda'
import AsignacionOdontologos from './pages/admin/AsignacionOdontologos'
import ReprogramarCita from './pages/admin/ReprogramarCita'
import CitaCompletada from './pages/admin/CitaCompletada'
import Pacientes from './pages/admin/Pacientes'
import NuevoPaciente from './pages/admin/NuevoPaciente'
import HistoriaClinica from './pages/admin/HistoriaClinica'
import Facturacion from './pages/admin/Facturacion'
import Inventario from './pages/admin/Inventario'
import Reportes from './pages/admin/Reportes'
import Notificaciones from './pages/admin/Notificaciones'
import Configuracion from './pages/admin/Configuracion'

// Odontólogo layout
import OdontologoLayout from './layouts/OdontologoLayout'
import AgendaOdontologo from './pages/odontologo/AgendaOdontologo'
import OdontologoPacientes from './pages/odontologo/OdontologoPacientes'
import OdontologoHistoria from './pages/odontologo/OdontologoHistoria'
import DetalleCitaOdontologo from './pages/odontologo/DetalleCitaOdontologo'

// Paciente layout
import PacienteLayout from './layouts/PacienteLayout'
import PortalPaciente from './pages/paciente/PortalPaciente'
import SolicitarCita from './pages/paciente/SolicitarCita'
import MisCitas from './pages/paciente/MisCitas'
import HistorialPaciente from './pages/paciente/HistorialPaciente'
import DetalleCitaPaciente from './pages/paciente/DetalleCitaPaciente'
import InfoConsultorio from './pages/paciente/InfoConsultorio'

// Public
import ConfirmacionCita from './pages/public/ConfirmacionCita'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#8B7355]">Verificando sesión...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (role && user.rol !== role) {
    return <Navigate to={redirectMap[user.rol]} replace />
  }
  return <>{children}</>
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#8B7355]">Verificando sesión...</div>
  if (user) return <Navigate to={redirectMap[user.rol]} replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/confirmar-cita/:token" element={<ConfirmacionCita />} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="agenda/asignar" element={<AsignacionOdontologos />} />
            <Route path="agenda/reprogramar/:id" element={<ReprogramarCita />} />
            <Route path="agenda/completada/:id" element={<CitaCompletada />} />
            <Route path="pacientes" element={<Pacientes />} />
            <Route path="pacientes/nuevo" element={<NuevoPaciente />} />
            <Route path="pacientes/:id/historia" element={<HistoriaClinica />} />
            <Route path="facturacion" element={<Facturacion />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="notificaciones" element={<Notificaciones />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>

          {/* Odontólogo */}
          <Route path="/odontologo" element={<ProtectedRoute role="odontologo"><OdontologoLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/odontologo/agenda" replace />} />
            <Route path="agenda" element={<AgendaOdontologo />} />            <Route path="citas/:id" element={<DetalleCitaOdontologo />} />            <Route path="pacientes" element={<OdontologoPacientes />} />
            <Route path="historia/:id" element={<OdontologoHistoria />} />
          </Route>

          {/* Paciente */}
          <Route path="/paciente" element={<ProtectedRoute role="paciente"><PacienteLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/paciente/portal" replace />} />
            <Route path="portal" element={<PortalPaciente />} />
            <Route path="mis-citas" element={<MisCitas />} />
            <Route path="citas/:id" element={<DetalleCitaPaciente />} />
            <Route path="historial" element={<HistorialPaciente />} />
            <Route path="solicitar" element={<SolicitarCita />} />
            <Route path="informacion" element={<InfoConsultorio />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
