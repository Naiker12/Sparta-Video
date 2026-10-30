import * as React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'blue' | 'pill'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        {
          'border-transparent bg-slate-800 text-slate-100 hover:bg-slate-700': variant === 'default',
          'border-transparent bg-slate-900 text-slate-300': variant === 'secondary',
          'border-transparent bg-red-500 text-white': variant === 'destructive',
          'text-slate-300 border-slate-700': variant === 'outline',
          'border-transparent bg-blue-600 text-white shadow-sm': variant === 'blue',
          'rounded-full px-2.5 py-0.5 text-xs font-medium': variant === 'pill',
        },
        className
      )}
      {...props}
    />
  )
}

