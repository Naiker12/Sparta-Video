import * as React from 'react'
import { cn } from '../../lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-7 w-full rounded-[6px] border border-border/70 bg-input px-2 py-0.5 text-xs text-foreground placeholder:text-muted-foreground transition-colors hover:bg-input-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 font-mono tabular-nums',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
