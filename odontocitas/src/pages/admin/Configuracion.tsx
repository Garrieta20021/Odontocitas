import { useEffect, useState } from 'react'
import { Save, Plus, Pencil, Trash2, Power, KeyRound, X } from 'lucide-react'
import {
  configuracionAPI,
  type ConfiguracionPayload,
  type HorarioAtencion,
  type NotificacionesConfig,
  type IntegracionesConfig,
} from '../../api/configuracion'
import { tratamientosAPI, type Tratamiento, type TratamientoPayload } from '../../api/tratamientos'
import { odontologosAPI, type Odontologo, type OdontologoPayload } from '../../api/odontologos'
import { usuariosAPI } from '../../api/usuarios'
import { useAsync } from '../../hooks/useAsync'

const secciones = ['Clinica', 'Odontologos', 'Horarios', 'Tarifas', 'Notificaciones', 'Usuarios y roles', 'Integraciones']

const ESPECIALIDADES = ['general', 'ortodoncia', 'endodoncia', 'cirugia', 'blanqueamiento', 'pediatrica']

const defaultNotificaciones: NotificacionesConfig = {
  recordatorios_activos: true,
  horas_anticipacion: 24,
  canal_email: true,
  canal_sms: false,
  canal_whatsapp: false,
  resumen_diario: true,
}

const defaultIntegraciones: IntegracionesConfig = {
  email_remitente: '',
  smtp_host: '',
  whatsapp_numero: '',
  pasarela_pago: 'ninguna',
}

const defaultConfig: ConfiguracionPayload = {
  nombre_clinica: '',
  nit: '',
  telefono: '',
  email: '',
  direccion: '',
  ciudad: '',
  horarios: [],
  notificaciones: defaultNotificaciones,
  integraciones: defaultIntegraciones,
}

