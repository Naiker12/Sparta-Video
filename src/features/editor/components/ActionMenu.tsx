import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type MenuEntry = { label: string; icon?: LucideIcon; shortcut?: string; checked?: boolean; disabled?: boolean; destructive?: boolean; onSelect: () => void } | { separator: true } | { heading: string }
type Props = { label: string; children: ReactNode; items: MenuEntry[]; align?: 'start' | 'end'; triggerClass?: string }

export function ActionMenu({ label, children, items, align = 'end', triggerClass = 'subtle-button' }: Props) {
  return <Menu.Root><Menu.Trigger className={triggerClass} aria-label={label} title={label}>{children}</Menu.Trigger><Menu.Portal><Menu.Positioner className="menu-positioner" side="bottom" align={align} sideOffset={6}><Menu.Popup className="action-menu-popup" aria-label={label}>{items.map((item, index) => {
    if ('separator' in item) return <Menu.Separator className="action-menu-separator" key={`separator-${index}`} />
    if ('heading' in item) return <div className="action-menu-heading" role="presentation" key={`heading-${index}`}>{item.heading}</div>
    const Icon = item.icon
    const content = <>{Icon ? <Icon size={14} /> : <span className="menu-icon-space" />}<span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}{item.checked !== undefined && <Menu.CheckboxItemIndicator className="menu-check-space"><Check size={13} /></Menu.CheckboxItemIndicator>}</>
    if (item.checked !== undefined) return <Menu.CheckboxItem key={item.label} className={`action-menu-item ${item.destructive ? 'destructive' : ''}`} checked={item.checked} onCheckedChange={item.onSelect} disabled={item.disabled}>{content}</Menu.CheckboxItem>
    return <Menu.Item key={item.label} className={`action-menu-item ${item.destructive ? 'destructive' : ''}`} disabled={item.disabled} onClick={item.onSelect}>{content}</Menu.Item>
  })}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>
}

export function MenuChevron() { return <ChevronDown size={12} aria-hidden="true" /> }
