/** @jsxImportSource preact */
import type { VNode } from "preact";
import {
  buildCommentTree,
  colorForUser,
  type Comment,
  type CommentNode,
  fmtDateUTC,
  initials,
  refNowSeconds,
  type ScrutinyOutput,
  timeAgoLong,
  withCommas,
} from "../shared";

const CSS = `
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :root {
        --so-orange: #f48225;
        --so-orange-hover: #da670b;
        --bg: #ffffff;
        --bg-outer: #f8f9f9;
        --border: #e3e6e8;
        --border-light: #eff0f1;
        --text: #232629;
        --text-secondary: #3b4045;
        --text-muted: #6a737c;
        --link: #0074cc;
        --tag-bg: #e1ecf4;
        --tag-text: #39739d;
        --tag-hover-bg: #d0e3f1;
        --accepted: #48a868;
        --vote: #babfc4;
        --card-blue: #e1ecf4;
        --font:
          -apple-system, BlinkMacSystemFont, "Segoe UI Adjusted", "Segoe UI", "Liberation Sans",
          sans-serif;
        --font-code: Consolas, Menlo, Monaco, "Courier New", monospace;
      }

      body {
        background: var(--bg-outer);
        color: var(--text);
        font-family: var(--font);
        font-size: 15px;
        line-height: 1.5;
      }

      a {
        color: var(--link);
        text-decoration: none;
      }
      a:hover {
        color: #0a95ff;
      }

      /* Top bar */
      .topbar {
        border-top: 3px solid var(--so-orange);
        background: var(--bg-outer);
        border-bottom: 1px solid var(--border);
        box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05);
        height: 50px;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 14px;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .logo {
        display: flex;
        align-items: baseline;
        gap: 1px;
        font-size: 17px;
        color: var(--text);
      }
      .logo .light {
        font-weight: 300;
      }
      .logo .bold {
        font-weight: 600;
      }
      .logo .so-mark {
        display: inline-block;
        width: 26px;
        height: 26px;
        margin-right: 6px;
        background: var(--so-orange);
        border-radius: 4px;
        position: relative;
        align-self: center;
      }
      .logo .so-mark::after {
        content: "S";
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 800;
        font-size: 17px;
      }
      .searchbar {
        flex: 1;
        max-width: 780px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: #fff;
        color: var(--text-muted);
        font-size: 13px;
        padding: 7px 10px;
      }
      .sim-badge {
        margin-left: auto;
        background: var(--so-orange);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 4px 9px;
        border-radius: 4px;
      }

      /* Layout */
      .container {
        max-width: 1100px;
        margin: 0 auto;
        background: var(--bg);
        display: grid;
        grid-template-columns: 1fr 300px;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
        min-height: calc(100vh - 50px);
      }
      @media (max-width: 820px) {
        .container {
          grid-template-columns: 1fr;
        }
        .sidebar {
          display: none;
        }
      }
      .main {
        padding: 24px;
        min-width: 0;
      }

      /* Question header */
      .q-title {
        font-size: 27px;
        font-weight: 400;
        line-height: 1.3;
        color: #0c0d0e;
        margin-bottom: 8px;
      }
      .q-meta {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: var(--text-muted);
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 16px;
      }
      .q-meta b {
        color: var(--text-secondary);
        font-weight: 400;
      }

      /* Close banner */
      .close-banner {
        background: #fdf7e2;
        border: 1px solid #e9d8a6;
        border-radius: 4px;
        padding: 12px 14px;
        margin-bottom: 16px;
        font-size: 14px;
        color: #3b4045;
      }
      .close-banner .close-title {
        font-weight: 600;
      }
      .close-banner .close-meta {
        color: var(--text-muted);
        font-size: 13px;
        margin-top: 4px;
      }

      /* Post (question + answers share this grid) */
      .post {
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 16px;
        padding: 16px 0;
      }
      .post + .post {
        border-top: 1px solid var(--border);
      }
      .votecell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        color: var(--text-muted);
      }
      .vote-arrow {
        width: 36px;
        height: 36px;
        border: 1px solid var(--vote);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--vote);
        background: none;
        font-size: 18px;
        line-height: 1;
        user-select: none;
      }
      .vote-arrow:hover {
        background: #fff7ef;
        border-color: var(--so-orange);
        color: var(--so-orange);
      }
      .vote-count {
        font-size: 21px;
        color: var(--text-secondary);
        margin: 2px 0;
      }
      .accepted-check {
        color: var(--accepted);
        font-size: 30px;
        line-height: 1;
        margin-top: 4px;
      }
      .accepted-check-label {
        display: block;
        font-size: 11px;
        color: var(--accepted);
      }

      .postcell {
        min-width: 0;
      }
      .body {
        font-size: 15px;
        line-height: 1.65;
        color: var(--text);
        overflow-wrap: break-word;
      }
      .body p {
        margin: 0 0 1em;
      }
      .body h1,
      .body h2,
      .body h3 {
        margin: 1em 0 0.5em;
        font-weight: 600;
      }
      .body code {
        background: #eff0f1;
        color: #242729;
        font-family: var(--font-code);
        font-size: 13px;
        padding: 2px 5px;
        border-radius: 3px;
      }
      .body pre {
        background: #f6f6f6;
        border-radius: 5px;
        padding: 12px;
        overflow-x: auto;
        margin: 0 0 1em;
      }
      .body pre code {
        background: none;
        padding: 0;
        font-size: 13px;
      }
      .body blockquote {
        border-left: 4px solid #e4e6e8;
        padding-left: 12px;
        color: var(--text-secondary);
        margin: 0 0 1em;
      }
      .body ul,
      .body ol {
        padding-left: 24px;
        margin: 0 0 1em;
      }

      /* Tags */
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 16px 0;
      }
      .tag {
        background: var(--tag-bg);
        color: var(--tag-text);
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .tag:hover {
        background: var(--tag-hover-bg);
      }

      /* Post footer / user card */
      .post-footer {
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        gap: 12px;
        margin-top: 8px;
      }
      .user-card {
        background: var(--card-blue);
        border-radius: 4px;
        padding: 7px 8px;
        font-size: 13px;
        min-width: 200px;
      }
      .user-card .action-time {
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .user-card .card-row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 3px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
      }
      .user-name {
        color: var(--link);
        font-weight: 600;
      }
      .user-name.is-op::after {
        content: " ♦";
        color: var(--so-orange);
      }
      .user-rep {
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 12px;
        margin-top: 2px;
      }
      .user-flair {
        color: var(--text-muted);
        font-size: 12px;
      }

      /* Answers header */
      .answers-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 28px 0 8px;
        padding-top: 16px;
      }
      .answers-header h2 {
        font-size: 19px;
        font-weight: 400;
      }
      .sorted-by {
        font-size: 13px;
        color: var(--text-muted);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 5px 8px;
      }

      /* Answer comments (flattened) */
      .a-comments {
        border-top: 1px solid var(--border-light);
        margin-top: 12px;
        font-size: 13px;
      }
      .a-comment {
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .a-comment .c-score {
        color: var(--text-muted);
        font-weight: 700;
        margin-right: 6px;
      }
      .a-comment .c-author {
        color: var(--link);
        font-weight: 600;
      }
      .a-comment .c-author.is-op {
        color: var(--so-orange);
      }
      .a-comment .c-time {
        color: var(--text-muted);
      }
      .a-comment.removed {
        color: var(--text-muted);
        font-style: italic;
      }
      .add-comment {
        display: block;
        color: var(--text-muted);
        font-size: 12px;
        padding: 8px 0;
      }

      /* Sidebar */
      .sidebar {
        background: var(--bg);
        border-left: 1px solid var(--border);
        padding: 24px 16px;
      }
      .widget {
        border: 1px solid #e6eaef;
        border-radius: 5px;
        margin-bottom: 16px;
      }
      .widget h3 {
        background: #fdf7e2;
        border-bottom: 1px solid #f3e8c0;
        border-radius: 5px 5px 0 0;
        font-size: 13px;
        font-weight: 500;
        color: #3b4045;
        padding: 8px 12px;
      }
      .widget-body {
        padding: 8px 12px;
      }
      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 13px;
        border-bottom: 1px solid var(--border-light);
      }
      .stat-row:last-child {
        border-bottom: none;
      }
      .stat-label {
        color: var(--text-muted);
      }
      .stat-value {
        color: var(--text-secondary);
        font-weight: 600;
      }
      .stat-value.yes {
        color: var(--accepted);
      }
      .stat-value.no {
        color: var(--text-muted);
      }
      .widget-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
      }

      /* Footer */
      .disclaimer {
        grid-column: 1 / -1;
        border-top: 1px solid var(--border);
        padding: 16px 24px;
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
        background: var(--bg-outer);
      }
`;

