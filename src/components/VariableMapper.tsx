import { useEffect, useMemo } from 'react'
import {
  availableFields,
  extractSlots,
  FIELD_CATALOG,
  mergeBindings,
  nextSlot,
  renderWithBindings,
  resolveField,
  syncBindingsToSlots,
  type ResolveContext,
} from '../lib/variables'
import type { DataFieldKey, VariableBinding } from '../types'

interface VariableMapperProps {
  body: string
  subject?: string
  showSubject?: boolean
  bindings: VariableBinding[]
  ctx: ResolveContext
  hasBrands: boolean
  onBodyChange: (body: string) => void
  onSubjectChange?: (subject: string) => void
  onBindingsChange: (bindings: VariableBinding[]) => void
  compact?: boolean
}

export function VariableMapper({
  body,
  subject = '',
  showSubject = false,
  bindings,
  ctx,
  hasBrands,
  onBodyChange,
  onSubjectChange,
  onBindingsChange,
  compact = false,
}: VariableMapperProps) {
  const fields = useMemo(() => availableFields(hasBrands), [hasBrands])
  const slots = useMemo(() => extractSlots(`${subject} ${body}`), [subject, body])

  const synced = useMemo(
    () => syncBindingsToSlots(slots, bindings, hasBrands),
    [slots, bindings, hasBrands],
  )

  useEffect(() => {
    const next = syncBindingsToSlots(slots, bindings, hasBrands)
    const changed =
      next.length !== bindings.length ||
      next.some(
        (b, i) =>
          b.slot !== bindings[i]?.slot ||
          (bindings[i] === undefined && b.field !== undefined),
      )
    if (changed) onBindingsChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when slots change
  }, [slots.join(',')])

  const insertField = (field: DataFieldKey) => {
    const slot = nextSlot(body, subject)
    const token = `{{${slot}}}`
    const spacer = body.length === 0 || body.endsWith(' ') || body.endsWith('\n') ? '' : ' '
    const newBody = body + spacer + token
    onBodyChange(newBody)
    const newSlots = extractSlots(`${subject} ${newBody}`)
    onBindingsChange(
      syncBindingsToSlots(newSlots, bindings, hasBrands).map((b) =>
        b.slot === slot ? { slot, field, literal: field === 'literal' ? '' : undefined } : b,
      ),
    )
  }

  const insertIntoSubject = (field: DataFieldKey) => {
    if (!onSubjectChange) return
    const slot = nextSlot(body, subject)
    const token = `{{${slot}}}`
    const newSubject = subject + (subject ? ' ' : '') + token
    onSubjectChange(newSubject)
    const newSlots = extractSlots(`${newSubject} ${body}`)
    onBindingsChange(
      syncBindingsToSlots(newSlots, bindings, hasBrands).map((b) =>
        b.slot === slot ? { slot, field, literal: field === 'literal' ? '' : undefined } : b,
      ),
    )
  }

  const setBinding = (slot: string, field: DataFieldKey) => {
    onBindingsChange(
      synced.map((b) =>
        b.slot === slot
          ? { slot, field, literal: field === 'literal' ? b.literal ?? '' : undefined }
          : b,
      ),
    )
  }

  const setLiteral = (slot: string, literal: string) => {
    onBindingsChange(
      synced.map((b) => (b.slot === slot ? { ...b, field: 'literal' as const, literal } : b)),
    )
  }

  const previewBindings = mergeBindings(synced, {})
  const previewBody = renderWithBindings(body, previewBindings, ctx)
  const previewSubject = showSubject
    ? renderWithBindings(subject, previewBindings, ctx)
    : undefined

  const groups = useMemo(() => {
    const map = new Map<string, typeof fields>()
    for (const f of fields) {
      const list = map.get(f.group) ?? []
      list.push(f)
      map.set(f.group, list)
    }
    return [...map.entries()]
  }, [fields])

  return (
    <div className={`var-mapper${compact ? ' compact' : ''}`}>
      {!compact ? (
        <div className="var-palette">
          <p className="var-palette-title">Insert from your data</p>
          <p className="muted-xs">
            Click a field to drop a {'{{n}}'} token and wire it. Brand fields only appear when this
            org has brands.
          </p>
          {groups.map(([group, opts]) => (
            <div key={group} className="var-group">
              <span className="var-group-label">{group}</span>
              <div className="var-chips">
                {opts.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="var-chip"
                    title={f.hint}
                    onClick={() => insertField(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="var-compose">
        {showSubject ? (
          <label className="field">
            <span className="row-between-inline">
              Subject
              {!compact ? (
                <span className="muted-xs">
                  Insert:{' '}
                  <button
                    type="button"
                    className="linkish dark"
                    onClick={() => insertIntoSubject('campaign.name')}
                  >
                    campaign
                  </button>
                  {' · '}
                  <button
                    type="button"
                    className="linkish dark"
                    onClick={() => insertIntoSubject(hasBrands ? 'brand.name' : 'org.name')}
                  >
                    {hasBrands ? 'brand' : 'org'}
                  </button>
                </span>
              ) : null}
            </span>
            <input
              value={subject}
              onChange={(e) => onSubjectChange?.(e.target.value)}
              placeholder="Subject with {{1}} tokens…"
            />
          </label>
        ) : null}
        {!compact ? (
          <label className="field">
            <span>Body</span>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Write copy, then insert data fields…"
            />
          </label>
        ) : null}
      </div>

      <div className="var-wire">
        <p className="var-palette-title">Wire slots → existing data</p>
        {slots.length === 0 ? (
          <p className="muted-xs">No {'{{n}}'} tokens yet — insert a field or type {'{{1}}'}.</p>
        ) : (
          <ul className="wire-list">
            {synced.map((b) => {
              const meta = FIELD_CATALOG.find((f) => f.key === b.field)
              const sample = resolveField(b.field, ctx, b.literal)
              return (
                <li key={b.slot} className="wire-row">
                  <span className="wire-slot">{'{{' + b.slot + '}}'}</span>
                  <span className="wire-arrow">→</span>
                  <select
                    value={b.field}
                    onChange={(e) => setBinding(b.slot, e.target.value as DataFieldKey)}
                  >
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.group}: {f.label}
                      </option>
                    ))}
                  </select>
                  {b.field === 'literal' ? (
                    <input
                      className="wire-literal"
                      value={b.literal ?? ''}
                      placeholder="Fixed text"
                      onChange={(e) => setLiteral(b.slot, e.target.value)}
                    />
                  ) : (
                    <span className="wire-sample" title={meta?.hint}>
                      e.g. {sample}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="var-preview">
        <p className="var-palette-title">Live with sample data</p>
        <p className="muted-xs">
          Preview as {ctx.influencer?.name ?? '—'}
          {ctx.brand ? ` · ${ctx.brand.name}` : ' · org-level (no brand)'}
          {ctx.campaign ? ` · ${ctx.campaign.name}` : ''}
        </p>
        {previewSubject ? (
          <p className="email-subject">
            <strong>Subject:</strong> {previewSubject}
          </p>
        ) : null}
        <div className="preview-bubble whatsapp">{previewBody || '…'}</div>
      </div>
    </div>
  )
}
