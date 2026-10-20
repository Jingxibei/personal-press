# Security policy

## Release status

`0.1.0-alpha.1` is a source preview. A stable release, signed installer distribution and a formal security audit have not been completed. Security fixes target the active source version; no support lifetime or response-time service level is promised for this early project.

## Report a vulnerability privately

Use this repository's **Security → Report a vulnerability** feature if the maintainer has enabled it. Do not assume that a private reporting channel is available until the repository actually displays one.

If no private channel is available, open a minimal issue asking the maintainer to establish one, without exploit details or sensitive attachments. There is no published security email address in this source preview. Do not invent an address or send a confidential report to an unrelated account.

A useful private report includes the affected version/OS, a minimal reproduction using synthetic data, expected and observed behavior, and the security impact. Remove credentials, private source URLs, full newspapers, diary entries, home-directory names and identifying screenshots before sharing. Coordinate disclosure of exploitable details through an actual private channel.

If a key was exposed, revoke it with its provider. Deleting it from Personal Press does not invalidate the provider credential.

## Boundaries worth investigating

| Area | Intended boundary |
| --- | --- |
| Renderer | Sandboxed, context-isolated local UI with a fixed preload API, not unrestricted Node or filesystem access |
| Network | Main-side, bounded public HTTPS feed retrieval with destination/redirect checks; cloud model endpoints restricted to approved providers |
| Local model | Explicit loopback HTTP(S) endpoint only; no arbitrary LAN or remote “local” service |
| Content | Feed/model output treated as untrusted text; bounded schema, known citations and escaped rendering |
| Credentials | Separate OS-protected blobs or session memory; no key persistence under Linux `basic_text` |
| Archive | Date-only paths, atomic writes and no overwrite of generated issue content |
| Printing | Durable pre-OS reservation, no implicit default-printer fallback and no automatic duplicate after an uncertain/submitted job |

Report ways to bypass these boundaries, including SSRF/private-address access, redirect credential leakage, path traversal, arbitrary renderer execution, sensitive IPC disclosure, print-state reset or credential persistence without suitable protection.

## Known limits

The archive is ordinary local JSON and is not encrypted by the app. OS-backed credential protection does not protect against every process with access to the same account, and a running application necessarily holds decrypted keys in memory. Exported files, temporary rendered documents, backups and OS print queues can contain issue text and diary entries. See [Privacy](docs/privacy.md).

The model review is a content-consistency aid, not a security verifier or a factual-truth oracle. Retrieved text can contain prompt injection. This version limits that risk through a tool-free model task, explicit untrusted-data boundaries, schema checks and escaped output; it does not claim that all malicious or misleading source content can be identified.

Daily and printer uniqueness depend on keeping the local archive and metadata together. Multiple computers writing the same synchronized folder are unsupported. No remote API server or hosted management endpoint is part of this alpha.

A signed and notarized release process, a maintained private-reporting channel, wider platform testing and continued dependency review are prerequisites for a more mature public release. Publishing source code alone does not establish those properties.
