# reddit-scrutinizer

Simulate Reddit reactions to your codebase before you post. Uses Claude to generate realistic community feedback in the voice of any subreddit.

## Install

```bash
bun install
```

## Usage

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Scan a project and simulate r/rust feedback
bunx reddit-scrutinizer . --subreddit=rust

# More options
bunx reddit-scrutinizer . --subreddit=lisp --comments=60 --style=snarky --open

# View a previous result
bunx reddit-scrutinizer serve ./reddit-scrutiny.json --open
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--subreddit` | `programming` | Target subreddit voice |
| `--comments` | `40` | Number of comments to generate |
| `--max-depth` | `4` | Max reply nesting depth |
| `--max-replies` | `3` | Number of OP replies |
| `--style` | `balanced` | balanced, snarky, supportive, hostile |
| `--model` | `claude-sonnet-4-20250514` | Anthropic model |
| `--out` | `./reddit-scrutiny.json` | Output file path |
| `--open` | `false` | Auto-open browser |
| `--port` | `3000` | UI server port |
| `--no-ui` | `false` | Skip web UI |
| `--temperature` | `0.8` | Generation temperature |
