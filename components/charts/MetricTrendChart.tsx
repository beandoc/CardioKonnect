'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { TrendPoint } from '@/lib/types'

interface Props {
  data: TrendPoint[]
  label: string
  unit?: string
  color?: string
  referenceLines?: { value: number; label: string; color?: string }[]
  height?: number
  fillArea?: boolean
  yDomain?: [number | 'auto', number | 'auto']
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label: lbl, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">{lbl}</p>
      <p className="text-blue-600 font-semibold">{payload[0].value} {unit}</p>
    </div>
  )
}

export default function MetricTrendChart({
  data, label, unit, color = '#3b82f6',
  referenceLines = [], height = 220, fillArea = true, yDomain,
}: Props) {
  const chartData = data
    .filter(d => d.value !== null)
    .map(d => ({
      date: (() => { try { return format(parseISO(d.date), 'MMM yy') } catch { return d.date } })(),
      value: d.value,
    }))

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400" style={{ height }}>
        No data recorded yet
      </div>
    )
  }

  const ChartComponent = fillArea ? AreaChart : LineChart

  const tickColor = typeof document !== 'undefined' && document.body.classList.contains('light') 
    ? '#475569' 
    : '#9ca3af'

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}{unit ? ` (${unit})` : ''}</p>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={chartData}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            domain={yDomain ?? ['auto', 'auto']}
            width={40}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {referenceLines.map(r => (
            <ReferenceLine
              key={r.value}
              y={r.value}
              stroke={r.color ?? '#ef4444'}
              strokeDasharray="4 4"
              label={{ value: r.label, position: 'right', fontSize: 10, fill: r.color ?? '#ef4444' }}
            />
          ))}
          {fillArea ? (
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${label})`}
              dot={{ r: 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
