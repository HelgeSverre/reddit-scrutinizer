# AGENTS.md

## Project overview

reddit-scrutinizer is a CLI tool that simulates Reddit reactions to a codebase. It scans a project, then uses Claude (Anthropic API) to generate a realistic Reddit post, critique themes, and threaded comments as if the project were posted to a specific subreddit.

Runtime: Bun. Language: TypeScript (strict). Package manager: bun. Test runner: `bun test`.

## Commands

```bash
bun run dev          # run src/index.ts directly
bun test             # run all tests
bun run typecheck    # tsc --noEmit
```

## Architecture

Entry point: `src/index.ts` orchestrates the full pipeline. CLI parsing: `src/cli.ts` (Commander).

### Directory structure

```
src/
  cli.ts              CLI definition (Commander)
  index.ts            Main pipeline orchestration
  scan/
    walk.ts            Directory walker (respects .gitignore, skips binaries)
    detect.ts          Language, stack, license, test detection
    dossier.ts         Builds ProjectDossier from scan results
    snippets.ts        File index, risk pattern scanning, snippet reading
  ai/
    client.ts          Anthropic SDK wrapper, generateJSON with structured output fallback
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
  ui/
    server.ts          Bun.serve for the browser UI
    templates/         HTML templates per theme (reddit, hackernews, producthunt)
bin/
  cli.mjs            Node shim that finds bun and runs src/index.ts
test/
  e2e.test.ts        Full pipeline test with mocked LLM (mock.module)
  fixtures/          Sample project and fixture AI responses
  ai/                Unit tests for AI modules
  scan/              Unit tests for scan modules
  output/            Unit tests for output modules
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

All AI calls go through `generateJSON()` in `ai/client.ts`. It tries structured output (JSON schema via `output_config`) first, falls back to prompt-based JSON parsing if the model doesn't support it. All responses are validated with Zod schemas.

### Vibe packs

Each subreddit has a JSON file in `src/ai/vibes/` defining tone, pet_topics, taboos, archetypes (with frequencies), common_flairs, and typical_replies. If a subreddit doesn't have a vibe pack, a generic fallback is used. To add a new subreddit, create a new JSON file following the existing format.

### Seeded RNG

Scores and timestamps use a Mulberry32 PRNG seeded from the `--seed` flag (or `Date.now()`). This makes runs reproducible with the same seed.

## Conventions

- All AI generation functions follow the same signature pattern: `(client, dossier, vibePack, ...extras, options) => Promise<T>`
- Zod schemas are defined alongside the interfaces they validate
- The `GenerateOptions` type (`model` + `temperature`) is passed through to all AI calls
- Tests mock the AI layer via `mock.module("../src/ai/client")` -- the mock returns fixture data
- Comment styles are defined in `STYLE_DESCRIPTIONS` in generate-comments.ts: balanced, snarky, supportive, hostile, roast, scrutiny, fanboy, slop
- The CLI exposes fewer styles than the code supports (balanced, snarky, supportive, hostile)
- Output schema version is "1.0", tool version is tracked in package.json
