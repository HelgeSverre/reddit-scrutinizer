# Self-contained HTML export and 0.6.0 release modernization

Status: Approved design; awaiting written-spec review

## Purpose

Let users save any scrutiny as a self-contained HTML file without starting a server, give every UI the project-specific browser title, and finish the 0.6.0 release on current dependencies and CI actions.

## CLI behavior

The main command gains `--export-html`. It continues to write JSON first, then writes HTML next to that JSON before optionally starting the UI server.

```text
reddit-scrutinizer <project> --export-html
reddit-scrutinizer <project> --export-html --export-theme reddit --export-theme hackernews
reddit-scrutinizer <project> --export-html --open
```

`--export-theme <theme>` is repeatable and valid only with `--export-html`. With no `--export-theme`, the export uses the existing `--theme` value. Explicit export themes replace that default; they do not add to it. Duplicate themes are collapsed while preserving their first occurrence.

The `export <file>` subcommand generates HTML from an existing scrutiny JSON file. It never starts a server or opens a browser.

```text
reddit-scrutinizer export <file>
reddit-scrutinizer export <file> --theme qdb
reddit-scrutinizer export <file> --theme reddit --theme hackernews -o demo.html
```

The subcommand accepts repeatable `--theme <theme>` and defaults to `reddit`. Its `-o, --output <file>` option sets the output base. An output without an `.html` extension receives one.

The existing server behavior is unchanged:

```text
reddit-scrutinizer <project> --open       generate, serve, and open
reddit-scrutinizer serve <file>           serve without opening
reddit-scrutinizer serve <file> --open    serve and open
```

## Output naming

One theme uses the unsuffixed HTML name. Multiple themes suffix every output with its theme:

```text
scrutiny.json + one theme                 -> scrutiny.html
scrutiny.json + reddit,hackernews         -> scrutiny-reddit.html
                                             scrutiny-hackernews.html
export scrutiny.json -o demo.html         -> demo.html
export scrutiny.json -o demo.html \
  --theme reddit --theme qdb              -> demo-reddit.html
                                             demo-qdb.html
```

The main command derives the HTML path from the final JSON path selected by `--out`. The export subcommand derives it from the input JSON unless `--output` is present.

## Export architecture

A focused output module owns four operations:

1. Parse and validate a JSON document with `ScrutinyOutputSchema`.
2. Resolve and validate themes and output paths.
3. Render a selected UI template with embedded scrutiny data and a project-specific title.
4. Write each HTML file atomically through a temporary file and rename.

All JSON, themes, paths, and rendered documents are prepared before the first final output is replaced. Validation or rendering errors therefore leave every destination untouched. Each individual file write is atomic; an operating-system failure during a multi-file rename can still leave a subset updated.

Exported pages contain their CSS, JavaScript, and data in one document and make no network requests. A template data loader first checks for an embedded `application/json` script and falls back to `/api/data`, allowing the same six templates to support both exported files and the existing server.

Embedded JSON is serialized as script-safe text. The exporter escapes `<`, U+2028, and U+2029 before insertion, preventing project content such as `</script>` from ending the data element or becoming executable source. Project names are HTML-escaped before insertion into `<title>`.

Like the current `serve` command, `export` treats local scrutiny JSON as trusted input. The renderer does not sanitize the existing `body_html` fields in 0.6.0. Documentation will warn users not to serve or open scrutiny JSON from an untrusted source.

## Document titles

Every served and exported theme uses this browser title after its data is available:

```text
<Project Name> — reddit-scrutinizer
```

The templates retain `reddit-scrutinizer` as the loading and error fallback. Export rendering also writes the project-specific title directly into the document so it is correct before JavaScript runs.

## Errors and command output

The commands exit non-zero with a concise error when:

- the input is not readable JSON;
- the JSON does not match `ScrutinyOutputSchema`;
- a theme is unknown;
- `--export-theme` is supplied without `--export-html`;
- an output directory cannot be created; or
- an HTML file cannot be written.

