interface BadgeProps {
  estado: string
  size?: 'sm' | 'md'
}

const estadoConfig: Record<string, string> = {
  'Confirmada': 'bg-green-100 text-green-700',
  'Pendiente': 'bg-amber-100 text-amber-700',
  'Cancelada': 'bg-red-100 text-red-700',
  'Realizada': 'bg-blue-100 text-blue-700',
  'Pagada': 'bg-green-100 text-green-700',
  'Vencida': 'bg-red-100 text-red-700',
  'Normal': 'bg-green-100 text-green-700',
  'Stock bajo': 'bg-red-100 text-red-700',
  'Por vencer': 'bg-amber-100 text-amber-700',
  'Activo': 'bg-green-100 text-green-700',
  'Inactivo': 'bg-gray-100 text-gray-600',
  'Leído': 'bg-gray-100 text-gray-600',
  'Confirmado': 'bg-green-100 text-green-700',
  'Sin respuesta': 'bg-amber-100 text-amber-700',
  'Pendiente envío': 'bg-blue-100 text-blue-700',
}

export default function Badge({ estado, size = 'sm' }: BadgeProps) {
  const cls = estadoConfig[estado] ?? 'bg-gray-100 text-gray-600'
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${padding} ${cls}`}>
      {estado}
    </span>
  )
}
