export interface ProgressReporterOptions {
  verbose: boolean;
  write?: (line: string) => void;
  writeError?: (line: string) => void;
  now?: () => number;
}

export interface StageProgress {
  detail(message: string): void;
  complete(message: string): void;
}

export interface ProgressReporter {
  readonly verbose: boolean;
  stage(current: number, total: number, message: string): StageProgress;
  detail(message: string): void;
  success(message: string): void;
  warn(message: string): void;
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(2).replace(/\.?0+$/, "")}s`;
}

export function createProgressReporter(options: ProgressReporterOptions): ProgressReporter {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const now = options.now ?? performance.now.bind(performance);

  const detail = (message: string): void => {
    if (options.verbose) write(`  ↳ ${message}`);
  };

  return {
    verbose: options.verbose,
    stage(current, total, message) {
      const startedAt = now();
      write(`[${current}/${total}] ${message}`);
      return {
        detail,
        complete(completionMessage) {
          if (options.verbose) {
            detail(`${completionMessage} (${formatDuration(now() - startedAt)})`);
          }
        },
      };
    },
    detail,
    success(message) {
      write(`✓ ${message}`);
    },
    warn(message) {
      writeError(`⚠ ${message}`);
    },
  };
}
