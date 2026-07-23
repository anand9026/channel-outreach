/** Extract Meta positional slots {{1}}, {{2}} from template body text. */

export function extractMetaSlots(body: string): string[] {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
  return [...new Set(matches)].sort((a, b) => Number(a) - Number(b))
}

export function fillMetaBody(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => values[n] ?? `{{${n}}}`)
}
