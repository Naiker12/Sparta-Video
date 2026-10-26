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
          'focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18191d]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          isSm ? 'h-[16px] w-[28px]' : 'h-[20px] w-[36px]',
          checked ? 'bg-[#3b82f6]' : 'bg-[#2c2d35] hover:bg-[#34363f]',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
            isSm
              ? 'size-3 ' + (checked ? 'translate-x-[13px]' : 'translate-x-[2px]')
              : 'size-4 ' + (checked ? 'translate-x-[18px]' : 'translate-x-[2px]'),
          )}
        />
      </button>
    )
  },
)

Switch.displayName = 'Switch'
