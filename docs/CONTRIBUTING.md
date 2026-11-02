# Contributing to OpenRadar

Thanks for helping. This project values small, focused changes that keep the map
fast and the data handling honest.

---

## 1. Before you start

- Read [Architecture](ARCHITECTURE.md) for the frame/tile model.
- Read [Development](DEVELOPMENT.md) for setup and conventions.
- Check [Roadmap](ROADMAP.md) for known direction.
- For a large feature, open an issue describing the problem and approach before
  writing code. It avoids wasted work and design churn.

Good first contributions:

- documentation corrections;
- accessibility and keyboard fixes;
- error-message clarity;
- small UI polish that does not add dependencies;
- tests for pure functions;
- reproducing and narrowing a bug.

---

## 2. Reporting bugs

Include:

- OpenRadar version, platform, and whether it is the desktop or browser build;
- selected data source and effective host;
- exact steps to reproduce;
- expected vs actual behaviour;
- the first console/webview error;
- whether the catalog loads and whether tiles load;
- a screenshot with sensitive locations removed.

Do not include API keys, full settings files, or precise home coordinates. See
[Troubleshooting § Collecting a useful bug report](TROUBLESHOOTING.md#14-collecting-a-useful-bug-report).

If the problem is upstream data (a missing alert, wrong radar return, provider
outage), report it to that provider. OpenRadar only displays their data.

---

## 3. Suggesting features

Describe:

- the user problem, not only the proposed control;
- who benefits and how often;
- alternatives considered;
- data-source, licensing, and privacy implications;
- whether it works on Linux, Windows, and the browser build.

Features that add a paid service, an API key requirement, telemetry, or
non-open data need a strong justification and must be optional.

---

## 4. Development workflow

```bash
npm install
npm run tauri:dev        # native
# or
npm run dev              # browser
```

Before committing:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

For native changes:

```bash
npx tauri build --no-bundle
```

Then run the relevant manual cases in [Testing](TESTING.md).

### Branch and commit style

- Work on a topic branch, not directly on the main branch.
- Keep commits coherent; avoid mixing refactors with behaviour changes.
- Write imperative commit subjects, for example:
  - `Fix RainViewer opaque frame paths`
  - `Add satellite opacity persistence`
  - `Document self-hosted CORS origins`
- Explain *why* in the body when the change is not obvious.
- Do not commit `node_modules`, `dist`, `src-tauri/target`, logs, or local
  settings.

---

## 5. Code expectations

### General

- Match the existing structure, naming, and formatting.
- Prefer the smallest change that solves the problem.
- Do not add a dependency for something the platform or existing code already
  does.
- Keep user-facing text clear and specific.
- Update documentation with behaviour changes.

### TypeScript

- `strict`, `noUnusedLocals`, `noUnusedParameters`, and
  `noUncheckedIndexedAccess` are on.
- Use `@/` absolute imports.
- Network calls accept an `AbortSignal`, set a timeout, and use
  `getErrorMessage`.
- Never inject upstream text with `innerHTML`.
- Persisted settings must be validated in `sanitizePersisted`.
- Effects touching MapLibre guard on `map` and `styleEpoch`.

### Rust

- Commands return `Result<T, String>` with actionable messages.
- Validate size, JSON, and file content before writing.
- Use atomic writes for user data.
- Sanitise filenames.
- Keep the capability list minimal.

### CSS

- Use tokens from `tokens.css`; avoid hard-coded colours.
- Support both themes and reduced motion.
- Test at 1280×820, 900 px, 760×560, and ≤520 px.

### Data and licences

- Do not add a source without documenting its licence, attribution, and terms.
- Do not describe Esri World Imagery as open data.
- Do not remove or hide attribution.
- Keep the “not for life-safety decisions” warning.

---

## 6. Pull request checklist

- [ ] The change is focused and described.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `cargo check` passes (if Rust changed).
- [ ] `cargo fmt`/`clippy` are clean (if Rust changed).
- [ ] The app was run and the affected flow tested.
- [ ] Base-map switching was tested if overlays changed.
- [ ] Settings persistence was tested if a setting was added.
- [ ] Narrow-window layout was checked if UI changed.
- [ ] Error paths were considered (offline, 4xx/5xx, empty data).
- [ ] Docs and [Changelog](CHANGELOG.md) are updated.
- [ ] No secrets, local paths, or debug logs are included.
- [ ] Attribution and licensing remain correct.

In the PR description, include:

- what changed and why;
- how you tested it;
- screenshots for UI changes;
- known limitations or follow-ups.

---

## 7. Review process

Reviewers look for:

- correctness under network failure and source changes;
- no regressions in playback or tile caching;
- no unnecessary re-renders or layer rebuilds;
- clear error copy;
- accessibility and keyboard behaviour;
- documentation accuracy;
- licence and attribution compliance.

Expect questions about edge cases. Small PRs are reviewed faster. If a review
request is unclear, ask rather than guessing.

Maintainers may close a PR that is out of scope, duplicates existing work, or
cannot be maintained. That is not a judgement of the contributor.

---

## 8. Documentation contributions

- Use the existing document structure and cross-link related pages.
- Keep commands copy-pasteable and paths exact.
- State the version and platform when behaviour differs.
- Do not promise SLAs or guarantees the app cannot meet.
- Update the index in [docs/README.md](README.md) when adding a document.
- Prefer a concrete example over a long abstract explanation.

---

## 9. Translation and localisation

The UI is English-only in v0.1.0. Dates and times already use the OS locale via
`Intl`. A future localisation effort should:

- extract strings rather than adding scattered conditionals;
- preserve keyboard shortcuts and accessible names;
- allow longer translations without clipping;
- keep data-source names and attribution untranslated where required.

Open an issue before starting a translation framework.

---

## 10. Security issues

Do not open a public issue for a suspected vulnerability. Follow
[Security and privacy § Reporting a vulnerability](SECURITY_PRIVACY.md#10-reporting-a-vulnerability).

---

## 11. Licensing of contributions

OpenRadar is MIT-licensed. By contributing, you agree that your contribution is
provided under the same licence and that you have the right to submit it.

Do not copy code from projects with incompatible licences. If you adapt code,
note the origin and licence in the PR. Data and service terms are separate from
the source licence; see [Data sources](DATA_SOURCES.md).

---

## 12. Community expectations

- Be direct, specific, and kind.
- Critique the change, not the person.
- Assume good faith, but verify claims with a reproduction.
- Respect maintainer time; avoid repeated pings.
- Do not demand features or timelines. This is a volunteer project.
- Do not use issues for support requests that the documentation already answers;
  link the relevant page instead.
