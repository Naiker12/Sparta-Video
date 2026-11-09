import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type MenuEntry = { label: string; icon?: LucideIcon; shortcut?: string; checked?: boolean; disabled?: boolean; destructive?: boolean; onSelect: () => void } | { separator: true } | { heading: string }
type Props = {
  label: string
  children: ReactNode
  items: MenuEntry[]
  align?: 'start' | 'end'
  triggerClass?: string
  popupClass?: string
}

export function ActionMenu({
  label,
  children,
  items,
  align = 'end',
  triggerClass = 'subtle-button',
  popupClass = '',
}: Props) {
  const hasAnyIcon = items.some((it) => 'icon' in it && !!it.icon)

  return (
    <Menu.Root>
      <Menu.Trigger className={triggerClass} aria-label={label} title={label}>
        {children}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="menu-positioner z-[99999]" side="bottom" align={align} sideOffset={6}>
          <Menu.Popup
            className={`action-menu-popup z-[99999] min-w-[190px] p-1.5 bg-[#14161b] border border-white/12 rounded-xl shadow-2xl text-white outline-none select-none ${popupClass}`.trim()}
            style={{
              backgroundColor: '#14161b',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '6px',
              minWidth: '190px',
              color: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.65)',
            }}
            aria-label={label}
          >
            {items.map((item, index) => {
              if ('separator' in item) {
                return (
                  <Menu.Separator
                    className="action-menu-separator my-1 h-[1px] bg-white/[0.08]"
                    style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }}
                    key={`separator-${index}`}
                  />
                )
              }
              if ('heading' in item) {
                return (
                  <div
                    className="action-menu-heading px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                    role="presentation"
                    key={`heading-${index}`}
                  >
                    {item.heading}
                  </div>
                )
              }
              const Icon = item.icon
              const content = (
                <div
                  className="flex flex-row items-center gap-2.5 w-full"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', width: '100%' }}
                >
                  {hasAnyIcon &&
                    (Icon ? (
                      <Icon size={14} className="action-menu-icon shrink-0 text-muted-foreground group-hover:text-white" aria-hidden="true" />
                    ) : (
                      <span className="w-3.5 shrink-0" aria-hidden="true" />
                    ))}
                  <span className="action-menu-label text-xs font-medium flex-1 text-left whitespace-nowrap">{item.label}</span>
                  {item.shortcut && <kbd className="text-[10px] text-muted-foreground font-mono ml-auto">{item.shortcut}</kbd>}
                  {item.checked !== undefined && (
                    <Menu.CheckboxItemIndicator className="menu-check-space ml-auto">
                      <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                    </Menu.CheckboxItemIndicator>
                  )}
                </div>
              )
              if (item.checked !== undefined) {
                return (
                  <Menu.CheckboxItem
                    key={item.label}
                    className={`action-menu-item group flex flex-row items-center w-full px-2.5 py-1.5 rounded-lg text-xs cursor-pointer outline-none transition-colors select-none ${
                      item.destructive
                        ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                        : 'text-white/85 hover:bg-white/10 hover:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white'
                    } ${item.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%' }}
                    checked={item.checked}
                    onCheckedChange={item.onSelect}
                    disabled={item.disabled}
                  >
                    {content}
                  </Menu.CheckboxItem>
                )
              }
              return (
                <Menu.Item
                  key={item.label}
                  className={`action-menu-item group flex flex-row items-center w-full px-2.5 py-1.5 rounded-lg text-xs cursor-pointer outline-none transition-colors select-none ${
                    item.destructive
                      ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                      : 'text-white/85 hover:bg-white/10 hover:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white'
                  } ${item.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%' }}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  {content}
                </Menu.Item>
              )
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function MenuChevron() { return <ChevronDown size={12} aria-hidden="true" /> }
