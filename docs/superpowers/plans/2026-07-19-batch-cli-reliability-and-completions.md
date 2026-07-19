# Batch CLI Reliability and Shell Completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generation non-blocking by default, recover from oversized AI comment batches, and generate Bash, Zsh, Fish, and PowerShell completions.

**Architecture:** Keep `serve` as the only unconditional server command and gate generation-time UI startup on `MainOptions.open`. Normalize model batches at the AI boundary before IDs are remapped. Build a shell-neutral model from the Commander tree and render it with focused, dependency-free shell modules.

**Tech Stack:** Bun, strict TypeScript, Commander 13, Bun Test, Oxfmt, Oxlint.

## Global Constraints

- Work directly on the current `main` worktree; do not create branches, worktrees, or sub-agents.
- Remove `--no-ui` without a compatibility alias.
- `reddit-scrutinizer <project> --open` starts the server and opens the browser.
- `reddit-scrutinizer serve <file>` always starts the server; its `--open` flag remains optional.
- Oversized AI batches are truncated; empty and undersized batches remain errors.
- Generate completions to stdout only; do not install or remove shell files.
- Update `CHANGELOG.md` as behavior changes land.

---

### Task 1: Make generation-time UI opt-in

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `createProgram(handlers)` and `MainOptions`.
- Produces: `MainOptions.open: boolean` as the sole generation-time server gate.

- [ ] **Step 1: Write failing CLI tests**

Add assertions that default options include `open: false`, do not contain `ui`, and that `--open` sets `open: true`. Add an unknown-option regression:

```ts
test("opens the generated UI only when --open is provided", () => {
  expect(parseMain(["./project"]).options.open).toBe(false);
  expect(parseMain(["./project", "--open"]).options.open).toBe(true);
});

test("rejects the removed --no-ui option", () => {
  expect(() => parseMain(["./project", "--no-ui"])).toThrow("unknown option '--no-ui'");
});
```

Update the documented-default assertion to require `open: false` and assert `"ui" in options` is false.

- [ ] **Step 2: Verify the tests fail for the current behavior**

Run: `bun test --isolate test/cli.test.ts`

Expected: FAIL because `ui` still exists and `--no-ui` is accepted.

- [ ] **Step 3: Implement the minimal CLI change**

Remove `ui` from `MainOptions` and remove `.option("--no-ui", ...)`. In `src/index.ts`, replace all `options.ui` logging and conditions with `options.open`, and start the server only inside:

```ts
if (options.open) {
  const { startServer } = await import("./ui/server");
  actualPort = await startServer(outPath, options.port, true, options.theme);
}
```

Use `options.open` in the stage-completion message.

- [ ] **Step 4: Verify the focused tests pass**

