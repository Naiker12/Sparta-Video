import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'primary' | 'pill'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg' | 'xs'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          {
            'bg-secondary text-foreground hover:bg-input': variant === 'default' || variant === 'secondary',
            'bg-primary text-primary-foreground font-semibold hover:brightness-110 shadow-xs': variant === 'primary',
            'bg-destructive text-white hover:brightness-110': variant === 'destructive',
            'border border-border bg-transparent hover:bg-secondary text-foreground': variant === 'outline',
            'hover:bg-secondary/60 text-muted-foreground hover:text-foreground': variant === 'ghost',
            'text-primary underline-offset-4 hover:underline': variant === 'link',
            'rounded-full px-3 py-1 font-semibold': variant === 'pill',
          },
          {
            'h-8 px-3 text-xs': size === 'default',
            'h-6 px-2 text-[11px]': size === 'xs',
            'h-7 rounded-[6px] px-2.5 text-xs': size === 'sm',
            'h-9 rounded-[6px] px-4 text-xs font-medium': size === 'lg',
            'h-7 w-7 p-0': size === 'icon',
            'h-6 w-6 p-0': size === 'icon-sm',
            'h-10 w-10 p-0 rounded-full': size === 'icon-lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
