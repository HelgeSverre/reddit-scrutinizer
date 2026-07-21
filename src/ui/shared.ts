// Pure, DOM-free helpers shared by every server-rendered theme.
// No imports from ./themes or ./server (keeps the module cycle-free and
// importable by src/output/export-html.ts without pulling in the server).

import type { Comment, Post, ScrutinyOutput } from "../output/schema";

export type { Comment, Post, ScrutinyOutput };

export interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/**
 * Bucket comments by parent, sort each level by score descending, and return
 * the nested tree rooted at the post. Mirrors the old client `renderCommentTree`.
 */
export function buildCommentTree(comments: Comment[], postId: string): CommentNode[] {
  const byParent = new Map<string, Comment[]>();
  for (const comment of comments) {
    const list = byParent.get(comment.parent_id);
    if (list) list.push(comment);
    else byParent.set(comment.parent_id, [comment]);
  }
  const build = (parentId: string): CommentNode[] => {
    const kids = byParent.get(parentId);
    if (!kids) return [];
    return [...kids]
      .sort((a, b) => b.score - a.score)
      .map((comment) => ({ comment, children: build(comment.id) }));
  };
  return build(postId);
}

/** Epoch seconds reference for relative time, taken from `generated_at`. */
export function refNowSeconds(generatedAt: string): number {
  const ms = Date.parse(generatedAt);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** Compact relative time: "just now", "5m", "3h", "2d", "7w". */
export function timeAgoShort(utc: number, refNow: number): string {
  const diff = Math.max(0, refNow - utc);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

/** Verbose relative time: "just now", "5 minutes ago", "1 hour ago", … */
export function timeAgoLong(utc: number, refNow: number): string {
  const diff = Math.max(0, refNow - utc);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (diff < 60) return "just now";
  if (diff < 3600) return unit(Math.floor(diff / 60), "minute");
  if (diff < 86400) return unit(Math.floor(diff / 3600), "hour");
  if (diff < 604800) return unit(Math.floor(diff / 86400), "day");
  return unit(Math.floor(diff / 604800), "week");
}

/** Reddit/Twitter-style compact score. lowercase "k" matches the reddit theme. */
export function formatScoreK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Twitter/Bluesky-style compact count with uppercase K/M. */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Deterministic thousands separators (no Intl/locale dependence). */
export function withCommas(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function fakeMembers(sub: string): string {
  const hash = [...sub].reduce((a, c) => a + c.charCodeAt(0), 0);
  return withCommas(50000 + ((hash * 7919) % 450000));
}

/** Deterministic replacement for the old Math.random() "online" count. */
export function deterministicOnline(sub: string): string {
  const hash = [...sub].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return withCommas(200 + (hash % 800));
}

/** UTC, locale-stable date "M/D/YYYY" — replaces toLocaleDateString(). */
export function fmtDateUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

/** Two-letter avatar initials; "?" for empty or deleted authors. */
export function initials(name: string): string {
  if (!name || name === "[deleted]") return "?";
  return name.slice(0, 2).toUpperCase();
}

/** Deterministic color pick from a palette, keyed by name. */
export function colorForUser(name: string, palette: readonly string[]): string {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[hash % palette.length]!;
}

/** Plain-text from a marked-produced HTML string, DOM-free (used by qdb). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
