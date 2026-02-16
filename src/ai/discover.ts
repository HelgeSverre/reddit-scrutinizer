import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ProjectDossier } from "../scan/dossier";
import type { DiscoveryPlan, EvidenceSnippet, FileIndex, PatternSummary } from "../scan/snippets";
import { generateJSON, type GenerateOptions } from "./client";

export interface EvidencePack {
  overview: string[];
  strengths: { claim: string; evidence: string[] }[];
  risks: { severity: "low" | "med" | "high"; claim: string; evidence: string[] }[];
  questions_for_op: string[];
  comment_ammo: { angle: string; evidence_quote?: string; evidence_ref?: string }[];
  citations: { ref: string; quote: string }[];
}

const DiscoveryReadSchema = z.object({
  path: z.string(),
  start_line: z.number(),
  line_count: z.number(),
  reason: z.string(),
  priority: z.number(),
});

const DiscoveryPlanSchema = z.object({
  reads: z.array(DiscoveryReadSchema),
});

const EvidencePackSchema = z.object({
  overview: z.array(z.string()),
  strengths: z.array(z.object({
    claim: z.string(),
    evidence: z.array(z.string()),
  })),
  risks: z.array(z.object({
    severity: z.enum(["low", "med", "high"]),
    claim: z.string(),
    evidence: z.array(z.string()),
  })),
  questions_for_op: z.array(z.string()),
  comment_ammo: z.array(z.object({
    angle: z.string(),
    evidence_quote: z.string().optional(),
    evidence_ref: z.string().optional(),
  })),
  citations: z.array(z.object({
    ref: z.string(),
    quote: z.string(),
  })),
});

export async function planDiscovery(
  client: Anthropic,
  dossier: ProjectDossier,
  fileIndex: FileIndex,
  patternSummary: PatternSummary | null,
  options: GenerateOptions,
): Promise<DiscoveryPlan> {
  const maxReads = 12;
  const maxLineCount = 150;

  const system = `You are a senior code reviewer helping sample an unknown codebase efficiently.

Goal: choose a small set of high-leverage code regions to read so we can later generate realistic technical critiques.

Constraints:
- Request at most ${maxReads} reads.
- Each read must specify: path (must exist in the file index), start_line (>= 1), line_count (<= ${maxLineCount}), reason (brief), priority (1 = must read, 2 = important, 3 = nice to have).
- Prefer: core logic, entrypoints, API/network boundaries, persistence/DB, auth/security, error handling, config, and test files.
- Avoid: vendored/minified/generated files, lockfiles, large data/JSON dumps, documentation.
- If a file is already in the excerpt list, you may still request deeper reads (different line ranges) from it.
- Bias toward files likely to contain bugs, questionable design, or interesting tradeoffs.
- Include at least one test file if any exist in the index.

Return ONLY valid JSON:
{
  "reads": [
    { "path": "src/example.ts", "start_line": 1, "line_count": 120, "reason": "main entrypoint", "priority": 1 }
  ]
}`;

  const excerptList = dossier.excerpts.map((e) => `- ${e.path} (${e.why})`).join("\n");

  let patternSection = "";
  if (patternSummary && patternSummary.signals.length > 0) {
    const byPattern = new Map<string, { files: string[]; total: number }>();
    for (const s of patternSummary.signals) {
      const existing = byPattern.get(s.pattern) ?? { files: [], total: 0 };
      existing.files.push(s.file);
      existing.total += s.count;
      byPattern.set(s.pattern, existing);
    }
    const lines = Array.from(byPattern.entries()).map(
      ([pattern, data]) => `- ${pattern}: ${data.total} occurrences in ${data.files.length} files (${data.files.slice(0, 3).join(", ")}${data.files.length > 3 ? "..." : ""})`,
    );
    patternSection = `\nRisk signals detected:\n${lines.join("\n")}\n`;
  }

  const userPrompt = `Project: ${dossier.name}
Description: ${dossier.description}
Languages: ${dossier.languages.map((l) => `${l.name} (${l.pct}%)`).join(", ")}
Stack: ${dossier.stack.join(", ")}
Has tests: ${dossier.has_tests}
Has CI: ${dossier.has_ci}

Already-included excerpts (first 100 lines each):
${excerptList}
${patternSection}
File index (${fileIndex.total_scanned} files scanned, showing ${fileIndex.files.length}):
${JSON.stringify(fileIndex.files, null, 2)}

Pick the most informative reads to sample.`;

  const plan = await generateJSON<DiscoveryPlan>(client, system, userPrompt, options, DiscoveryPlanSchema);

  const validPaths = new Set(fileIndex.files.map((f) => f.path));
  plan.reads = plan.reads
    .filter((r) => validPaths.has(r.path))
    .slice(0, maxReads)
    .map((r) => ({
      ...r,
      start_line: Math.max(1, r.start_line),
      line_count: Math.min(maxLineCount, Math.max(1, r.line_count)),
      priority: Math.min(3, Math.max(1, r.priority)),
    }));

  return plan;
}

export async function synthesizeEvidence(
  client: Anthropic,
  dossier: ProjectDossier,
  snippets: EvidenceSnippet[],
  options: GenerateOptions,
): Promise<EvidencePack> {
  const system = `You are preparing a compact "evidence pack" for generating realistic Reddit-style technical scrutiny of a project.

Rules:
- Base all claims on the provided code snippets and project facts. Do not invent issues you can't see.
- Cite evidence using snippet refs like "E1:L10-L40" (snippet ID : line range within snippet).
- Include both genuine strengths and real risks/issues.
- Provide "comment_ammo": specific angles a knowledgeable redditor would comment on, with short evidence quotes when possible.
- Keep quotes under 120 characters. Be concise — no long prose.
- Generate 5-10 overview bullets, 3-6 strengths, 4-8 risks, 5-10 questions for OP, 8-15 comment ammo items, and up to 12 citations.

Return ONLY valid JSON:
{
  "overview": ["..."],
  "strengths": [{ "claim": "...", "evidence": ["E1:L10-L40"] }],
  "risks": [{ "severity": "low|med|high", "claim": "...", "evidence": ["E2:L1-L25"] }],
  "questions_for_op": ["..."],
  "comment_ammo": [{ "angle": "...", "evidence_quote": "short quote", "evidence_ref": "E3:L5" }],
  "citations": [{ "ref": "E3:L5-L12", "quote": "..." }]
}`;

  const snippetText = snippets.map((s) =>
    `[${s.id}] ${s.path}:${s.start_line}-${s.end_line} (${s.reason})\n---\n${s.content}\n---`,
  ).join("\n\n");

  const userPrompt = `Project: ${dossier.name}
Description: ${dossier.description}
Languages: ${dossier.languages.map((l) => `${l.name} (${l.pct}%)`).join(", ")}
Stack: ${dossier.stack.join(", ")}
Has tests: ${dossier.has_tests}
Has CI: ${dossier.has_ci}
License: ${dossier.license ?? "none detected"}
README excerpt: ${dossier.readme.slice(0, 500)}

Evidence snippets:

${snippetText}`;

  return generateJSON<EvidencePack>(client, system, userPrompt, options, EvidencePackSchema);
}
