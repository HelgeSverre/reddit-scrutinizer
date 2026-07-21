# Changelog

## [Unreleased]

## [0.6.0] - 2026-07-19

### Added

- Self-contained HTML export: `--export-html` on the main command and a standalone `export <file>` subcommand, with repeatable themes. Pages are server-rendered, so exported and served content is readable with JavaScript disabled (JS only adds optional voting/collapse); offline, no network requests
- Project-specific browser titles (`<Project Name> — reddit-scrutinizer`) for every served and exported theme
- `--verbose` progress details for scan results, selected code reads, stage timings, comment batches, output files, and UI startup
- `completions <shell>` generation for Bash, Zsh, Fish, and PowerShell
- Oxfmt, Oxlint, EditorConfig, isolated tests, coverage reporting, and a single `bun run check` command
- Real CLI parsing tests, progress reporter tests, batch progress tests, and empty-batch protection

### Changed

- AI plumbing now uses the Vercel AI SDK Anthropic provider and its model capability handling
- CLI help, examples, numeric validation, and option ordering now match actual behavior
- Generation writes JSON and exits by default; `--open` explicitly starts the UI server and browser
- TypeScript now typechecks source and tests with stricter Bun-oriented settings
- Tool versions in generated output come from `package.json`
- The browser UI is now server-rendered with Preact instead of a client-side SPA; `serve` and `export` share one deterministic render path (no more `/api/data` route or embedded-data client bootstrap)
- Upgraded commander (15), marked (18), zod (4), and typescript (7); added preact + preact-render-to-string
- CI uses current action majors (`actions/checkout@v7`, `actions/setup-node@v7`, `oven-sh/setup-bun@v2`) with read-only permissions and a Node 24/26 package-smoke matrix

### Fixed

- New Anthropic models no longer fail when they reject the `temperature` parameter
- Comment generation now trims oversized AI batches and fails clearly for empty or undersized batches

## [0.5.0] - 2026-02-20

### Added

- Twitter, Bluesky, and QDB browser themes
- Project website with an interactive command builder, favicon, and social preview image
- `--api-key` CLI option as an alternative to `ANTHROPIC_API_KEY`
- `AGENTS.md` architecture and development guide

### Changed

- Large comment requests are split into batches with automatically scaled output-token limits
- Website command builder includes all available themes

### Fixed

- Large comment generations no longer fail when a single response reaches the output-token limit

## [0.4.1] - 2026-02-16

### Added

- GitHub Actions workflow that creates a GitHub release when a version tag is pushed
- Eight-stage pipeline documentation and Mermaid flowchart in the README

## [0.4.0] - 2026-02-16

### Added

- **UI themes** — `--theme` flag to switch between `reddit` (default), `hackernews`, and `producthunt` visual styles
- **Hacker News template** — orange header, Verdana font, beige background, classic HN threaded layout at 85% width
- **Product Hunt template** — upvote box, maker badges, tech stack sidebar, clean modern design
- **GitHub Actions CI** — runs `bun test` and `bun run typecheck` on push and PR
- Template files extracted from inline HTML to `src/ui/templates/` directory
- `--theme` flag on both main command and `serve` subcommand
- 19 new tests for theme support (template files, server themes, CLI validation)

### Changed

- UI server reads templates from `src/ui/templates/{theme}.html` instead of inline HTML
- Total test count: 160 (up from 141)

## [0.3.0] - 2026-02-16

### Added

- **npm/npx support** — works without bun installed globally; bun runtime is bundled as a dependency
- Node.js wrapper (`bin/cli.mjs`) auto-detects bundled or global bun, with a friendly error if neither is found
- CLI option parsing tests and serve subcommand integration tests
- Test fixture for server tests (`sample-scrutiny.json`)

### Fixed

- `--port` flag on `serve` subcommand was silently ignored — raw `parseInt` received Commander's default value as radix, producing `NaN`
- CLI version is now read dynamically from `package.json` instead of being hardcoded

### Changed

- Primary install method is now `npm install -g` / `npx` (bun still supported)
- Updated available subreddits list in README (22 total)

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
