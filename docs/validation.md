# Validation of the first source preview

Validation was performed on 20 October 2026 for `0.1.0-alpha.1`. This is evidence for the source preview, not a hardware certification or a signed-installer release.

## Automated checks

All **75 named automated tests passed**. The suite covers source date/freshness filtering, URL/DNS/redirect boundaries, bounded XML parsing, model request contracts, all six ordered language pairs, professional profiles and paragraph budgets, evidence and review failure handling, daily uniqueness, crash/restart behavior, DST, printing reservations, printer status interpretation, credentials and EPUB content preservation.

Run the normal suite with `npm test`. An additional in-process run on Node 24 executes all named cases with:

```sh
node --test --test-isolation=none test/*.test.mjs
```

`npm run check` validates JavaScript syntax, the local reader policy and lockfile consistency. `npm audit --omit=dev --audit-level=high` reported no production dependency vulnerabilities at the time of the check; advisories can change.

## Real desktop and export checks

Electron 44.9.1 ran the real main/preload/renderer path with separate temporary app data. The test opened the offline sample through the bridge and confirmed that the renderer did not expose `window.require`. Production window configuration enables context isolation and sandboxing. The headless Linux test runner used `--no-sandbox` because of its container restrictions; this does not certify an effective OS sandbox or replace a normal desktop test.

Both the English/Chinese A4 sample and Japanese/English Letter sample exported to three-page PDFs. All pages were rendered and visually inspected for legible type, language glyphs, column flow, clipping and complete puzzle grids. The Letter media box was 612 × 792 points. No missing-glyph replacement characters appeared in extracted sample text. A4 uses two newspaper columns, Letter uses two, and the A3 configuration uses three; focused reading uses a single column.

The EPUB archive put its uncompressed `mimetype` entry first, and every XML/OPF/XHTML document parsed successfully. It contains reflowable articles, source links, a local diary, leisure and separate answers. It deliberately leaves body font and colors to the reading device.

A fresh-profile startup plus sample PDF export was checked through Chromium's network log after suppressing its optional spelling-dictionary fetch. No external HTTP(S) destinations appeared in that specific run.

## UI and build checks

The UI was also exercised with a desktop viewport and a 390-pixel mobile-sized browser viewport. Local modules/fonts and the newspaper frame loaded, the paper remained light with dark text within a dark surrounding UI, answers expanded, and neither viewport overflowed horizontally. The narrow viewport is a responsive preview, not a shipped mobile application.

Interaction checks covered professional field selection and free description, separate depth settings, sources, language preferences, locally entered diary entries, independent credential saving, generation prerequisites, explicit printer actions and errors appearing without clearing an edited form.

The Linux unpacked desktop build completed with `npm run pack`. Its application archive contained the source modules, local fonts and third-party license files. Windows and macOS package targets and GitHub workflows are supplied; they have not been executed on those operating systems during this validation.

## Still requiring release validation

No paid live model request was made and no physical printer was operated during these checks. Provider behavior was tested with bounded, injected fixtures; printer submission/recovery with state tests; real document rendering with Electron's PDF exporter.

Before a general binary release, validate live provider accounts, regional connectivity, representative Windows/macOS/Ubuntu installations, printer drivers, physical margins/duplex output, representative e-reader import workflows and signing/notarization. Review the current dependency advisories and keep exact tested versions in release notes.
