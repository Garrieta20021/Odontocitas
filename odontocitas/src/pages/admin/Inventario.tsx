import { useEffect, useState } from 'react'
import { Search, Plus, ShoppingCart, Pencil, Trash2, X, Minus, RefreshCw } from 'lucide-react'
import Badge from '../../components/Badge'
import { useAsync } from '../../hooks/useAsync'
import { inventarioAPI, type Insumo, type MovimientoInventario, type ResumenInventario } from '../../api/inventario'
import { exportarPDF } from '../../utils/pdf'

type Cat = 'Todos' | 'Protección' | 'Materiales' | 'Anestesia' | 'Instrumental'
const CATEGORIAS = ['Protección', 'Materiales', 'Anestesia', 'Instrumental']

const estadoLabel: Record<string, string> = {
  normal: 'Normal', stock_bajo: 'Stock bajo', por_vencer: 'Por vencer', vencido: 'Vencido',
}

const emptyInsumo: Omit<Insumo, 'id' | 'estado'> = {
  nombre: '', categoria: 'Materiales', stock_actual: 0, stock_minimo: 0,
  unidad: 'unidad', proveedor: '', precio_unitario: null, fecha_vencimiento: null,
}

const inputCls = 'w-full border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm text-[#3D2B1F] focus:outline-none focus:border-[#C17A5A] bg-white'

