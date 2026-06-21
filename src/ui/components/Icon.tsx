// Minimal inline SVG icon set (Lucide-style, currentColor). No dependency.
// Replaces emoji in chrome for the engineered Linear look. Decorative by default
// (aria-hidden); pass a `label` to expose an accessible name.
const PATHS: Record<string, string> = {
  inbox: 'M4 13h4l2 3h4l2-3h4M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM4 10h16M8 3v4M16 3v4',
  settings: 'M10.3 4.3a1 1 0 0 1 .94-.7h1.52a1 1 0 0 1 .94.7l.3.92a1 1 0 0 0 1.36.6l.88-.4a1 1 0 0 1 1.18.36l.76 1.06a1 1 0 0 1-.12 1.3l-.7.66a1 1 0 0 0 0 1.46l.7.66a1 1 0 0 1 .12 1.3l-.76 1.06a1 1 0 0 1-1.18.36l-.88-.4a1 1 0 0 0-1.36.6l-.3.92a1 1 0 0 1-.94.7h-1.52a1 1 0 0 1-.94-.7l-.3-.92a1 1 0 0 0-1.36-.6l-.88.4a1 1 0 0 1-1.18-.36l-.76-1.06a1 1 0 0 1 .12-1.3l.7-.66a1 1 0 0 0 0-1.46l-.7-.66a1 1 0 0 1-.12-1.3l.76-1.06a1 1 0 0 1 1.18-.36l.88.4a1 1 0 0 0 1.36-.6l.3-.92zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  refresh: 'M20 11a8 8 0 0 0-14-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 4.5L20 16M20 20v-4h-4',
  sparkles: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  mail: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zM4 7l8 6 8-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 9v4M12 17h.01M10.3 4.2 2.6 17.5A1.5 1.5 0 0 0 3.9 20h16.2a1.5 1.5 0 0 0 1.3-2.5L13.7 4.2a1.5 1.5 0 0 0-2.6 0z',
  shield: 'M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5',
  paperclip: 'M21 11.5 12.5 20a4.5 4.5 0 0 1-6.4-6.4l8.5-8.5a3 3 0 0 1 4.3 4.3l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1l7.8-7.8',
  inboxOff: 'M4 13h4l2 3h4l2-3h4M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5'
}

export function Icon({ name, size = 16, label, style }: { name: keyof typeof PATHS | string; size?: number; label?: string; style?: React.CSSProperties }) {
  const d = PATHS[name] ?? ''
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flexShrink: 0, ...style }}
    >
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} />
      ))}
    </svg>
  )
}