Run: `bun test --isolate test/cli.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the UI behavior**

```bash
git add src/cli.ts src/index.ts test/cli.test.ts
git commit -m "fix: make generated UI opt-in"
```

---

### Task 2: Normalize oversized comment batches

**Files:**
- Modify: `test/ai/generate-comments.test.ts`
- Modify: `src/ai/generate-comments.ts`

**Interfaces:**
- Consumes: `GeneratedComment[]` returned by `generateCommentBatch()`.
- Produces: `normalizeBatchSize(batch, expected, batchNumber, totalBatches): GeneratedComment[]`.

- [ ] **Step 1: Replace the oversized-batch failure test with expected normalization**

For a single batch, return three fixtures for a request of two and assert IDs `local-1`, `local-2` are retained. Add a continuation regression where batch one returns two comments and batch two returns three for a one-comment remainder; assert the final IDs are `c1`, `c2`, `c3` and progress completes with `generated: 1`, `totalGenerated: 3`, `remaining: 0`.

```ts
test("truncates comments beyond the requested batch size", async () => {
  setGenerateTextHandler(() => ({
    output: [comment("local-1"), comment("local-2"), comment("local-3")],
    finishReason: "stop",
    warnings: undefined,
  }));

  const result = await generateComments(client, dossier, vibePack, post, [], null, {
    ...options,
    comments: 2,
    batchSize: 3,
  });

  expect(result.map((item) => item.id)).toEqual(["local-1", "local-2"]);
});
```

- [ ] **Step 2: Verify the tests fail with the exact-count assertion**

Run: `bun test --isolate test/ai/generate-comments.test.ts`

Expected: FAIL with `AI returned 3 comments ... expected exactly 2`.

- [ ] **Step 3: Implement normalization before ID remapping**

Replace `assertBatchSize` with:

```ts
function normalizeBatchSize(
  batch: GeneratedComment[],
  expected: number,
  batchNumber: number,
  totalBatches: number,
): GeneratedComment[] {
  if (expected > 0 && batch.length === 0) {
    throw new Error(`AI returned no comments for batch ${batchNumber} of ${totalBatches}`);
  }
  if (batch.length < expected) {
    const noun = batch.length === 1 ? "comment" : "comments";
    throw new Error(
      `AI returned ${batch.length} ${noun} for batch ${batchNumber} of ${totalBatches}; expected exactly ${expected}`,
    );
  }
  return batch.slice(0, expected);
}
```

Use the normalized return value in both single- and multi-batch paths before callbacks or ID remapping.

- [ ] **Step 4: Verify comment-generation tests pass**

Run: `bun test --isolate test/ai/generate-comments.test.ts`

Expected: PASS, including existing empty and undersized failures.

- [ ] **Step 5: Commit batch normalization**

```bash
git add src/ai/generate-comments.ts test/ai/generate-comments.test.ts
git commit -m "fix: trim oversized comment batches"
```

---

### Task 3: Generate shell completions from the Commander tree

**Files:**
- Create: `src/completions/model.ts`
- Create: `src/completions/bash.ts`
- Create: `src/completions/zsh.ts`
- Create: `src/completions/fish.ts`
- Create: `src/completions/powershell.ts`
- Create: `src/completions/index.ts`
- Create: `test/completions.test.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Produces: `SUPPORTED_SHELLS`, `Shell`, `buildCompletionModel(program)`, and `renderCompletionScript(program, shell)`.
- Consumes: Commander `Command`, `Option`, and `Argument` metadata plus JSON filenames from `src/ai/vibes/`.

- [ ] **Step 1: Write failing completion tests**

Create table-driven tests that call `renderCompletionScript(createProgram(), shell)` for all shells and expect shell markers:

```ts
const markers = {
  bash: ["_reddit_scrutinizer()", "complete -F _reddit_scrutinizer reddit-scrutinizer"],
  zsh: ["#compdef reddit-scrutinizer", "compdef _reddit_scrutinizer reddit-scrutinizer"],
  fish: ["complete -c reddit-scrutinizer", "__fish_seen_subcommand_from serve"],
  powershell: ["Register-ArgumentCompleter", "-CommandName 'reddit-scrutinizer'"],
} as const;
```

For every shell, also assert output contains `serve`, `completions`, `--open`, `--subreddit`, `balanced`, `reddit`, `localllama`, `bash`, and `powershell`. Add CLI parsing tests that capture `completions bash` and reject `completions tcsh`.

- [ ] **Step 2: Verify completion tests fail because the API and command do not exist**

Run: `bun test --isolate test/completions.test.ts test/cli.test.ts`

Expected: FAIL because `src/completions` and the `completions` subcommand are missing.

- [ ] **Step 3: Build the shell-neutral model**

Define recursive command, option, and argument metadata. Extract visible subcommands, option flags/descriptions/value choices, and positional hints. Infer `directory` for `<path>`, `file` for `<file>` and `--out`, shell choices for `<shell>`, and vibe-pack names for `--subreddit`. Preserve Commander choices for `--style` and `--theme`.

```ts
export const SUPPORTED_SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type Shell = (typeof SUPPORTED_SHELLS)[number];

export interface CompletionModel {
  name: string;
  description: string;
  options: CompletionOption[];
  arguments: CompletionArgument[];
  subcommands: CompletionModel[];
}

export function buildCompletionModel(program: Command): CompletionModel;
```