export default function Inventario() {
  const [cat, setCat] = useState<Cat>('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ insumo: Insumo | null } | null>(null)
  const [accionId, setAccionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: insumos, loading, refetch } = useAsync<Insumo[]>(
    () => inventarioAPI.listar({ categoria: cat !== 'Todos' ? cat : undefined, busqueda: busqueda || undefined }),
    [cat, busqueda]
  )
  const { data: resumen, refetch: refetchResumen } = useAsync<ResumenInventario>(() => inventarioAPI.resumen())
  const { data: movimientos, refetch: refetchMovimientos } = useAsync<MovimientoInventario[]>(
    () => inventarioAPI.movimientos({ limit: 8 })
  )

  const recargar = () => { refetch(); refetchResumen(); refetchMovimientos() }

  // Tiempo real: refresca al enfocar la ventana y cada 30 s.
  useEffect(() => {
    const onFocus = () => recargar()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(recargar, 30000)
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, refetchResumen])

  const ajustarStock = async (insumo: Insumo, delta: number) => {
    setAccionId(insumo.id)
    setError(null)
    try {
      await inventarioAPI.registrarMovimiento(insumo.id, {
        tipo: delta > 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(delta),
        motivo: delta > 0 ? 'Ajuste rápido de entrada' : 'Ajuste rápido de salida',
      })
      recargar()
    }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar el stock.') }
    finally { setAccionId(null) }
  }

  const eliminar = async (insumo: Insumo) => {
    if (!window.confirm(`¿Eliminar el insumo "${insumo.nombre}"? Esta acción no se puede deshacer.`)) return
    setAccionId(insumo.id)
    setError(null)
    try { await inventarioAPI.eliminar(insumo.id); recargar() }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo eliminar el insumo.') }
    finally { setAccionId(null) }
  }

  const ordenCompra = async () => {
    const items = (insumos ?? []).filter(i => i.stock_actual <= i.stock_minimo)
    if (items.length === 0) { window.alert('No hay insumos por debajo del mínimo. ¡Inventario al día!'); return }

    const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
    let totalEstimado = 0
    const filas = items.map(i => {
      const sugerida = Math.max(i.stock_minimo * 2 - i.stock_actual, i.stock_minimo)
      const precio = i.precio_unitario ?? 0
      const subtotal = precio * sugerida
      totalEstimado += subtotal
      return [
        i.nombre,
        i.categoria,
        i.stock_actual,
        i.stock_minimo,
        sugerida,
        precio ? money(precio) : '—',
        subtotal ? money(subtotal) : '—',
        i.proveedor || '—',
      ]
    })

    const hoy = new Date()
    const numero = `OC-${hoy.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`

    setAccionId('orden-compra')
    setError(null)
    try {
      await exportarPDF({
        titulo: 'Orden de compra',
        subtitulo: `N.º ${numero} · ${items.length} insumo(s) bajo mínimo`,
        archivo: `orden-compra-${hoy.toISOString().slice(0, 10)}.pdf`,
        bloques: [
          {
            tipo: 'kv',
            titulo: 'Datos de la orden',
            filas: [
              ['Número de orden', numero],
              ['Fecha de emisión', hoy.toLocaleDateString('es-CO', { dateStyle: 'long' })],
              ['Insumos a reponer', String(items.length)],
              ['Total estimado', money(totalEstimado)],
            ],
          },
          {
            tipo: 'tabla',
            titulo: 'Insumos por debajo del mínimo',
            columnas: ['Insumo', 'Categoría', 'Stock', 'Mínimo', 'Cant. sugerida', 'Precio unit.', 'Subtotal', 'Proveedor'],
            filas,
          },
          {
            tipo: 'texto',
            titulo: 'Observaciones',
            texto: 'La cantidad sugerida lleva cada insumo al doble de su stock mínimo. Confirme cantidades y precios con el proveedor antes de emitir la compra definitiva.',
          },
        ],
        notaLegal: 'Orden de compra interna generada por el sistema Odontocitas. Documento de uso administrativo; no constituye factura ni documento tributario.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la orden de compra.')
    } finally {
      setAccionId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Inventario de insumos</h1>
          <p className="text-xs text-[#8B7355] mt-0.5 flex items-center gap-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualización en tiempo real
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={ordenCompra} disabled={accionId === 'orden-compra'}
            className="flex items-center gap-2 border border-[#D4C4B0] bg-white text-[#3D2B1F] px-3 py-2 rounded-lg text-sm hover:bg-[#F5EFE6] disabled:opacity-50">
            <ShoppingCart size={14} /> {accionId === 'orden-compra' ? 'Generando...' : 'Orden de compra'}
          </button>
          <button onClick={() => setModal({ insumo: null })}
            className="flex items-center gap-2 bg-[#C17A5A] hover:bg-[#A0623F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={14} /> Nuevo insumo
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        {[
          { label: 'Total insumos', value: resumen?.total_insumos ?? '—' },
          { label: 'Stock bajo', value: resumen?.stock_bajo ?? '—', alert: true },
          { label: 'Por vencer (30d)', value: resumen?.por_vencer ?? '—', alert: true },
          { label: 'Valor total', value: resumen ? `$${(resumen.valor_total / 1000000).toFixed(1)}M` : '—' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-xl border border-[#D4C4B0] p-4">
            <div className="text-xs text-[#8B7355] mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.alert ? 'text-[#C17A5A]' : 'text-[#3D2B1F]'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
          <input type="text" placeholder="Buscar insumo..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D4C4B0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#C17A5A]" />
        </div>
        {(['Todos', 'Protección', 'Materiales', 'Anestesia', 'Instrumental'] as Cat[]).map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cat === c ? 'bg-[#C17A5A] text-white' : 'bg-white border border-[#D4C4B0] text-[#8B7355] hover:bg-[#F5EFE6]'
            }`}>{c}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
        {loading && !insumos ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-[#C17A5A]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EDE0D4]">
                {['INSUMO', 'CATEGORÍA', 'STOCK', 'MÍNIMO', 'VENCIMIENTO', 'PROVEEDOR', 'ESTADO', ''].map((h, idx) => (
                  <th key={idx} className="text-left text-xs font-semibold text-[#8B7355] px-4 py-3 tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(insumos ?? []).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8B7355]">No hay insumos que coincidan.</td></tr>
              ) : (insumos ?? []).map(i => (
                <tr key={i.id} className="border-b border-[#F5EFE6] hover:bg-[#FDFAF7] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[#3D2B1F]">{i.nombre}</td>
                  <td className="px-4 py-3 text-sm text-[#8B7355]">{i.categoria}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => ajustarStock(i, -1)} disabled={accionId === i.id || i.stock_actual === 0}
                        className="w-5 h-5 rounded border border-[#D4C4B0] flex items-center justify-center text-[#8B7355] hover:bg-[#F5EFE6] disabled:opacity-30">
                        <Minus size={11} />
                      </button>
                      <span className={`text-sm font-bold w-8 text-center ${i.stock_actual <= i.stock_minimo ? 'text-red-600' : 'text-[#3D2B1F]'}`}>
                        {i.stock_actual}
                      </span>
                      <button onClick={() => ajustarStock(i, 1)} disabled={accionId === i.id}
                        className="w-5 h-5 rounded border border-[#D4C4B0] flex items-center justify-center text-[#8B7355] hover:bg-[#F5EFE6] disabled:opacity-30">
                        <Plus size={11} />
                      </button>
                      <span className="text-[10px] text-[#8B7355] ml-1">{i.unidad}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8B7355]">{i.stock_minimo}</td>
                  <td className={`px-4 py-3 text-sm ${i.fecha_vencimiento ? 'text-amber-600 font-medium' : 'text-[#8B7355]'}`}>
                    {i.fecha_vencimiento
                      ? new Date(i.fecha_vencimiento).toLocaleDateString('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8B7355]">{i.proveedor || '—'}</td>
                  <td className="px-4 py-3"><Badge estado={estadoLabel[i.estado] ?? i.estado} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setModal({ insumo: i })} className="text-[#8B7355] hover:text-[#C17A5A]" title="Editar"><Pencil size={15} /></button>
                      <button onClick={() => eliminar(i)} disabled={accionId === i.id} className="text-[#A0623F] hover:text-red-600 disabled:opacity-40" title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-[#D4C4B0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#EDE0D4]">
          <h2 className="font-semibold text-[#3D2B1F]">Movimientos recientes</h2>
        </div>
        <div className="divide-y divide-[#F5EFE6]">
          {(movimientos ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#8B7355]">Sin movimientos registrados.</div>
          ) : (movimientos ?? []).map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-[#3D2B1F]">{m.insumo_nombre ?? 'Insumo eliminado'}</div>
                <div className="text-xs text-[#8B7355]">
                  {m.motivo || 'Movimiento de inventario'} · {m.usuario_nombre ?? 'Sistema'}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${m.tipo === 'salida' ? 'text-red-600' : 'text-[#5A8A6A]'}`}>
                  {m.tipo === 'salida' ? '-' : '+'}{m.cantidad} {m.tipo}
                </div>
                <div className="text-xs text-[#8B7355]">
                  {new Date(m.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <InsumoModal
          insumo={modal.insumo}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); recargar() }}
        />
      )}
    </div>
  )
}

function InsumoModal({ insumo, onClose, onSaved }: { insumo: Insumo | null; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<Omit<Insumo, 'id' | 'estado'>>(
    insumo
      ? {
          nombre: insumo.nombre, categoria: insumo.categoria, stock_actual: insumo.stock_actual,
          stock_minimo: insumo.stock_minimo, unidad: insumo.unidad, proveedor: insumo.proveedor,
          precio_unitario: insumo.precio_unitario,
          fecha_vencimiento: insumo.fecha_vencimiento ? insumo.fecha_vencimiento.slice(0, 10) : null,
        }
      : emptyInsumo
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof typeof data>(k: K, v: (typeof data)[K]) => setData(d => ({ ...d, [k]: v }))

  const submit = async () => {
    if (!data.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload = { ...data, fecha_vencimiento: data.fecha_vencimiento || null }
    try {
      if (insumo) await inventarioAPI.actualizar(insumo.id, payload)
      else await inventarioAPI.crear(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el insumo.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#D4C4B0] w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#3D2B1F]">{insumo ? 'Editar insumo' : 'Nuevo insumo'}</h3>
          <button onClick={onClose} className="text-[#8B7355] hover:text-[#3D2B1F]"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Nombre</label>
            <input value={data.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Categoría</label>
            <select value={data.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Unidad</label>
            <input value={data.unidad} onChange={e => set('unidad', e.target.value)} className={inputCls} placeholder="caja, unidad, ml..." />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Stock actual</label>
            <input type="number" min={0} value={data.stock_actual} onChange={e => set('stock_actual', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Stock mínimo</label>
            <input type="number" min={0} value={data.stock_minimo} onChange={e => set('stock_minimo', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Precio unitario (COP)</label>
            <input type="number" min={0} value={data.precio_unitario ?? ''} onChange={e => set('precio_unitario', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Vencimiento</label>
            <input type="date" value={data.fecha_vencimiento ?? ''} onChange={e => set('fecha_vencimiento', e.target.value || null)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#8B7355] mb-1 block">Proveedor</label>
            <input value={data.proveedor ?? ''} onChange={e => set('proveedor', e.target.value)} className={inputCls} />
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 border border-[#D4C4B0] text-[#8B7355] py-2 rounded-lg text-sm hover:bg-[#F5EFE6]">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex-1 bg-[#C17A5A] hover:bg-[#A0623F] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
