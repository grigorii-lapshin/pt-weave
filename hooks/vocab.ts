import { CORE } from './core'

export type Entry = {
  gloss: string
  seen: number
  used: number
  daily: Record<string, number>
  firstSeen: string
  lastSeen: string
  step: number
  due?: string
  masteredOn?: string
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
const LEGACY_FADE_SHOWS = 5
const LEGACY_FADE_DAYS = 2
// Days until the next review on entering each step: offsets 1, 3, 7, 15, 31, 63 from introduction.
const INTERVALS = [1, 2, 4, 8, 16, 32]
const LAST_STEP = INTERVALS.length
const GLOSS_STEP = 3
const REVIEW_SHOWS = 2
const ITALIC = /(?<![*_\p{L}])[*_]([^*_\n]+?)[*_](?![*_\p{L}])/gu
const RANK = new Map(CORE.map((item, i) => [item.pt, i]))

const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10)

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
    const seen = Number(value.seen ?? 0)
    const used = Number(value.used ?? 0)
    const entry: Entry = {
      gloss: String(value.gloss ?? ''),
      seen,
      used,
      daily,
      firstSeen: String(value.firstSeen ?? lastSeen),
      lastSeen,
      step: 1,
      due: lastSeen,
    }
    if (typeof value.step === 'number') {
      entry.step = value.step
      if (typeof value.due === 'string') entry.due = value.due
      else delete entry.due
      if (typeof value.masteredOn === 'string') entry.masteredOn = value.masteredOn
    } else {
      // 0.1 store: items past their gloss start at the gloss step; everything is due at once.
      const since = typeof value.lapseDay === 'string' ? value.lapseDay : ''
      const days = Object.keys(daily).filter(day => day >= since).length
      const shows = seen - (typeof value.lapseSeen === 'number' ? value.lapseSeen : 0)
      if (used >= 1 || (shows >= LEGACY_FADE_SHOWS && days >= LEGACY_FADE_DAYS)) entry.step = GLOSS_STEP
    }
    vocab[word] = entry
  }
  return vocab
}

/** Past its gloss: the footer no longer translates it. */
export function isKnown(entry: Entry): boolean {
  return entry.used >= 1 || entry.step >= GLOSS_STEP
}

export function isMastered(entry: Entry): boolean {
  return entry.step > LAST_STEP
}

export function isDue(entry: Entry, day: string): boolean {
  return entry.due !== undefined && entry.due <= day
}

function advance(entry: Entry, day: string) {
  if (isMastered(entry)) return
  entry.step += 1
  if (isMastered(entry)) {
    entry.masteredOn = day
    delete entry.due
  } else {
    entry.due = addDays(day, INTERVALS[entry.step - 1] as number)
  }
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
      vocab[word] = {
        gloss,
        seen: 1,
        used: 0,
        daily: { [day]: 1 },
        firstSeen: day,
        lastSeen: day,
        step: 1,
        due: addDays(day, INTERVALS[0] as number),
      }
      seen.added.push(word)
      continue
    }
    const wasKnown = isKnown(entry)
    if (wasKnown && gloss.length > 0) {
      entry.used = 0
      entry.step = 1
      entry.due = addDays(day, INTERVALS[0] as number)
      delete entry.masteredOn
      seen.relearned.push(word)
    }
    entry.seen += 1
    entry.lastSeen = day
    if (gloss.length > 0) entry.gloss = gloss
    entry.daily[day] = (entry.daily[day] ?? 0) + 1
    entry.daily = Object.fromEntries(Object.entries(entry.daily).sort().slice(-DAYS_KEPT))
    if (isDue(entry, day) && (entry.daily[day] ?? 0) >= REVIEW_SHOWS) advance(entry, day)
    if (!wasKnown && isKnown(entry)) seen.faded.push(word)
  }
  return seen
}

export function recordUsed(vocab: Vocab, text: string, day: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ')} `
  const used: string[] = []
  for (const [word, entry] of Object.entries(vocab)) {
    if (word.length < MIN_USED_LENGTH || ENGLISH_LOOKALIKES.has(word)) continue
    if (!lower.includes(` ${word} `)) continue
    entry.used += 1
    advance(entry, day)
    used.push(word)
  }
  return used
}

