import * as React from 'react'
import { cn } from '../../lib/utils'

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>
export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  variant?: 'default' | 'pill' | 'underline' | 'dock'
}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      className={cn('inline-flex items-center justify-start gap-1 p-1 bg-card border-b border-border', className)}
      {...props}
    />
  )
}

export const TabTrigger = React.forwardRef<HTMLButtonElement, TabTriggerProps>(
  ({ className, active, variant = 'default', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all cursor-pointer select-none',
          {
            'px-2.5 py-1 rounded-[6px] text-muted-foreground hover:text-foreground': variant === 'default' && !active,
            'px-2.5 py-1 rounded-[6px] bg-primary/20 text-foreground font-semibold shadow-xs': variant === 'default' && active,
            'px-3 py-1 rounded-full text-muted-foreground hover:text-foreground': variant === 'pill' && !active,
            'px-3 py-1 rounded-full bg-primary/20 text-foreground font-semibold': variant === 'pill' && active,
            'px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground': variant === 'underline' && !active,
            'px-3 py-2 border-b-2 border-primary text-foreground font-semibold': variant === 'underline' && active,
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40': variant === 'dock' && !active,
            'flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-[6px] text-[11px] font-semibold bg-primary/20 text-foreground shadow-xs': variant === 'dock' && active,
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TabTrigger.displayName = 'TabTrigger'
