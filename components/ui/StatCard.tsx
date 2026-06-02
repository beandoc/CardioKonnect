import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  accentColor?: string
  trend?: { value: number; label: string }
}

export default function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, accentColor = '#3b82f6', trend }: Props) {
  return (
    <div className="kpi-card blue" style={{ '--accent': accentColor } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
        {label}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: 'rgba(148,163,184,0.45)' }}>{sub}</p>
      )}
      {trend && (
        <p className="text-xs mt-2 font-medium" style={{ color: trend.value >= 0 ? '#10b981' : '#f43f5e' }}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
        </p>
      )}
    </div>
  )
}
