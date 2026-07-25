import { useEffect, useRef, useState } from 'react'

/**
 * Tiny dependency-free emoji picker. Curated set of the most common
 * work/chat emojis so it feels native without a 6MB emoji-mart bundle.
 */
const EMOJIS: Array<{ group: string; items: string[] }> = [
  {
    group: 'Smileys',
    items: [
      '\u{1F642}', '\u{1F60A}', '\u{1F604}', '\u{1F609}', '\u{1F60E}', '\u{1F914}',
      '\u{1F60D}', '\u{1F970}', '\u{1F929}', '\u{1F973}', '\u{1F44B}', '\u{1F44D}',
      '\u{1F64F}', '\u{1F44F}', '\u{1F4AA}', '\u{1F91D}',
    ],
  },
  {
    group: 'Reactions',
    items: [
      '\u2764\uFE0F', '\u{1F525}', '\u2728', '\u{1F389}', '\u{1F44C}', '\u{1F44D}',
      '\u{1F44E}', '\u{1F614}', '\u{1F62E}', '\u{1F602}', '\u{1F60D}', '\u{1F621}',
    ],
  },
  {
    group: 'Work',
    items: [
      '\u{1F4E9}', '\u{1F4C5}', '\u{1F4CE}', '\u{1F4CA}', '\u{1F4C8}', '\u{1F4C9}',
      '\u{1F4B0}', '\u{1F4B3}', '\u{1F4E6}', '\u2705', '\u274C', '\u26A1',
    ],
  },
]

export function EmojiPicker({
  onPick,
  onClose,
  anchorRight = false,
}: {
  onPick: (emoji: string) => void
  onClose: () => void
  anchorRight?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const [q, setQ] = useState('')
  const filtered = EMOJIS.map((g) => ({
    ...g,
    items: q ? g.items : g.items,
  }))

  return (
    <div
      ref={ref}
      className={`rx-emoji-pop${anchorRight ? ' is-right' : ''}`}
      role="dialog"
      aria-label="Emoji picker"
      data-testid="emoji-picker"
    >
      <input
        className="rx-input"
        placeholder={'Search emoji\u2026'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="rx-emoji-scroll">
        {filtered.map((g) => (
          <div key={g.group} className="rx-emoji-group">
            <div className="rx-emoji-group-title">{g.group}</div>
            <div className="rx-emoji-grid">
              {g.items.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="rx-emoji-btn"
                  onClick={() => onPick(em)}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
