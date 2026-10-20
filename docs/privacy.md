# Privacy and local data

[Project overview](../README.md) · [中文说明](../README.zh-CN.md) · [日本語](../README.ja.md)

This document describes the implementation of the `0.1.0-alpha.1` source preview. Personal Press runs its desktop application and stores editions locally. **Choosing a cloud model still sends an inference request to that provider.** “Local” storage does not make cloud generation an offline operation.

## Data boundaries

| Operation | Data involved | Destination |
| --- | --- | --- |
| Read the offline sample or an archived issue | Bundled sample or saved edition, reading settings and local fonts | The application on your computer; no model request |
| Save settings | Professional directions, preferences, public feed URLs, print settings and manual diary entries | Local JSON files |
| Fetch feeds | Requests for your enabled public feed URLs; ordinary network request metadata | The selected feed servers and their allowed redirects |
| Fetch a model list | Selected provider and its API credential | That provider's approved API endpoint, or the configured local endpoint |
| Generate an issue | Edition date/cutoff, chosen professional directions and free descriptions, perspectives, requested languages/depth, source titles/dates/URLs/excerpts | Your selected model provider |
| Additional model review | Draft articles and their source excerpts | The same selected provider/model, in another request |
| Add a diary to the issue | Matching events entered into this app | Local processing after all model calls |
| Export | The issue, including its retained sources and diary | The file location you choose |
| Print | The selected edition or an explicit test page | The operating system's print system and selected printer |
| Open a source link | The link you explicitly select | Your system browser, which follows its own privacy settings |

Feed hosts and model services can see standard connection information such as your IP address. The application has no provider-independent data-retention agreement, processing-region guarantee or control over an external provider's logs. Consult the chosen provider's current terms and account controls.

A loopback local model keeps the application's inference request on the computer. You are responsible for the local server's own configuration and any network behavior it may have. Public news retrieval still connects to source servers. This alpha does not offer an offline source-import pipeline for generating fresh editions without network access.

## What is stored

The Settings screen displays the app's actual data location. Under that location, the application keeps:

| Relative location | Contents |
| --- | --- |
| `archive/settings.json` | Whitelisted preferences, feed URLs, professional profiles and manually entered diary events; no API keys |
| `archive/issues/YYYY-MM-DD.json` | Immutable generated issue content, dated sources/excerpts, review notes, leisure and the diary snapshot |
| `archive/meta.json` | Publication states, schedule changes, generation-attempt metadata and printer submission history |
| `credentials/<provider>.bin` | An encrypted credential blob when suitable OS-backed protection is available |

**The JSON archive is not encrypted by this application.** File permissions restrict access where supported, but that is different from encryption. Anyone with sufficient access to the same computer, backups or exported files may be able to read the archive. Use the operating system's disk/backup protection if that matters for your information.

Document rendering also creates temporary local HTML. Normal cleanup removes it after export or printing; a process or system crash can leave temporary files. Electron and the operating system may maintain their own local caches and print spool data.

## API credentials

The renderer passes a key through the narrow local bridge; the Electron main process owns storage and API requests. Keys are excluded from ordinary settings, issue files and metadata. Saved keys are not returned to the reader; it receives availability flags.

The vault uses Electron's `safeStorage` protection when available. Its platform mechanisms include macOS Keychain, Windows DPAPI and Linux desktop secret stores. Linux's `basic_text` fallback is explicitly rejected for persistence by this app; an unavailable secure backend results in session-memory storage. These OS mechanisms have different security properties and are not a defense against every process running as the same user. See [Electron's official safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage).

On a session-only setup, enter the key again after restarting. An unsigned development build on macOS may also encounter Keychain permission prompts or require re-entry after a build change. Release signing is not complete in this alpha.

Deleting a key in Settings removes the application's stored value. It does not revoke the credential at the provider. To invalidate a compromised key, use that provider's API account controls. Error messages are bounded and known loaded credentials are redacted, but do not post unreviewed screenshots, archives or logs publicly.

## Calendar and professional descriptions

The diary is a **manual calendar inside this app**. Personal Press does not read the system calendar, request Google/Outlook calendar access or synchronize events. Events matching the issue date are attached locally after generation and review. Their titles and times are not put in model prompts.

The resulting newspaper can still contain those events. Exporting it to a shared folder, sending it to an e-reader, or printing it shares the retained diary along with the paper. An old issue keeps its original diary snapshot; editing today's settings does not rewrite an immutable issue.

Professional free descriptions do enter the model prompt. Avoid including private customer names, confidential project details or other material you do not want that provider to receive. Use public RSS/Atom feeds; this version is not a credentialed private-feed client. URL query parameters are stored with settings, so do not put private access tokens in a supposedly public feed URL.

## Network and account behavior

The alpha has no Personal Press account backend, analytics uploader, cloud archive, automatic device delivery or built-in synchronization. Daily publication and automatic printing start disabled. Once you enable the daily schedule, it can fetch feeds and call the chosen model while the application runs.

Reader windows use bundled scripts and fonts. Renderer HTTP(S) requests are blocked, built-in spellchecking is disabled, and its dictionary URL is directed to a local empty location to prevent Chromium's default dictionary download. An isolated Linux sample-reading/PDF-export check found no external HTTP(S) destinations. This is a checked startup path, not a guarantee about every operating system or software added to the machine.

An additional model review is another API request. Scheduled generation failures have a bounded retry/backoff path; manual attempts can cause additional requests. A daily issue limit is not a provider billing limit. API usage is governed by developer-account billing, not by this app's license or a chat-login session. See [OpenAI billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform), [Gemini billing](https://ai.google.dev/gemini-api/docs/billing), [xAI API documentation](https://docs.x.ai/developers) and [DeepSeek API documentation](https://api-docs.deepseek.com/).

Installing dependencies with `npm ci` separately contacts package/runtime distribution services. It downloads the dependencies, Electron runtime and font packages needed for the source build. Those downloads are not newspaper generation and do not make the installed reader depend on a font CDN.

## Backups, sharing and deletion

Quit the app before making a consistent backup of its data directory. Keep issue content and `meta.json` together: metadata contains publication and printer-submission history. Do not copy the active data directory between running instances or point multiple installations at a synchronized writable folder. Multi-device conflict resolution is not implemented.

Credential blobs may not unlock under another user, operating system or installation. Re-enter the appropriate API key after restoring or moving an archive. A backup of this directory is not an automatically portable credential bundle.

Exported PDF, EPUB and HTML files are ordinary files. A cloud-synchronized folder you select may upload them through another application. Printer drivers, queues and hardware can retain their own copies; Personal Press cannot remove those external copies.

There is no comprehensive in-app archive-deletion workflow in this alpha. For a full manual removal, disable scheduling/automatic printing, quit, and remove this app's displayed data directory plus any exports or backups you no longer want. This also removes daily and print history. Do not delete only `meta.json` to force a retry: it carries the information used to avoid duplicate automatic submissions.
