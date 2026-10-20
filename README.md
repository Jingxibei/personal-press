# Personal Press

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

A personal daily newspaper for professional reading, e-readers and paper. Choose your interests and public sources, bring your own model API key, and keep the resulting editions on your computer.

**Version `0.1.0-alpha.1` is a source preview.** Desktop build configurations are included for Windows, macOS and Linux. Ready-made installers have not been published, and release signing/notarization is not complete. This is an early desktop implementation, with device delivery and hosted services still on the [roadmap](ROADMAP.md).

The core is free, open-source software under [Apache-2.0](LICENSE). No Personal Press account or subscription is required. Model API usage is handled by your chosen provider.

## Run the source preview

Install **Node.js 22 or newer with npm** on a Windows, macOS or Ubuntu desktop. Download/extract the source or clone this repository, open its project directory, then run:

```sh
npm ci
npm start
```

`npm ci` needs internet access. Its installation step downloads Electron and prepares the bundled Latin, Chinese and Japanese fonts from the pinned dependencies. Reading a saved issue or the sample uses local fonts; there is no font-CDN request. Python and Docker are not required.

Start by opening the **offline sample**. It is original example content, clearly labelled, and does not consume a daily issue or make a model request. Daily generation and automatic printing are both off on a fresh installation.

For a reader-only browser preview, use `npm run preview` and open the local address it prints. That preview has session-only settings and cannot generate real issues, store keys, export files or access printers. Use `npm start` for the desktop features.

## What the alpha implements

| Area | Current behavior |
| --- | --- |
| Models | Bring your own OpenAI, Gemini, Grok or DeepSeek API key; an optional loopback OpenAI-compatible local model endpoint is also supported. |
| Professional interests | A three-level selection tree across 14 fields, multiple reading directions, free descriptions, reading perspectives and five depth levels. |
| Languages | Chinese, English and Japanese interfaces; any pair of those languages for new editions, with an approximate language-share control. |
| Reader | An embedded reader, date-ordered history, newspaper/focused layouts, text size and four restrained paper palettes. |
| Exports | PDF, EPUB and HTML from the same saved issue, without regenerating its articles. EPUB uses a simpler reflowable layout. |
| Daily publication | A fixed IANA timezone, preparation up to 20 minutes early, one immutable official issue per date and today's catch-up after a late start. |
| Printing | OS printer discovery, an explicit test page, manual system-dialog printing and opt-in scheduled printing. |
| Local extras | A date-generated Sudoku, a small original bank of English word squares with translated clues, riddles, jokes and manually entered diary events. |

The leisure bank is deliberately small and repeats. The word puzzle is an English mini puzzle, not a full Chinese or Japanese crossword. No commercial cartoons are bundled. Some low-level diagnostics and review notes can still appear in English in this alpha.

## Make your first real edition

1. In Settings, choose your interface language and publication timezone.
2. Add a broad field, refine it to a specialism/topics, or describe a direction in your own words. You may add several directions and set a separate depth for each.
3. Add at least one **public HTTPS RSS or Atom feed** and enable it. Sources start empty; this alpha does not search the web for feeds on your behalf.
4. Choose a model provider, save your own API key and select an available text model. You can fetch the provider's model list or enter a compatible model ID.
5. Choose the two reading languages, their target share and the maximum article count. The default is up to 6 articles; the allowed range is 1–12. Thin evidence can produce fewer articles.
6. Save the settings, then click **Generate today's edition**. This makes the official issue for today, including when daily scheduling is off.
7. Read the source links, cutoff time, evidence limitations and review notes. Export or print that saved edition as needed.
8. If you want recurring publication, set a target time and explicitly enable the schedule. Configure automatic printing separately, after a successful printer test.

The model selection must support the text API used by its adapter. A model appearing in an account's catalog is not a promise that every capability of that model works here. There is no automatic switch to another provider or paid model when a request fails.

### Professional depth

The field tree covers technology/digital products; industry/robotics/manufacturing; health/life sciences; finance/business services; law/policy/public affairs; energy/resources/environment; architecture/civil engineering/cities; transport/logistics/aerospace; geospatial/earth science; agriculture/food/bioresources; consumer/retail/services; education/society/humanities; media/culture/design; and maths/physics/basic science. See the [actual catalog](src/shared/domains.mjs).

Directions describe **what** to follow. Perspectives such as engineering, management, products, research or policy describe **how** to read it. A free description accommodates work that does not fit the tree. The profile guides selection and explanation; it does not guarantee a story for every chosen field each day.

| Level | Reading request |
| --- | --- |
| 1 · Brief | The development, essential terms and a short explanation. |
| 2 · Industry briefing | Practical relevance, workflows and the main evidence limits. |
| 3 · Professional | Mechanisms, assumptions and conditional professional implications. This is the default. |
| 4 · In-depth | Method, applicability, constraints and alternative interpretations where sources support them. |
| 5 · Expert | Deeper scrutiny of evidence, scenarios and decision boundaries, with missing information made explicit. |

Depth changes the requested treatment, never the evidence standard. A short feed excerpt cannot support a comprehensive research report merely because level 5 is selected.

### Bilingual reading and immutable editions

The percentage is an **approximate paragraph budget**, not a precise word, character or page-area ratio. Both languages receive headlines and summaries; the larger share normally gets a fuller explanation. Different writing systems and available evidence affect the result.

Changing font size, palette, layout or language share reflows saved content locally. It does not call a model, expand a condensed translation into missing full text, or add a new language to an old issue. New language pairs, sources and professional preferences apply to newly generated editions.

