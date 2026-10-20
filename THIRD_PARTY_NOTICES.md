# Third-party notices

Personal Press source is licensed under Apache License 2.0. Dependencies and bundled fonts retain their own licenses.

## Runtime components

| Component | License | Upstream |
| --- | --- | --- |
| Electron and its JavaScript APIs | MIT; bundled Chromium/Node components retain additional notices | https://www.electronjs.org/ |
| fast-xml-parser | MIT | https://github.com/NaturalIntelligence/fast-xml-parser |
| pdf-lib | MIT | https://github.com/Hopding/pdf-lib |

The installer includes the Electron runtime's `LICENSE` / Chromium notices and installed production dependencies with their license files. Exact dependency versions and transitive packages are recorded in `package-lock.json`. Do not remove notices when repackaging binaries.

## Bundled fonts

| Font | Distribution package | License |
| --- | --- | --- |
| Noto Serif SC | @fontsource-variable/noto-serif-sc | SIL Open Font License 1.1 |
| Noto Serif JP | @fontsource-variable/noto-serif-jp | SIL Open Font License 1.1 |
| Libre Caslon Display | @fontsource/libre-caslon-display | SIL Open Font License 1.1 |

The source installation copies the fonts and their complete license texts from the pinned npm packages into `src/assets/fonts/`. Those files are bundled with desktop builds; no remote font request is required while reading. The package lock and `scripts/prepare-fonts.mjs` preserve the reproducible font preparation path. Unmodified font binaries remain under their original licenses; CSS family aliases do not assert ownership of the font design.

## Build tools and content

Electron Builder and other development dependencies are used under their respective package licenses. The original application icon, offline demonstration text, clues, riddles and jokes are distributed with this project's Apache-2.0 source. Demonstration text is not a news source. There are no commercial cartoons or newspaper crossword syndications in this release.

User-selected feeds, source articles and generated editions are not relicensed by the application's software license. Users retain responsibility for their source subscriptions and the permissions that govern redistribution of retrieved material.
