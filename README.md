# reddit-scrutinizer

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Claude API](https://img.shields.io/badge/AI-Claude%20API-cc785c?logo=anthropic)](https://docs.anthropic.com)

Simulate Reddit reactions to your codebase before you post. Uses Claude to generate realistic community feedback in the voice of any subreddit.

## How it works

1. **Scan** — walks your project, detects languages/stack, reads key files
2. **Post** — generates a realistic Reddit submission as if you posted your project
3. **Agenda** — analyzes critique themes the community would focus on
4. **Comments** — generates a threaded comment tree with votes, flairs, awards, and OP replies
5. **Output** — writes structured JSON and optionally opens a browser UI

## Install

```bash
bun install
```

## Usage

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Scan a project and simulate r/rust feedback
bunx reddit-scrutinizer ./my-project --subreddit rust

# Snarky r/programming with 60 comments, auto-open browser
bunx reddit-scrutinizer ./my-project --subreddit programming --comments 60 --style snarky --open

# Reproducible run with a fixed seed
bunx reddit-scrutinizer ./my-project --subreddit typescript --seed 42

# View a previous result
bunx reddit-scrutinizer serve ./reddit-scrutiny.json --open
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--subreddit <name>` | `programming` | Target subreddit voice |
| `--comments <n>` | `40` | Number of comments to generate |
| `--max-depth <n>` | `4` | Max reply nesting depth |
| `--max-replies <n>` | `3` | Number of OP replies |
| `--style <mode>` | `balanced` | `balanced`, `snarky`, `supportive`, `hostile` |
| `--model <name>` | `claude-sonnet-4-20250514` | Anthropic model |
| `--out <file>` | `./reddit-scrutiny.json` | Output file path |
| `--open` | `false` | Auto-open browser |
| `--port <n>` | `3000` | UI server port |
| `--no-ui` | — | Skip web UI |
| `--temperature <n>` | `0.8` | Generation temperature |
| `--seed <n>` | — | Random seed for reproducibility |

## Available subreddits

Each subreddit has its own vibe pack defining tone, pet topics, taboos, commenter archetypes, and typical replies.

`cpp` · `golang` · `haskell` · `javascript` · `lisp` · `programming` · `python` · `rust` · `typescript` · `webdev`

## Serve command

View results from a previous run without re-generating:

```bash
bunx reddit-scrutinizer serve ./reddit-scrutiny.json --port 3000 --open
```