- [ ] **Step 4: Implement one renderer per shell and the registry**

Each renderer exports `render(model: CompletionModel): string`. Bash uses `compgen`, Zsh uses `_arguments` and `_alternative`, Fish emits `complete` declarations with subcommand conditions, and PowerShell emits `Register-ArgumentCompleter` with `CompletionResult` values. `src/completions/index.ts` dispatches exhaustively:

```ts
const RENDERERS: Record<Shell, (model: CompletionModel) => string> = {
  bash: renderBash,
  zsh: renderZsh,
  fish: renderFish,
  powershell: renderPowerShell,
};

export function renderCompletionScript(program: Command, shell: Shell): string {
  return RENDERERS[shell](buildCompletionModel(program));
}
```

- [ ] **Step 5: Register `completions <shell>`**

Add a `completions` handler to `ProgramHandlers`, define the shell argument with Commander choices, and default to printing `renderCompletionScript(program, shell)` with `process.stdout.write`. The handler receives the root program so generated output reflects current commands.

- [ ] **Step 6: Verify completion tests and Bash syntax**

Run:

```bash
bun test --isolate test/completions.test.ts test/cli.test.ts
bun run src/index.ts completions bash | bash -n
```

Expected: all tests PASS and `bash -n` exits 0.

- [ ] **Step 7: Commit completion generation**

```bash
git add src/cli.ts src/completions test/cli.test.ts test/completions.test.ts
git commit -m "feat: generate shell completions"
```

---

### Task 4: Update user-facing documentation and batch script

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `batch.sh` (local untracked script; do not add it unless already tracked)

**Interfaces:**
- Documents the CLI behavior implemented in Tasks 1-3.

- [ ] **Step 1: Update the README reference and how-to sections**

Remove `--no-ui`, describe `--open` as starting the server and browser, state that generation exits after writing JSON by default, and add tested completion commands:

```bash
eval "$(reddit-scrutinizer completions bash)"
eval "$(reddit-scrutinizer completions zsh)"
reddit-scrutinizer completions fish | source
reddit-scrutinizer completions powershell | Out-String | Invoke-Expression
```

- [ ] **Step 2: Update the Unreleased changelog while changes land**

Add completion generation under Added, opt-in generation UI under Changed, and oversized comment-batch truncation under Fixed. Revise the existing wrong-size failure bullet to say empty or undersized batches.

- [ ] **Step 3: Remove `--no-ui` from the local batch script**

Delete both `--no-ui` continuations and ensure the preceding `--out` lines no longer end with a continuation when they are last.

- [ ] **Step 4: Verify documented commands and stale references**

Run:

```bash
bun run src/index.ts --help
bun run src/index.ts completions bash | bash -n
rg -n -- '--no-ui' README.md CHANGELOG.md src test batch.sh
```

Expected: help and Bash completion generation succeed; `--no-ui` remains only in historical changelog entries and the regression test that asserts rejection.

- [ ] **Step 5: Commit tracked documentation**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document batch-safe CLI behavior"
```

---

### Task 5: Full verification and review

**Files:**
- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Run the complete repository check**

Run: `bun run check`

Expected: formatting check, lint, typecheck, coverage, and all isolated tests PASS.

- [ ] **Step 2: Smoke-test every completion generator**

Run:

```bash
bun run src/index.ts completions bash > /tmp/reddit-scrutinizer.bash
bash -n /tmp/reddit-scrutinizer.bash
bun run src/index.ts completions zsh > /tmp/_reddit-scrutinizer
bun run src/index.ts completions fish > /tmp/reddit-scrutinizer.fish
bun run src/index.ts completions powershell > /tmp/reddit-scrutinizer.ps1
```

Expected: all generation commands exit 0, Bash parses the script, and every file is non-empty.

- [ ] **Step 3: Review the scoped diff**

Inspect only the files changed for this work, verify no unrelated user changes were staged, and correct any functional or documentation defects with focused tests.

- [ ] **Step 4: Re-run `bun run check` after review changes**

Expected: PASS with no warnings.
