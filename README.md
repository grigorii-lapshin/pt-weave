# pt-weave

Learn European Portuguese (PT-PT) from the replies Claude Code already writes you. No flashcards, no separate app: each reply carries a few Portuguese words whose meaning the sentence gives away, glossed on one footer line.

> *Já está* — the tests pass, *mas* one is flaky. *Vou ver* the logs *depois*.
>
> 🇵🇹 já está — done · mas — but · vou ver — I'll check · depois — later

> "We acquire language in only one way, when we understand what people say."
> — Stephen Krashen ([video, 2:53](https://www.youtube.com/watch?v=doBxlUxVZxY&t=173s))

pt-weave is built on that idea, called comprehensible input. A reply about your own code is a message you already understand, so the few Portuguese words in it are easy to guess. Words come back across replies until you know them. Then the gloss drops and the Portuguese stays. Over weeks, more of each reply is Portuguese.

Inspired by Olly Richards' video [Everyone is Bad at Languages Until They Learn THIS](https://www.youtube.com/watch?v=doBxlUxVZxY).

```bash
claude plugin install pt-weave --marketplace grigorii-lapshin/pt-weave
```

<!-- TODO: add a GIF of a session here -->

## How it works

- **Glue words, not cognates.** Words like *sistema* or *importante* teach nothing to an English or Russian speaker. pt-weave picks function words instead: *ser*/*estar*, *ter*, *ir*, prepositions, connectors, *já*/*ainda*/*só*, pronouns, and past and future forms.
- **A fixed teaching order.** A core list of about 170 items sets the order in which new words appear.
- **Words graduate.** An item drops out of the footer after you see it 5 times across 2 days, or as soon as you type it yourself. After that, Claude uses it in place of the English without a gloss.
- **Words come back.** If you ask about a graduated word, it returns to the footer until you learn it again.
- **Progress persists.** Vocabulary is kept across sessions. The status line shows `🇵🇹 <items> · <known> sem tradução`.
- **Work output stays English.** Code, commit messages, PR text and drafts for other people stay in English. Error reports and destructive-action confirmations stay in English too.

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
| `/pt` | Show your vocabulary and stats |
| `/pt core` | Show the core list in teaching order |
| `/pt on`, `/pt off` | Turn weaving on or off |
| `/pt more`, `/pt less` | Change the number of new items per reply (1–6, default 3) |
| `/pt forget <item>` | Remove an item from your vocabulary |

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

MIT
