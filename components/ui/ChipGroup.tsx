import { cn } from '@/lib/utils'

interface Option { value: string; label: string }

interface RadioChipGroupProps {
  options: Option[]
  value: string
  onChange: (v: string) => void
  className?: string
  disabled?: boolean
}

export function RadioChipGroup({ options, value, onChange, className, disabled }: RadioChipGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className, disabled && 'opacity-60 pointer-events-none')}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(o.value)}
          className={cn('chip-radio', value === o.value && 'selected')}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: value === o.value ? '#3b82f6' : 'rgba(148,163,184,0.3)',
              border: value === o.value ? 'none' : '1px solid rgba(148,163,184,0.3)',
            }}
          />
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface CheckChipGroupProps {
  options: Option[]
  value: string[]
  onChange: (v: string[]) => void
  className?: string
  disabled?: boolean
}

export function CheckChipGroup({ options, value, onChange, className, disabled }: CheckChipGroupProps) {
  const toggle = (v: string) => {
    if (disabled) return
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className, disabled && 'opacity-60 pointer-events-none')}>
      {options.map(o => {
        const selected = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={cn('chip-check', selected && 'selected')}
          >
            <span
              className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: selected ? '#3b82f6' : 'transparent',
                border: selected ? 'none' : '1px solid rgba(148,163,184,0.3)',
              }}
            >
              {selected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
