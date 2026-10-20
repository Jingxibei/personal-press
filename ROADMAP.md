# Roadmap

This roadmap distinguishes code present in `0.1.0-alpha.1` from proposed work. Items below are directions, not shipped service promises, release dates or paid entitlements.

## Current source preview

The free Apache-2.0 core includes a local Electron desktop app, self-supplied public RSS/Atom feeds, four cloud model adapters plus an optional local model endpoint, professional direction/depth settings, bilingual issue generation, bounded evidence checks, local history, an embedded newspaper reader, file exports and opt-in OS printing.

The app stores one immutable official issue per date. Local scheduling requires an awake computer and a running app. Source evidence is limited to feed titles and excerpts. Original local leisure content and manually entered diary events are supported. No account backend, cloud archive or payment system is enabled.

## 1. Desktop release readiness

- Complete reproducible builds and practical validation on Windows, macOS and Ubuntu desktops.
- Publish clearly identified installers, checksums and release notes after native verification.
- Establish code signing and macOS notarization, including stable credential behavior across upgrades.
- Broaden physical-printer and multi-page bilingual layout checks without weakening the uncertain-job duplicate barrier.
- Improve setup diagnostics, translation coverage, accessible reading controls, backup/export workflows and documented data migrations.
- Establish and maintain a private security-reporting channel.

Native build targets are configured today. Signed, generally available installers are not yet a completed milestone.

## 2. Stronger source and editorial workflows

- Help users discover candidate sources from their professional needs, while retaining a fully self-selected-source route.
- Explain source ownership, origin, freshness, coverage and evidence limitations before a feed is added.
- Improve event-level clustering, update detection and tracing of multiple reports to the same underlying source.
- Add explicit evidence provenance, source-conflict presentation and optional human review controls.
- Investigate lawful, attributable richer-source access where the source permits it; do not equate more text with independent verification.
- Refine specialist profiles, per-direction coverage and explanation depth without lowering the evidence standard.

The current free core already accepts multiple professional directions and feeds. Better discovery/curation is a separate capability, not an existing restriction that requires payment to remove.

## 3. E-reader and multi-device delivery

- Improve exported layouts for small e-ink screens and document actual device-specific import paths.
- Explore opt-in file, email or supported service delivery adapters that reuse the saved issue.
- Add explicit connection setup, delivery status and duplicate prevention appropriate to each destination.
- Design local-first synchronization with conflict handling, key separation and a clear encryption model.

Kindle, iReader/掌阅, BOOX, reMarkable and Kobo have different software and transfer constraints. No universal automatic-delivery or native-installation guarantee is implied. Exporting a document remains useful while individual adapters are developed.

## 4. Independent mobile management

Explore iOS, Android and HarmonyOS clients able to manage their own settings, archive, sources and credentials without requiring a desktop to stay online. Reuse formats and appropriate core logic, while designing platform-specific lifecycle, background-work, key storage, printing and distribution behavior.

HarmonyOS needs an explicit platform design; an Android build is not proof of HarmonyOS compatibility. A responsive browser preview is not a standalone mobile application. Background generation and exact delivery timing must be evaluated under each platform's actual limits.

## 5. Optional paid services

Potential services include managed source discovery and cross-industry curation, more involved professional research workflows and an all-in-one hosted offering. A hosted scheduler would need its own server-side state, account/billing controls, data retention choices and delivery infrastructure.

These services are **not available for purchase in this alpha**. Pricing, service terms, regional availability, review standards and data-processing arrangements have not been launched. The free open-source core should remain useful with the user's own sources and model credentials.

## 6. A richer newspaper culture section

Expand original and appropriately licensed puzzles, improve native-language word games, and consider cartoons only with a clear right to use and distribute them. The current small original bank repeats, and no commercial cartoon catalog is bundled.

## Principles for future work

Keep sources separate from models, and generation separate from file/device delivery. Preserve the same official issue when the reader reflows, downloads or sends it. Treat factual uncertainty and print-submission uncertainty explicitly. Describe capabilities according to their implemented and observed behavior, especially for devices, models, countries and background scheduling.
