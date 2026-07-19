# reddit-scrutinizer — Design Spec

**Date:** 2026-02-16
**Status:** Draft

## Overview

A CLI tool that scans any codebase and uses Claude to generate a realistic simulated Reddit thread — complete with an "I made this" announcement post and dozens of community comments matching the culture/vibe of a target subreddit. Outputs structured JSON and serves a pixel-perfect Reddit dark-mode web UI.

**Why it's useful:** Anticipate real community criticism before launching. In a prior experiment with the Sema language project, a simulated Reddit thread generated 305 comments across r/lisp and r/programming. An audit found ~40% of the criticisms were valid real issues in the codebase. This is a genuine pre-launch stress test.

## Tech Stack

| Component    | Choice                 | Rationale                             |
| ------------ | ---------------------- | ------------------------------------- |
| Runtime      | Bun                    | Fast, native TS, built-in HTTP server |
| Language     | TypeScript             | Type safety, good DX                  |
| CLI parsing  | commander              | Lightweight, clap-like                |
| AI provider  | Anthropic Claude (MVP) | Best structured output quality        |
| AI SDK       | @anthropic-ai/sdk      | Official client                       |
| Validation   | zod                    | Validate model JSON output            |
| Markdown     | marked                 | Convert comment markdown to HTML      |
| UI           | Single HTML file       | No build step, no framework           |
| Distribution | npm package            | `bin` entry for global install        |

## CLI Interface

### Primary command

```bash
reddit-scrutinizer <path> [options]
```

### Options

| Flag            | Type    | Default                      | Description                                            |
| --------------- | ------- | ---------------------------- | ------------------------------------------------------ |
| `--subreddit`   | string  | `"programming"`              | Target subreddit voice (rust, lisp, programming, etc.) |
| `--comments`    | number  | `40`                         | Target number of community comments                    |
| `--max-depth`   | number  | `4`                          | Maximum reply nesting depth                            |
| `--max-replies` | number  | `3`                          | Number of OP (author) replies to generate              |
| `--style`       | enum    | `"balanced"`                 | balanced \| snarky \| supportive \| hostile            |
| `--model`       | string  | `"claude-sonnet-4-20250514"` | Anthropic model to use                                 |
| `--out`         | string  | `"./reddit-scrutiny.json"`   | Output JSON path                                       |
| `--open`        | boolean | `false`                      | Auto-open browser after generation                     |
| `--port`        | number  | `3000`                       | Web UI server port                                     |
| `--no-ui`       | boolean | `false`                      | Skip serving the web UI                                |
| `--temperature` | number  | `0.8`                        | Generation temperature                                 |
| `--seed`        | number  | auto                         | Seed for deterministic usernames/scores                |

### Serve command (view previously generated files)

```bash
reddit-scrutinizer serve <file.json> [--port 3000] [--open]
```

### Examples

```bash
# Scan current directory, simulate r/rust feedback
reddit-scrutinizer . --subreddit=rust --comments=60

# Quick hostile review
reddit-scrutinizer ~/code/myapp --subreddit=programming --style=hostile --comments=20

# Generate and auto-open
reddit-scrutinizer . --subreddit=lisp --open

# Just JSON, no UI
reddit-scrutinizer . --subreddit=typescript --no-ui --out=./feedback.json

# View a previous result
reddit-scrutinizer serve ./reddit-scrutiny.json --open
```

## JSON Output Schema

Single file containing metadata, project dossier, and the full simulation.

Comments use a **flat list with `parent_id` pointers** (easier for Claude to generate reliably; UI rebuilds the tree client-side).

```typescript
interface ScrutinyOutput {
  schema_version: "1.0";
  generated_at: string; // ISO timestamp
  tool: { name: "reddit-scrutinizer"; version: string };

  input: {
    path: string;
    subreddit: string;
    model: string;
    comments: number;
    max_depth: number;
    max_replies: number;
    style: string;
    seed: number | null;
  };

  project: {
    name: string;
    tagline: string;
    languages: { name: string; pct: number }[];
    stack: string[];
    facts: {
      has_tests: boolean;
      has_ci: boolean;
      license: string | null;
      files_scanned: number;
      readme_excerpt: string;
    };
  };

  simulation: {
    subreddit: {
      name: string; // "rust"
      display: string; // "r/rust"
    };
    post: Post;
    comments: Comment[]; // flat list
  };
}

interface Post {
  id: string; // "t3_abc123"
  title: string;
  body_md: string;
  body_html: string;
  author: string;
  author_flair: string | null;
  post_flair: string | null;
  score: number;
  upvote_ratio: number;
  created_utc: number;
  awards: { icon: string; label: string; count: number }[];
}

interface Comment {
  id: string; // "t1_cmt001"
  parent_id: string; // "t3_abc123" or "t1_cmt00X"
  author: string;
  author_flair: string | null;
  is_op: boolean;
  body_md: string;
  body_html: string;
  score: number;
  controversiality: number; // 0 or 1
  created_utc: number;
  depth: number;
  is_deleted: boolean;
}
```