const ENHANCE = `
(function () {
  document.addEventListener("click", function (e) {
    var arrow = e.target.closest("[data-vote]");
    if (!arrow) return;
    var cell = arrow.closest(".votecell");
    if (!cell) return;
    var countEl = cell.querySelector(".vote-count");
    if (!countEl) return;
    var base = parseInt(countEl.getAttribute("data-base"), 10) || 0;
    var dir = arrow.getAttribute("data-vote") === "up" ? 1 : -1;
    var cur = countEl.getAttribute("data-cur");
    var next = (cur === String(dir)) ? 0 : dir;
    countEl.setAttribute("data-cur", String(next));
    countEl.textContent = String(base + next);
  });
})();
`;

const AVATAR_COLORS = [
  "#f48225",
  "#0074cc",
  "#3d8f5b",
  "#a1662f",
  "#6b5b95",
  "#c0392b",
  "#2c8c99",
  "#8e44ad",
  "#16829b",
  "#b8860b",
  "#5a6e7f",
  "#c0562b",
] as const;

const CLOSE_REASONS = [
  {
    title: "opinion-based",
    detail:
      "Answers to this question tend to be almost entirely based on opinions, rather than facts, references, or specific expertise.",
  },
  {
    title: "needs details or clarity",
    detail:
      "Add details and clarify the problem by editing this post. This will help others answer the question.",
  },
  {
    title: "not suitable for this site",
    detail:
      "This question does not appear to be about programming within the scope defined in the help center.",
  },
  {
    title: "too broad",
    detail:
      "Please edit the question to limit it to a specific problem with enough detail to identify an adequate answer.",
  },
] as const;

