import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, KeyRound, Copy, User } from 'lucide-react'
import { pacientesAPI, type PacienteCreado } from '../../api/pacientes'
import { citasAPI } from '../../api/citas'
import { odontologosAPI, type Odontologo, type HorarioDisponible } from '../../api/odontologos'
import { tratamientosAPI, type Tratamiento } from '../../api/tratamientos'
import { useAsync } from '../../hooks/useAsync'

const pasos = ['Datos personales', 'Antecedentes medicos', 'Consentimiento', 'Primera cita']
const enfermedadesOpciones = ['Hipertension', 'Diabetes', 'Cardiopatia', 'Embarazo', 'Tiroides', 'VIH/SIDA']

export default function NuevoPaciente() {
  const [paso, setPaso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [credenciales, setCredenciales] = useState<PacienteCreado | null>(null)
  const [citaCreada, setCitaCreada] = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    eps: '',
    grupo_sanguineo: '',
    alergias: '',
    enfermedades: [] as string[],
    medicamentos: '',
    motivo: '',
    password: '',
    password_confirm: '',
  })

  const [cita, setCita] = useState({
    crear: false,
    tratamiento_id: '',
    odontologo_id: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '',
  })

  const { data: odontologos } = useAsync<Odontologo[]>(() => odontologosAPI.listar())
  const { data: tratamientos } = useAsync<Tratamiento[]>(() => tratamientosAPI.listar())
  const { data: disponibilidad } = useAsync<HorarioDisponible[]>(
    () => (cita.odontologo_id && cita.fecha ? odontologosAPI.disponibilidad(cita.odontologo_id, cita.fecha) : Promise.resolve([])),
    [cita.odontologo_id, cita.fecha]
  )

  useEffect(() => {
    if (tratamientos?.length && !cita.tratamiento_id) {
      setCita(prev => ({ ...prev, tratamiento_id: tratamientos[0].id }))
    }
  }, [tratamientos, cita.tratamiento_id])

  useEffect(() => {
    if (odontologos?.length && !cita.odontologo_id) {
      setCita(prev => ({ ...prev, odontologo_id: odontologos[0].id }))
    }
  }, [odontologos, cita.odontologo_id])

  const horariosDisponibles = useMemo(
    () => disponibilidad?.filter(h => h.disponible).map(h => h.hora) ?? [],
    [disponibilidad]
  )

  useEffect(() => {
    if (horariosDisponibles.length && (!cita.hora || !horariosDisponibles.includes(cita.hora))) {
      setCita(prev => ({ ...prev, hora: horariosDisponibles[0] }))
    }
  }, [horariosDisponibles, cita.hora])

  const tratamientoSeleccionado = tratamientos?.find(t => t.id === cita.tratamiento_id)

  const toggleEnfermedad = (value: string) => {
    setForm(prev => ({
      ...prev,
      enfermedades: prev.enfermedades.includes(value)
        ? prev.enfermedades.filter(item => item !== value)
        : [...prev.enfermedades, value],
    }))
  }

  const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  // Valida los campos obligatorios de un paso concreto. Devuelve '' si está OK.
  const validarPaso = (p: number): string => {
    if (p === 1) {
      if (!form.nombre.trim()) return 'Ingresa el nombre completo.'
      if (!form.cedula.trim()) return 'Ingresa el número de cédula.'
      if (!/^\d{5,}$/.test(form.cedula.replace(/[.\s]/g, ''))) return 'La cédula debe contener solo números (mínimo 5 dígitos).'
      if (!form.email.trim() || !emailValido(form.email)) return 'Ingresa un email válido.'
      if (!form.telefono.trim()) return 'Ingresa el teléfono.'
      if (!form.fecha_nacimiento) return 'Ingresa la fecha de nacimiento.'
      if (form.password || form.password_confirm) {
        if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
        if (form.password !== form.password_confirm) return 'Las contraseñas no coinciden.'
      }
    }
    if (p === 2) {
      if (!form.grupo_sanguineo) return 'Selecciona el grupo sanguíneo.'
      if (!form.eps.trim()) return 'Ingresa la EPS / aseguradora.'
      if (!form.motivo.trim()) return 'Ingresa el motivo de consulta inicial.'
    }
    if (p === 3) {
      if (!consentimiento) return 'Debes registrar el consentimiento informado.'
    }
    if (p === 4) {
      if (cita.crear && (!cita.tratamiento_id || !cita.odontologo_id || !cita.fecha || !cita.hora)) {
        return 'Completa los datos de la primera cita.'
      }
    }
    return ''
  }

  // No deja avanzar al siguiente paso si faltan datos obligatorios.
  const avanzar = () => {
    const e = validarPaso(paso)
    if (e) { setError(e); return }
    setError('')
    setPaso(paso + 1)
  }

  // Solo permite ir hacia atrás o al paso actual desde el indicador.
  const irAPaso = (num: number) => {
    if (num <= paso) { setError(''); setPaso(num) }
  }

  const handleGuardar = async () => {
    // Revalida todos los pasos; si falta algo, salta a ese paso y no guarda.
    for (let p = 1; p <= 4; p++) {
      const e = validarPaso(p)
      if (e) { setError(e); setPaso(p); return }
    }

    setSaving(true)
    setError('')
    try {
      const paciente = await pacientesAPI.crear({
        cedula: form.cedula,
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        fecha_nacimiento: form.fecha_nacimiento || undefined,
        grupo_sanguineo: form.grupo_sanguineo || undefined,
        eps: form.eps || undefined,
        alergias: form.alergias.split(',').map(a => a.trim()).filter(Boolean),
        enfermedades: form.enfermedades,
        medicamentos: form.medicamentos || undefined,
        password: form.password.trim() || undefined,
      })

      if (cita.crear) {
        await citasAPI.crear({
          paciente_id: paciente.id,
          odontologo_id: cita.odontologo_id,
          tratamiento_id: cita.tratamiento_id,
          fecha_hora: `${cita.fecha}T${cita.hora}:00`,
          motivo: form.motivo || 'Primera cita',
          duracion_minutos: tratamientoSeleccionado?.duracion_minutos ?? 45,
        })
        setCitaCreada(true)
      }

      // Mostrar credenciales generadas al final del proceso.
      setCredenciales(paciente)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el paciente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-sm text-[#8B7355] mb-6">
        <button onClick={() => navigate('/admin/pacientes')} className="flex items-center gap-1 hover:text-[#C17A5A]">
          <ChevronLeft size={14} /> Pacientes
        </button>
        <span>/</span>
        <span className="text-[#3D2B1F] font-medium">Registro de nuevo paciente</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate('/admin/pacientes')}
            className="border border-[#D4C4B0] bg-white text-[#8B7355] px-4 py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            className="bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Check size={14} /> {saving ? 'Guardando...' : 'Guardar paciente'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {pasos.map((p, i) => {
          const num = i + 1
          const done = num < paso
          const active = num === paso
          return (
            <button key={p} onClick={() => irAPaso(num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                active ? 'bg-[#C17A5A] text-white' :
                done ? 'bg-green-100 text-green-700' :
                'bg-white border border-[#D4C4B0] text-[#8B7355]'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                active ? 'bg-white text-[#C17A5A]' :
                done ? 'bg-green-600 text-white' :
                'bg-[#EDE0D4] text-[#8B7355]'
              }`}>
                {done ? <Check size={10} /> : num}
              </span>
              <span>{p}</span>
            </button>
          )
        })}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-6">
          {paso === 1 && (
            <div>
              <h2 className="font-semibold text-[#3D2B1F] mb-4">Datos personales</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nombre completo', key: 'nombre', full: true },
                  { label: 'Numero de cedula', key: 'cedula' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Telefono', key: 'telefono' },
                  { label: 'Fecha de nacimiento', key: 'fecha_nacimiento', type: 'date' },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs font-medium text-[#8B7355] mb-1 block">
                      {f.label} <span className="text-red-500">*</span>
                    </label>
                    <input type={f.type ?? 'text'} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-[#EDE0D4]">
                <h3 className="text-sm font-semibold text-[#3D2B1F] mb-1">Credenciales de acceso</h3>
                <p className="text-xs text-[#8B7355] mb-3">
                  El paciente ingresa con su número de cédula. Puedes asignarle una contraseña;
                  si la dejas en blanco, la contraseña inicial será su cédula.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[#8B7355] mb-1 block">Contraseña (opcional)</label>
                    <input type="password" value={form.password} autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8B7355] mb-1 block">Confirmar contraseña</label>
                    <input type="password" value={form.password_confirm} autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      onChange={e => setForm({ ...form, password_confirm: e.target.value })}
                      className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div>
              <h2 className="font-semibold text-[#3D2B1F] mb-4">Antecedentes medicos y odontologicos</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Grupo sanguineo <span className="text-red-500">*</span></label>
                  <select value={form.grupo_sanguineo} onChange={e => setForm({ ...form, grupo_sanguineo: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white">
                    <option value="">Sin registrar</option>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">EPS / Aseguradora <span className="text-red-500">*</span></label>
                  <input value={form.eps} onChange={e => setForm({ ...form, eps: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white" />
                </div>
              </div>

              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Alergias conocidas</label>
              <input value={form.alergias} onChange={e => setForm({ ...form, alergias: e.target.value })}
                placeholder="Separadas por coma"
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white mb-4" />

              <label className="text-xs font-medium text-[#8B7355] mb-2 block">Enfermedades sistemicas</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {enfermedadesOpciones.map(e => (
                  <label key={e} className="flex items-center gap-2 text-sm text-[#3D2B1F] cursor-pointer">
                    <input type="checkbox" checked={form.enfermedades.includes(e)} onChange={() => toggleEnfermedad(e)}
                      className="accent-[#C17A5A]" />
                    {e}
                  </label>
                ))}
              </div>

              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Medicamentos actuales</label>
              <input value={form.medicamentos} onChange={e => setForm({ ...form, medicamentos: e.target.value })}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white mb-4" />

              <label className="text-xs font-medium text-[#8B7355] mb-1 block">Motivo de consulta inicial <span className="text-red-500">*</span></label>
              <textarea value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} rows={3}
                className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white resize-none" />
            </div>
          )}

          {paso === 3 && (
            <div>
              <h2 className="font-semibold text-[#3D2B1F] mb-4">Consentimiento informado</h2>
              <div className="bg-[#F5EFE6] rounded-xl p-4 text-sm text-[#8B7355] mb-4 h-48 overflow-y-auto">
                <p className="mb-3">El paciente autoriza a la clinica y a sus profesionales a realizar procedimientos odontologicos necesarios para su tratamiento.</p>
                <p className="mb-3">Declara haber sido informado sobre procedimientos, riesgos, beneficios y alternativas disponibles.</p>
                <p>Autoriza el uso de sus datos personales y clinicos para fines medicos y seguimiento asistencial.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={consentimiento} onChange={e => setConsentimiento(e.target.checked)}
                  className="accent-[#C17A5A] w-4 h-4" />
                <span className="text-sm text-[#3D2B1F]">El paciente acepta los terminos del consentimiento informado</span>
              </label>
            </div>
          )}

          {paso === 4 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#3D2B1F]">Agendar primera cita</h2>
                <label className="flex items-center gap-2 text-sm text-[#3D2B1F]">
                  <input type="checkbox" checked={cita.crear} onChange={e => setCita({ ...cita, crear: e.target.checked })}
                    className="accent-[#C17A5A]" />
                  Crear cita al guardar
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4 opacity-100">
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Tratamiento</label>
                  <select disabled={!cita.crear} value={cita.tratamiento_id} onChange={e => setCita({ ...cita, tratamiento_id: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white disabled:opacity-50">
                    {tratamientos?.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Odontologo</label>
                  <select disabled={!cita.crear} value={cita.odontologo_id} onChange={e => setCita({ ...cita, odontologo_id: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white disabled:opacity-50">
                    {odontologos?.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Fecha</label>
                  <input disabled={!cita.crear} type="date" value={cita.fecha} onChange={e => setCita({ ...cita, fecha: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8B7355] mb-1 block">Hora</label>
                  <select disabled={!cita.crear} value={cita.hora} onChange={e => setCita({ ...cita, hora: e.target.value })}
                    className="w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white disabled:opacity-50">
                    {horariosDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-[#EDE0D4]">
            <button onClick={() => setPaso(Math.max(1, paso - 1))} disabled={paso === 1}
              className="border border-[#D4C4B0] text-[#8B7355] px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-[#F5EFE6]">
              Anterior
            </button>
            {paso < 4 ? (
              <button onClick={avanzar}
                className="bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Siguiente
              </button>
            ) : (
              <button onClick={handleGuardar} disabled={saving}
                className="bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Guardando...' : 'Guardar paciente'}
              </button>
            )}
          </div>
        </div>

        <div className="w-56 space-y-4">
          <div className="bg-white rounded-xl border border-[#D4C4B0] p-4">
            <h3 className="text-sm font-semibold text-[#3D2B1F] mb-3">Resumen del registro</h3>
            <div className="space-y-1.5 text-xs">
              {[
                ['Nombre', form.nombre || 'Pendiente'],
                ['Cedula', form.cedula || 'Pendiente'],
                ['Telefono', form.telefono || 'Pendiente'],
                ['EPS', form.eps || 'Sin registrar'],
                ['Consentimiento', consentimiento ? 'Aceptado' : 'Pendiente'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-[#8B7355]">{label}</span>
                  <span className="font-medium text-[#3D2B1F] text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {credenciales && (
        <CredencialesModal
          data={credenciales}
          citaCreada={citaCreada}
          onVerHistoria={() => navigate(`/admin/pacientes/${credenciales.id}/historia`)}
          onIrPacientes={() => navigate('/admin/pacientes')}
        />
      )}
    </div>
  )
}

function CredencialesModal({
  data, citaCreada, onVerHistoria, onIrPacientes,
}: {
  data: PacienteCreado
  citaCreada: boolean
  onVerHistoria: () => void
  onIrPacientes: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    const texto = `Usuario: ${data.credenciales.usuario}\nContraseña: ${data.credenciales.password_inicial}\nRol: paciente`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-[#D4C4B0] w-full max-w-md p-6">
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <Check size={22} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-[#3D2B1F]">Paciente registrado</h3>
          <p className="text-sm text-[#8B7355] mt-1">
            {data.nombre}{citaCreada ? ' · primera cita agendada' : ''}
          </p>
        </div>

        <div className="rounded-xl border border-[#EDE0D4] bg-[#F9F5EE] p-4 mb-3 space-y-3">
          <div className="text-xs font-semibold text-[#8B7355] uppercase tracking-wide">Credenciales de acceso</div>
          <div className="flex items-center gap-3">
            <User size={16} className="text-[#C17A5A]" />
            <div>
              <div className="text-[10px] text-[#8B7355] uppercase tracking-wide">Usuario</div>
              <div className="text-sm font-bold text-[#3D2B1F]">{data.credenciales.usuario}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <KeyRound size={16} className="text-[#C17A5A]" />
            <div>
              <div className="text-[10px] text-[#8B7355] uppercase tracking-wide">
                {data.credenciales.password_personalizada ? 'Contraseña' : 'Contraseña inicial'}
              </div>
              <div className="text-sm font-bold text-[#3D2B1F]">{data.credenciales.password_inicial}</div>
            </div>
          </div>
          <p className="text-[11px] text-[#8B7355] pt-1">
            {data.credenciales.password_personalizada
              ? 'El paciente ingresa con el rol "Paciente" usando su número de cédula y la contraseña asignada.'
              : 'El paciente ingresa con el rol "Paciente". La contraseña inicial es su número de cédula; recomiéndale cambiarla.'}
          </p>
        </div>

        <button onClick={copiar}
          className="w-full flex items-center justify-center gap-2 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6] mb-4">
          <Copy size={14} /> {copiado ? 'Copiado' : 'Copiar credenciales'}
        </button>

        <div className="flex gap-2">
          <button onClick={onIrPacientes}
            className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">
            Ir a pacientes
          </button>
          <button onClick={onVerHistoria}
            className="flex-1 bg-[#C17A5A] hover:bg-[#A0623F] text-white py-2 rounded-lg text-sm font-medium">
            Ver historia clínica
          </button>
        </div>
      </div>
    </div>
  )
}
