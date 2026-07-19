# Batch CLI reliability and shell completions

Status: Approved for implementation

## Purpose

Make generated scrutiny runs safe to use in shell scripts, tolerate excess comments from the model, and provide shell completions without adding a runtime dependency.

## CLI behavior

The main command writes its JSON output and exits unless the user passes `--open`. With `--open`, it starts the UI server and opens the result in the browser. The `--no-ui` option is removed.

The `serve <file>` subcommand remains independent. It always starts the UI server; its `--open` option controls only whether the browser opens.

This produces three explicit paths:

```text
reddit-scrutinizer <project>             generate, write JSON, exit
reddit-scrutinizer <project> --open      generate, serve, open browser
reddit-scrutinizer serve <file> [--open] serve existing output, optionally open browser
```

## Comment batch normalization

Model output is untrusted even when the prompt requests an exact array length. Each non-empty batch is normalized before global ID remapping and parent repair:

- An oversized batch is truncated to the requested batch size.
- An undersized batch remains an error rather than silently returning fewer comments.
- An empty batch retains its specific no-comments error.

Progress totals report the accepted comments, so a successful run always returns exactly the requested total.

## Shell completions

Add `reddit-scrutinizer completions <shell>` for `bash`, `zsh`, `fish`, and `powershell`. The command prints a script to stdout and never modifies shell configuration.

The implementation follows the neighboring `namecheap-cli` and `observe-llm` pattern:

- Build a shell-neutral completion model from the Commander command tree.
- Keep one renderer per shell.
- Include subcommands, flags, option choices, subreddit suggestions, shell names, file arguments, and directory arguments.
- Derive supported subreddit suggestions from the bundled vibe packs while still allowing unknown subreddit names at runtime.

README examples show how to evaluate or install the generated output for each shell. The changelog records completion support, the new opt-in UI behavior, and oversized-batch recovery.

## Testing

Regression tests cover:

- Main-command defaults, `--open`, and rejection of removed `--no-ui`.
- Unchanged `serve` behavior with and without `--open`.
- Truncation of oversized single and continuation batches, including exact progress totals.
- Existing failures for empty and undersized batches.
- Completion command parsing and recognizable output for all four shells.
- Completion coverage for current subcommands, flags, choices, and path hints.

The complete formatting, linting, type-checking, and isolated test suite must pass before completion.

## Non-goals

- Installing or uninstalling completion files.
- Retrying or filling undersized AI batches.
- Preserving compatibility for `--no-ui`.
- Changing the `serve` subcommand lifecycle.
