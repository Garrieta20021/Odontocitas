import { Phone, MapPin, Mail, ExternalLink } from 'lucide-react'
import { configuracionAPI } from '../../api/configuracion'
import { tratamientosAPI, type Tratamiento } from '../../api/tratamientos'
import { useAsync } from '../../hooks/useAsync'

export default function InfoConsultorio() {
  const { data: tratamientos, loading, error } = useAsync<Tratamiento[]>(() => tratamientosAPI.listar())
  const { data: config } = useAsync(() => configuracionAPI.obtener())

  const direccionMapa = [
    config?.direccion ?? 'Cra 54 #72-33, Barranquilla',
    config?.ciudad,
  ].filter(Boolean).join(', ')
  const consultaMapa = encodeURIComponent(direccionMapa)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">{config?.nombre_clinica ?? 'Clinica Sonrisas'}</h1>
        <p className="text-sm text-[#8B7355]">Conoce nuestros servicios, horarios y ubicacion</p>
      </div>

      <div className="bg-white rounded-xl border border-[#D4C4B0] p-5 mb-4">
        <h2 className="font-semibold text-[#3D2B1F] mb-4">Servicios ofrecidos</h2>
        {loading ? (
          <div className="text-sm text-[#8B7355]">Cargando servicios...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(tratamientos ?? []).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-[#F5EFE6] rounded-xl">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg font-bold text-[#C17A5A] flex-shrink-0">
                  +
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#3D2B1F]">{s.nombre}</div>
                  <div className="text-xs text-[#8B7355]">{s.descripcion || s.especialidad}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Horarios de atencion</h2>
          <div className="space-y-3">
            {(config?.horarios ?? []).map(h => (
              <div key={h.dia} className="flex items-center justify-between py-2 border-b border-[#F5EFE6] last:border-0">
                <span className="text-sm text-[#3D2B1F]">{h.dia}</span>
                <span className={`text-sm font-medium ${h.activo ? 'text-[#3D2B1F]' : 'text-red-500'}`}>
                  {h.activo ? `${h.desde} - ${h.hasta}` : 'Cerrado'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Datos de contacto</h2>
          <div className="space-y-3">
            {[
              { icon: <Phone size={14} />, label: 'Telefono', value: config?.telefono ?? '605 345 6789' },
              { icon: <MapPin size={14} />, label: 'Direccion', value: config?.direccion ?? 'Cra 54 #72-33, Barranquilla' },
              { icon: <Mail size={14} />, label: 'Correo', value: config?.email ?? 'info@clinicasonrisas.co' },
            ].map(c => (
              <div key={c.label} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-[#F5EFE6] rounded-lg flex items-center justify-center text-[#C17A5A] flex-shrink-0 mt-0.5">
                  {c.icon}
                </div>
                <div>
                  <div className="text-xs text-[#8B7355]">{c.label}</div>
                  <div className="text-sm font-medium text-[#3D2B1F]">{c.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#3D2B1F]">Ubicacion en el mapa</h2>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${consultaMapa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-[#C17A5A] hover:text-[#A0623F]"
          >
            <ExternalLink size={14} /> Abrir en Google Maps
          </a>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#EDE0D4]">
          <iframe
            title="Ubicacion de la clinica"
            src={`https://www.google.com/maps?q=${consultaMapa}&output=embed`}
            className="w-full h-64 border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        <div className="mt-3 flex items-start gap-2 text-sm text-[#8B7355]">
          <MapPin size={16} className="text-[#C17A5A] flex-shrink-0 mt-0.5" />
          <span>{direccionMapa}</span>
        </div>
      </div>
    </div>
  )
}