export default function Configuracion() {
  const [seccion, setSeccion] = useState('Clinica')
  const [form, setForm] = useState<ConfiguracionPayload>(defaultConfig)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: config, loading: loadingConfig, error: configError, refetch } = useAsync(() => configuracionAPI.obtener())

  useEffect(() => {
    if (config) {
      setForm({
        nombre_clinica: config.nombre_clinica,
        nit: config.nit ?? '',
        telefono: config.telefono ?? '',
        email: config.email ?? '',
        direccion: config.direccion ?? '',
        ciudad: config.ciudad ?? '',
        horarios: config.horarios ?? [],
        notificaciones: { ...defaultNotificaciones, ...(config.notificaciones ?? {}) },
        integraciones: { ...defaultIntegraciones, ...(config.integraciones ?? {}) },
      })
    }
  }, [config])

  const updateField = (key: keyof ConfiguracionPayload, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateNotif = (key: keyof NotificacionesConfig, value: boolean | number) => {
    setForm(prev => ({ ...prev, notificaciones: { ...prev.notificaciones, [key]: value } }))
  }

  const updateIntegracion = (key: keyof IntegracionesConfig, value: string) => {
    setForm(prev => ({ ...prev, integraciones: { ...prev.integraciones, [key]: value } }))
  }

  const updateHorario = (index: number, data: Partial<HorarioAtencion>) => {
    setForm(prev => ({
      ...prev,
      horarios: prev.horarios.map((h, i) => (i === index ? { ...h, ...data } : h)),
    }))
  }

  const addHorario = () => {
    setForm(prev => ({
      ...prev,
      horarios: [...prev.horarios, { dia: 'Nuevo horario', desde: '08:00', hasta: '17:00', activo: true }],
    }))
  }

  const removeHorario = (index: number) => {
    setForm(prev => ({ ...prev, horarios: prev.horarios.filter((_, i) => i !== index) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const saved = await configuracionAPI.actualizar(form)
      setForm({
        nombre_clinica: saved.nombre_clinica,
        nit: saved.nit ?? '',
        telefono: saved.telefono ?? '',
        email: saved.email ?? '',
        direccion: saved.direccion ?? '',
        ciudad: saved.ciudad ?? '',
        horarios: saved.horarios ?? [],
        notificaciones: { ...defaultNotificaciones, ...(saved.notificaciones ?? {}) },
        integraciones: { ...defaultIntegraciones, ...(saved.integraciones ?? {}) },
      })
      setStatus({ type: 'success', message: 'Configuracion guardada correctamente.' })
      refetch()
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo guardar la configuracion.' })
    } finally {
      setSaving(false)
    }
  }

  // El botón global solo aplica a secciones basadas en el formulario de config.
  const guardableSecciones = ['Clinica', 'Horarios', 'Notificaciones', 'Integraciones']
  const mostrarGuardar = guardableSecciones.includes(seccion)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Configuracion del sistema</h1>
          {status && (
            <p className={`mt-1 text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {status.message}
            </p>
          )}
          {configError && <p className="mt-1 text-sm text-red-700">{configError}</p>}
        </div>
        {mostrarGuardar && (
          <button onClick={handleSave} disabled={saving || loadingConfig}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="w-44 bg-white rounded-xl border border-[#D4C4B0] p-2 h-fit">
          {secciones.map(s => (
            <button key={s} onClick={() => setSeccion(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                seccion === s ? 'bg-[#C17A5A] text-white font-medium' : 'text-[#8B7355] hover:bg-[#F5EFE6]'
              }`}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-6">
          {loadingConfig && seccion === 'Clinica' ? (
            <div className="text-sm text-[#8B7355]">Cargando configuracion...</div>
          ) : seccion === 'Clinica' ? (
            <div>
              <h2 className="font-semibold text-[#3D2B1F] mb-4">Datos de la clinica</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nombre de la clinica', key: 'nombre_clinica' },
                  { label: 'NIT', key: 'nit' },
                  { label: 'Telefono', key: 'telefono' },
                  { label: 'Correo', key: 'email' },
                  { label: 'Ciudad', key: 'ciudad' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-[#8B7355] mb-1 block">{f.label}</label>
                    <input type="text" value={String(form[f.key as keyof ConfiguracionPayload] ?? '')}
                      onChange={e => updateField(f.key as keyof ConfiguracionPayload, e.target.value)}
                      className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Direccion</label>
                  <input type="text" value={form.direccion ?? ''} onChange={e => updateField('direccion', e.target.value)}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                </div>
              </div>
            </div>
          ) : seccion === 'Horarios' ? (
            <HorariosEditor horarios={form.horarios} onAdd={addHorario} onChange={updateHorario} onRemove={removeHorario} />
          ) : seccion === 'Tarifas' ? (
            <TarifasManager />
          ) : seccion === 'Odontologos' ? (
            <OdontologosManager />
          ) : seccion === 'Notificaciones' ? (
            <NotificacionesForm value={form.notificaciones} onChange={updateNotif} />
          ) : seccion === 'Usuarios y roles' ? (
            <UsuariosManager />
          ) : seccion === 'Integraciones' ? (
            <IntegracionesForm value={form.integraciones} onChange={updateIntegracion} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HorariosEditor({
  horarios,
  onAdd,
  onChange,
  onRemove,
}: {
  horarios: HorarioAtencion[]
  onAdd: () => void
  onChange: (index: number, data: Partial<HorarioAtencion>) => void
  onRemove: (index: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#3D2B1F]">Horarios de atencion</h2>
        <button onClick={onAdd}
          className="flex items-center gap-1 text-xs text-[#C17A5A] border border-[#C17A5A] px-3 py-1 rounded-lg hover:bg-[#F5EFE6]">
          <Plus size={12} /> Agregar horario
        </button>
      </div>
      <p className="text-xs text-[#8B7355] mb-4">Recuerda pulsar "Guardar cambios" para conservar los horarios.</p>
      <div className="space-y-3">
        {horarios.map((h, index) => (
          <div key={`${h.dia}-${index}`} className="flex items-center gap-4">
            <input value={h.dia} onChange={e => onChange(index, { dia: e.target.value })}
              className="text-sm text-[#3D2B1F] w-36 border border-[#D4C4B0] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#C17A5A]" />
            <span className="text-xs text-[#8B7355]">Desde</span>
            <input type="time" value={h.desde} disabled={!h.activo} onChange={e => onChange(index, { desde: e.target.value })}
              className="border border-[#D4C4B0] rounded-lg px-3 py-1.5 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white w-28 disabled:opacity-50" />
            <span className="text-xs text-[#8B7355]">Hasta</span>
            <input type="time" value={h.hasta} disabled={!h.activo} onChange={e => onChange(index, { hasta: e.target.value })}
              className="border border-[#D4C4B0] rounded-lg px-3 py-1.5 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white w-28 disabled:opacity-50" />
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-[#3D2B1F]">
              <input type="checkbox" checked={h.activo} onChange={e => onChange(index, { activo: e.target.checked })}
                className="accent-[#C17A5A]" />
              Activo
            </label>
            <button onClick={() => onRemove(index)} className="text-[#A0623F] hover:text-red-600" title="Eliminar">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {horarios.length === 0 && <p className="text-sm text-[#8B7355]">No hay horarios configurados.</p>}
      </div>
    </div>
  )
}

// ─── Tarifas (CRUD de tratamientos) ───────────────────────────────
const emptyTratamiento: TratamientoPayload = {
  nombre: '', descripcion: '', duracion_minutos: 45, tarifa: 0, especialidad: 'general',
}

function TarifasManager() {
  const { data: tratamientos, loading, error, refetch } = useAsync<(Tratamiento & { activo: boolean })[]>(
    () => tratamientosAPI.listarTodos()
  )
  const [editando, setEditando] = useState<Tratamiento | null>(null)
  const [creando, setCreando] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const desactivar = async (t: Tratamiento) => {
    if (!window.confirm(`¿Desactivar el tratamiento "${t.nombre}"? No aparecerá al agendar nuevas citas.`)) return
    setBusy(t.id)
    try { await tratamientosAPI.eliminar(t.id); refetch() }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Error al desactivar') }
    finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#3D2B1F]">Tarifas de tratamientos</h2>
        <button onClick={() => setCreando(true)}
          className="flex items-center gap-1 text-xs text-white bg-[#C17A5A] hover:bg-[#A0623F] px-3 py-1.5 rounded-lg">
          <Plus size={12} /> Nuevo tratamiento
        </button>
      </div>
      {msg && <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{msg}</div>}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#EDE0D4]">
            <th className="text-left text-xs font-semibold text-[#8B7355] pb-2">TRATAMIENTO</th>
            <th className="text-left text-xs font-semibold text-[#8B7355] pb-2">ESPECIALIDAD</th>
            <th className="text-right text-xs font-semibold text-[#8B7355] pb-2">DURACION</th>
            <th className="text-right text-xs font-semibold text-[#8B7355] pb-2">TARIFA</th>
            <th className="text-right text-xs font-semibold text-[#8B7355] pb-2">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="py-4 text-center text-sm text-[#8B7355]">Cargando tarifas...</td></tr>
          ) : error ? (
            <tr><td colSpan={5} className="py-4 text-center text-sm text-red-700">{error}</td></tr>
          ) : (tratamientos ?? []).map(t => (
            <tr key={t.id} className={`border-b border-[#F5EFE6] ${!t.activo ? 'opacity-50' : ''}`}>
              <td className="py-2.5 text-sm text-[#3D2B1F]">
                {t.nombre}{!t.activo && <span className="ml-2 text-[10px] text-[#A0623F]">(inactivo)</span>}
              </td>
              <td className="py-2.5 text-sm text-[#8B7355] capitalize">{t.especialidad}</td>
              <td className="py-2.5 text-sm text-[#8B7355] text-right">{t.duracion_minutos} min</td>
              <td className="py-2.5 text-sm font-medium text-[#3D2B1F] text-right">${Number(t.tarifa).toLocaleString()}</td>
              <td className="py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setEditando(t)} className="text-[#8B7355] hover:text-[#C17A5A]" title="Editar"><Pencil size={15} /></button>
                  {t.activo && (
                    <button onClick={() => desactivar(t)} disabled={busy === t.id} className="text-[#A0623F] hover:text-red-600 disabled:opacity-40" title="Desactivar"><Trash2 size={15} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(creando || editando) && (
        <TratamientoModal
          tratamiento={editando}
          onClose={() => { setCreando(false); setEditando(null) }}
          onSaved={() => { setCreando(false); setEditando(null); refetch() }}
        />
      )}
    </div>
  )
}

function TratamientoModal({ tratamiento, onClose, onSaved }: { tratamiento: Tratamiento | null; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<TratamientoPayload>(
    tratamiento
      ? {
          nombre: tratamiento.nombre,
          descripcion: tratamiento.descripcion ?? '',
          duracion_minutos: tratamiento.duracion_minutos,
          tarifa: Number(tratamiento.tarifa),
          especialidad: tratamiento.especialidad,
        }
      : emptyTratamiento
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!data.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    try {
      if (tratamiento) await tratamientosAPI.actualizar(tratamiento.id, data)
      else await tratamientosAPI.crear(data)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  return (
    <ModalShell title={tratamiento ? 'Editar tratamiento' : 'Nuevo tratamiento'} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nombre">
          <input value={data.nombre} onChange={e => setData({ ...data, nombre: e.target.value })} className={inputCls} />
        </Campo>
        <Campo label="Descripción">
          <input value={data.descripcion ?? ''} onChange={e => setData({ ...data, descripcion: e.target.value })} className={inputCls} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Duración (min)">
            <input type="number" min={5} value={data.duracion_minutos} onChange={e => setData({ ...data, duracion_minutos: Number(e.target.value) })} className={inputCls} />
          </Campo>
          <Campo label="Tarifa (COP)">
            <input type="number" min={0} value={data.tarifa} onChange={e => setData({ ...data, tarifa: Number(e.target.value) })} className={inputCls} />
          </Campo>
        </div>
        <Campo label="Especialidad">
          <select value={data.especialidad} onChange={e => setData({ ...data, especialidad: e.target.value })} className={inputCls}>
            {ESPECIALIDADES.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
          </select>
        </Campo>
        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
        <BotonesModal onClose={onClose} onSubmit={submit} saving={saving} />
      </div>
    </ModalShell>
  )
}

// ─── Odontólogos ──────────────────────────────────────────────────
function OdontologosManager() {
  const { data: odontologos, loading, error, refetch } = useAsync<Odontologo[]>(() => odontologosAPI.listarTodos())
  const [editando, setEditando] = useState<Odontologo | null>(null)
  const [creando, setCreando] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const toggle = async (o: Odontologo) => {
    setBusy(o.id)
    try { await odontologosAPI.cambiarActivo(o.id, !o.activo); refetch() }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Error al cambiar estado') }
    finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#3D2B1F]">Equipo odontológico</h2>
        <button onClick={() => setCreando(true)}
          className="flex items-center gap-1 text-xs text-white bg-[#C17A5A] hover:bg-[#A0623F] px-3 py-1.5 rounded-lg">
          <Plus size={12} /> Nuevo odontólogo
        </button>
      </div>
      {msg && <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{msg}</div>}
      {loading ? (
        <p className="text-sm text-[#8B7355]">Cargando odontólogos...</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <div className="space-y-2">
          {(odontologos ?? []).map(o => (
            <div key={o.id} className={`flex items-center gap-3 border border-[#EDE0D4] rounded-xl p-3 ${!o.activo ? 'opacity-60' : ''}`}>
              <span className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: o.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[#3D2B1F] truncate">
                  {o.nombre}{!o.activo && <span className="ml-2 text-[10px] text-[#A0623F]">(inactivo)</span>}
                </div>
                <div className="text-xs text-[#8B7355] capitalize">{o.especialidad} · {o.email}</div>
              </div>
              <span className="text-xs text-[#8B7355] mr-2">{o.citas_semana} citas/sem</span>
              <button onClick={() => setEditando(o)} className="text-[#8B7355] hover:text-[#C17A5A]" title="Editar"><Pencil size={15} /></button>
              <button onClick={() => toggle(o)} disabled={busy === o.id}
                className={`hover:opacity-80 disabled:opacity-40 ${o.activo ? 'text-[#A0623F]' : 'text-green-600'}`}
                title={o.activo ? 'Desactivar' : 'Activar'}>
                <Power size={15} />
              </button>
            </div>
          ))}
          {(odontologos ?? []).length === 0 && <p className="text-sm text-[#8B7355]">No hay odontólogos registrados.</p>}
        </div>
      )}

      {(creando || editando) && (
        <OdontologoModal
          odontologo={editando}
          onClose={() => { setCreando(false); setEditando(null) }}
          onSaved={() => { setCreando(false); setEditando(null); refetch() }}
        />
      )}
    </div>
  )
}

function OdontologoModal({ odontologo, onClose, onSaved }: { odontologo: Odontologo | null; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<OdontologoPayload>({
    nombre: odontologo?.nombre ?? '',
    cedula: odontologo?.cedula ?? '',
    email: odontologo?.email ?? '',
    telefono: odontologo?.telefono ?? '',
    especialidad: odontologo?.especialidad ?? 'general',
    color: odontologo?.color ?? '#C17A5A',
    registro_profesional: odontologo?.registro_profesional ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [credenciales, setCredenciales] = useState<{ usuario: string; password_inicial: string } | null>(null)

  const submit = async () => {
    if (!data.nombre.trim() || !data.email.trim()) { setError('Nombre y correo son obligatorios.'); return }
    if (!odontologo && !data.cedula.trim()) { setError('La cédula es obligatoria.'); return }
    setSaving(true); setError('')
    try {
      if (odontologo) {
        const { cedula, ...rest } = data
        void cedula
        await odontologosAPI.actualizar(odontologo.id, rest)
        onSaved()
      } else {
        const res = await odontologosAPI.crear(data)
        setCredenciales(res.credenciales)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  if (credenciales) {
    return (
      <ModalShell title="Odontólogo creado" onClose={onSaved}>
        <p className="text-sm text-[#3D2B1F] mb-3">Comparte estas credenciales de acceso:</p>
        <div className="rounded-xl bg-[#F5EFE6] p-4 text-sm space-y-1">
          <div><span className="text-[#8B7355]">Usuario (cédula):</span> <strong>{credenciales.usuario}</strong></div>
          <div><span className="text-[#8B7355]">Contraseña inicial:</span> <strong>{credenciales.password_inicial}</strong></div>
        </div>
        <button onClick={onSaved} className="mt-4 w-full bg-[#C17A5A] hover:bg-[#A0623F] text-white py-2 rounded-lg text-sm font-medium">Listo</button>
      </ModalShell>
    )
  }

  return (
    <ModalShell title={odontologo ? 'Editar odontólogo' : 'Nuevo odontólogo'} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nombre completo">
          <input value={data.nombre} onChange={e => setData({ ...data, nombre: e.target.value })} className={inputCls} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cédula">
            <input value={data.cedula} disabled={!!odontologo} onChange={e => setData({ ...data, cedula: e.target.value })} className={`${inputCls} disabled:opacity-50`} />
          </Campo>
          <Campo label="Teléfono">
            <input value={data.telefono ?? ''} onChange={e => setData({ ...data, telefono: e.target.value })} className={inputCls} />
          </Campo>
        </div>
        <Campo label="Correo">
          <input type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })} className={inputCls} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Especialidad">
            <select value={data.especialidad} onChange={e => setData({ ...data, especialidad: e.target.value })} className={inputCls}>
              {ESPECIALIDADES.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
            </select>
          </Campo>
          <Campo label="Color de agenda">
            <input type="color" value={data.color} onChange={e => setData({ ...data, color: e.target.value })} className="w-full h-9 border border-[#D4C4B0] rounded-lg bg-white" />
          </Campo>
        </div>
        <Campo label="Registro profesional">
          <input value={data.registro_profesional ?? ''} onChange={e => setData({ ...data, registro_profesional: e.target.value })} className={inputCls} />
        </Campo>
        {!odontologo && <p className="text-[11px] text-[#8B7355]">La contraseña inicial será la cédula.</p>}
        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
        <BotonesModal onClose={onClose} onSubmit={submit} saving={saving} />
      </div>
    </ModalShell>
  )
}

// ─── Notificaciones ───────────────────────────────────────────────
function NotificacionesForm({ value, onChange }: { value: NotificacionesConfig; onChange: (k: keyof NotificacionesConfig, v: boolean | number) => void }) {
  const toggles: { key: keyof NotificacionesConfig; label: string; desc: string }[] = [
    { key: 'recordatorios_activos', label: 'Recordatorios de cita', desc: 'Enviar recordatorios automáticos a los pacientes.' },
    { key: 'resumen_diario', label: 'Resumen diario para el equipo', desc: 'Generar el resumen de la jornada cada día.' },
    { key: 'canal_email', label: 'Canal: correo electrónico', desc: 'Notificar por email.' },
    { key: 'canal_sms', label: 'Canal: SMS', desc: 'Notificar por mensaje de texto.' },
    { key: 'canal_whatsapp', label: 'Canal: WhatsApp', desc: 'Notificar por WhatsApp.' },
  ]
  return (
    <div>
      <h2 className="font-semibold text-[#3D2B1F] mb-1">Preferencias de notificaciones</h2>
      <p className="text-xs text-[#8B7355] mb-5">Pulsa "Guardar cambios" para aplicar.</p>
      <div className="mb-5 max-w-xs">
        <label className="text-xs font-medium text-[#8B7355] mb-1 block">Horas de anticipación del recordatorio</label>
        <input type="number" min={1} max={168} value={value.horas_anticipacion}
          onChange={e => onChange('horas_anticipacion', Number(e.target.value))} className={inputCls} />
      </div>
      <div className="space-y-2">
        {toggles.map(t => (
          <label key={t.key} className="flex items-center justify-between border border-[#EDE0D4] rounded-xl p-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#3D2B1F]">{t.label}</div>
              <div className="text-xs text-[#8B7355]">{t.desc}</div>
            </div>
            <input type="checkbox" checked={Boolean(value[t.key])} onChange={e => onChange(t.key, e.target.checked)} className="accent-[#C17A5A] w-4 h-4" />
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Integraciones ────────────────────────────────────────────────
function IntegracionesForm({ value, onChange }: { value: IntegracionesConfig; onChange: (k: keyof IntegracionesConfig, v: string) => void }) {
  return (
    <div>
      <h2 className="font-semibold text-[#3D2B1F] mb-1">Integraciones</h2>
      <p className="text-xs text-[#8B7355] mb-5">Datos de proveedores externos. Pulsa "Guardar cambios" para aplicar.</p>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Correo remitente">
          <input value={value.email_remitente} onChange={e => onChange('email_remitente', e.target.value)} className={inputCls} placeholder="citas@clinica.co" />
        </Campo>
        <Campo label="Servidor SMTP">
          <input value={value.smtp_host} onChange={e => onChange('smtp_host', e.target.value)} className={inputCls} placeholder="smtp.proveedor.com" />
        </Campo>
        <Campo label="Número de WhatsApp">
          <input value={value.whatsapp_numero} onChange={e => onChange('whatsapp_numero', e.target.value)} className={inputCls} placeholder="+57 300 000 0000" />
        </Campo>
        <Campo label="Pasarela de pago">
          <select value={value.pasarela_pago} onChange={e => onChange('pasarela_pago', e.target.value)} className={inputCls}>
            <option value="ninguna">Ninguna</option>
            <option value="wompi">Wompi</option>
            <option value="payu">PayU</option>
            <option value="mercadopago">Mercado Pago</option>
          </select>
        </Campo>
      </div>
    </div>
  )
}

// ─── Usuarios y roles ─────────────────────────────────────────────
function UsuariosManager() {
  const { data: usuarios, loading, error, refetch } = useAsync(() => usuariosAPI.listar())
  const [filtro, setFiltro] = useState('todos')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const toggle = async (id: string, activo: boolean) => {
    setBusy(id); setMsg(null)
    try { await usuariosAPI.cambiarActivo(id, !activo); refetch() }
    catch (err) { setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error' }) }
    finally { setBusy(null) }
  }

  const resetPass = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Restablecer la contraseña de ${nombre} a su número de cédula?`)) return
    setBusy(id); setMsg(null)
    try {
      const res = await usuariosAPI.resetPassword(id)
      setMsg({ type: 'ok', text: `Contraseña de ${nombre} restablecida a: ${res.password_inicial}` })
    } catch (err) { setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error' }) }
    finally { setBusy(null) }
  }

  const filtrados = (usuarios ?? []).filter(u => filtro === 'todos' || u.rol === filtro)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#3D2B1F]">Usuarios y roles</h2>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="border border-[#D4C4B0] rounded-lg px-3 py-1.5 text-sm text-[#3D2B1F] bg-white">
          <option value="todos">Todos los roles</option>
          <option value="admin">Administradores</option>
          <option value="odontologo">Odontólogos</option>
          <option value="paciente">Pacientes</option>
        </select>
      </div>
      {msg && <div className={`mb-3 rounded-lg p-2 text-xs ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {loading ? (
        <p className="text-sm text-[#8B7355]">Cargando usuarios...</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EDE0D4]">
              <th className="text-left text-xs font-semibold text-[#8B7355] pb-2">NOMBRE</th>
              <th className="text-left text-xs font-semibold text-[#8B7355] pb-2">ROL</th>
              <th className="text-left text-xs font-semibold text-[#8B7355] pb-2">ESTADO</th>
              <th className="text-right text-xs font-semibold text-[#8B7355] pb-2">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(u => (
              <tr key={u.id} className="border-b border-[#F5EFE6]">
                <td className="py-2.5">
                  <div className="text-sm text-[#3D2B1F]">{u.nombre}</div>
                  <div className="text-xs text-[#8B7355]">{u.email}</div>
                </td>
                <td className="py-2.5 text-sm text-[#8B7355] capitalize">{u.rol}</td>
                <td className="py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => resetPass(u.id, u.nombre)} disabled={busy === u.id} className="text-[#8B7355] hover:text-[#C17A5A] disabled:opacity-40" title="Restablecer contraseña"><KeyRound size={15} /></button>
                    <button onClick={() => toggle(u.id, u.activo)} disabled={busy === u.id}
                      className={`hover:opacity-80 disabled:opacity-40 ${u.activo ? 'text-[#A0623F]' : 'text-green-600'}`}
                      title={u.activo ? 'Desactivar' : 'Activar'}><Power size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-sm text-[#8B7355]">No hay usuarios.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Helpers de UI ────────────────────────────────────────────────
const inputCls = 'w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#8B7355] mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#D4C4B0] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#3D2B1F]">{title}</h3>
          <button onClick={onClose} className="text-[#8B7355] hover:text-[#3D2B1F]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BotonesModal({ onClose, onSubmit, saving }: { onClose: () => void; onSubmit: () => void; saving: boolean }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onClose} className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">Cancelar</button>
      <button onClick={onSubmit} disabled={saving} className="flex-1 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}
