import { CORE } from './core'

export type Entry = {
  gloss: string
  seen: number
  used: number
  daily: Record<string, number>
  firstSeen: string
  lastSeen: string
  lapseSeen?: number
  lapseDay?: string
}

export type Vocab = Record<string, Entry>

export type Settings = { isOn: boolean; perReply: number }

export const DEFAULT_SETTINGS: Settings = { isOn: true, perReply: 3 }

const FOOTER = /^\s*[*_]*🇵🇹[*_:\s]*(.+)$/u
const SEPARATOR = /\s+[—–=-]\s+|\s*[—–=:]\s*/u
const MIN_USED_LENGTH = 3
const ENGLISH_LOOKALIKES = new Set(['era', 'logo', 'nada', 'come', 'sole', 'pronto', 'com', 'sim'])
const DAYS_KEPT = 30
const CORE_OFFERED = 6
const FADE_SHOWS = 5
const FADE_DAYS = 2
const ITALIC = /(?<![*_\p{L}])[*_]([^*_\n]+?)[*_](?![*_\p{L}])/gu
const RANK = new Map(CORE.map((item, i) => [item.pt, i]))

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function normalize(raw: unknown): Vocab {
  const vocab: Vocab = {}
  if (typeof raw !== 'object' || raw === null) return vocab
  for (const [word, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (typeof value !== 'object' || value === null) continue
    const days = Array.isArray(value.days) ? value.days.map(String) : []
    const daily =
      typeof value.daily === 'object' && value.daily !== null
        ? (value.daily as Record<string, number>)
        : Object.fromEntries(days.map(day => [day, 1]))
    const lastSeen = String(value.lastSeen ?? Object.keys(daily).sort().pop() ?? '')
    vocab[word] = {
      gloss: String(value.gloss ?? ''),
      seen: Number(value.seen ?? 0),
      used: Number(value.used ?? 0),
      daily,
      firstSeen: String(value.firstSeen ?? lastSeen),
      lastSeen,
      ...(typeof value.lapseSeen === 'number' ? { lapseSeen: value.lapseSeen } : {}),
      ...(typeof value.lapseDay === 'string' ? { lapseDay: value.lapseDay } : {}),
    }
  }
  return vocab
}

export function isKnown(entry: Entry): boolean {
  if (entry.used >= 1) return true
  const since = entry.lapseDay ?? ''
  const days = Object.keys(entry.daily).filter(day => day >= since).length
  return entry.seen - (entry.lapseSeen ?? 0) >= FADE_SHOWS && days >= FADE_DAYS
}

export function italicItems(answer: string, vocab: Vocab): string[] {
  const found = new Set<string>()
  for (const match of answer.matchAll(ITALIC)) {
    const item = (match[1] ?? '').trim().toLowerCase()
    if (vocab[item] !== undefined) found.add(item)
  }
  return [...found]
}

function clean(text: string): string {
  return text.replace(/[*_`]/g, '').trim()
}

export function parseFooter(answer: string): Array<{ word: string; gloss: string }> {
  const line = answer
    .split('\n')
    .reverse()
    .find(l => FOOTER.test(l))
  if (line === undefined) return []
  const body = (line.match(FOOTER) ?? [])[1] ?? ''
  return body
    .split(/\s+·\s+|\s*;\s*|\s*\|\s*/u)
    .map(item => {
      const at = item.search(SEPARATOR)
      if (at <= 0) return { word: clean(item).toLowerCase(), gloss: '' }
      const sep = item.match(SEPARATOR)?.[0] ?? ''
      return {
        word: clean(item.slice(0, at)).toLowerCase(),
        gloss: clean(item.slice(at + sep.length)),
      }
    })
    .filter(w => w.word.length > 0)
}

export type Seen = { added: string[]; faded: string[]; relearned: string[] }

export function recordSeen(
  vocab: Vocab,
  glossed: Array<{ word: string; gloss: string }>,
  plain: readonly string[],
  day: string,
): Seen {
  const seen: Seen = { added: [], faded: [], relearned: [] }
  const items = new Map(glossed.map(g => [g.word, g.gloss]))
  for (const word of plain) if (!items.has(word)) items.set(word, '')
  for (const [word, gloss] of items) {
    const entry = vocab[word]
    if (entry === undefined) {
      vocab[word] = { gloss, seen: 1, used: 0, daily: { [day]: 1 }, firstSeen: day, lastSeen: day }
      seen.added.push(word)
      continue
    }
    const wasKnown = isKnown(entry)
    if (wasKnown && gloss.length > 0) {
      entry.used = 0
      entry.lapseSeen = entry.seen
      entry.lapseDay = day
      seen.relearned.push(word)
    }
    entry.seen += 1
    entry.lastSeen = day
    if (gloss.length > 0) entry.gloss = gloss
    entry.daily[day] = (entry.daily[day] ?? 0) + 1
    entry.daily = Object.fromEntries(Object.entries(entry.daily).sort().slice(-DAYS_KEPT))
    if (!wasKnown && isKnown(entry)) seen.faded.push(word)
  }
  return seen
}

export function recordUsed(vocab: Vocab, text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ')} `
  const used: string[] = []
  for (const [word, entry] of Object.entries(vocab)) {
    if (word.length < MIN_USED_LENGTH || ENGLISH_LOOKALIKES.has(word)) continue
    if (!lower.includes(` ${word} `)) continue
    entry.used += 1
    used.push(word)
  }
  return used
}

function byOldest(a: [string, Entry], b: [string, Entry]): number {
  return a[1].lastSeen.localeCompare(b[1].lastSeen) || a[1].seen - b[1].seen
}

function byCore(a: [string, Entry], b: [string, Entry]): number {
  return (RANK.get(a[0]) ?? Infinity) - (RANK.get(b[0]) ?? Infinity) || b[1].seen - a[1].seen
}

export function nextCore(vocab: Vocab, count: number) {
  return CORE.filter(item => vocab[item.pt] === undefined).slice(0, count)
}

export function turnNote(vocab: Vocab, settings: Settings, usedNow: readonly string[]): string {
  const entries = Object.entries(vocab)
  const learning = entries.filter(([, e]) => !isKnown(e)).sort(byOldest)
  const known = entries.filter(([, e]) => isKnown(e)).sort((a, b) => b[1].lastSeen.localeCompare(a[1].lastSeen))
  const review = learning.slice(0, Math.max(1, settings.perReply - 1))
  const fresh = Math.max(1, settings.perReply - review.length)
  const offered = nextCore(vocab, CORE_OFFERED)
  const lines = [
    `[pt-weave] Up to ${settings.perReply} glossed Portuguese items in this reply. ${entries.length} woven so far, ${known.length} past their gloss.`,
  ]
  if (review.length > 0) {
    lines.push(`Reuse where they fit (still learning): ${review.map(([w, e]) => `${w} (${e.gloss})`).join(', ')}.`)
  }
  if (offered.length > 0) {
    lines.push(
      `Introduce at most ${fresh} new, taken from the core list in this order, skipping one only when it cannot fit: ${offered.map(i => `${i.pt} (${i.en})`).join(', ')}.`,
    )
  } else {
    lines.push(`Introduce at most ${fresh} new glue word${fresh === 1 ? '' : 's'} or tense form${fresh === 1 ? '' : 's'} of your choice.`)
  }
  if (known.length > 0) {
    lines.push(
      `Past their gloss: use each wherever it fits, beyond the limit, in place of the English; italic, but leave them out of the footer: ${known.slice(0, 80).map(([w]) => w).join(', ')}.`,
    )
  }
  if (known.length >= 25) {
    lines.push('The user can read short phrases (2–5 words) built from known items; write one now and then.')
  }
  if (usedNow.length > 0) {
    lines.push(`The user just wrote these themselves, so they no longer need a gloss: ${usedNow.join(', ')}.`)
  }
  return lines.join('\n')
}

function pad(text: string, width: number): string {
  return text.length >= width ? `${text.slice(0, width - 1)}… ` : text.padEnd(width)
}

function table(rows: Array<[string, Entry]>, day: string): string[] {
  if (rows.length === 0) return ['  (none)']
  return [
    `  ${pad('item', 16)}${pad('meaning', 26)}${pad('shown', 7)}${pad('today', 7)}${pad('days', 6)}${pad('used', 6)}last`,
    ...rows.map(
      ([w, e]) =>
        `  ${pad(w, 16)}${pad(e.gloss, 26)}${pad(String(e.seen), 7)}${pad(String(e.daily[day] ?? 0), 7)}${pad(String(Object.keys(e.daily).length), 6)}${pad(String(e.used), 6)}${e.lastSeen}`,
    ),
  ]
}

export function summary(vocab: Vocab, settings: Settings, day: string): string {
  const entries = Object.entries(vocab)
  const known = entries.filter(([, e]) => isKnown(e)).sort(byCore)
  const learning = entries.filter(([, e]) => !isKnown(e)).sort(byCore)
  const shown = entries.reduce((n, [, e]) => n + e.seen, 0)
  const today = entries.reduce((n, [, e]) => n + (e.daily[day] ?? 0), 0)
  const coreIn = CORE.filter(item => vocab[item.pt] !== undefined)
  const coreKnown = coreIn.filter(item => isKnown(vocab[item.pt] as Entry))
  return [
    `pt-weave is ${settings.isOn ? 'on' : 'off'}, ${settings.perReply} per reply. ${plural(entries.length, 'item')}, ${known.length} known. Shown ${plural(shown, 'time')}, ${today} today.`,
    `Core list: ${coreIn.length}/${CORE.length} introduced, ${coreKnown.length} past their gloss. Next: ${nextCore(vocab, 8).map(i => i.pt).join(', ') || 'done'}.`,
    '',
    `A aprender (${learning.length}):`,
    ...table(learning, day),
    '',
    `Já sabes, no gloss (${known.length}):`,
    ...table(known, day),
  ].join('\n')
}

export function coreListing(vocab: Vocab): string {
  return CORE.map((item, i) => {
    const entry = vocab[item.pt]
    const mark = entry === undefined ? ' ' : isKnown(entry) ? '✓' : '·'
    return `${mark} ${String(i + 1).padStart(3)}  ${pad(item.pt, 16)}${item.en}`
  }).join('\n')
}

export const SECTION = `# European Portuguese, woven in (pt-weave)

The user is learning European Portuguese (PT-PT, the Lisbon norm) by inference: items picked up from context, the way a child learns "nariz" while someone points at a nose. Content words that look like English or Russian (importante, problema, sistema, versão, teste) teach nothing; the hard part is the glue: ser/estar, ter, ir, fazer, poder, prepositions, connectors, adverbs like já/ainda/só, pronouns, and the simple past and future. Weave those.

In your final reply to the user each turn:

- Swap a few English glue items for Portuguese where the sentence makes the meaning obvious: "*Já está* — the tests pass", "it *foi* the cache, *não* the query", "*vou ver* the logs *depois*". Prefer short chunks (*ainda não*, *acho que*, *vou fazer*, *correu bem*) over isolated words: they carry the grammar.
- Use tense forms as they occur: simple past (foi, fiz, tive, disse, ficou, correu), ongoing past (era, estava, tinha), near future (vou + infinitive, vai ser), and estar vs ser where the difference shows.
- Write each Portuguese item in italics, correct for PT-PT. Do not translate it inline. Never spend a slot on a transparent cognate; use those freely without listing them.
- Use European forms, never Brazilian: "estou a fazer" (not "fazendo"), tu-forms, se calhar, ecrã, ficheiro, utilizador, equipa, telemóvel.
- End the reply with one line glossing the Portuguese items that still need it, exactly as written (the inflected form or the chunk): \`🇵🇹 já está — done · vou ver — I'll check\`. Nothing else goes on that line. Write no such line when none needs a gloss.
- A note tagged [pt-weave] beside the user's prompt names the items to reuse, the next ones from the core list, and the ones past their gloss. Follow it. Items past their gloss are how Portuguese gradually takes over: prefer them to the English every time they fit, and leave them out of the footer.
- If the user stumbles on an item past its gloss (asks about it, or misreads it), gloss it in the footer again: that puts it back into learning.
- Keep Portuguese out of everything that is not conversation with the user: code, comments, commands, file contents, commit messages, PR text, drafts for Slack, Asana or email, and prompts for subagents. If you are a subagent, ignore this section.
- Never let it cost clarity: leave it out of error reports, security warnings, confirmations of destructive actions and any sentence the user must act on precisely.
- If the user asks what an item means, or writes Portuguese, answer in kind, briefly.`
