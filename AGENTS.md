# AGENTS.md

## Project overview

reddit-scrutinizer is a CLI tool that simulates Reddit reactions to a codebase. It scans a project, then uses Claude (Anthropic API) to generate a realistic Reddit post, critique themes, and threaded comments as if the project were posted to a specific subreddit.

Runtime: Bun. Language: TypeScript (strict). Package manager: bun. Formatter: Oxfmt. Linter: Oxlint. Test runner: `bun test --isolate`.

## Commands

```bash
bun run dev             # run src/index.ts directly
bun test                # run isolated tests
bun run test:coverage   # run tests with a coverage report
bun run format          # format all supported files with Oxfmt
bun run lint            # run Oxlint; warnings fail the command
bun run typecheck       # typecheck source and tests
bun run check           # run the complete CI check
```

## Architecture

Entry point: `src/index.ts` orchestrates the full pipeline. CLI parsing: `src/cli.ts` (Commander).

### Directory structure

```
src/
  cli.ts              CLI definition (Commander)
  index.ts            Main pipeline orchestration
  progress.ts         Default and verbose progress reporting
  version.ts          Tool version sourced from package.json
  scan/
    walk.ts            Directory walker (respects .gitignore, skips binaries)
    detect.ts          Language, stack, license, test detection
    dossier.ts         Builds ProjectDossier from scan results
    snippets.ts        File index, risk pattern scanning, snippet reading
  ai/
    client.ts          Vercel AI SDK wrapper for Anthropic structured output
    load-vibe.ts       Loads subreddit vibe packs from vibes/ directory
    discover.ts        AI-driven code discovery (planDiscovery + synthesizeEvidence)
    generate-post.ts   Generates the Reddit post
    generate-agenda.ts Generates critique themes/agenda
    generate-comments.ts Generates threaded comment tree
    vibes/             22 subreddit JSON files defining tone, archetypes, pet topics
  output/
    schema.ts          Zod schemas for ScrutinyOutput (the JSON output format)
    scores.ts          Seeded RNG for comment scores and timestamps
    markdown.ts        Markdown to HTML via marked
    write.ts           Assembles and writes final JSON output
    export-html.ts     Self-contained HTML export (parse, theme resolve, render, atomic write)
  ui/
    server.ts          Bun.serve for the browser UI
    templates/         HTML templates for all six UI themes (embedded export data or /api/data; project title)
bin/
  cli.mjs            Node shim that finds bun and runs src/index.ts
test/
  e2e.test.ts        Full pipeline test with a mocked Vercel AI SDK boundary
  export-command.test.ts Export subcommand integration test
  fixtures/          Sample project and fixture AI responses
  ai/                Unit tests for AI modules (incl. zod-schema.test.ts: Zod-through-AI-SDK boundary)
  scan/              Unit tests for scan modules
  output/            Unit tests for output modules (incl. export-html.test.ts)
```

### Pipeline (8 steps, 5 AI calls)

1. **Scan** -- `buildDossier()` walks the project, detects languages/stack/license, selects key file excerpts. No AI.
2. **Discover** -- `buildFileIndex()` + `scanRiskPatterns()` builds a classified file index and scans for risk patterns (eval, innerHTML, TODO/FIXME, as any, etc). No AI.
3. **Plan** -- `planDiscovery()` (AI call 1) asks Claude to pick up to 12 high-leverage code regions to read.
4. **Synthesize** -- `synthesizeEvidence()` (AI call 2) reads the snippets and produces an EvidencePack (strengths, risks, comment ammo, citations).
5. **Post** -- `generatePost()` (AI call 3) generates a realistic Reddit submission.
6. **Agenda** -- `generateAgenda()` (AI call 4) generates 8-15 critique themes with stances, grounded in evidence.
7. **Comments** -- `generateComments()` (AI call 5) generates the full threaded comment tree.
8. **Output** -- `assembleOutput()` assigns seeded scores/timestamps, renders markdown to HTML, writes JSON. Optionally starts a Bun HTTP server for the browser UI.

### Key types

- `ProjectDossier` (scan/dossier.ts) -- project metadata, languages, stack, excerpts, file tree
- `EvidencePack` (ai/discover.ts) -- strengths, risks, comment ammo, citations from code analysis
- `GeneratedPost` (ai/generate-post.ts) -- title, body, author, flairs
- `AgendaItem` (ai/generate-agenda.ts) -- topic, stance, angle, suggested comment count
- `GeneratedComment` (ai/generate-comments.ts) -- id, parent_id, author, body, depth, is_op
- `ScrutinyOutput` (output/schema.ts) -- the full JSON output validated by Zod

### AI client pattern

All AI calls go through `generateJSON()` in `ai/client.ts`. It uses Vercel AI SDK `generateText()` with `Output.object()` and the Anthropic provider, validating every response against a Zod schema. The provider handles model capabilities, structured-output selection, retries, and unsupported-setting warnings such as `temperature` on Claude Sonnet 5.

### HTML export

`output/export-html.ts` parses and validates scrutiny JSON with `ScrutinyOutputSchema`, resolves themes and output paths, renders a template with embedded script-safe JSON and an HTML-escaped project title, and writes each file atomically (temp file + rename). It is reused by the main command's `--export-html` flag and the `export <file>` subcommand. The `export` subcommand never starts or opens a server. Completions are generated from the Commander tree, so `export`, `--export-html`, and `--export-theme` appear automatically.

### Progress reporting

All pipeline output goes through `createProgressReporter()` in `progress.ts`. Normal mode shows eight numbered stages. `--verbose` adds safe configuration, counts, selected reads, timings, and comment-batch events. Never log API keys, prompts, snippet contents, or raw model responses.

### Vibe packs

Each subreddit has a JSON file in `src/ai/vibes/` defining tone, pet_topics, taboos, archetypes (with frequencies), common_flairs, and typical_replies. If a subreddit doesn't have a vibe pack, a generic fallback is used. To add a new subreddit, create a new JSON file following the existing format.

### Seeded RNG

Scores and timestamps use a Mulberry32 PRNG seeded from the `--seed` flag (or `Date.now()`). This makes runs reproducible with the same seed.

## Conventions

- All AI generation functions follow the same signature pattern: `(client, dossier, vibePack, ...extras, options) => Promise<T>`
- Zod schemas are defined alongside the interfaces they validate
- The `GenerateOptions` type (`model` + `temperature`) is passed through to all AI calls
- Tests run with Bun isolation and mock the Vercel AI SDK through `test/fixtures/ai-sdk-mock.ts`
- CLI tests instantiate the real Commander definition through `createProgram()`
- Format the repository with Oxfmt; do not hand-format around it
- Comment styles are defined in `STYLE_DESCRIPTIONS` in generate-comments.ts: balanced, snarky, supportive, hostile, roast, scrutiny, fanboy, slop
- The CLI exposes fewer styles than the code supports (balanced, snarky, supportive, hostile)
- Output schema version is "1.0", tool version is tracked in package.json
