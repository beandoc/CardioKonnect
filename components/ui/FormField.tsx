import { cn } from '@/lib/utils'
import React, { forwardRef } from 'react'

interface FieldWrapProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function FieldWrap({ label, required, error, hint, children, className, disabled }: FieldWrapProps) {
  return (
    <div className={cn('space-y-1', className, disabled && 'opacity-50 pointer-events-none')}>
      <label className="form-label">
        {label}
        {required && <span className="ml-0.5" style={{ color: '#f43f5e' }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>{hint}</p>}
      {error && <p className="text-xs" style={{ color: '#f43f5e' }}>{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('form-input', error && 'error', className)}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn('form-select', error && 'error', className)}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  rows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn('form-input resize-none', error && 'error', className)}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
