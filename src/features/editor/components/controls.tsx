import type { ReactNode } from 'react'

export function IconButton({ label, children, active = false, disabled = false, onClick }: { label: string; children: ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>
}

export function Property({ label, x, y, suffix = '' }: { label: string; x: string; y?: string; suffix?: string }) {
  return <div className="property-row"><span>{label}</span><div className="property-values"><span>{x}<i>{suffix}</i></span>{y && <span>{y}</span>}</div></div>
}
