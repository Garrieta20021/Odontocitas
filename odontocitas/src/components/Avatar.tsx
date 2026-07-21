interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const colors = [
  'bg-[#C17A5A] text-white',
  'bg-[#5A8A6A] text-white',
  'bg-[#4A7A9B] text-white',
  'bg-[#C4943A] text-white',
  'bg-[#8A5A9B] text-white',
]

function getColor(initials: string) {
  const idx = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % colors.length
  return colors[idx]
}

export default function Avatar({ initials, size = 'md' }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sizeClass} ${getColor(initials)} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}