function byCore(a: [string, Entry], b: [string, Entry]): number {
  return (RANK.get(a[0]) ?? Infinity) - (RANK.get(b[0]) ?? Infinity) || b[1].seen - a[1].seen
}

export function nextCore(vocab: Vocab, count: number) {
  return CORE.filter(item => vocab[item.pt] === undefined).slice(0, count)
}

export function turnNote(vocab: Vocab, settings: Settings, usedNow: readonly string[], day: string): string {
  const entries = Object.entries(vocab)
  const known = entries.filter(([, e]) => isKnown(e)).sort((a, b) => b[1].lastSeen.localeCompare(a[1].lastSeen))
  const due = entries
    .filter(([, e]) => isDue(e, day))
    .sort((a, b) => (a[1].due as string).localeCompare(b[1].due as string) || byCore(a, b))
  const review = due.slice(0, settings.perReply)
  const glossed = review.filter(([, e]) => !isKnown(e))
  const quiet = review.filter(([, e]) => isKnown(e))
  const fresh = settings.perReply - review.length
  const offered = nextCore(vocab, CORE_OFFERED)
  const lines = [
    `[pt-weave] Up to ${settings.perReply} Portuguese items to teach in this reply, reviews first. ${entries.length} woven so far, ${known.length} past their gloss, ${due.length} due for review.`,
  ]
  if (glossed.length > 0) {
    lines.push(`Reuse where they fit (still learning): ${glossed.map(([w, e]) => `${w} (${e.gloss})`).join(', ')}.`)
  }
  if (quiet.length > 0) {
    lines.push(`Due for review, use each about twice, no gloss: ${quiet.map(([w]) => w).join(', ')}.`)
  }
  if (fresh === 0) {
    lines.push('No new items this reply: reviews are due.')
  } else if (offered.length > 0) {
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
    `  ${pad('item', 16)}${pad('meaning', 26)}${pad('shown', 7)}${pad('today', 7)}${pad('days', 6)}${pad('used', 6)}${pad('last', 12)}due`,
    ...rows.map(
      ([w, e]) =>
        `  ${pad(w, 16)}${pad(e.gloss, 26)}${pad(String(e.seen), 7)}${pad(String(e.daily[day] ?? 0), 7)}${pad(String(Object.keys(e.daily).length), 6)}${pad(String(e.used), 6)}${pad(e.lastSeen, 12)}${e.due ?? 'mastered'}`,
    ),
  ]
}

export function summary(vocab: Vocab, settings: Settings, day: string): string {
  const entries = Object.entries(vocab)
  const known = entries.filter(([, e]) => isKnown(e)).sort(byCore)
  const learning = entries.filter(([, e]) => !isKnown(e)).sort(byCore)
  const shown = entries.reduce((n, [, e]) => n + e.seen, 0)
  const today = entries.reduce((n, [, e]) => n + (e.daily[day] ?? 0), 0)
  const mastered = entries.filter(([, e]) => isMastered(e)).length
  const due = entries.filter(([, e]) => isDue(e, day)).length
  const coreIn = CORE.filter(item => vocab[item.pt] !== undefined)
  const coreKnown = coreIn.filter(item => isKnown(vocab[item.pt] as Entry))
  return [
    `pt-weave is ${settings.isOn ? 'on' : 'off'}, ${settings.perReply} per reply. ${plural(entries.length, 'item')}, ${known.length} known. Shown ${plural(shown, 'time')}, ${today} today. ${mastered} mastered, ${due} due for review.`,
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
- A note tagged [pt-weave] beside the user's prompt names the items to reuse, the reviews that are due, the next ones from the core list, and the ones past their gloss. Follow it: due reviews come before new items. Items past their gloss are how Portuguese gradually takes over: prefer them to the English every time they fit, and leave them out of the footer.
- If the user stumbles on an item past its gloss (asks about it, or misreads it), gloss it in the footer again: that puts it back into learning.
- Keep Portuguese out of everything that is not conversation with the user: code, comments, commands, file contents, commit messages, PR text, drafts for Slack, Asana or email, and prompts for subagents. If you are a subagent, ignore this section.
- Never let it cost clarity: leave it out of error reports, security warnings, confirmations of destructive actions and any sentence the user must act on precisely.
- If the user asks what an item means, or writes Portuguese, answer in kind, briefly.`
