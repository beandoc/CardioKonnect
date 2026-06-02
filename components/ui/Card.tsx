import { cn } from '@/lib/utils'

interface CardProps { children: React.ReactNode; className?: string; style?: React.CSSProperties }
interface CardHeaderProps { children: React.ReactNode; className?: string }
interface CardTitleProps { children: React.ReactNode }
interface CardBodyProps { children: React.ReactNode; className?: string }

export function Card({ children, className, style }: CardProps) {
  return (
    <div className={cn('glass-card', className)} style={style}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between px-5 py-4', className)}
      style={{ borderBottom: '1px solid rgba(59,130,246,0.1)' }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children }: CardTitleProps) {
  return (
    <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
      {children}
    </h3>
  )
}

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  )
}
