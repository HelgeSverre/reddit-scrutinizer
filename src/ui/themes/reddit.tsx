/** @jsxImportSource preact */
import type { VNode } from "preact";
import {
  buildCommentTree,
  type CommentNode,
  deterministicOnline,
  fakeMembers,
  fmtDateUTC,
  formatScoreK,
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
        --bg: #030303;
        --surface: #1a1a1b;
        --surface-hover: #252526;
        --border: #343536;
        --text: #d7dadc;
        --text-muted: #818384;
        --text-link: #4fbcff;
        --accent: #ff4500;
        --upvote: #ff4500;
        --downvote: #7193ff;
        --op-badge: #0079d3;
        --comment-line: #343536;
        --comment-line-hover: #818384;
        --flair-bg: #272729;
        --flair-text: #d7dadc;
        --award-bg: #1a1a1b;
        --font:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--font);
        font-size: 14px;
        line-height: 1.5;
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
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        height: 48px;
        display: flex;
        align-items: center;
        padding: 0 20px;
      }
      .topnav-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
      }
      .topnav-logo svg {
        width: 32px;
        height: 32px;
      }
      .topnav-search {
        margin-left: 24px;
        flex: 1;
        max-width: 600px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 6px 16px;
        color: var(--text-muted);
        font-size: 14px;
      }
      .topnav-badge {
        margin-left: auto;
        background: var(--accent);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
      }

      /* Subreddit header */
      .sub-header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 12px 0;
      }
      .sub-header-inner {
        max-width: 740px;
        margin: 0 auto;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .sub-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 700;
        color: #fff;
      }
      .sub-info h1 {
        font-size: 22px;
        font-weight: 700;
      }
      .sub-info .sub-meta {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .sub-join {
        margin-left: auto;
        background: #fff;
        color: #1a1a1b;
        border: none;
        border-radius: 20px;
        padding: 6px 16px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
      }
      .sub-join:hover {
        opacity: 0.9;
      }

      /* Main container */
      .main {
        max-width: 740px;
        margin: 16px auto;
        padding: 0 16px;
      }

      /* Post card */
      .post {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        display: flex;
        overflow: hidden;
      }
      .post-votes {
        width: 40px;
        background: #161617;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        gap: 4px;
        flex-shrink: 0;
      }
      .vote-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 2px;
        width: 24px;
        height: 24px;
      }
      .vote-btn:hover {
        background: var(--surface-hover);
      }
      .vote-btn.upvoted {
        color: var(--upvote);
      }
      .vote-btn.downvoted {
        color: var(--downvote);
      }
      .vote-btn svg {
        width: 20px;
        height: 20px;
      }
      .post-score {
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }

      .post-content {
        flex: 1;
        padding: 8px 12px;
      }
      .post-meta {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .post-meta .op-name {
        color: var(--text-link);
      }

      .post-flair {
        display: inline-block;
        background: var(--flair-bg);
        color: var(--flair-text);
        font-size: 12px;
        padding: 1px 8px;
        border-radius: 12px;
        margin-right: 6px;
        border: 1px solid var(--border);
      }

      .post-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text);
      }

      .post-awards {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .award {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: var(--award-bg);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 6px;
        font-size: 12px;
      }
      .award-count {
        color: var(--text-muted);
      }

      .post-body {
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 12px;
      }
      .post-body p {
        margin-bottom: 8px;
      }
      .post-body code {
        background: var(--bg);
        padding: 1px 4px;
        border-radius: 3px;
        font-family: "SF Mono", Monaco, monospace;
        font-size: 13px;
      }
      .post-body pre {
        background: var(--bg);
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .post-body pre code {
        padding: 0;
        background: none;
      }
      .post-body blockquote {
        border-left: 3px solid var(--border);
        padding-left: 12px;
        color: var(--text-muted);
        margin: 8px 0;
      }
      .post-body ul,
      .post-body ol {
        padding-left: 24px;
        margin: 8px 0;
      }
      .post-body h1,
      .post-body h2,
      .post-body h3 {
        margin: 12px 0 6px;
      }

      .post-actions {
        display: flex;
        gap: 4px;
        padding: 4px 0;
        border-top: 1px solid var(--border);
        margin-top: 4px;
      }
      .action-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 700;
        padding: 6px 8px;
        border-radius: 2px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .action-btn:hover {
        background: var(--surface-hover);
      }
      .action-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Comments section */
      .comments-header {
        padding: 16px 0 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .comments-sort {
        background: none;
        border: none;
        color: var(--text-link);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        padding: 4px 8px;
      }

      .comment-tree {
        padding-bottom: 40px;
      }

      .comment {
        display: flex;
        padding-top: 8px;
        position: relative;
      }
      .comment.collapsed > .comment-main > .comment-body,
      .comment.collapsed > .comment-main > .comment-actions,
      .comment.collapsed > .comment-main > .comment-children {
        display: none;
      }
      .comment.collapsed > .comment-main > .comment-header .collapse-hint {
        display: inline;
      }

      .comment-thread-line {
        width: 22px;
        flex-shrink: 0;
        display: flex;
        justify-content: center;
        cursor: pointer;
        position: relative;
      }
      .comment-thread-line::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        background: var(--comment-line);
        transform: translateX(-50%);
      }
      .comment-thread-line:hover::after {
        background: var(--comment-line-hover);
      }

      .comment-main {
        flex: 1;
        min-width: 0;
      }

      .comment-header {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .comment-author {
        font-weight: 700;
        color: var(--text);
      }
      .comment-author.is-op {
        color: var(--op-badge);
      }
      .op-badge {
        background: var(--op-badge);
        color: #fff;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 2px;
        font-weight: 700;
      }
      .comment-flair {
        background: var(--flair-bg);
        color: var(--flair-text);
        font-size: 11px;
        padding: 0 6px;
        border-radius: 10px;
        border: 1px solid var(--border);
      }
      .collapse-hint {
        display: none;
        color: var(--text-muted);
        font-style: italic;
      }

      .comment-body {
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 4px;
      }
      .comment-body p {
        margin-bottom: 6px;
      }
      .comment-body code {
        background: var(--bg);
        padding: 1px 4px;
        border-radius: 3px;
        font-family: "SF Mono", Monaco, monospace;
        font-size: 13px;
      }
      .comment-body pre {
        background: var(--bg);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 6px 0;
      }
      .comment-body pre code {
        padding: 0;
        background: none;
      }
      .comment-body blockquote {
        border-left: 3px solid var(--border);
        padding-left: 12px;
        color: var(--text-muted);
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
        opacity: 0.7;
      }

      .comment-actions {
        display: flex;
        gap: 2px;
        padding: 2px 0;
      }
      .comment-actions .action-btn {
        font-size: 12px;
        padding: 4px 6px;
      }
      .comment-actions .c-score {
        font-weight: 700;
        font-size: 12px;
      }
      .comment-actions .c-score.upvoted {
        color: var(--upvote);
      }
      .comment-actions .c-score.downvoted {
        color: var(--downvote);
      }
      .controversial::after {
        content: " †";
        color: var(--text-muted);
      }

      .comment-children {
      }

      /* Disclaimer */
      .disclaimer {
        max-width: 740px;
        margin: 20px auto;
        padding: 12px 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }

      @media (max-width: 600px) {
        .main {
          padding: 0 8px;
        }
        .post-title {
          font-size: 16px;
        }
        .topnav-search {
          display: none;
        }
      }
`;

const ENHANCE = `
(function () {
  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  document.addEventListener("click", function (e) {
    var el = e.target;
    var line = el.closest(".comment-thread-line");
    if (line) { line.closest(".comment").classList.toggle("collapsed"); return; }
    var join = el.closest(".sub-join");
    if (join) { join.textContent = join.textContent === "Join" ? "Joined" : "Join"; return; }
    var btn = el.closest(".vote-btn");
    if (!btn) return;
    var container = btn.closest(".post-votes") || btn.closest(".comment-actions");
    if (!container) return;
    var scoreEl = container.querySelector(".post-score, .c-score");
    if (!scoreEl) return;
    var base = parseInt(scoreEl.dataset.base, 10) || 0;
    var buttons = container.querySelectorAll(".vote-btn");
    var upBtn = buttons[0], downBtn = buttons[1];
    if (btn.dataset.vote === "up") {
      if (upBtn.classList.contains("upvoted")) {
        upBtn.classList.remove("upvoted"); scoreEl.classList.remove("upvoted"); scoreEl.textContent = fmt(base);
      } else {
        upBtn.classList.add("upvoted"); downBtn.classList.remove("downvoted");
        scoreEl.classList.add("upvoted"); scoreEl.classList.remove("downvoted"); scoreEl.textContent = fmt(base + 1);
      }
    } else {
      if (downBtn.classList.contains("downvoted")) {
        downBtn.classList.remove("downvoted"); scoreEl.classList.remove("downvoted"); scoreEl.textContent = fmt(base);
      } else {
        downBtn.classList.add("downvoted"); upBtn.classList.remove("upvoted");
        scoreEl.classList.add("downvoted"); scoreEl.classList.remove("upvoted"); scoreEl.textContent = fmt(base - 1);
      }
    }
  });
})();
`;

function UpArrow() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M10 3 L3 11 H7 V17 H13 V11 H17 Z" fill="currentColor" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg viewBox="0 0 20 20">
      <path d="M10 17 L3 9 H7 V3 H13 V9 H17 Z" fill="currentColor" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path
        d="M2 4 H18 V14 H8 L4 18 V14 H2 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </svg>
  );
}

function CommentItem({ node, refNow }: { node: CommentNode; refNow: number }) {
  const c = node.comment;
  const classes = ["comment"];
  if (c.is_deleted) classes.push("deleted");
  if (c.score < 0) classes.push("negative");

  return (
    <div class={classes.join(" ")} data-id={c.id}>
      <div class="comment-thread-line" title="Collapse thread" />
      <div class="comment-main">
        <div class="comment-header">
          <span class={`comment-author${c.is_op ? " is-op" : ""}`}>
            {c.is_deleted ? "[deleted]" : `u/${c.author}`}
          </span>
          {c.is_op && <span class="op-badge">OP</span>}
          {c.author_flair && !c.is_deleted && <span class="comment-flair">{c.author_flair}</span>}
          <span>· {timeAgoShort(c.created_utc, refNow)}</span>
          <span class="collapse-hint">(collapsed)</span>
        </div>
        <div class="comment-body" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        <div class="comment-actions">
          <button class="vote-btn" data-vote="up" title="Upvote">
            <UpArrow />
          </button>
          <span class={`c-score${c.controversiality ? " controversial" : ""}`} data-base={c.score}>
            {formatScoreK(c.score)}
          </span>
          <button class="vote-btn" data-vote="down" title="Downvote">
            <DownArrow />
          </button>
          <button class="action-btn" style="margin-left:8px">
            Reply
          </button>
          <button class="action-btn">Share</button>
          <button class="action-btn">⋯</button>
        </div>
        <div class="comment-children">
          {node.children.map((child) => (
            <CommentItem key={child.comment.id} node={child} refNow={refNow} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  commentCount,
  refNow,
}: {
  post: ScrutinyOutput["simulation"]["post"];
  commentCount: number;
  refNow: number;
}) {
  return (
    <div class="post">
      <div class="post-votes">
        <button class="vote-btn" data-vote="up" title="Upvote">
          <UpArrow />
        </button>
        <span class="post-score" data-base={post.score}>
          {formatScoreK(post.score)}
        </span>
        <button class="vote-btn" data-vote="down" title="Downvote">
          <DownArrow />
        </button>
      </div>
      <div class="post-content">
        <div class="post-meta">
          {post.post_flair && <span class="post-flair">{post.post_flair}</span>}
          Posted by <span class="op-name">u/{post.author}</span>
          {post.author_flair && <span class="comment-flair">{post.author_flair}</span>}·{" "}
          {timeAgoShort(post.created_utc, refNow)}
        </div>
        <h2 class="post-title">{post.title}</h2>
        {post.awards.length > 0 && (
          <div class="post-awards">
            {post.awards.map((a, i) => (
              <span class="award" key={i}>
                <span dangerouslySetInnerHTML={{ __html: a.icon }} />
                <span class="award-count">{a.count > 1 ? a.count : ""}</span>
              </span>
            ))}
          </div>
        )}
        <div class="post-body" dangerouslySetInnerHTML={{ __html: post.body_html }} />
        <div class="post-actions">
          <button class="action-btn">
            <CommentIcon /> {commentCount} Comments
          </button>
          <button class="action-btn">↗ Share</button>
          <button class="action-btn">⚑ Save</button>
          <button class="action-btn">⋯</button>
        </div>
      </div>
    </div>
  );
}

export function Page({ doc }: { doc: ScrutinyOutput }): VNode {
  const sim = doc.simulation;
  const refNow = refNowSeconds(doc.generated_at);
  const tree = buildCommentTree(sim.comments, sim.post.id);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${doc.project.name} — reddit-scrutinizer`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <nav class="topnav">
          <div class="topnav-logo">
            <svg viewBox="0 0 20 20" fill="var(--accent)">
              <circle cx="10" cy="10" r="10" />
              <circle cx="6.5" cy="9" r="1.5" fill="#fff" />
              <circle cx="13.5" cy="9" r="1.5" fill="#fff" />
              <path d="M6 13 Q10 16 14 13" stroke="#fff" stroke-width="1.2" fill="none" />
              <ellipse cx="3" cy="8" rx="2" ry="2.5" fill="var(--accent)" />
              <ellipse cx="17" cy="8" rx="2" ry="2.5" fill="var(--accent)" />
              <line x1="14" y1="2" x2="17" y2="2" stroke="var(--accent)" stroke-width="2.5" />
              <line x1="17" y1="2" x2="17" y2="5" stroke="var(--accent)" stroke-width="2.5" />
              <circle cx="17" cy="2" r="1.5" fill="var(--accent)" />
            </svg>
            <span>reddit</span>
          </div>
          <div class="topnav-search">Search Reddit</div>
          <div class="topnav-badge">SIMULATED</div>
        </nav>

        <div id="app">
          <div class="sub-header">
            <div class="sub-header-inner">
              <div class="sub-icon">{sim.subreddit.name[0]?.toUpperCase() ?? "R"}</div>
              <div class="sub-info">
                <h1>{sim.subreddit.display}</h1>
                <div class="sub-meta">
                  {fakeMembers(sim.subreddit.name)} members ·{" "}
                  {deterministicOnline(sim.subreddit.name)} online
                </div>
              </div>
              <button class="sub-join">Join</button>
            </div>
          </div>
          <div class="main">
            <PostCard post={sim.post} commentCount={sim.comments.length} refNow={refNow} />
            <div class="comments-header">
              <span style="font-size:12px;color:var(--text-muted)">
                {sim.comments.length} Comments
              </span>
              <button class="comments-sort">Sort by: Best ▾</button>
            </div>
            <div class="comment-tree">
              {tree.map((node) => (
                <CommentItem key={node.comment.id} node={node} refNow={refNow} />
              ))}
            </div>
          </div>
          <div class="disclaimer">
            ⚠️ This is a simulated Reddit thread generated by reddit-scrutinizer using{" "}
            {doc.input.model}. No real users were involved. Generated {fmtDateUTC(doc.generated_at)}
            .
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
