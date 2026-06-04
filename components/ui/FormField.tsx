import { cn } from '@/lib/utils'
import type React from 'react'

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

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={cn('form-input', error && 'error', className)}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn('form-select', error && 'error', className)}
      {...props}
    >
      {children}
    </select>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  rows?: number
}

export function Textarea({ error, className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn('form-input resize-none', error && 'error', className)}
      {...props}
    />
  )
}