/** Char-sum hash for deterministic, reproducible fake counts. */
function hashNum(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Compact reputation like Stack Overflow: "134", "1.2k", "23.4k". */
function repFmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function reputation(name: string): string {
  return repFmt(11 + (hashNum(name) % 48000));
}

function views(id: string): string {
  return withCommas(120 + (hashNum(id) % 40000));
}

/** All descendants of an answer, flattened and ordered chronologically (SO comments are flat). */
function flattenDescendants(node: CommentNode): Comment[] {
  const out: Comment[] = [];
  const walk = (n: CommentNode): void => {
    for (const child of n.children) {
      out.push(child.comment);
      walk(child);
    }
  };
  walk(node);
  return out.sort((a, b) => a.created_utc - b.created_utc);
}

/** Language/stack entries as plain tag strings (languages may be `{name}` objects). */
function tagStrings(project: ScrutinyOutput["project"]): string[] {
  const langs = project.languages.map((l) => l.name).filter(Boolean);
  return [...new Set([...langs.slice(0, 3), ...project.stack])].slice(0, 6);
}

function VoteCell({ score, accepted }: { score: number; accepted?: boolean }): VNode {
  return (
    <div class="votecell">
      <button class="vote-arrow" data-vote="up" title="This is useful" aria-label="Up vote">
        ▲
      </button>
      <span class="vote-count" data-base={score}>
        {score}
      </span>
      <button class="vote-arrow" data-vote="down" title="This is not useful" aria-label="Down vote">
        ▼
      </button>
      {accepted && (
        <span class="accepted-check" title="Accepted answer">
          ✓<span class="accepted-check-label">accepted</span>
        </span>
      )}
    </div>
  );
}

function UserCard({
  author,
  isOp,
  flair,
  action,
  time,
}: {
  author: string;
  isOp: boolean;
  flair: string | null;
  action: string;
  time: string;
}): VNode {
  const display = author || "[deleted]";
  return (
    <div class="user-card">
      <div class="action-time">
        {action} {time}
      </div>
      <div class="card-row">
        <div class="avatar" style={`background:${colorForUser(display, AVATAR_COLORS)}`}>
          {initials(display)}
        </div>
        <div>
          <div class={`user-name ${isOp ? "is-op" : ""}`}>{display}</div>
          <div class="user-rep">{reputation(display)}</div>
          {flair && <div class="user-flair">{flair}</div>}
        </div>
      </div>
    </div>
  );
}

function AnswerComments({ comments, refNow }: { comments: Comment[]; refNow: number }): VNode {
  return (
    <div class="a-comments">
      {comments.map((c) =>
        c.is_deleted ? (
          <div class="a-comment removed" key={c.id}>
            comment removed by moderator
          </div>
        ) : (
          <div class="a-comment" key={c.id}>
            {c.score > 0 && <span class="c-score">{c.score}</span>}
            <span dangerouslySetInnerHTML={{ __html: c.body_html }} /> –{" "}
            <span class={`c-author ${c.is_op ? "is-op" : ""}`}>{c.author}</span>{" "}
            <span class="c-time">{timeAgoLong(c.created_utc, refNow)}</span>
          </div>
        ),
      )}
      <span class="add-comment">Add a comment</span>
    </div>
  );
}

function Answer({
  node,
  accepted,
  refNow,
}: {
  node: CommentNode;
  accepted: boolean;
  refNow: number;
}): VNode {
  const c = node.comment;
  const deleted = c.is_deleted;
  const comments = flattenDescendants(node);
  return (
    <div class="post">
      <VoteCell score={c.score} accepted={accepted} />
      <div class="postcell">
        {deleted ? (
          <div class="body" style="color:var(--text-muted);font-style:italic">
            This answer was deleted.
          </div>
        ) : (
          <div class="body" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        )}
        <div class="post-footer">
          <UserCard
            author={deleted ? "[deleted]" : c.author}
            isOp={c.is_op}
            flair={c.author_flair}
            action="answered"
            time={timeAgoLong(c.created_utc, refNow)}
          />
        </div>
        {comments.length > 0 && <AnswerComments comments={comments} refNow={refNow} />}
      </div>
    </div>
  );
}

function Sidebar({ project }: { project: ScrutinyOutput["project"] }): VNode {
  const facts = project.facts;
  const boolRows: Array<[string, boolean]> = [
    ["Has tests", facts.has_tests],
    ["Has CI", facts.has_ci],
  ];
  const tags = tagStrings(project);
  return (
    <aside class="sidebar">
      <div class="widget">
        <h3>Project Info</h3>
        <div class="widget-body">
          <div class="stat-row">
            <span class="stat-label">License</span>
            <span class="stat-value">{facts.license ?? "none"}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Files scanned</span>
            <span class="stat-value">{withCommas(facts.files_scanned)}</span>
          </div>
          {boolRows.map(([label, v]) => (
            <div class="stat-row" key={label}>
              <span class="stat-label">{label}</span>
              <span class={`stat-value ${v ? "yes" : "no"}`}>{v ? "✓ yes" : "✗ no"}</span>
            </div>
          ))}
        </div>
      </div>
      {tags.length > 0 && (
        <div class="widget">
          <h3>Watched Tags</h3>
          <div class="widget-tags">
            {tags.map((t) => (
              <span class="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function Page({ doc }: { doc: ScrutinyOutput }): VNode {
  const sim = doc.simulation;
  const project = doc.project;
  const post = sim.post;
  const refNow = refNowSeconds(doc.generated_at);
  const answers = buildCommentTree(sim.comments, post.id);
  const tags = tagStrings(project);
  const close = CLOSE_REASONS[hashNum(post.id) % CLOSE_REASONS.length]!;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${project.name} — reddit-scrutinizer`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <header class="topbar">
          <div class="logo">
            <span class="so-mark" />
            <span class="light">stack</span>
            <span class="bold">overflow</span>
          </div>
          <div class="searchbar">Search…</div>
          <span class="sim-badge">SIMULATED</span>
        </header>

        <div id="app">
          <div class="container">
            <main class="main">
              <h1 class="q-title">{post.title}</h1>
              <div class="q-meta">
                <span>
                  Asked <b>{timeAgoLong(post.created_utc, refNow)}</b>
                </span>
                <span>
                  Viewed <b>{views(post.id)} times</b>
                </span>
              </div>

              <div class="close-banner">
                <span class="close-title">Closed.</span> This question is not currently accepting
                answers — it was closed as <b>{close.title}</b>.
                <div class="close-meta">{close.detail}</div>
              </div>

              <div class="post">
                <VoteCell score={post.score} />
                <div class="postcell">
                  <div class="body" dangerouslySetInnerHTML={{ __html: post.body_html }} />
                  <div class="tags">
                    {tags.map((t) => (
                      <span class="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div class="post-footer">
                    <UserCard
                      author={post.author}
                      isOp
                      flair={post.author_flair}
                      action="asked"
                      time={timeAgoLong(post.created_utc, refNow)}
                    />
                  </div>
                </div>
              </div>

              <div class="answers-header">
                <h2>
                  {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
                </h2>
                {answers.length > 0 && <span class="sorted-by">Sorted by: Highest score</span>}
              </div>

              {answers.map((node, i) => (
                <Answer key={node.comment.id} node={node} accepted={i === 0} refNow={refNow} />
              ))}
            </main>

            <Sidebar project={project} />

            <div class="disclaimer">
              ⚠️ Simulated Stack Overflow question generated by reddit-scrutinizer using{" "}
              {doc.input.model}. No real users, questions, or answers were involved. Generated{" "}
              {fmtDateUTC(doc.generated_at)}.
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
