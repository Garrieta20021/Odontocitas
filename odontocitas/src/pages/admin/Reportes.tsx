import { Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { dashboardAPI, type Reporte } from '../../api/dashboard'
import { exportarPDF } from '../../utils/pdf'

function money(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('es-CO')}`
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100
  return ((cur - prev) / prev) * 100
}

function mesLabel(mes: string): string {
  const d = new Date(`${mes}-01T00:00:00Z`)
  const txt = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function diaCorto(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

function fechaCitaLabel(fecha: string): string {
  return new Date(fecha).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  })
}

// Últimos 6 meses como opciones del selector.
function ultimosMeses(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

export default function Reportes() {
  const meses = useMemo(() => ultimosMeses(6), [])
  const [mes, setMes] = useState(meses[0])

  const { data, loading, error, refetch } = useAsync<Reporte>(() => dashboardAPI.reportes(mes), [mes])

  // Actualización en tiempo real: refresca al enfocar la ventana y cada 30s.
  useEffect(() => {
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(refetch, 30000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [refetch])

  const kpis = data?.kpis
  const ingresosData = data?.ingresos_semanales ?? []
  const tratamientosData = data?.tratamientos ?? []
  const citasData = data?.citas_por_odontologo ?? []
  const ausentismo = data?.ausentismo_por_dia ?? []
  const cartera = data?.cartera ?? { cobrado: 0, pendiente: 0, vencida: 0 }
  const prediccionPacientes = data?.prediccion_pacientes
  const prediccionIngresos = data?.prediccion_ingresos
  const prediccionEspecialidades = data?.prediccion_especialidades ?? []
  const riesgoInasistencia = data?.riesgo_inasistencia ?? []

  const maxCitas = citasData.length > 0 ? Math.max(...citasData.map(o => o.citas)) : 1
  const maxTrat = tratamientosData.length > 0 ? Math.max(...tratamientosData.map(t => t.cantidad)) : 1
  const totalCartera = cartera.cobrado + cartera.pendiente + cartera.vencida

  const citasChart = useMemo(() => citasData.map(o => ({
    ...o,
    iniciales: o.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    color: '#C17A5A',
  })), [citasData])

  const tarjetasKpi = kpis ? [
    {
      label: 'Ingresos del mes',
      value: money(kpis.actual.ingresos),
      delta: pctChange(kpis.actual.ingresos, kpis.previo.ingresos),
      mejorSiSube: true,
      formatDelta: (d: number) => `${Math.abs(d).toFixed(0)}% vs mes anterior`,
    },
    {
      label: 'Citas realizadas',
      value: String(kpis.actual.citas_realizadas),
      delta: kpis.actual.citas_realizadas - kpis.previo.citas_realizadas,
      mejorSiSube: true,
      formatDelta: (d: number) => `${d >= 0 ? '+' : ''}${d} vs mes anterior`,
    },
    {
      label: 'Tasa de ausentismo',
      value: `${kpis.actual.tasa_ausentismo.toFixed(1)}%`,
      delta: kpis.actual.tasa_ausentismo - kpis.previo.tasa_ausentismo,
      mejorSiSube: false,
      formatDelta: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts vs mes anterior`,
    },
    {
      label: 'Nuevos pacientes',
      value: String(kpis.actual.nuevos_pacientes),
      delta: kpis.actual.nuevos_pacientes - kpis.previo.nuevos_pacientes,
      mejorSiSube: true,
      formatDelta: (d: number) => `${d >= 0 ? '+' : ''}${d} vs mes anterior`,
    },
  ] : []

  const exportar = async () => {
    if (!data) return
    await exportarPDF({
      titulo: 'Reporte de gestión clínica',
      subtitulo: `Periodo: ${mesLabel(mes)}`,
      archivo: `reporte-${mes}.pdf`,
      notaLegal: 'Reporte estadístico de uso interno. Cifras sujetas a conciliación contable.',
      bloques: [
        {
          tipo: 'tabla',
          titulo: 'Indicadores del periodo',
          columnas: ['Indicador', 'Actual', 'Mes anterior'],
          filas: [
            ['Ingresos del mes', money(data.kpis.actual.ingresos), money(data.kpis.previo.ingresos)],
            ['Citas realizadas', data.kpis.actual.citas_realizadas, data.kpis.previo.citas_realizadas],
            ['Tasa de ausentismo', `${data.kpis.actual.tasa_ausentismo.toFixed(1)}%`, `${data.kpis.previo.tasa_ausentismo.toFixed(1)}%`],
            ['Nuevos pacientes', data.kpis.actual.nuevos_pacientes, data.kpis.previo.nuevos_pacientes],
          ],
        },
        {
          tipo: 'tabla',
          titulo: 'Tratamientos más frecuentes',
          columnas: ['Tratamiento', 'Cantidad'],
          filas: data.tratamientos.length ? data.tratamientos.map(t => [t.nombre, t.cantidad]) : [['Sin datos', '0']],
        },
        {
          tipo: 'tabla',
          titulo: 'Citas por odontólogo',
          columnas: ['Odontólogo', 'Citas'],
          filas: data.citas_por_odontologo.length ? data.citas_por_odontologo.map(o => [o.nombre, o.citas]) : [['Sin datos', '0']],
        },
        {
          tipo: 'tabla',
          titulo: 'Estado de cartera',
          columnas: ['Concepto', 'Monto'],
          filas: [
            ['Cobrado', money(data.cartera.cobrado)],
            ['Pendiente', money(data.cartera.pendiente)],
            ['Vencida', money(data.cartera.vencida)],
          ],
        },
        {
          tipo: 'tabla',
          titulo: 'Predicción de pacientes (tiempo real)',
          columnas: ['Indicador', 'Valor'],
          filas: data.prediccion_pacientes.metodo !== 'sin_datos'
            ? [
              ['Completados este mes', data.prediccion_pacientes.realizado_mes_actual],
              ['Proyección del mes', data.prediccion_pacientes.proyeccion_mes_actual],
              ['Ritmo diario', data.prediccion_pacientes.ritmo_diario],
              ['Próximos 7 días', data.prediccion_pacientes.proyeccion_7dias],
              ['Próximos 30 días', data.prediccion_pacientes.proyeccion_30dias],
              ['Tendencia (7d vs 7d)', `${data.prediccion_pacientes.tendencia_pct >= 0 ? '+' : ''}${data.prediccion_pacientes.tendencia_pct.toFixed(1)}%`],
            ]
            : [['Sin datos suficientes', '—']],
        },
        {
          tipo: 'tabla',
          titulo: 'Predicción de ingresos (tiempo real)',
          columnas: ['Indicador', 'Valor'],
          filas: data.prediccion_ingresos.metodo !== 'sin_datos'
            ? [
              ['Recaudado este mes', money(data.prediccion_ingresos.realizado_mes_actual)],
              ['Proyección del mes', money(data.prediccion_ingresos.proyeccion_mes_actual)],
              ['Ritmo diario', money(data.prediccion_ingresos.ritmo_diario)],
              ['Próximos 7 días', money(data.prediccion_ingresos.proyeccion_7dias)],
              ['Próximos 30 días', money(data.prediccion_ingresos.proyeccion_30dias)],
              ['Tendencia (7d vs 7d)', `${data.prediccion_ingresos.tendencia_pct >= 0 ? '+' : ''}${data.prediccion_ingresos.tendencia_pct.toFixed(1)}%`],
            ]
            : [['Sin datos suficientes', '—']],
        },
        {
          tipo: 'tabla',
          titulo: 'Predicción por especialidad',
          columnas: ['Especialidad', 'Actual', 'Estimado', 'Tendencia'],
          filas: data.prediccion_especialidades.length
            ? data.prediccion_especialidades.map(e => [
              e.especialidad,
              e.actual,
              e.estimado,
              `${e.tendencia_pct >= 0 ? '+' : ''}${e.tendencia_pct.toFixed(1)}%`,
            ])
            : [['Sin datos suficientes', '—', '—', '—']],
        },
        {
          tipo: 'tabla',
          titulo: 'Riesgo de inasistencia',
          columnas: ['Paciente', 'Fecha', 'Riesgo', 'Factores'],
          filas: data.riesgo_inasistencia.length
            ? data.riesgo_inasistencia.map(r => [
              r.paciente_nombre,
              fechaCitaLabel(r.fecha_hora),
              `${r.probabilidad}% (${r.nivel})`,
              r.factores.join(', ') || 'Sin factores críticos',
            ])
            : [['Sin citas próximas', '—', '—', '—']],
        },
      ],
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Reportes y estadísticas</h1>
          <p className="text-xs text-[#8B7355] mt-0.5 flex items-center gap-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualización en tiempo real · {mesLabel(mes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-[#C17A5A]">
            {meses.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
          </select>
          <button onClick={exportar} disabled={!data}
            className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6] disabled:opacity-50">
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>}

      {/* KPIs */}
      <div className="flex gap-4 mb-6">
        {loading && !data ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4 h-[92px] animate-pulse" />
          ))
        ) : tarjetasKpi.map(k => {
          const positivo = k.mejorSiSube ? k.delta >= 0 : k.delta <= 0
          const Icon = (k.delta >= 0) === k.mejorSiSube ? TrendingUp : TrendingDown
          return (
            <div key={k.label} className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4">
              <div className="text-xs text-[#8B7355] mb-1">{k.label}</div>
              <div className="text-2xl font-bold text-[#3D2B1F]">{k.value}</div>
              <div className={`text-xs mt-0.5 flex items-center gap-1 ${positivo ? 'text-green-600' : 'text-[#A0623F]'}`}>
                <Icon size={12} /> {k.formatDelta(k.delta)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 mb-4">
        {/* Ingresos semanales */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Ingresos semanales</h2>
          {ingresosData.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-[#8B7355]">Sin ingresos en este mes.</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ingresosData} barSize={32}>
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#8B7355' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: unknown) => [money(Number(v)), 'Ingresos']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #D4C4B0', fontSize: 12 }}
                />
                <Bar dataKey="ingresos" fill="#C17A5A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tratamientos frecuentes */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Tratamientos más frecuentes</h2>
          <div className="space-y-3">
            {tratamientosData.map(t => (
              <div key={t.nombre}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#8B7355]">{t.nombre}</span>
                  <span className="font-semibold text-[#3D2B1F]">{t.cantidad}</span>
                </div>
                <div className="h-2 bg-[#F5EFE6] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(t.cantidad / maxTrat) * 100}%`, backgroundColor: '#C17A5A' }} />
                </div>
              </div>
            ))}
            {tratamientosData.length === 0 && <div className="text-sm text-[#8B7355]">No hay datos de tratamientos para este mes.</div>}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Citas por odontólogo */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Citas por odontólogo</h2>
          <div className="space-y-3">
            {citasChart.map(o => (
              <div key={o.nombre} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: o.color }}>
                  {o.iniciales}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#3D2B1F] font-medium">{o.nombre}</span>
                    <span className="font-bold text-[#3D2B1F]">{o.citas}</span>
                  </div>
                  <div className="h-2 bg-[#F5EFE6] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(o.citas / maxCitas) * 100}%`, backgroundColor: o.color }} />
                  </div>
                </div>
              </div>
            ))}
            {citasChart.length === 0 && <div className="text-sm text-[#8B7355]">No hay datos de citas por odontólogo para este mes.</div>}
          </div>
        </div>

        {/* Ausentismo */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Ausentismo por día</h2>
          {ausentismo.every(a => a.valor === 0) ? (
            <div className="h-[120px] flex items-center justify-center text-sm text-[#8B7355]">Sin cancelaciones este mes.</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={ausentismo} barSize={24}>
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#8B7355' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: unknown) => [String(v), 'Canceladas']} contentStyle={{ borderRadius: 8, border: '1px solid #D4C4B0', fontSize: 12 }} />
                <Bar dataKey="valor" fill="#EDE0D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Estado de cartera */}
        <div className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-5">
          <h2 className="font-semibold text-[#3D2B1F] mb-4">Estado de cartera</h2>
          <div className="space-y-3">
            {[
              { label: 'Cobrado', value: cartera.cobrado, color: 'bg-[#EDE0D4]' },
              { label: 'Pendiente', value: cartera.pendiente, color: 'bg-amber-100' },
              { label: 'Vencida', value: cartera.vencida, color: 'bg-red-100' },
            ].map(c => (
              <div key={c.label} className={`${c.color} rounded-lg p-3 flex justify-between items-center`}>
                <span className="text-sm text-[#3D2B1F]">
                  {c.label}
                  {totalCartera > 0 && <span className="text-xs text-[#8B7355] ml-1">({Math.round((c.value / totalCartera) * 100)}%)</span>}
                </span>
                <span className="font-bold text-[#3D2B1F]">{money(c.value)}</span>
              </div>
            ))}
            {totalCartera === 0 && <div className="text-sm text-[#8B7355]">No hay facturas emitidas este mes.</div>}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-[#D4C4B0] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-[#3D2B1F]">Riesgo de inasistencia</h2>
            <p className="text-xs text-[#8B7355] mt-0.5">
              Próximas citas con mayor probabilidad de no asistencia para activar recordatorios adicionales.
            </p>
          </div>
          <span className="text-[10px] bg-[#F5EFE6] text-[#8B7355] rounded-full px-2 py-1">IA operativa</span>
        </div>

        {riesgoInasistencia.length === 0 ? (
          <div className="rounded-lg bg-[#F5EFE6] p-4 text-sm text-[#8B7355]">
            No hay citas próximas para evaluar riesgo.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {riesgoInasistencia.map(r => {
              const color =
                r.nivel === 'alto'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : r.nivel === 'medio'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-green-200 bg-green-50 text-green-700'
              return (
                <div key={r.id} className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-sm font-semibold text-[#3D2B1F]">{r.paciente_nombre}</div>
                      <div className="text-xs text-[#8B7355]">{fechaCitaLabel(r.fecha_hora)}</div>
                      <div className="text-xs text-[#8B7355]">
                        {r.tratamiento_nombre ?? 'Atención odontológica'} · {r.odontologo_nombre}
                      </div>
                    </div>
                    <div className={`rounded-full border px-2 py-1 text-xs font-bold ${color}`}>
                      {r.probabilidad}% · {r.nivel}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(r.factores.length ? r.factores : ['Sin factores críticos']).map(f => (
                      <span key={f} className="rounded-full bg-[#F5EFE6] px-2 py-1 text-[10px] text-[#8B7355]">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-[#D4C4B0] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-[#3D2B1F]">Predicción de pacientes</h2>
            <p className="text-xs text-[#8B7355] mt-0.5">
              Proyección en tiempo real según el ritmo de citas completadas.
            </p>
          </div>
          <span className="text-[10px] bg-[#F5EFE6] text-[#8B7355] rounded-full px-2 py-1">
            {prediccionPacientes?.metodo === 'sin_datos' ? 'Datos insuficientes' : 'Tiempo real'}
          </span>
        </div>

        {!prediccionPacientes || prediccionPacientes.metodo === 'sin_datos' ? (
          <div className="rounded-lg bg-[#F5EFE6] p-4 text-sm text-[#8B7355]">
            {prediccionPacientes?.mensaje ?? 'Aún no hay predicción disponible.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-[#C17A5A] bg-[#FBF1EB] p-4">
                <div className="text-xs text-[#8B7355] mb-1">Proyección de este mes</div>
                <div className="text-2xl font-bold text-[#3D2B1F]">{prediccionPacientes.proyeccion_mes_actual}</div>
                <div className="text-xs text-[#C17A5A]">{prediccionPacientes.realizado_mes_actual} ya completados</div>
              </div>
              <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-4">
                <div className="text-xs text-[#8B7355] mb-1">Ritmo diario</div>
                <div className="text-2xl font-bold text-[#3D2B1F]">{prediccionPacientes.ritmo_diario}</div>
                <div className="text-xs text-[#8B7355]">pacientes/día</div>
              </div>
              <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-4">
                <div className="text-xs text-[#8B7355] mb-1">Próximos 7 días</div>
                <div className="text-2xl font-bold text-[#3D2B1F]">{prediccionPacientes.proyeccion_7dias}</div>
                <div className="text-xs text-[#8B7355]">estimados</div>
              </div>
              <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-4">
                <div className="text-xs text-[#8B7355] mb-1">Próximos 30 días</div>
                <div className="text-2xl font-bold text-[#3D2B1F]">{prediccionPacientes.proyeccion_30dias}</div>
                <div className={`text-xs font-semibold ${prediccionPacientes.tendencia_pct >= 0 ? 'text-green-600' : 'text-[#A0623F]'}`}>
                  {prediccionPacientes.tendencia_pct >= 0 ? '▲' : '▼'} {Math.abs(prediccionPacientes.tendencia_pct).toFixed(1)}% vs semana previa
                </div>
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prediccionPacientes.serie.slice(-14)}>
                  <XAxis dataKey="fecha" tickFormatter={diaCorto} tick={{ fontSize: 10, fill: '#8B7355' }} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B7355' }} allowDecimals={false} width={24} />
                  <Tooltip labelFormatter={(label: unknown) => diaCorto(String(label))} formatter={(v: unknown) => [`${Number(v)} pacientes`, '']} />
                  <Bar dataKey="pacientes" fill="#C17A5A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-[#8B7355] mt-2">{prediccionPacientes.mensaje}</p>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-[#3D2B1F]">Predicción de ingresos</h2>
              <p className="text-xs text-[#8B7355] mt-0.5">
                Estimación de recaudo en tiempo real según el ritmo diario.
              </p>
            </div>
            <span className="text-[10px] bg-[#F5EFE6] text-[#8B7355] rounded-full px-2 py-1">
              {prediccionIngresos?.metodo === 'sin_datos' ? 'Datos insuficientes' : 'Tiempo real'}
            </span>
          </div>

          {!prediccionIngresos || prediccionIngresos.metodo === 'sin_datos' ? (
            <div className="rounded-lg bg-[#F5EFE6] p-4 text-sm text-[#8B7355]">
              {prediccionIngresos?.mensaje ?? 'Aún no hay predicción disponible.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#C17A5A] bg-[#FBF1EB] p-3">
                <div className="text-xs text-[#8B7355]">Proyección de este mes</div>
                <div className="text-2xl font-bold text-[#C17A5A]">{money(prediccionIngresos.proyeccion_mes_actual)}</div>
                <div className="text-xs text-[#8B7355]">
                  {money(prediccionIngresos.realizado_mes_actual)} recaudado · {prediccionIngresos.tendencia_pct >= 0 ? '+' : ''}{prediccionIngresos.tendencia_pct.toFixed(1)}% vs semana previa
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-3">
                  <div className="text-xs text-[#8B7355]">Ritmo diario</div>
                  <div className="text-sm font-bold text-[#3D2B1F]">{money(prediccionIngresos.ritmo_diario)}</div>
                </div>
                <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-3">
                  <div className="text-xs text-[#8B7355]">Próx. 7 días</div>
                  <div className="text-sm font-bold text-[#3D2B1F]">{money(prediccionIngresos.proyeccion_7dias)}</div>
                </div>
                <div className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-3">
                  <div className="text-xs text-[#8B7355]">Próx. 30 días</div>
                  <div className="text-sm font-bold text-[#3D2B1F]">{money(prediccionIngresos.proyeccion_30dias)}</div>
                </div>
              </div>
              <p className="text-xs text-[#8B7355]">{prediccionIngresos.mensaje}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#D4C4B0] p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-[#3D2B1F]">Predicción por especialidad</h2>
              <p className="text-xs text-[#8B7355] mt-0.5">
                Últimos 30 días vs proyección de los próximos 30.
              </p>
            </div>
            <span className="text-[10px] bg-[#F5EFE6] text-[#8B7355] rounded-full px-2 py-1">IA operativa</span>
          </div>

          {prediccionEspecialidades.length === 0 ? (
            <div className="rounded-lg bg-[#F5EFE6] p-4 text-sm text-[#8B7355]">
              Se necesitan citas completadas por especialidad en al menos 2 meses.
            </div>
          ) : (
            <div className="space-y-3">
              {prediccionEspecialidades.slice(0, 6).map(e => {
                const sube = e.tendencia_pct >= 0
                const Icon = sube ? TrendingUp : TrendingDown
                return (
                  <div key={e.especialidad} className="rounded-xl border border-[#EDE0D4] bg-[#FDFAF7] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#3D2B1F] capitalize">{e.especialidad}</div>
                        <div className="text-xs text-[#8B7355]">últimos 30d {e.actual} · próx. 30d {e.estimado}</div>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-bold ${sube ? 'text-green-600' : 'text-[#A0623F]'}`}>
                        <Icon size={14} /> {sube ? '+' : ''}{e.tendencia_pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
