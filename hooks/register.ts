import type { EngineInterface, Register } from 'claude-code'

import {
  DEFAULT_SETTINGS,
  coreListing,
  SECTION,
  isKnown,
  markKnown,
  normalize,
  parseKnownLine,
  italicItems,
  parseFooter,
  recordSeen,
  recordUsed,
  summary,
  turnNote,
} from './vocab'
import type { Settings, Vocab } from './vocab'

const USER_ORIGINS = new Set(['composer', 'bridge'])
const COMPOSE_FRESH_MS = 60 * 60 * 1000

async function loadVocab($: EngineInterface): Promise<Vocab> {
  return normalize(await $.store.get('vocab'))
}

async function loadSettings($: EngineInterface): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await $.store.get('settings')) as Partial<Settings> | undefined) }
}

async function today($: EngineInterface): Promise<string> {
  return new Date(await $.clock.now()).toISOString().slice(0, 10)
}

function showStatus($: EngineInterface, vocab: Vocab, settings: Settings) {
  const entries = Object.values(vocab)
  if (!settings.isOn || entries.length === 0) {
    $.ui.status(undefined)
    return
  }
  $.ui.status(`🇵🇹 ${entries.length} · ${entries.filter(isKnown).length} sem tradução`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pt',
      description: 'Show your Portuguese progress, or tune it: core, on, off, more, less, focus, native, forget',
      argumentHint: '[core|on|off|more|less|focus <area>|native <languages>|forget <item>]',
      immediate: true,
    })
    showStatus($, await loadVocab($), await loadSettings($))
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (e.traits.includes('bare') || e.traits.includes('teammate')) return result
    if (!(await loadSettings($)).isOn) return result
    const now = await $.clock.now()
    if (now - Number((await $.store.get('composedAt')) ?? 0) > COMPOSE_FRESH_MS / 2) await $.store.set('composedAt', now)
    return { sections: [...result.sections, { id: 'pt-weave:rules', text: SECTION, scope: 'session' as const }] }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!USER_ORIGINS.has(e.origin.kind)) return next(e)
    const settings = await loadSettings($)
    if (!settings.isOn) return next(e)
    const vocab = await loadVocab($)
    const day = await today($)
    const used = recordUsed(vocab, e.text, day)
    if (used.length > 0) await $.store.set('vocab', vocab)
    const isComposing = (await $.clock.now()) - Number((await $.store.get('composedAt')) ?? 0) < COMPOSE_FRESH_MS
    const note = turnNote(vocab, settings, used, day)
    return next({ ...e, context: [...(e.context ?? []), isComposing ? note : `${SECTION}\n\n${note}`] })
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      const vocab = await loadVocab($)
      const glossed = parseFooter(e.answer)
      const plain = italicItems(e.answer, vocab)
      const placed = parseKnownLine(e.answer)
      if (glossed.length > 0 || plain.length > 0 || placed.length > 0) {
        const day = await today($)
        const seen = recordSeen(vocab, glossed, plain, day)
        const known = markKnown(vocab, placed, day)
        await $.store.set('vocab', vocab)
        showStatus($, vocab, await loadSettings($))
        const news = [
          known.length > 0 ? `Já sabes: ${known.join(', ')}` : '',
          seen.added.length > 0 ? `Novo: ${seen.added.join(', ')}` : '',
          seen.faded.length > 0 ? `Sem tradução: ${seen.faded.join(', ')}` : '',
          seen.relearned.length > 0 ? `De volta: ${seen.relearned.join(', ')}` : '',
        ].filter(Boolean)
        if (news.length > 0) $.ui.toast(news.join(' · '))
      }
    }
    return next(e)
  })

  on('command.run', { command: 'pt' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = rest.join(' ')
    const word = arg.toLowerCase()
    const settings = await loadSettings($)
    const vocab = await loadVocab($)

    switch (verb.toLowerCase()) {
      case 'on':
      case 'off':
        settings.isOn = verb.toLowerCase() === 'on'
        break
      case 'more':
      case 'less':
        settings.perReply = Math.min(6, Math.max(1, settings.perReply + (verb.toLowerCase() === 'more' ? 1 : -1)))
        break
      case 'focus':
      case 'native':
        if (arg.length > 0) settings[verb.toLowerCase() as 'focus' | 'native'] = arg
        else delete settings[verb.toLowerCase() as 'focus' | 'native']
        break
      case 'forget':
        if (vocab[word] === undefined) return { text: `"${word}" is not in the vocabulary.` }
        delete vocab[word]
        await $.store.set('vocab', vocab)
        break
      case 'core':
        return { text: `Core list, in teaching order (✓ known, · introduced):\n${coreListing(vocab)}` }
      case '':
      case 'list':
        break
      default:
        return { text: 'Usage: /pt [core|on|off|more|less|focus <area>|native <languages>|forget <item>]' }
    }

    await $.store.set('settings', settings)
    showStatus($, vocab, settings)
    return { text: summary(vocab, settings, await today($)) }
  })
}
