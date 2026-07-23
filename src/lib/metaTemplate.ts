/** Convert UI body placeholders to Meta positional {{1}}, {{2}}, … */
export function toMetaBody(body: string): { text: string; examples: string[] } {
  const matches = [...body.matchAll(/\{\{([^}]+)\}\}/g)]
  if (matches.length === 0) {
    return { text: body, examples: [] }
  }

  const seen = new Map<string, number>()
  const examples: string[] = []
  let next = 1
  let text = body

  for (const match of matches) {
    const key = match[1]
    if (!seen.has(key)) {
      const n = next++
      seen.set(key, n)
      const label = key.includes('.') ? (key.split('.').pop() ?? key) : key
      examples.push(label.replace(/\W+/g, '_') || `var_${n}`)
    }
  }

  for (const [key, n] of seen) {
    text = text.split(`{{${key}}}`).join(`{{${n}}}`)
  }

  return { text, examples }
}

export function toMetaTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512)
}
