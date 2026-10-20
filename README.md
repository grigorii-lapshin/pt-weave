# pt-weave

Learn European Portuguese (PT-PT) from Claude Code's replies. Each one carries a few Portuguese words the context gives away, glossed in a footer:

> *Já está* — the tests pass, *mas* one is flaky. *Vou ver* the logs *depois*.
>
> 🇵🇹 já está — done · mas — but · vou ver — I'll check · depois — later

> "We acquire language in only one way, when we understand what people say."
> — Stephen Krashen ([video, 2:53](https://www.youtube.com/watch?v=doBxlUxVZxY&t=173s))

You already understand a reply about your own code, so its Portuguese words are easy to guess. Once you know a word, its gloss drops and the Portuguese stays.

Inspired by Olly Richards' video [Everyone is Bad at Languages Until They Learn THIS](https://www.youtube.com/watch?v=doBxlUxVZxY).

```bash
claude plugin install pt-weave --marketplace grigorii-lapshin/pt-weave
```

<!-- TODO: add a GIF of a session here -->

## How it works

- **Glue words, not cognates.** Words like *sistema* or *importante* teach nothing to an English speaker. Tell pt-weave which other languages you speak (`/pt native ru`) and it skips their look-alikes too. pt-weave picks function words instead: *ser*/*estar*, *ter*, *ir*, prepositions, connectors, *já*/*ainda*/*só*, pronouns, and past and future forms.
- **A fixed teaching order.** A core list of about 170 glue items sets the order in which new words appear. Once you know 80% of it, a list of 1000 frequent words follows. `/pt focus <area>` steers new words toward a topic.
- **Spaced repetition.** Each word comes back 1, 3, 7, 15, 31 and 63 days after you first see it. Reviews that are due come before new words, so new words slow down when you have a backlog. A word drops out of the footer after its second review, or as soon as you type it yourself, and is mastered after the last one.
- **Words come back.** If you ask about a word past its gloss, it returns to the footer and starts its schedule again.
- **Placement.** On the first run Claude asks which basic words you already know, so you skip them.
- **Progress persists.** Vocabulary is kept across sessions. The status line shows `🇵🇹 <items> · <known> sem tradução`.
- **Work output stays English.** Code, commit messages, PR text and drafts for other people stay in English. Error reports and destructive-action confirmations stay in English too.
- **Nothing leaves your machine.** The mod makes no network calls and runs no commands. It reads your prompts and Claude's footers to track words, and keeps only your vocabulary and settings in Claude Code's mod storage.

## Install

Mods need Claude Code v2.1.287 or later.

At the prompt of a terminal session:

```
/plugin install pt-weave --marketplace grigorii-lapshin/pt-weave
```

From a shell:

```bash
claude plugin install pt-weave --marketplace grigorii-lapshin/pt-weave
```

Answer `y` to add the marketplace, then choose a scope.

In the desktop app: click **+** next to the prompt box, then **Plugins**. Add the marketplace `grigorii-lapshin/pt-weave`, then add the plugin.

## Commands

| Command | Effect |
| --- | --- |
| `/pt` | Show your vocabulary and stats: learning, mastered, due today, median days to mastery |
| `/pt core` | Show the core list in teaching order |
| `/pt on`, `/pt off` | Turn weaving on or off |
| `/pt more`, `/pt less` | Change how many items each reply teaches, which sets how fast new words come (1–6, default 3) |
| `/pt focus <area>` | Prefer new words for an area, e.g. `/pt focus ordering food`; `/pt focus` clears it |
| `/pt native <languages>` | Languages you speak besides the one you write in, e.g. `/pt native ru` |
| `/pt forget <item>` | Remove an item from your vocabulary |

## Make it your own

pt-weave is meant to work without setup. If you want to change how it teaches, fork it and ask Claude to edit your fork:

- `hooks/core.ts`: the core list and its teaching order
- `hooks/vocab.ts`: the rules Claude follows (`SECTION`), when a word counts as known (`isKnown`), and the per-turn note (`turnNote`)
- `hooks/register.ts`: the `/pt` commands

Install your fork with `claude plugin install pt-weave --marketplace <you>/pt-weave`. Don't edit the installed copy: updates replace it.

Your progress is stored apart from the code, in `~/.claude/plugins/store/`, so it survives updates. The file is keyed by plugin and marketplace, so switching to a fork may start you with an empty vocabulary.

## Development

```bash
claude --plugin-dir .
```

While the mod is loaded, the engine writes its types to `.claude-plugin/types/`. `tsconfig.json` extends them, so `tsc -p .` type-checks the mod after the first load. The folder is git-ignored.

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

## Licence

MIT, except `hooks/frequency.ts`, which is derived from [FrequencyWords](https://github.com/hermitdave/FrequencyWords) and licensed CC BY-SA 4.0 (see `hooks/frequency.LICENSE.md`).
