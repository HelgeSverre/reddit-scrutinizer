/** @jsxImportSource preact */
import type { VNode } from "preact";
import {
  buildCommentTree,
  colorForUser,
  type CommentNode,
  fmtDateUTC,
  formatCount,
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
        --bg: #000000;
        --surface: #16181c;
        --surface-hover: #1d1f23;
        --border: #2f3336;
        --text: #e7e9ea;
        --text-muted: #71767b;
        --text-link: #1d9bf0;
        --accent: #1d9bf0;
        --like: #f91880;
        --repost: #00ba7c;
        --verified: #1d9bf0;
        --font:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--font);
        font-size: 15px;
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
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border);
        height: 53px;
        display: flex;
        align-items: center;
        padding: 0 16px;
      }
      .topnav-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 20px;
        font-weight: 700;
        color: var(--text);
      }
      .topnav-logo svg {
        width: 28px;
        height: 28px;
      }
      .topnav-search {
        margin-left: 20px;
        flex: 1;
        max-width: 500px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 9999px;
        padding: 8px 16px;
        color: var(--text-muted);
        font-size: 15px;
      }
      .topnav-badge {
        margin-left: auto;
        background: var(--accent);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 9999px;
        letter-spacing: 0.3px;
      }

      /* Main feed container */
      .feed {
        max-width: 600px;
        margin: 0 auto;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
        min-height: 100vh;
      }

      /* Post (tweet) */
      .tweet {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
      }
      .tweet-header {
        display: flex;
        gap: 12px;
      }
      .tweet-avatar {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 700;
        color: #fff;
      }
      .tweet-meta {
        flex: 1;
        min-width: 0;
      }
      .tweet-author-row {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .tweet-name {
        font-weight: 700;
        font-size: 15px;
        color: var(--text);
      }
      .tweet-verified {
        display: inline-flex;
        align-items: center;
        margin-left: 2px;
      }
      .tweet-verified svg {
        width: 18px;
        height: 18px;
      }
      .tweet-handle {
        color: var(--text-muted);
        font-size: 15px;
      }
      .tweet-dot {
        color: var(--text-muted);
      }
      .tweet-time {
        color: var(--text-muted);
        font-size: 15px;
      }

      .tweet-flair {
        display: inline-block;
        background: var(--surface);
        color: var(--text-muted);
        font-size: 12px;
        padding: 1px 8px;
        border-radius: 4px;
        margin-left: 4px;
      }

      .tweet-body {
        margin-top: 8px;
        font-size: 15px;
        line-height: 1.55;
      }
      .tweet-body p {
        margin-bottom: 8px;
      }
      .tweet-body .post-title-line {
        font-weight: 700;
        font-size: 17px;
        margin-bottom: 6px;
        display: block;
      }
      .tweet-body code {
        background: var(--surface);
        padding: 1px 5px;
        border-radius: 4px;
        font-family: "SF Mono", Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .tweet-body pre {
        background: #0d1117;
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 8px 0;
        border: 1px solid var(--border);
      }
      .tweet-body pre code {
        background: none;
        padding: 0;
      }
      .tweet-body blockquote {
        border-left: 3px solid var(--border);
        padding-left: 12px;
        color: var(--text-muted);
        margin: 8px 0;
      }
      .tweet-body ul,
      .tweet-body ol {
        padding-left: 24px;
        margin: 8px 0;
      }
      .tweet-body h1,
      .tweet-body h2,
      .tweet-body h3 {
        margin: 12px 0 6px;
      }

      .tweet-awards {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .tweet-award {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 9999px;
        padding: 2px 8px;
        font-size: 13px;
      }
      .tweet-award-count {
        color: var(--text-muted);
        font-size: 12px;
      }

      /* Engagement bar */
      .tweet-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 12px;
        max-width: 425px;
      }
      .tweet-action {
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 13px;
        padding: 8px;
        margin: -8px;
        border-radius: 9999px;
        transition: color 0.15s;
      }
      .tweet-action svg {
        width: 18px;
        height: 18px;
        transition: color 0.15s;
      }
      .tweet-action:hover {
        background: none;
      }
      .tweet-action.reply:hover,
      .tweet-action.reply:hover svg {
        color: var(--accent);
      }
      .tweet-action.repost:hover,
      .tweet-action.repost:hover svg {
        color: var(--repost);
      }
      .tweet-action.like:hover,
      .tweet-action.like:hover svg {
        color: var(--like);
      }
      .tweet-action.like.liked,
      .tweet-action.like.liked svg {
        color: var(--like);
      }
      .tweet-action.views:hover,
      .tweet-action.views:hover svg {
        color: var(--accent);
      }
      .tweet-action.bookmark:hover,
      .tweet-action.bookmark:hover svg {
        color: var(--accent);
      }
      .tweet-action.share:hover,
      .tweet-action.share:hover svg {
        color: var(--accent);
      }

      /* Reply thread header */
      .thread-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        font-size: 20px;
        font-weight: 800;
        color: var(--text);
      }

      /* Comments (replies) */
      .comment {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
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
      .comment.collapsed .comment-avatar-col .thread-line {
        display: none;
      }

      .comment-avatar-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;
        width: 40px;
      }
      .comment-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
        flex-shrink: 0;
      }
      .thread-line {
        width: 2px;
        flex: 1;
        background: var(--border);
        margin-top: 4px;
        min-height: 8px;
      }

      .comment-main {
        flex: 1;
        min-width: 0;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .comment-name {
        font-weight: 700;
        font-size: 15px;
        color: var(--text);
      }
      .comment-verified {
        display: inline-flex;
        align-items: center;
        margin-left: 1px;
      }
      .comment-verified svg {
        width: 16px;
        height: 16px;
      }
      .comment-handle {
        color: var(--text-muted);
        font-size: 15px;
      }
      .comment-dot {
        color: var(--text-muted);
      }
      .comment-time {
        color: var(--text-muted);
        font-size: 15px;
      }
      .comment-flair {
        background: var(--surface);
        color: var(--text-muted);
        font-size: 11px;
        padding: 0 6px;
        border-radius: 4px;
      }
      .collapse-hint {
        display: none;
        color: var(--text-muted);
        font-size: 13px;
        font-style: italic;
      }

      .comment-body {
        font-size: 15px;
        line-height: 1.55;
        margin-top: 2px;
      }
      .comment-body p {
        margin-bottom: 6px;
      }
      .comment-body code {
        background: var(--surface);
        padding: 1px 5px;
        border-radius: 4px;
        font-family: "SF Mono", Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .comment-body pre {
        background: #0d1117;
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 6px 0;
        border: 1px solid var(--border);
      }
      .comment-body pre code {
        background: none;
        padding: 0;
      }
      .comment-body blockquote {
        border-left: 3px solid var(--border);
        padding-left: 12px;
        color: var(--text-muted);
        margin: 6px 0;
      }

      .comment.deleted .comment-name {
        color: var(--text-muted);
      }
      .comment.deleted .comment-body {
        color: var(--text-muted);
        font-style: italic;
      }

      .comment-actions {
        display: flex;
        gap: 0;
        margin-top: 4px;
        max-width: 300px;
        justify-content: space-between;
      }
      .c-action {
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 13px;
        padding: 4px;
        border-radius: 9999px;
        transition: color 0.15s;
      }
      .c-action svg {
        width: 16px;
        height: 16px;
      }
      .c-action.reply:hover,
      .c-action.reply:hover svg {
        color: var(--accent);
      }
      .c-action.repost:hover,
      .c-action.repost:hover svg {
        color: var(--repost);
      }
      .c-action.like:hover,
      .c-action.like:hover svg {
        color: var(--like);
      }
      .c-action.like.liked,
      .c-action.like.liked svg {
        color: var(--like);
      }

      .comment-children {
      }

      /* Like heart fill swap (JS toggles .liked) */
      .tweet-action .heart-filled,
      .c-action .heart-filled {
        display: none;
      }
      .tweet-action.liked .heart-outline,
      .c-action.liked .heart-outline {
        display: none;
      }
      .tweet-action.liked .heart-filled,
      .c-action.liked .heart-filled {
        display: inline;
      }

      /* Disclaimer */
      .disclaimer {
        max-width: 600px;
        margin: 0 auto;
        padding: 16px;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }

      @media (max-width: 600px) {
        .feed {
          border-left: none;
          border-right: none;
        }
        .topnav-search {
          display: none;
        }
        .disclaimer {
          border-left: none;
          border-right: none;
        }
      }
`;

const ENHANCE = `
(function () {
  function formatScore(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 10000) return (n / 1000).toFixed(1) + "K";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }
  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var avatar = el.closest(".comment-avatar[data-collapse]");
    if (avatar) {
      var comment = avatar.closest(".comment");
      if (comment) comment.classList.toggle("collapsed");
      return;
    }
    var likeBtn = el.closest(".tweet-action.like[data-like], .c-action.like[data-like]");
    if (likeBtn) {
      var base = parseInt(likeBtn.dataset.base, 10) || 0;
      var likeBase = likeBtn.classList.contains("c-action") ? Math.max(0, base) : base;
      var countEl = likeBtn.querySelector(".like-count");
      if (likeBtn.classList.contains("liked")) {
        likeBtn.classList.remove("liked");
        if (countEl) countEl.textContent = formatScore(likeBase);
      } else {
        likeBtn.classList.add("liked");
        if (countEl) countEl.textContent = formatScore(likeBase + 1);
      }
      return;
    }
  });
})();
`;

const AVATAR_COLORS = [
  "#1d9bf0",
  "#794bc4",
  "#00ba7c",
  "#f91880",
  "#ff7a00",
  "#ffd400",
  "#7856ff",
  "#f4212e",
  "#00bcd4",
  "#4caf50",
  "#e91e63",
  "#ff5722",
  "#009688",
  "#673ab7",
  "#3f51b5",
];

function ReplySvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M1.751 10c.004-.7.01-1.4.025-2.1C1.826 6.37 2.546 5 4.505 5h15.49c1.96 0 2.68 1.37 2.73 2.9.015.7.021 1.4.025 2.1 0 2.8-.07 5.6-.21 7.4-.1 1.3-.73 2.6-2.545 2.6H4.505c-1.815 0-2.445-1.3-2.545-2.6-.14-1.8-.21-4.6-.21-7.4z" />
      <path d="M8.5 15l3.5-3.5L8.5 8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function RepostSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M23.77 15.67a.749.749 0 0 0-1.06 0l-2.22 2.22V7.65a3.755 3.755 0 0 0-3.75-3.75h-5.85a.75.75 0 0 0 0 1.5h5.85a2.25 2.25 0 0 1 2.25 2.25v10.24l-2.22-2.22a.749.749 0 1 0-1.06 1.06l3.5 3.5c.145.147.337.22.53.22s.383-.072.53-.22l3.5-3.5a.747.747 0 0 0 0-1.06zm-10.66 3.28H7.26a2.25 2.25 0 0 1-2.25-2.25V6.46l2.22 2.22a.752.752 0 0 0 1.062 0 .749.749 0 0 0 0-1.06l-3.5-3.5a.747.747 0 0 0-1.06 0l-3.5 3.5a.749.749 0 1 0 1.06 1.06l2.22-2.22V16.7a3.755 3.755 0 0 0 3.75 3.75h5.85a.75.75 0 0 0 0-1.5z" />
    </svg>
  );
}

function HeartSvg() {
  return (
    <svg
      class="heart-outline"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
    >
      <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 3.96 5.973 3 8.236 3c1.386 0 2.673.397 3.764 1.121C13.09 3.397 14.377 3 15.764 3c2.262 0 4.33.96 5.455 3.21 1.116 2.06 1.025 4.48-.335 6.98z" />
    </svg>
  );
}

function HeartFilledSvg() {
  return (
    <svg class="heart-filled" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 3.96 5.973 3 8.236 3c1.386 0 2.673.397 3.764 1.121C13.09 3.397 14.377 3 15.764 3c2.262 0 4.33.96 5.455 3.21 1.116 2.06 1.025 4.48-.335 6.98z" />
    </svg>
  );
}

function ViewsSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M8 18V6m4 12V9m4 9v-6m4 6V3" />
    </svg>
  );
}

function BookmarkSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z" />
    </svg>
  );
}

function ShareSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41L7.71 9.71 6.3 8.3z" />
      <path d="M21 15v3c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-3" />
    </svg>
  );
}

function VerifiedSvg() {
  return (
    <svg viewBox="0 0 22 22" fill="var(--verified)">
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.607-.274 1.264-.144 1.897.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

function toHandle(name: string): string {
  return "@" + name.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function CommentItem({ node, refNow }: { node: CommentNode; refNow: number }): VNode {
  const c = node.comment;
  const classes = ["comment"];
  if (c.is_deleted) classes.push("deleted");
  const authorDisplay = c.is_deleted ? "[deleted]" : c.author;
  const color = colorForUser(authorDisplay, AVATAR_COLORS);
  const handle = toHandle(authorDisplay);
  const hasChildren = node.children.length > 0;

  return (
    <div class={classes.join(" ")} data-id={c.id}>
      <div class="comment-avatar-col">
        <div
          class="comment-avatar"
          style={`background:${color}`}
          data-collapse="true"
          title="Collapse"
        >
          {initials(authorDisplay)}
        </div>
        {hasChildren && <div class="thread-line" />}
      </div>
      <div class="comment-main">
        <div class="comment-header">
          <span class="comment-name">{c.is_deleted ? "[deleted]" : c.author}</span>
          {c.is_op && !c.is_deleted && (
            <span class="comment-verified">
              <VerifiedSvg />
            </span>
          )}
          {c.author_flair && !c.is_deleted && <span class="comment-flair">{c.author_flair}</span>}
          <span class="comment-handle">{handle}</span>
          <span class="comment-dot">·</span>
          <span class="comment-time">{timeAgoShort(c.created_utc, refNow)}</span>
          <span class="collapse-hint">(collapsed)</span>
        </div>
        <div class="comment-body" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        <div class="comment-actions">
          <button class="c-action reply">
            <ReplySvg />
          </button>
          <button class="c-action repost">
            <RepostSvg />
          </button>
          <button class="c-action like" data-like="true" data-base={c.score}>
            <HeartSvg />
            <HeartFilledSvg />
            <span class="like-count">{formatCount(Math.max(0, c.score))}</span>
          </button>
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
}): VNode {
  const color = colorForUser(post.author, AVATAR_COLORS);
  const handle = toHandle(post.author);
  const reposts = Math.floor(post.score * 0.15);
  const views = post.score * 50 + ((post.author.length * 137) % 500);

  return (
    <div class="tweet">
      <div class="tweet-header">
        <div class="tweet-avatar" style={`background:${color}`}>
          {initials(post.author)}
        </div>
        <div class="tweet-meta">
          <div class="tweet-author-row">
            <span class="tweet-name">{post.author}</span>
            <span class="tweet-verified">
              <VerifiedSvg />
            </span>
            <span class="tweet-handle">{handle}</span>
            <span class="tweet-dot">·</span>
            <span class="tweet-time">{timeAgoShort(post.created_utc, refNow)}</span>
            {post.post_flair && <span class="tweet-flair">{post.post_flair}</span>}
          </div>
        </div>
      </div>
      <div class="tweet-body">
        <span class="post-title-line">{post.title}</span>
        <div dangerouslySetInnerHTML={{ __html: post.body_html }} />
      </div>
      {post.awards.length > 0 && (
        <div class="tweet-awards">
          {post.awards.map((a, i) => (
            <span class="tweet-award" key={i}>
              <span dangerouslySetInnerHTML={{ __html: a.icon }} />
              {a.count > 1 && <span class="tweet-award-count">{a.count}</span>}
            </span>
          ))}
        </div>
      )}
      <div class="tweet-actions">
        <button class="tweet-action reply">
          <ReplySvg />
          <span>{formatCount(commentCount)}</span>
        </button>
        <button class="tweet-action repost">
          <RepostSvg />
          <span>{formatCount(reposts)}</span>
        </button>
        <button class="tweet-action like" data-like="true" data-base={post.score}>
          <HeartSvg />
          <HeartFilledSvg />
          <span class="like-count">{formatCount(post.score)}</span>
        </button>
        <button class="tweet-action views">
          <ViewsSvg />
          <span>{formatCount(views)}</span>
        </button>
        <button class="tweet-action bookmark">
          <BookmarkSvg />
        </button>
        <button class="tweet-action share">
          <ShareSvg />
        </button>
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
            <svg viewBox="0 0 24 24" fill="var(--text)">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div class="topnav-search">Search</div>
          <div class="topnav-badge">SIMULATED</div>
        </nav>

        <div id="app">
          <div class="feed">
            <PostCard post={sim.post} commentCount={sim.comments.length} refNow={refNow} />
            <div class="thread-header">Replies</div>
            <div class="comment-tree">
              {tree.map((node) => (
                <CommentItem key={node.comment.id} node={node} refNow={refNow} />
              ))}
            </div>
            <div class="disclaimer">
              This is a simulated X/Twitter thread generated by reddit-scrutinizer using{" "}
              {doc.input.model}. No real users were involved. Generated{" "}
              {fmtDateUTC(doc.generated_at)}.
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
