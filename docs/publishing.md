# Publishing the source and desktop packages

## First public repository

Create a new public GitHub repository named `personal-press`. The intended initial description is:

> A local-first daily newspaper for professional readers, e-readers and paper.

Use `main` as the default branch. The source tree already includes its Apache-2.0 license, notices, three-language READMEs, contribution guidance, security policy and workflows. If you use GitHub's web creation form, start with an empty repository to avoid replacing its generated files.

From the reviewed source folder, the owner can publish with their own authenticated Git/GitHub CLI session:

```sh
git init -b main
git add .
git commit -m "Initial Personal Press desktop alpha"
gh repo create personal-press --public --source=. --remote=origin --push
```

Set your preferred public Git author identity before the commit. Do not paste credentials into a shell command, README or source file. If a repository already exists, inspect its contents and configure that remote instead of running the creation command again.

## Verify the first public commit

The `Source checks` workflow tests the project on Windows, macOS and Ubuntu, checks production dependency advisories, and runs an isolated sample PDF/EPUB/IPC smoke test on Linux. The smoke test disables physical printing, uses separate temporary application data and calls no paid model. Review the sample PDF artifact for layout regressions.

For a local check:

```sh
npm ci
npm run check
npm test
npm run source:zip
```

The source ZIP is deliberately assembled from project directories and named documentation files. It omits installed dependencies, generated font copies, exported newspapers, application data and credentials. `npm ci` downloads the pinned development/runtime dependencies and prepares local fonts again.

## Build installable alpha packages

Run the manual `Build desktop packages` workflow. It prepares Windows x64 NSIS, macOS ARM64/x64 DMG, and Ubuntu x64 AppImage/DEB packages. Artifacts are **unsigned alpha candidates** for maintainer review. They are not automatically published to GitHub Releases and this repository does not contain signing credentials.

On the appropriate operating system, local builds use:

```sh
npm run dist
```

Before publishing binaries, install them on clean machines, test each target printer/driver combination, and check the PDF/EPUB exports. Add maintainer-controlled Windows signing and macOS signing/notarization for a public installer release. Do not advise users to disable platform security features to run an alpha.

Publish only inspected installers, the source ZIP, their checksums, a clear alpha release note and tested-platform information. The current version is `0.1.0-alpha.1`; the source preview is not a claim that every platform, e-reader or physical printer has already been certified.
