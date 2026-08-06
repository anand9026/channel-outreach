export type ParsedEmailDisplay = {
  /** Latest reply — what the user should read first */
  primary: string
  /** Earlier thread / quoted content */
  quoted?: string
  /** True when quoted content was stripped from a noisy snippet */
  hadQuotedReply: boolean
}

const GMAIL_WROTE_RE =
  /\sOn\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[\s\S]{0,320}?wrote:\s*/i

const OUTLOOK_ORIGINAL_RE = /-{3,}\s*Original Message\s*-{3,}/i

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function splitQuotedReply(text: string): { primary: string; quoted?: string } {
  const outlookIdx = text.search(OUTLOOK_ORIGINAL_RE)
  if (outlookIdx > 0) {
    return {
      primary: text.slice(0, outlookIdx).trim(),
      quoted: text.slice(outlookIdx).trim(),
    }
  }

  const wroteMatch = text.match(GMAIL_WROTE_RE)
  if (wroteMatch && wroteMatch.index != null && wroteMatch.index > 0) {
    return {
      primary: text.slice(0, wroteMatch.index).trim(),
      quoted: text.slice(wroteMatch.index).trim(),
    }
  }

  const lines = text.split('\n')
  const quoteStart = lines.findIndex((line) => /^>\s?/.test(line))
  if (quoteStart > 0) {
    return {
      primary: lines.slice(0, quoteStart).join('\n').trim(),
      quoted: lines.slice(quoteStart).join('\n').trim(),
    }
  }

  return { primary: text.trim() }
}

/**
 * Turn Gmail snippets / HTML / raw thread text into readable inbox copy.
 */
export function formatEmailForDisplay(raw: string | null | undefined): ParsedEmailDisplay {
  if (!raw || !String(raw).trim()) {
    return { primary: '(No message content)', hadQuotedReply: false }
  }

  let text = decodeHtmlEntities(String(raw))
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = stripHtmlTags(text)
  }
  text = normalizeWhitespace(text)

  const { primary, quoted } = splitQuotedReply(text)
  const cleanPrimary = normalizeWhitespace(primary) || normalizeWhitespace(text)

  if (!quoted) {
    return { primary: cleanPrimary, hadQuotedReply: false }
  }

  const cleanQuoted = normalizeWhitespace(
    quoted
      .replace(GMAIL_WROTE_RE, '')
      .replace(/^>\s?/gm, '')
      .replace(OUTLOOK_ORIGINAL_RE, ''),
  )

  return {
    primary: cleanPrimary,
    quoted: cleanQuoted || undefined,
    hadQuotedReply: true,
  }
}

export function previewEmailLine(raw: string | null | undefined, max = 120): string {
  const { primary } = formatEmailForDisplay(raw)
  if (primary.length <= max) return primary
  return `${primary.slice(0, max - 1)}…`
}
