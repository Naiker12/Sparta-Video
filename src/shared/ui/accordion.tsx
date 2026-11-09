import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AccordionProps {
  title: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function AccordionSection({ title, defaultOpen = true, children, className, action }: AccordionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className={cn('border-t border-border/60 py-0.5', className)}>
      <div className="w-full flex items-center justify-between py-1.5 text-[13px] font-semibold text-foreground">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer select-none text-left"
        >
          <ChevronDown
            size={13}
            className={cn('text-muted-foreground transition-transform duration-200', {
              '-rotate-90': !open,
            })}
          />
          <span>{title}</span>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {open && <div className="pt-0.5 pb-2 text-xs">{children}</div>}
    </div>
  )
}
