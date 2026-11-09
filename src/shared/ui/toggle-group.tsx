import * as React from 'react'
import { cn } from '../../lib/utils'

interface ToggleGroupContextValue {
  value: string
  onValueChange: (val: string) => void
  size?: 'sm' | 'default'
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
  size?: 'sm' | 'default'
}

export function ToggleGroup({ value, onValueChange, size = 'sm', className, children, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange, size }}>
      <div className={cn('inline-flex items-center gap-1 rounded-md bg-muted p-0.5', className)} {...props}>
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

export interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ value, className, children, disabled, ...props }, ref) => {
    const ctx = React.useContext(ToggleGroupContext)
    const isSelected = ctx?.value === value

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        disabled={disabled}
        onClick={() => ctx?.onValueChange(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-[5px] text-xs font-medium transition-colors cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none',
          ctx?.size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-xs',
          isSelected
            ? 'bg-primary/20 text-foreground font-semibold shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = 'ToggleGroupItem'

