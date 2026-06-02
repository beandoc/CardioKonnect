import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  variant?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'gray'
  className?: string
}

export default function Badge({ children, variant = 'blue', className }: Props) {
  const variantClass = {
    blue:   'badge-blue',
    violet: 'badge-violet',
    green:  'badge-green',
    red:    'badge-red',
    amber:  'badge-amber',
    gray:   'badge-gray',
  }[variant]

  return (
    <span className={cn('badge', variantClass, className)}>
      {children}
    </span>
  )
}
