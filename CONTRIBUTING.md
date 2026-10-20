# Contributing

Personal Press is an early Apache-2.0 desktop project. Contributions are welcome in the free core, particularly reproducible fixes to evidence handling, local storage, multilingual reading, exports and printer behavior. Read the [architecture](docs/architecture.md) and [security policy](SECURITY.md) before changing a trust boundary.

## Local setup

Use Node.js 22 or newer and npm on the desktop operating system you want to develop for.

```sh
npm ci
npm start
```

The install step downloads Electron and prepares the local fonts. `npm run preview` is a reader-only browser preview; it does not exercise native credentials, generation, exports or printing.

```sh
npm test
npm run check
```

Tests use Node's built-in test runner and controlled fixtures. The check command inspects JavaScript syntax, the manifest/lockfile agreement and the local reader policy. Describe the checks you actually ran; do not present a configuration or a mocked API test as real provider or hardware validation.

Use `npm run pack` for an unpacked desktop build, or `npm run dist` on the target OS for its configured package targets. The alpha has no completed public signing/notarization process. Do not distribute an unsigned local build as a verified official installer.

## Scope changes so they can be reviewed

Open an issue or draft proposal for a new provider, source-discovery service, device connector or data migration before a large implementation. Explain the concrete user problem, resulting behavior, data sent/stored and how failures will be handled. A small reproducible bug fix can be submitted directly.

Keep the desktop contracts aligned across main, preload, core modules and the renderer. Use native `.mjs` modules for core/shared code and the existing `.cjs` entry points for Electron. A new setting must have a bounded whitelist entry; a new IPC action must have an explicit method and validate its payload.

Reviewable changes should preserve these invariants:

- One immutable official issue per date, shared by manual and scheduled generation; samples never consume that slot.
- No API keys in settings, issue content, metadata, source fixtures or the renderer's returned state.
- Public-source network validation remains in the main-side transport, including redirects and private-address protection.
- Model/feed text is data, never executable HTML or an instruction to invoke tools.
- Model consistency review is described honestly and never relabelled as independent verification.
- Printing persists its reservation before calling the OS and never automatically retries a submitted/uncertain issue.
- Archive reflow and export never trigger another model request.

## Tests and fixtures

Add targeted tests when they address an actual risk: a new parser edge case, malformed model output, credential handling, filesystem races, DST, print recovery or a regression. Avoid tests that merely restate an implementation detail.

Keep routine tests offline. Use injected fake transports, synthetic excerpts, harmless identifiers and temporary directories. Never commit real API keys, private feed URLs, personal profiles, calendars, exported newspapers or user-data archives. Real paid API calls and physical printing must be explicit, optional verification steps under the tester's control.

For reading/print changes, inspect a representative long bilingual issue, a narrow layout and multi-page output. State which OS, paper size and hardware you used when reporting printer behavior. A successful OS callback proves submission, not physical completion.

## Languages, sources and licensing

Keep [English](README.md), [Chinese](README.zh-CN.md) and [Japanese](README.ja.md) user-facing documentation consistent. UI strings live in the renderer translation catalog; field labels and depth choices live in the shared professional catalog. Preserve the user's free description and stable IDs when translating labels.

Only add material you have the right to contribute. Keep dependencies and font notices accurate, and update the lockfile together with dependency changes. Do not bundle commercial news text, cartoons, crossword collections, accounts or logos merely because they are accessible online. Explain the origin and license of a new fixture or asset.

Submit changes under the project's [Apache-2.0 license](LICENSE). Include a concise description of the problem, the change, observed validation and remaining limits. No contribution process should require uploading personal newspapers or credentials.
