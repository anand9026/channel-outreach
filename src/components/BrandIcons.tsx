/**
 * Lucide removed brand icons (Instagram, WhatsApp) for trademark reasons.
 * These tiny inline SVGs mimic Lucide's stroke style so they blend seamlessly
 * with the rest of the icon set.
 */

export function IgIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.52 3.48A11.87 11.87 0 0 0 12 0C5.37 0 0 5.37 0 12a11.94 11.94 0 0 0 1.64 6L0 24l6.14-1.61A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12a11.87 11.87 0 0 0-3.48-8.52z" opacity="0.15" fill="currentColor" stroke="none" />
      <path d="M17 14.5c-.5-.25-2-1-2.3-1.1-.3-.1-.5-.15-.7.15s-.8 1-1 1.2c-.2.2-.4.2-.7.05-.5-.25-2-.7-3.6-2.15-1.35-1.2-2.25-2.65-2.5-3.1-.25-.5-.05-.75.2-1s.5-.55.75-.8c.2-.25.3-.4.4-.7s.05-.5-.05-.75c-.1-.25-.7-1.7-1-2.3-.25-.55-.55-.5-.75-.5h-.6c-.25 0-.6.1-.9.4-.3.35-1.15 1.15-1.15 2.75s1.15 3.2 1.35 3.4c.2.25 2.3 3.55 5.55 4.95.8.35 1.4.55 1.9.7.75.25 1.4.2 2 .1.6-.1 2-.85 2.3-1.65.3-.85.3-1.55.2-1.7-.1-.15-.35-.2-.75-.4z" />
    </svg>
  )
}
