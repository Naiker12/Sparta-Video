import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: 'default' | 'sm'
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, size = 'default', 'aria-label': ariaLabel, onClick, onKeyDown, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      onCheckedChange?.(!checked)
      onClick?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onCheckedChange?.(!checked)
      }
      onKeyDown?.(e)
    }

    const isSm = size === 'sm'

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
          'disabled:cursor-not-allowed disabled:opacity-40',
          isSm ? 'h-[16px] w-[28px]' : 'h-[18px] w-[32px]',
          checked ? 'bg-primary' : 'bg-input hover:bg-input-hover',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full shadow-xs transition-transform duration-200 ease-in-out',
            isSm ? 'h-[12px] w-[12px]' : 'h-[14px] w-[14px]',
            checked
              ? (isSm ? 'bg-white translate-x-[14px]' : 'bg-white translate-x-[16px]')
              : 'bg-white/80 translate-x-[2px]'
          )}
        />
      </button>
    )
  },
)
Switch.displayName = 'Switch'