Successful export commands print every written path. Normal main-command progress reports HTML exports without dumping the document or embedded data. No command logs API keys, prompts, snippets, or raw model responses.

## Dependency upgrades

The 0.6.0 dependency refresh upgrades:

| Package      | From    | To     | Expected migration                                                                                |
| ------------ | ------- | ------ | ------------------------------------------------------------------------------------------------- |
| `commander`  | 13.1.0  | 15.0.0 | ESM-compatible package update; verify CLI and completion introspection                            |
| `marked`     | 15.0.12 | 18.0.6 | Parser API remains compatible; verify Markdown regression cases                                   |
| `zod`        | 3.25.76 | 4.4.3  | Existing schema primitives are compatible; verify AI SDK schema conversion                        |
| `typescript` | 5.9.3   | 7.0.2  | The repository only uses `tsc --noEmit`; the current configuration already avoids removed options |

Commander 15's Node requirement does not replace the Bun runtime requirement: the installed Node shim locates Bun, and the TypeScript source still executes under Bun. The lockfile is regenerated with Bun.

The migration keeps the current APIs unless the upgraded types or tests demonstrate a necessary change. It does not combine the upgrade with unrelated refactoring.

## Continuous integration

CI uses the current major releases:

- `actions/checkout@v7` in CI and release workflows;
- `actions/setup-node@v7`;
- `oven-sh/setup-bun@v2`.

The quality job installs the frozen Bun lockfile and runs `bun run check`. A package-smoke matrix covers Node 24 LTS and Node 26 Current. Node 26 is included for forward compatibility and is not described as LTS.

Each matrix entry packs the npm artifact, installs it in a temporary project, and exercises the installed `reddit-scrutinizer` binary through its Node shim. The smoke test checks version output, help, shell-completion generation, and HTML export from a fixture. CI receives read-only repository permissions.

## Documentation and completions

The release updates:

- README command reference, export examples, filename rules, trusted-input warning, and completion instructions;
- the 0.6.0 changelog section for export, titles, dependencies, and CI;
- AGENTS.md architecture, `GenerateOptions`, completion layout, export behavior, and tests;
- on-demand Bash, Zsh, Fish, and PowerShell completion output for the new command and flags;
- CLI help for all new options and the `export` subcommand.

Historical changelog entries remain historical and are not rewritten to match current behavior.

## Testing

Implementation starts with failing tests for:

- main-command and export-subcommand parsing, defaults, repeatable themes, and invalid option combinations;
- one-theme and multiple-theme output naming, including `--out` and `--output`;
- schema validation before writes and clear malformed-input errors;
- script-safe JSON embedding, HTML-escaped titles, and offline data loading;
- all six themes using the project-specific title and embedded-data fallback;
- main-command export with and without `--open`;
- export-subcommand behavior that never starts or opens a server;
- completion coverage for the new command, file argument, flags, and theme choices;
- Markdown behavior affected by the Marked upgrade;
- Zod 4 conversion through the real AI SDK structured-output boundary;
- the packed npm artifact under the supported CI matrix.

The complete formatter, linter, TypeScript 7 type-check, isolated test suite, coverage run, completion syntax checks, and package smoke tests must pass before release preparation is complete.

## Release boundary

The repository remains on `main`, as requested. Work is committed in reviewable chunks on top of the existing commits. This work prepares version 0.6.0 but does not create a tag, publish the npm package, or create a GitHub release. The user will run a weird-project demo before authorizing publication.

## Non-goals

- Bundling arbitrary external assets into templates that do not currently use them.
- Adding HTML sanitization or changing Markdown's raw-HTML policy.
- Opening or serving from the `export` subcommand.
- Changing JSON schema version `1.0`.
- Retrying failed exports or providing an export archive.
- Publishing or tagging 0.6.0 as part of implementation.
