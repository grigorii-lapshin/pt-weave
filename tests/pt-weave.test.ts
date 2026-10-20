import { expect, mock, test } from 'claude-code/testing'

const DAY = Date.UTC(2026, 9, 15)

const pt = (args: string) => ({
  command: 'pt',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 100 },
})

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
}

const answer = (text: string) => ({
  answer: text,
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer' as const,
})

test('a footer logs its words and /pt lists them', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: DAY })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('command.run', () => ({ text: 'engine' }))

  await $.turn.complete(answer('*Já está*, the tests pass, *mas* one is flaky.\n\n🇵🇹 já está — done · mas — but'))
  const listed = await $.command.run(pt(''))

  expect(listed.text).toMatch(/já está\s+done\s+1\s+1\s+1\s+0\s+2026-10-15/)
  expect(listed.text).toContain('2 items, 0 known. Shown 2 times, 2 today.')
  expect(listed.text).toContain('Core list: 2/')
})

test('a reply with no footer logs nothing', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: DAY })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.complete(answer('Done. All tests pass.'))
  const listed = await $.command.run(pt(''))

  expect(listed.text).toContain('0 items, 0 known. Shown 0 times')
})

test('a word the user writes loses its gloss', async ($, on) => {
  mock.store(on, {
    vocab: { 'ainda não': { gloss: 'not yet', seen: 1, used: 0, daily: { '2026-10-14': 1 }, firstSeen: '2026-10-14', lastSeen: '2026-10-14' } },
  })
  mock.clock(on, { now: DAY })
  let context: readonly string[] = []
  on('prompt.submit', ($, e) => {
    context = e.context ?? []
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'ainda  não, the build is red', wait: false, origin: { kind: 'composer' } })
  const listed = await $.command.run(pt(''))

  expect(context.join('\n')).toContain('no longer need a gloss: ainda não')
  expect(context.join('\n')).toContain('core list in this order, skipping one only when it cannot fit: é (')
  expect(listed.text).toContain('1 item, 1 known')
})

test('/pt off stops the system prompt section', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: DAY })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' as const }] }))

  const before = await $.prompt.compose(COMPOSE)
  await $.command.run(pt('off'))
  const after = await $.prompt.compose(COMPOSE)

  expect(before.sections.some(s => s.id === 'pt-weave:rules')).toBe(true)
  expect(after.sections.some(s => s.id === 'pt-weave:rules')).toBe(false)
})

const learning = (seen: number, days: string[]) => ({
  gloss: 'not yet',
  seen,
  used: 0,
  daily: Object.fromEntries(days.map(d => [d, 1])),
  firstSeen: days[0] ?? '2026-10-10',
  lastSeen: days[days.length - 1] ?? '2026-10-10',
})

const scheduled = (step: number, due: string | undefined, gloss = 'not yet') => ({
  ...learning(1, ['2026-10-10']),
  gloss,
  step,
  ...(due === undefined ? {} : { due }),
})

const noted = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  const box = { context: '' }
  on('prompt.submit', ($, e) => {
    box.context = (e.context ?? []).join('\n')
    return { text: e.text }
  })
  return box
}

test('a due item passes its review after two shows and drops its gloss at step 3', async ($, on) => {
  mock.store(on, { vocab: { 'ainda não': scheduled(2, '2026-10-15') } })
  mock.clock(on, { now: DAY })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  const note = noted(on)

  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
  expect(note.context).toContain('Reuse where they fit (still learning): ainda não (not yet)')

  await $.turn.complete(answer('*Ainda não* — the deploy is queued.\n\n🇵🇹 ainda não — not yet'))
  await $.turn.complete(answer('*Ainda não*, still queued.'))
  await $.prompt.submit({ text: 'and now?', wait: false, origin: { kind: 'composer' } })
  const listed = await $.command.run(pt(''))

  expect(note.context).toContain('leave them out of the footer: ainda não')
  expect(note.context).not.toContain('Reuse where they fit')
  expect(listed.text).toMatch(/Já sabes, no gloss \(1\)[\s\S]*ainda não\s+not yet\s+3\s+2\s+2\s+0\s+2026-10-15\s+2026-10-19/)
})

test('new items stop while reviews fill every slot', async ($, on) => {
  mock.store(on, {
    vocab: { 'já': scheduled(1, '2026-10-14'), 'mas': scheduled(4, '2026-10-15'), 'também': scheduled(1, '2026-10-15') },
  })
  mock.clock(on, { now: DAY })
  const note = noted(on)

  await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })

  expect(note.context).toContain('No new items this reply')
  expect(note.context).not.toContain('Introduce')
  expect(note.context).toContain('Due for review, use each about twice, no gloss: mas.')
})

test('an item is mastered after its last review and leaves the schedule', async ($, on) => {
  mock.store(on, { vocab: { 'mas': scheduled(6, '2026-10-15', 'but') } })
  mock.clock(on, { now: DAY })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.complete(answer('*Mas* one is flaky, *mas* only on CI.'))
  await $.turn.complete(answer('*Mas* it passed.'))
  const listed = await $.command.run(pt(''))

  expect(listed.text).toContain('1 mastered, 0 due for review.')
  expect(listed.text).toMatch(/mas\s+but\s+.*mastered/)
})

test('typing an item moves it a step along', async ($, on) => {
  mock.store(on, { vocab: { 'também': scheduled(4, '2026-10-15', 'also') } })
  mock.clock(on, { now: DAY })
  noted(on)

  await $.prompt.submit({ text: 'também the API', wait: false, origin: { kind: 'composer' } })
  const listed = await $.command.run(pt(''))

  expect(listed.text).toMatch(/também\s+also\s+.*2026-10-31/)
})

test('glossing a faded item again puts it back into learning', async ($, on) => {
  mock.store(on, { vocab: { 'ainda não': learning(6, ['2026-10-13', '2026-10-14']) } })
  mock.clock(on, { now: DAY })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.turn.complete(answer('*Ainda não*.\n\n🇵🇹 ainda não — not yet'))
  const listed = await $.command.run(pt(''))

  expect(listed.text).toContain('A aprender (1)')
  expect(listed.text).toContain('Já sabes, no gloss (0)')
})

test('the rules ride the prompt until the system prompt hook is seen running', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: DAY })
  on('prompt.compose', () => ({ sections: [] }))
  let context: readonly string[] = []
  on('prompt.submit', ($, e) => {
    context = e.context ?? []
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'first', wait: false, origin: { kind: 'composer' } })
  const before = context.join('\n')
  await $.prompt.compose(COMPOSE)
  await $.prompt.submit({ text: 'second', wait: false, origin: { kind: 'composer' } })

  expect(before).toContain('# European Portuguese, woven in')
  expect(context.join('\n')).not.toContain('# European Portuguese, woven in')
  expect(context.join('\n')).toContain('[pt-weave]')
})

test('entries stored in the first format still load', async ($, on) => {
  mock.store(on, {
    vocab: { 'não': { gloss: 'not', seen: 1, used: 1, days: ['2026-10-15'], firstSeen: '2026-10-15', lastSeen: '2026-10-15' } },
  })
  mock.clock(on, { now: DAY })
  let context: readonly string[] = []
  on('prompt.submit', ($, e) => {
    context = e.context ?? []
    return { text: e.text }
  })

  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  const listed = await $.command.run(pt(''))

  expect(context.join('\n')).toContain('leave them out of the footer: não')
  expect(listed.text).toMatch(/não\s+not\s+1\s+1\s+1\s+1\s+2026-10-15/)
  expect(context.join('\n')).toContain('Due for review, use each about twice, no gloss: não.')
})
