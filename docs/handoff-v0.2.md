# Handoff: pt-weave 0.2

Goal of 0.2: a complete plugin that works for the general public without setup. Power users fork it (see README, "Make it your own"). Three work areas: new commands, vocabulary expansion, dynamic cognate filter.

## Constraints

- **Keep the name `pt-weave` and the marketplace name.** The store file (`~/.claude/plugins/store/pt-weave_pt-weave-<hash>.json`) is keyed by them; renaming loses every user's progress. Other languages come later as sibling plugins (`es-weave`, …).
- **No network, no shell, no file access.** The README promises "Nothing leaves your machine". Bundle all data in the plugin.
- **Store schema stays backward compatible.** `normalize()` in `hooks/vocab.ts` must read 0.1 stores. Add fields as optional.
- **No user homework.** The user says what they want in general words; Claude does the work. No commands that make the user type lists of items.
- **Few knobs.** Defaults must be good. Don't add settings nobody asked for.
- Bump `version` in `.claude-plugin/plugin.json` to 0.2.0. Keep `tests/pt-weave.test.ts` green and extend it.

## 1. New commands

### `/pt focus <area>`

Free text: `/pt focus restaurants and ordering food`, `/pt focus talking to my landlord`, `/pt focus past tense`.

- Stored in settings (`focus?: string`). `/pt focus` with no argument clears it.
- `turnNote()` adds a line like "Prefer new items from: <area>". Claude picks the words itself; the mod generates no list.
- New items Claude glosses in the footer are tracked by the existing `parseFooter`/`recordSeen` flow and graduate like core items.

### `/pt native <languages>`

Languages the user already speaks besides the chat language, e.g. `/pt native ru`. Feeds the cognate filter (section 3). Stored in settings.

### Stats in `/pt`

The point of 0.2 for the author: measure whether this works. Show:

- items known, items learning
- new items known per week
- median days from first seen to known

Data gaps to fix first:

- No graduation date is stored. Add `knownOn?: string` to `Entry`, set when `isKnown` first turns true (and cleared on lapse).
- `daily` is trimmed to 30 days (`DAYS_KEPT`), so history must come from `firstSeen` and `knownOn`, not `daily`.

### Placement on first run

New users who already know basics should not wait through 170 core items.

- On the first session with an empty vocabulary, show about 20 core items and let the user say which they know; mark those known at once.
- Mechanism is open. Options: (a) the turn note asks Claude to ask the user once, and the user's reply is caught by `recordUsed` (weak: it skips words under 3 letters like *é*); (b) Claude reports known items on a marked footer line the mod parses; (c) a `/pt know <items>` command (makes the user type, see Constraints). Prefer (b) if it works reliably.

### Small fix

The `/pt` command description in `hooks/register.ts` reads "Portuguese vocabulary and show stats"; rewrite it.

## 2. Vocabulary expansion

Three tiers, one pipeline:

1. **Glue core** (existing, ~170 items in `hooks/core.ts`). Function words, connectors, tense forms. This is the product's pitch: learners pick up nouns on their own and get stuck on the glue.
2. **Frequency list** (~1000 items, new). Unlocks when most of tier 1 is known (pick a threshold, e.g. 80%). Today, when tier 1 runs out, `turnNote()` lets Claude choose freely; tier 2 replaces that.
3. **Focus** (`/pt focus`). On top of tiers 1–2, chosen by Claude.

Tier 2 source:

- Build it from an open frequency corpus (subtitle or Wikipedia derived lists) for European Portuguese. Check and record the license in the repo.
- Do **not** copy a published book's list (selection, order or glosses): copyright.
- Keep cognates in the list; the dynamic filter (section 3) skips them at runtime, since what counts as a cognate depends on the user.
- Ship it as a data file next to `core.ts`; generation script optional, output committed.

## 3. Dynamic cognate filter

Today two places assume an English or Russian speaker:

- `SECTION` in `hooks/vocab.ts`: "Content words that look like English or Russian … teach nothing".
- `ENGLISH_LOOKALIKES` in `hooks/vocab.ts`: words like *era*, *come*, *com* that `recordUsed` must not count as the user writing Portuguese, because they are also English.

Change:

- `SECTION` says: skip items transparent to the user's languages, which are the language the user writes in plus those set with `/pt native`.
- `turnNote()` names those languages each turn.
- When Claude skips an offered item as transparent, it should not be offered again (mark it known, or a `skipped` flag). Decide which.
- `ENGLISH_LOOKALIKES` becomes per-language or is extended for the chat language. At minimum it must not false-positive for the languages in use.

Chat language is not the native language (the author writes English and is a native Russian speaker), hence `/pt native`.

## Out of scope for 0.2

- Lite version as a standalone skill for chat and Cowork: [#1](https://github.com/grigorii-lapshin/pt-weave/issues/1).
- Sibling plugins for other languages, and a monorepo with a shared engine.
- README GIF and store submission (separate tasks).
- A launch post after about a month of real stats: "You know the nouns. pt-weave teaches the glue."

## Ideas not yet discussed

- **Auto-density.** The source video's rule is "keep it comprehensible". If the user often asks what an item means, lower `perReply`; if they never do, raise it.
