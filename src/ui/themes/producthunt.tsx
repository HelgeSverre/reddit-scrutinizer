import type { VNode } from "preact";
import {
  buildCommentTree,
  colorForUser,
  type CommentNode,
  fmtDateUTC,
  initials,
  refNowSeconds,
  type ScrutinyOutput,
  timeAgoShort,
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
        --ph-orange: #da552f;
        --ph-orange-hover: #bf4526;
        --ph-orange-light: #fff3ee;
        --bg: #ffffff;
        --surface: #f9f9f9;
        --border: #e8e8e8;
        --border-light: #f0f0f0;
        --text: #1a1a1a;
        --text-secondary: #6f6f6f;
        --text-muted: #999;
        --text-link: #da552f;
        --maker-bg: #da552f;
        --maker-text: #fff;
        --badge-bg: #da552f;
        --tag-bg: #f0f0f0;
        --tag-text: #6f6f6f;
        --font:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--font);
        font-size: 15px;
        line-height: 1.6;
      }

      a {
        color: var(--text-link);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }

      /* Top nav */
      .topnav {
        position: sticky;
        top: 0;
        z-index: 100;
        background: #fff;
        border-bottom: 1px solid var(--border);
        height: 56px;
        display: flex;
        align-items: center;
        padding: 0 24px;
      }
      .topnav-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 20px;
        font-weight: 700;
        color: var(--text);
      }
      .topnav-logo .ph-icon {
        width: 36px;
        height: 36px;
        background: var(--ph-orange);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 800;
        font-size: 20px;
      }
      .topnav-badge {
        margin-left: auto;
        background: var(--ph-orange);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 4px;
        letter-spacing: 0.5px;
      }

      /* Layout */
      .page-wrapper {
        max-width: 1080px;
        margin: 0 auto;
        padding: 32px 24px;
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 32px;
      }
      @media (max-width: 768px) {
        .page-wrapper {
          grid-template-columns: 1fr;
        }
      }

      /* POTD badge */
      .potd-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #da552f, #f5a623);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 4px;
        margin-bottom: 16px;
        letter-spacing: 0.3px;
      }
      .potd-badge svg {
        width: 14px;
        height: 14px;
      }

      /* Product header */
      .product-header {
        display: flex;
        gap: 20px;
        align-items: flex-start;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 24px;
      }
      .upvote-box {
        flex-shrink: 0;
        width: 72px;
        text-align: center;
        border: 2px solid var(--border);
        border-radius: 8px;
        padding: 10px 8px;
        cursor: pointer;
        transition: all 0.15s;
        background: #fff;
        user-select: none;
      }
      .upvote-box:hover {
        border-color: var(--ph-orange);
      }
      .upvote-box.upvoted {
        border-color: var(--ph-orange);
        background: var(--ph-orange-light);
      }
      .upvote-box.upvoted .upvote-arrow {
        color: var(--ph-orange);
      }
      .upvote-box.upvoted .upvote-count {
        color: var(--ph-orange);
      }
      .upvote-arrow {
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        color: var(--text-secondary);
        transition: color 0.15s;
      }
      .upvote-count {
        font-size: 14px;
        font-weight: 700;
        margin-top: 2px;
        color: var(--text-secondary);
        transition: color 0.15s;
      }
      .product-info {
        flex: 1;
      }
      .product-name {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 4px;
        color: var(--text);
      }
      .product-tagline {
        font-size: 16px;
        color: var(--text-secondary);
        margin-bottom: 10px;
      }
      .product-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .product-tag {
        background: var(--tag-bg);
        color: var(--tag-text);
        font-size: 12px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 12px;
      }

      /* Post body */
      .post-body {
        padding-bottom: 24px;
        margin-bottom: 24px;
        border-bottom: 1px solid var(--border);
      }
      .post-body h2 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--text);
      }
      .post-body-content {
        font-size: 15px;
        line-height: 1.7;
        color: #333;
      }
      .post-body-content p {
        margin-bottom: 12px;
      }
      .post-body-content code {
        background: var(--surface);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: "SF Mono", Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .post-body-content pre {
        background: #1a1a2e;
        color: #e0e0e0;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 12px 0;
      }
      .post-body-content pre code {
        background: none;
        padding: 0;
        color: inherit;
      }
      .post-body-content blockquote {
        border-left: 3px solid var(--ph-orange);
        padding-left: 16px;
        color: var(--text-secondary);
        margin: 12px 0;
      }
      .post-body-content ul,
      .post-body-content ol {
        padding-left: 24px;
        margin: 8px 0;
      }
      .post-body-content h1,
      .post-body-content h2,
      .post-body-content h3 {
        margin: 16px 0 8px;
      }

      /* Discussion */
      .discussion-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
      }
      .discussion-header h3 {
        font-size: 18px;
        font-weight: 700;
      }
      .discussion-count {
        background: var(--tag-bg);
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 12px;
      }

      /* Comments */
      .comment-tree {
        padding-bottom: 40px;
      }

      .comment {
        display: flex;
        gap: 12px;
        padding: 12px 0;
        position: relative;
      }
      .comment + .comment {
        border-top: 1px solid var(--border-light);
      }

      .comment.collapsed > .comment-main > .comment-body,
      .comment.collapsed > .comment-main > .comment-actions,
      .comment.collapsed > .comment-main > .comment-children {
        display: none;
      }
      .comment.collapsed > .comment-main > .comment-header .collapse-hint {
        display: inline;
      }

      .comment-avatar {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
      }

      .comment-main {
        flex: 1;
        min-width: 0;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .comment-author {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
      }
      .comment-author.is-op {
        color: var(--ph-orange);
      }
      .maker-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: var(--maker-bg);
        color: var(--maker-text);
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .comment-flair {
        background: var(--tag-bg);
        color: var(--tag-text);
        font-size: 11px;
        padding: 1px 8px;
        border-radius: 10px;
      }
      .comment-time {
        font-size: 13px;
        color: var(--text-muted);
      }
      .collapse-hint {
        display: none;
        color: var(--text-muted);
        font-size: 13px;
        font-style: italic;
      }

      .comment-body {
        font-size: 14px;
        line-height: 1.6;
        color: #333;
        margin-bottom: 6px;
      }
      .comment-body p {
        margin-bottom: 6px;
      }
      .comment-body code {
        background: var(--surface);
        padding: 1px 4px;
        border-radius: 3px;
        font-family: "SF Mono", Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .comment-body pre {
        background: #1a1a2e;
        color: #e0e0e0;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .comment-body pre code {
        background: none;
        padding: 0;
        color: inherit;
      }
      .comment-body blockquote {
        border-left: 3px solid var(--border);
        padding-left: 12px;
        color: var(--text-secondary);
        margin: 6px 0;
      }

      .comment.deleted .comment-author {
        color: var(--text-muted);
      }
      .comment.deleted .comment-body {
        color: var(--text-muted);
        font-style: italic;
      }
      .comment.negative .comment-body {
        opacity: 0.6;
      }

      .comment-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .c-vote-btn {
        background: none;
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        padding: 3px 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        transition: all 0.15s;
      }
      .c-vote-btn:hover {
        border-color: var(--ph-orange);
        color: var(--ph-orange);
      }
      .c-vote-btn.upvoted {
        border-color: var(--ph-orange);
        color: var(--ph-orange);
        background: var(--ph-orange-light);
      }
      .c-vote-btn .arrow {
        font-size: 10px;
      }
      .c-action-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 4px;
      }
      .c-action-btn:hover {
        background: var(--surface);
        color: var(--text-secondary);
      }
      .controversial::after {
        content: " †";
        color: var(--text-muted);
      }

      .comment-children {
        margin-left: 20px;
        padding-left: 16px;
        border-left: 2px solid var(--border-light);
      }
      .comment-children .comment:first-child {
        border-top: none;
      }

      /* Sidebar */
      .sidebar {
        position: sticky;
        top: 80px;
        align-self: start;
      }

      .sidebar-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 16px;
      }
      .sidebar-card h4 {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
        margin-bottom: 14px;
      }
      .fact-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
        font-size: 14px;
      }
      .fact-row:last-child {
        border-bottom: none;
      }
      .fact-label {
        color: var(--text-secondary);
      }
      .fact-value {
        font-weight: 600;
        color: var(--text);
      }
      .fact-value.yes {
        color: #26b455;
      }
      .fact-value.no {
        color: var(--text-muted);
      }

      .stack-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .stack-tag {
        background: #fff;
        border: 1px solid var(--border);
        font-size: 12px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 14px;
        color: var(--text-secondary);
      }

      .sidebar-cta {
        background: var(--ph-orange);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 12px;
        width: 100%;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s;
      }
      .sidebar-cta:hover {
        background: var(--ph-orange-hover);
      }

      /* Disclaimer */
      .disclaimer {
        max-width: 1080px;
        margin: 0 auto 32px;
        padding: 12px 24px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }
