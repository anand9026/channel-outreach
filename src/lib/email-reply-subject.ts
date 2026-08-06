import type { Message } from '../types'

export function defaultEmailReplySubject(messages: Message[]): string {
  const prior = [...messages]
    .filter((m) => m.channel === 'email' && m.subject)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  if (!prior?.subject) return 'Re: your message'

  const subject = prior.subject.trim()
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`
}