## AI Prompting Architecture

### Pipeline

```
[1] Scan codebase (local)
        ↓
[2] Build project dossier (local)
        ↓
[3] Generate post (Claude Call A)
        ↓
[4] Generate critique agenda (Claude Call B)
        ↓
[5] Generate comments (Claude Call C, using post + agenda)
        ↓
[6] Post-process: assign scores, timestamps, convert markdown → HTML
        ↓
[7] Write JSON + serve UI
```

### Stage 1: Codebase Scan (local, no AI)

- Walk files respecting `.gitignore`
- Detect languages by extension, count lines
- Identify build system, framework, dependencies
- Extract: README (first 2000 chars), package manifest, main entrypoints
- Select 10-15 representative code excerpts (prioritize: parser, evaluator, CLI, core logic, tests)
- Budget: cap at ~2MB of sampled text total

### Stage 2: Project Dossier (local, no AI)

Structured summary passed to all AI calls:

```typescript
interface ProjectDossier {
  name: string;
  description: string;
  languages: { name: string; pct: number; lines: number }[];
  build_system: string | null;
  framework: string | null;
  dependencies: string[]; // top 20 by importance
  has_tests: boolean;
  has_ci: boolean;
  has_docs: boolean;
  license: string | null;
  readme: string; // truncated
  file_tree: string; // abbreviated directory listing
  excerpts: { path: string; content: string; why: string }[];
}
```

### Stage 3: Subreddit Vibe Packs (bundled data)

Ship ~10 built-in packs as JSON files. Unknown subreddits: Claude infers the vibe from the name.

```json
{
  "subreddit": "rust",
  "tone": ["technical", "direct", "earnest", "occasionally snarky"],
  "pet_topics": ["safety", "performance", "error handling", "docs", "benchmarks", "unsafe"],
  "taboos": ["don't invent unstable features", "avoid excessive memes"],
  "archetypes": [
    { "type": "perf-nerd", "frequency": 0.15 },
    { "type": "safety-evangelist", "frequency": 0.15 },
    { "type": "docs-stickler", "frequency": 0.1 },
    { "type": "friendly-helper", "frequency": 0.2 },
    { "type": "skeptic", "frequency": 0.15 },
    { "type": "pedant", "frequency": 0.1 },
    { "type": "newbie", "frequency": 0.1 },
    { "type": "troll", "frequency": 0.05 }
  ],
  "common_flairs": ["Project", "Discussion", "Help", "Blog Post"],
  "typical_replies": [
    "have you considered using X crate?",
    "why not use iterators here?",
    "this needs more documentation"
  ]
}
```

Built-in vibes: `rust`, `lisp`, `programming`, `typescript`, `javascript`, `golang`, `python`, `cpp`, `webdev`, `haskell`.

### Stage 4: AI Calls

#### Call A — Generate Post

- **System prompt:** "You are a developer posting your project to r/{subreddit}."
- **Input:** project dossier + vibe pack
- **Output:** `{ title, body_md }` — the announcement post
- **Guidance:** Write an authentic "I made this" post. Include what it does, why you built it, what's interesting technically, and invite feedback.

#### Call B — Generate Critique Agenda

- **System prompt:** "You are analyzing what r/{subreddit} would say about this project."
- **Input:** dossier + vibe pack + generated post
- **Output:** List of 8-15 critique themes, each with:
  - topic (e.g., "Performance", "Naming conventions")
  - stance distribution (e.g., "skeptical: 3, supportive: 1, neutral: 1")
  - specific angles to explore
- **Purpose:** Ensures diverse comment distribution; prevents 40 comments all saying the same thing.

#### Call C — Generate Comments

- **System prompt:** "You are simulating Reddit comments for r/{subreddit}."
- **Input:** post + agenda + dossier + constraints
- **Output:** Flat JSON array of comments with `parent_id` pointers
- **Constraints provided:**
  - Target N top-level comments
  - Max depth M
  - Include up to K replies from OP (with `is_op: true`)
  - Mix of sentiment per the agenda
  - Include some misunderstandings, one mild argument thread
  - Include 0-2 deleted comments with quote-bot replies
  - Generate realistic usernames with optional flairs