`;

const ENHANCE = `
(function () {
  document.addEventListener("click", function (e) {
    var t = e.target;
    var collapse = t.closest("[data-collapse]");
    if (collapse) {
      var comment = collapse.closest(".comment");
      if (comment) comment.classList.toggle("collapsed");
      return;
    }
    var cta = t.closest("[data-cta]");
    if (cta) {
      cta.textContent = cta.textContent === "🔗 Visit Website" ? "✓ Link Copied!" : "🔗 Visit Website";
      return;
    }
    var vote = t.closest("[data-vote]");
    if (vote) {
      var base = parseInt(vote.getAttribute("data-base"), 10) || 0;
      var countEl = vote.querySelector(".upvote-count, .c-vote-count");
      if (!countEl) return;
      if (vote.classList.contains("upvoted")) {
        vote.classList.remove("upvoted");
        countEl.textContent = String(base);
      } else {
        vote.classList.add("upvoted");
        countEl.textContent = String(base + 1);
      }
      return;
    }
  });
})();
`;

const AVATAR_COLORS = [
  "#da552f",
  "#4b587c",
  "#3bb2b8",
  "#8b572a",
  "#7b68ee",
  "#e67e22",
  "#27ae60",
  "#e74c3c",
  "#9b59b6",
  "#2980b9",
  "#1abc9c",
  "#d35400",
  "#c0392b",
  "#16a085",
  "#2c3e50",
] as const;

/** Normalize a language entry (object `{name}` or string) to its display name. */
function langName(l: ScrutinyOutput["project"]["languages"][number] | string): string {
  if (!l) return "";
  return typeof l === "object" && l.name ? l.name : String(l);
}

function CommentItem({ node, refNow }: { node: CommentNode; refNow: number }): VNode {
  const c = node.comment;
  const classes = ["comment"];
  if (c.is_deleted) classes.push("deleted");
  if (c.score < 0) classes.push("negative");

  const authorDisplay = c.is_deleted ? "[deleted]" : c.author;
  const avatarColor = colorForUser(authorDisplay, AVATAR_COLORS);
  const hasChildren = node.children.length > 0;

  return (
    <div class={classes.join(" ")} data-id={c.id}>
      <div
        class="comment-avatar"
        style={`background:${avatarColor}`}
        data-collapse="1"
        title="Collapse thread"
      >
        {initials(authorDisplay)}
      </div>
      <div class="comment-main">
        <div class="comment-header">
          <span class={`comment-author ${c.is_op ? "is-op" : ""}`}>
            {c.is_deleted ? "[deleted]" : c.author}
          </span>
          {c.is_op && <span class="maker-badge">🏷️ Maker</span>}
          {c.author_flair && !c.is_deleted && <span class="comment-flair">{c.author_flair}</span>}
          <span class="comment-time">· {timeAgoShort(c.created_utc, refNow)}</span>
          <span class="collapse-hint">(collapsed)</span>
        </div>
        <div class="comment-body" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        <div class="comment-actions">
          <button class="c-vote-btn" data-vote="comment" data-base={c.score}>
            <span class="arrow">▲</span>
            <span class={`c-vote-count${c.controversiality ? " controversial" : ""}`}>
              {c.score}
            </span>
          </button>
          <button class="c-action-btn">Reply</button>
          <button class="c-action-btn">Share</button>
        </div>
        {hasChildren && (
          <div class="comment-children">
            {node.children.map((child) => (
              <CommentItem key={child.comment.id} node={child} refNow={refNow} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductHeader({
  project,
  post,
}: {
  project: ScrutinyOutput["project"];
  post: ScrutinyOutput["simulation"]["post"];
}): VNode {
  return (
    <div class="product-header">
      <div class="upvote-box" data-vote="product" data-base={post.score}>
        <div class="upvote-arrow">▲</div>
        <div class="upvote-count">{post.score}</div>
      </div>
      <div class="product-info">
        <div class="product-name">{project.name}</div>
        <div class="product-tagline">{project.tagline}</div>
        <div class="product-tags">
          {project.languages.map((l, i) => (
            <span class="product-tag" key={i}>
              {langName(l)}
            </span>
          ))}
          {post.post_flair && <span class="product-tag">{post.post_flair}</span>}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  project,
  post,
}: {
  project: ScrutinyOutput["project"];
  post: ScrutinyOutput["simulation"]["post"];
}): VNode {
  const facts = project.facts;
  const stackItems = [
    ...new Set([...project.stack, ...project.languages.map(langName)].filter(Boolean)),
  ];
  const factRows: Array<[string, string | boolean | null]> = [
    ["License", facts.license],
    ["Has Tests", facts.has_tests],
    ["Has CI", facts.has_ci],
  ];

  return (
    <>
      <div class="sidebar-card">
        <h4>Tech Stack</h4>
        <div class="stack-list">
          {stackItems.map((s) => (
            <span class="stack-tag" key={s}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div class="sidebar-card">
        <h4>Project Info</h4>
        {factRows
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([label, v]) => (
            <div class="fact-row" key={label}>
              <span class="fact-label">{label}</span>
              {typeof v === "boolean" ? (
                <span class={`fact-value ${v ? "yes" : "no"}`}>{v ? "✓ Yes" : "✗ No"}</span>
              ) : (
                <span class="fact-value">{String(v)}</span>
              )}
            </div>
          ))}
      </div>
      {post.awards.length > 0 && (
        <div class="sidebar-card">
          <h4>Awards</h4>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            {post.awards.map((a, i) => (
              <span
                key={i}
                style="font-size:20px;"
                title={a.label}
                dangerouslySetInnerHTML={{
                  __html:
                    a.icon +
                    (a.count > 1
                      ? `<span style="font-size:12px;color:var(--text-muted);margin-left:2px;">×${a.count}</span>`
                      : ""),
                }}
              />
            ))}
          </div>
        </div>
      )}
      <button class="sidebar-cta" data-cta="1">
        🔗 Visit Website
      </button>
    </>
  );
}

export function Page({ doc }: { doc: ScrutinyOutput }): VNode {
  const sim = doc.simulation;
  const project = doc.project;
  const refNow = refNowSeconds(doc.generated_at);
  const tree = buildCommentTree(sim.comments, sim.post.id);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${project.name} — reddit-scrutinizer`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <nav class="topnav">
          <div class="topnav-logo">
            <div class="ph-icon">P</div>
            <span>Product Hunt</span>
          </div>
          <div class="topnav-badge">SIMULATED</div>
        </nav>

        <div id="app">
          <div class="page-wrapper">
            <div class="main-col">
              <div class="potd-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                PRODUCT OF THE DAY
              </div>
              <ProductHeader project={project} post={sim.post} />
              <div class="post-body">
                <h2>About</h2>
                <div
                  class="post-body-content"
                  dangerouslySetInnerHTML={{ __html: sim.post.body_html }}
                />
              </div>
              <div class="discussion-header">
                <h3>Discussion</h3>
                <span class="discussion-count">{sim.comments.length}</span>
              </div>
              <div class="comment-tree">
                {tree.map((node) => (
                  <CommentItem key={node.comment.id} node={node} refNow={refNow} />
                ))}
              </div>
            </div>
            <div class="sidebar">
              <Sidebar project={project} post={sim.post} />
            </div>
          </div>
          <div class="disclaimer">
            ⚠️ This is a simulated Product Hunt page generated by reddit-scrutinizer using{" "}
            {doc.input.model}. No real users or products were involved. Generated{" "}
            {fmtDateUTC(doc.generated_at)}.
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
