# frequency.ts licence

`hooks/frequency.ts` is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), not MIT. The rest of the plugin stays MIT.

## Source

- Word list: FrequencyWords by Hermit Dave, file `content/2018/pt/pt_50k.txt`: https://github.com/hermitdave/FrequencyWords
- Licence of that list: CC BY-SA 4.0 for content, MIT for code (stated in the repository README).
- Underlying corpus: OpenSubtitles2018 from OPUS (http://opus.nlpl.eu/OpenSubtitles2018.php). Its `pt` subset is European Portuguese; Brazilian Portuguese is the separate `pt_br` list, which was not used.

## Changes made

- Took the most frequent words in their original order and kept the first 1000 left after filtering.
- Removed items already in `core.ts`, proper nouns, numbers, abbreviations, bare interjections, vulgar words and junk tokens.
- Modernised pre-1990-reform spellings (óptimo → ótimo, detective → detetive, direcção → direção).
- Dropped the occurrence counts and added English glosses, which are original to this project.

## Why this is fine in an MIT plugin

CC BY-SA 4.0 allows copying, redistribution and modification, commercial use included, as long as the source is credited, changes are indicated, and the adapted material is shared under the same licence. This file does all three. Share-alike covers the adapted list only: the plugin's code sits beside it and is not an adaptation of it, so it keeps its MIT licence.