- **Output format:** JSON only, validated with zod

### Stage 5: Post-Processing (local, no AI)

After Claude returns raw content:

1. **Assign scores** — seeded PRNG, log-normal distribution (top comments: 50-200, deeper replies: 1-30, controversial: negative)
2. **Assign timestamps** — cascade from post time, top-level first (minutes apart), replies within hours
3. **Convert markdown to HTML** — using `marked` library
4. **Validate parent_id references** — ensure tree is well-formed
5. **Auto-repair** — fix minor issues (missing fields, orphaned comments get reparented to post)

## Web UI

### Architecture

Single HTML file (`template.html`) with embedded CSS and JS. No build step, no framework.

### Rendering

- `Bun.serve()` exposes `/api/data` → returns the JSON file
- `app.js` fetches data, builds comment tree from flat list using `parent_id` grouping
- Recursive `renderComment()` with depth-based left-border indentation
- Reddit dark mode theme via CSS variables

### Visual Components

- **Top nav:** Reddit-style header bar
- **Subreddit header:** r/{name}, member count, description
- **Post card:** title, flair, author, timestamp, score, awards, body
- **Comment section:** threaded comments with:
  - Vote arrows (interactive, client-side only)
  - Author + flair + OP badge
  - Relative timestamps ("3 hours ago")
  - Collapse/expand threads
  - Action row (reply, share, report — cosmetic)
  - Controversial marker for negative-score comments
- **Data model supports tabs** for future multi-subreddit (MVP renders one)

### CSS Theme

```css
:root {
  --bg: #030303;
  --surface: #1a1a1b;
  --border: #343536;
  --text: #d7dadc;
  --text-muted: #818384;
  --accent: #ff4500;
  --upvote: #ff4500;
  --downvote: #7193ff;
  --op-badge: #0079d3;
  --comment-line: #343536;
}
```

## Project Structure

```
reddit-scrutinizer/
├── src/
│   ├── index.ts              # CLI entrypoint
│   ├── cli.ts                # commander setup
│   ├── scan/
│   │   ├── walk.ts           # file enumeration + .gitignore
│   │   ├── detect.ts         # language/framework detection
│   │   └── dossier.ts        # build project summary
│   ├── ai/
│   │   ├── client.ts         # Anthropic SDK wrapper
│   │   ├── generate-post.ts
│   │   ├── generate-agenda.ts
│   │   ├── generate-comments.ts
│   │   └── vibes/            # subreddit vibe packs
│   │       ├── rust.json
│   │       ├── lisp.json
│   │       ├── programming.json
│   │       ├── typescript.json
│   │       ├── javascript.json
│   │       ├── golang.json
│   │       ├── python.json
│   │       ├── cpp.json
│   │       ├── webdev.json
│   │       └── haskell.json
│   ├── output/
│   │   ├── schema.ts         # zod schemas + types
│   │   ├── scores.ts         # seeded PRNG score/timestamp assignment
│   │   ├── markdown.ts       # md → HTML conversion
│   │   └── write.ts          # write JSON to disk
│   └── ui/
│       ├── server.ts         # Bun.serve() wrapper
│       └── template.html     # single-file Reddit UI
├── docs/
│   └── plans/
│       └── 2026-02-16-reddit-scrutinizer-design.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Dependencies (MVP)

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "commander": "^12.0.0",
    "zod": "^3.23.0",
    "marked": "^15.0.0",
    "ignore": "^7.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

## MVP Scope

### In scope

- Single subreddit per invocation
- Claude-only provider
- 10 built-in vibe packs
- 3-call pipeline (post → agenda → comments)
- OP replies (configurable, default 3)
- Flat JSON output with post-processed scores/timestamps
- Reddit dark-mode web UI
- `serve` command for viewing old results

### Out of scope (future)

- Multiple providers (OpenAI, etc.)
- Multiple subreddits per run
- Caching/incremental generation
- HN/Lobsters/other forum styles
- Interactive "reply as OP" mode
- Critique audit (auto-validate criticisms against codebase)
- Custom vibe pack files
- CI integration

## Implementation Order

1. **Scaffold** — package.json, tsconfig, directory structure
2. **Schema** — zod types for all data models
3. **Scanner** — file walk, language detection, dossier builder
4. **AI pipeline** — client wrapper, post/agenda/comments generation
5. **Post-processing** — scores, timestamps, markdown → HTML
6. **CLI** — commander setup, wire pipeline together
7. **Web UI** — Reddit template HTML/CSS/JS
8. **Server** — Bun.serve() for serving UI + data
9. **Polish** — error handling, progress output, README
