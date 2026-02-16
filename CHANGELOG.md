# Changelog

## [0.2.1] - 2026-02-16

### Fixed
- `--open` flag on `serve` subcommand was silently ignored due to Commander.js flag conflict with parent command
- Use `open` npm package for cross-platform browser opening (handles macOS, Windows, Linux, WSL)

## [0.2.0] - 2026-02-16

### Added
- **12 new subreddit vibe packs**: csharp, devops, experienceddevs, gamedev, java, kotlin, linux, localllama, machinelearning, php, reactjs, selfhosted (22 total)
- **Zod runtime validation** on all AI responses (post, agenda, comments)
- **Test suite** — 125 tests covering scanner, output pipeline, vibe packs, and E2E with mocked LLM
- **MIT license**
- **npm package metadata** — description, author, repository, keywords, engines
- **CHANGELOG.md**
- Meta screenshot in README (yes, it roasted itself)

### Fixed
- `--no-ui` flag now correctly defaults to UI enabled (opt-out instead of opt-in)
- `serve` command no longer exits immediately — `Bun.serve()` keeps the process alive
- Timestamp parent lookup bug — top-level comments now correctly reference the post ID
- Windows support for `--open` flag (`cmd /c start`)
- Removed unnecessary `await new Promise(() => {})` blocking — `Bun.serve()` handles it

### Changed
- UI server starts by default after generation; pass `--no-ui` to skip
- `generateJSON` now accepts an optional Zod schema for validation
- Cleaned up unused `parseArgs` export

## [0.1.0] - 2026-02-16

### Added
- Initial release
- 3-call AI pipeline: post → agenda → comments
- 10 built-in subreddit vibe packs (cpp, golang, haskell, javascript, lisp, programming, python, rust, typescript, webdev)
- Seeded PRNG for deterministic scores and timestamps
- Reddit dark-mode web UI
- `serve` command for viewing previous results
- CLI with full option set (subreddit, comments, depth, style, model, seed, etc.)
