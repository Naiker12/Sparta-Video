import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, onChange, disabled, ...props }, ref) => {
    const val = value !== undefined ? value : defaultValue ?? 0
    const percent = Math.min(100, Math.max(0, ((val - min) / (max - min || 1)) * 100))

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = Number(e.target.value)
      onValueChange?.(num)
      onChange?.(e)
    }

    return (
      <div className={cn('relative flex w-full touch-none select-none items-center h-5 py-1', className)}>
        <div className="relative w-full h-1 bg-input rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          disabled={disabled}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-sm ring-1 ring-black/20 pointer-events-none transition-transform"
          style={{ left: `${percent}%` }}
        />
      </div>
    )
  }
)
Slider.displayName = 'Slider'