An official issue is immutable from the moment it is prepared, including early preparation. Manual and scheduled generation reuse the same date. Downloads and layout changes do not create extra editions. The offline sample has a separate identity.

## Evidence and review: what “checked” means

This version reads **feed titles, dates and bounded excerpts**. It does not browse the full articles, bypass paywalls or perform independent reporting. Each feed defaults to a **48-hour freshness window**, configurable from 1 to 168 hours. Undated, future-dated, stale, unsafe and empty entries are excluded.

The pipeline checks output structure, allowed source IDs, exact supporting excerpt matches and simple duplicates. An additional model consistency review is enabled by default; it can exclude unsupported or contradictory draft articles. Deterministic checks still run if you disable the extra model pass.

These checks are **not a factual-accuracy guarantee**. Matching a quote does not prove that every inference follows from it, and a second pass by the same selected model is not independent verification. Multiple links can repeat the same original report. The alpha deduplicates canonical URLs/titles and simple draft repetitions; comprehensive event-level clustering and independent-source tracing remain future work.

If no usable evidence or no acceptable articles remain, generation fails without inventing a replacement newspaper. Use the source links and limitations to judge whether an item is sufficient for your work. More detail on the pipeline is in [Architecture](docs/architecture.md).

## Model accounts, costs and regional access

Personal Press uses provider **API credentials**, not chat-app login cookies or a consumer subscription session. API access, credits and usage charges follow the provider's developer account and current terms; do not assume a chat membership supplies this application's API usage. OpenAI, for example, documents [separate ChatGPT and API billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

| Selection | Adapter | Provider documentation |
| --- | --- | --- |
| OpenAI | Responses API | [OpenAI API](https://developers.openai.com/api/docs/) |
| Gemini | `generateContent` | [Gemini API](https://ai.google.dev/gemini-api/docs) · [Billing](https://ai.google.dev/gemini-api/docs/billing) |
| Grok | Chat Completions API | [xAI developer docs](https://docs.x.ai/developers) · [API pricing](https://docs.x.ai/developers/pricing) |
| DeepSeek | Chat Completions API | [DeepSeek API docs](https://api-docs.deepseek.com/) |
| Local | OpenAI-compatible chat endpoint on loopback | Supply your own running server, model and hardware, for example `http://127.0.0.1:11434/v1`. |

A successful edition normally uses a generation request plus an additional request when model review is enabled. Failed scheduled generation can retry with a ten-minute backoff, stopping automatic attempts after three failures for the date. Manual attempts can incur further usage. One issue per day is not an API spending cap; inspect the provider's usage controls.

The app does not guarantee that every provider or feed is available in the United States, Canada, mainland China, Japan or any other region. Account eligibility, network reachability, models and billing are provider-dependent. A local model avoids cloud inference calls, but fresh feed retrieval still requires network access.

## Scheduling, printing and e-readers

**The computer must be awake and the application must be running.** The alpha installs no wake service or hosted scheduler. A 00:05 delivery can begin preparation at 23:45 on the preceding day. A late start prepares today's issue, not a backlog of old dates. DST and timezone changes are handled by calendar dates and a persisted change guard.

Printing is opt-in. Select an installed OS printer, paper size and duplex mode; explicitly send and inspect a test page; then enable automatic printing. Scheduled output uses one copy, white paper and dark ink, with a configurable **1–12 page limit**. A queued success is recorded as **submitted**, not “printed.” An uncertain result is never automatically submitted again. Manual printing opens the system dialog. Read [Printing](docs/printing.md) before relying on unattended output.

PDF, EPUB and HTML let you use an e-reader's existing document-import workflow. This alpha does not install an app on, pair with or automatically deliver to Kindle, iReader/掌阅, BOOX, reMarkable or Kobo. File-import support and transfer steps depend on the device and its current software. Exporting a format does not imply universal device compatibility.

## Privacy and local data

Settings, editions, diary entries and job history are local JSON files, **not an encrypted archive**. API keys are kept outside settings using Electron's available OS-backed credential protection. If secure persistence is unavailable—including Linux `basic_text`—keys stay in memory for the app session.

Cloud generation sends the selected source excerpts and professional preferences to your chosen provider. Manually entered diary events are attached afterward on the computer and are not included in model prompts. The app does not read the operating system's calendar. Exported and printed editions can contain those diary entries.

There is no built-in account service, analytics upload or cloud sync in this alpha. See [Privacy](docs/privacy.md) for the precise data boundaries, storage and backup behavior, and [Security](SECURITY.md) for reporting problems.

## Development and native packaging

```sh
npm test
npm run check
npm run dist
```

Run `npm run dist` on the target operating system. The configuration targets Windows x64 NSIS, macOS arm64/x64 DMG, and Linux AppImage/deb, writing build outputs to `dist/`. Build tools may need additional downloads and OS prerequisites. These targets are configuration, not a claim that signed installers or a complete hardware test matrix have been released.

`npm run pack` creates an unpacked application; `npm run source:zip` creates the source archive and a SHA-256 file. See [Contributing](CONTRIBUTING.md) for development boundaries. Third-party dependencies and fonts keep their respective licenses, listed in [Third-party notices](THIRD_PARTY_NOTICES.md); the software license does not grant rights to republish third-party news.

Paid source discovery, managed cross-industry research, a hosted service, device delivery, mobile apps and licensed cartoons are described only as [planned work](ROADMAP.md). The free core already supports multiple self-selected professional directions and feeds.
