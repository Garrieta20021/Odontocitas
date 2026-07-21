import type { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  value: string | number
  label: string
  sublabel?: string
  color?: string
}

export default function StatCard({ icon, value, label, sublabel, color = 'text-[#C17A5A]' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-[#D4C4B0] flex-1 min-w-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-[#F5EFE6] ${color}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-[#3D2B1F]">{value}</div>
      <div className="text-sm text-[#8B7355] mt-0.5">{label}</div>
      {sublabel && <div className="text-xs text-[#C17A5A] mt-1">{sublabel}</div>}
    </div>
  )
}
