import type { VNode } from "preact";
import {
  buildCommentTree,
  type CommentNode,
  fmtDateUTC,
  refNowSeconds,
  type ScrutinyOutput,
  timeAgoLong,
} from "../shared";

const CSS = `
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        background: #fff;
        font-family: Verdana, Geneva, sans-serif;
        font-size: 10pt;
        color: #000;
      }

      .hn-center {
        width: 85%;
        max-width: 1280px;
        margin: 0 auto;
        background: #f6f6ef;
      }

      a {
        color: #000;
        text-decoration: none;
      }
      a:visited {
        color: #828282;
      }
      a:hover {
        text-decoration: underline;
      }

      /* Header */
      .header {
        background: #ff6600;
        padding: 2px;
      }
      .header-inner {
        display: flex;
        align-items: center;
        padding: 2px 4px;
        gap: 4px;
      }
      .header-logo {
        border: 1px solid #fff;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 11px;
        color: #fff;
        background: #ff6600;
        flex-shrink: 0;
      }
      .header-nav {
        font-size: 10pt;
        color: #000;
        font-weight: bold;
      }
      .header-nav a {
        color: #000;
      }
      .header-nav .hn-name {
        font-weight: bold;
        margin-right: 6px;
      }
      .header-nav .pipe {
        color: #000;
        margin: 0 3px;
      }
      .header-badge {
        margin-left: auto;
        background: #fff;
        color: #ff6600;
        font-size: 8pt;
        font-weight: bold;
        padding: 1px 5px;
        border-radius: 2px;
      }

      /* Main content area */
      .content {
        padding: 0;
      }

      /* Post (item) */
      .post-row {
        padding: 10px 6px 0 6px;
      }
      .post-title-row {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .post-rank {
        color: #828282;
        font-size: 10pt;
        min-width: 20px;
        text-align: right;
        margin-right: 2px;
      }
      .upvote {
        color: #9a9a9a;
        cursor: pointer;
        font-size: 10pt;
        user-select: none;
        margin-right: 2px;
      }
      .upvote:hover {
        color: #ff6600;
      }
      .upvote.upvoted {
        color: #ff6600;
      }
      .post-title-text {
        font-size: 10pt;
      }
      .post-title-text a {
        color: #000;
      }
      .post-title-text a:visited {
        color: #828282;
      }
      .post-domain {
        font-size: 8pt;
        color: #828282;
        margin-left: 4px;
      }
      .post-subline {
        font-size: 7pt;
        color: #828282;
        padding-left: 38px;
        margin-top: 2px;
        padding-bottom: 5px;
      }
      .post-subline a {
        color: #828282;
      }
      .post-subline a:hover {
        text-decoration: underline;
      }

      /* Post body (self text) */
      .post-body-container {
        padding: 8px 6px 8px 38px;
        font-size: 9pt;
        color: #000;
        line-height: 1.4;
      }
      .post-body-container p {
        margin-bottom: 8px;
      }
      .post-body-container code {
        font-family: monospace;
        font-size: 9pt;
        background: #e8e8e0;
        padding: 1px 3px;
      }
      .post-body-container pre {
        background: #e8e8e0;
        padding: 8px;
        overflow-x: auto;
        margin: 6px 0;
        font-size: 9pt;
      }
      .post-body-container pre code {
        background: none;
        padding: 0;
      }
      .post-body-container blockquote {
        border-left: 2px solid #828282;
        padding-left: 8px;
        color: #828282;
        margin: 6px 0;
        font-style: italic;
      }
      .post-body-container ul,
      .post-body-container ol {
        padding-left: 20px;
        margin: 6px 0;
      }

      /* Separator */
      .spacer {
        height: 10px;
      }

      /* Comments section */
      .comments-header {
        padding: 0 6px;
        border-top: 2px solid #ff6600;
        padding-top: 6px;
      }

      .comment-tree {
        padding: 0 6px 20px 6px;
      }

      .comment {
        margin-top: 10px;
      }
      .comment.collapsed > .comment-main > .comment-body,
      .comment.collapsed > .comment-main > .comment-actions,
      .comment.collapsed > .comment-main > .comment-children {
        display: none;
      }

      .comment-head {
        font-size: 7pt;
        color: #828282;
        display: flex;
        align-items: baseline;
        gap: 4px;
        flex-wrap: wrap;
      }
      .comment-head .c-upvote {
        color: #9a9a9a;
        cursor: pointer;
        font-size: 8pt;
        user-select: none;
      }
      .comment-head .c-upvote:hover {
        color: #ff6600;
      }
      .comment-head .c-upvote.upvoted {
        color: #ff6600;
      }
      .comment-toggle {
        cursor: pointer;
        font-size: 7pt;
        color: #828282;
        user-select: none;
      }
      .comment-toggle:hover {
        color: #000;
      }
      .comment-user {
        font-weight: bold;
        color: #000;
      }
      .comment-user a {
        color: #000;
        text-decoration: none;
      }
      .comment-user.is-op a {
        color: #3c963c;
      }
      .comment-score {
        color: #828282;
      }
      .comment-time {
        color: #828282;
      }
      .comment-time a {
        color: #828282;
      }
      .comment-nav-link a {
        color: #828282;
        font-size: 7pt;
      }
      .comment-nav-link a:hover {
        text-decoration: underline;
      }
      .controversial::after {
        content: " [flagged]";
      }

      .comment-text {
        font-size: 9pt;
        color: #000;
        line-height: 1.4;
        margin-top: 4px;
        overflow-wrap: break-word;
      }
      .comment-text p {
        margin-bottom: 6px;
      }
      .comment-text code {
        font-family: monospace;
        font-size: 9pt;
        background: #e8e8e0;
        padding: 1px 3px;
      }
      .comment-text pre {
        background: #e8e8e0;
        padding: 8px;
        overflow-x: auto;
        margin: 6px 0;
        font-size: 9pt;
      }
      .comment-text pre code {
        background: none;
        padding: 0;
      }
      .comment-text blockquote {
        border-left: 2px solid #828282;
        padding-left: 8px;
        color: #828282;
        margin: 6px 0;
        font-style: italic;
      }

      .comment.deleted .comment-user a {
        color: #828282;
      }
      .comment.deleted .comment-text {
        color: #828282;
        font-style: italic;
      }
      .comment.negative .comment-text {
        opacity: 0.6;
      }

      .comment-reply a {
        color: #828282;
        font-size: 7pt;
        text-decoration: underline;
      }
      .comment-children {
      }

      /* Disclaimer */
      .disclaimer {
        border-top: 2px solid #ff6600;
        padding: 10px;
        text-align: center;
        font-size: 7pt;
        color: #828282;
        margin-top: 20px;
      }

      /* Footer links */
      .hn-footer {
        text-align: center;
        padding: 10px;
        border-top: 2px solid #ff6600;
        font-size: 7pt;
        color: #828282;
      }
      .hn-footer a {
        color: #828282;
        margin: 0 4px;
      }

      @media (max-width: 600px) {
        .post-subline {
          padding-left: 28px;
        }
        .post-body-container {
          padding-left: 28px;
        }
      }
`;

const ENHANCE = `
(function () {
  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var toggle = el.closest("[data-collapse]");
    if (toggle) {
      var comment = toggle.closest(".comment");
      if (!comment) return;
      var collapsed = comment.classList.toggle("collapsed");
      toggle.textContent = collapsed ? "[+]" : "[–]";
      return;
    }
    var vote = el.closest("[data-vote]");
    if (!vote) return;
    if (vote.classList.contains("c-upvote")) {
      var head = vote.closest(".comment-head");
      if (!head) return;
      var cScore = head.querySelector(".comment-score");
      if (!cScore) return;
      var cBase = parseInt(cScore.dataset.base, 10) || 0;
      if (vote.classList.contains("upvoted")) {
        vote.classList.remove("upvoted");
        cScore.textContent = cBase + " point" + (cBase !== 1 ? "s" : "");
      } else {
        vote.classList.add("upvoted");
        cScore.textContent = (cBase + 1) + " point" + (cBase + 1 !== 1 ? "s" : "");
      }
      return;
    }
    var row = vote.closest(".post-row");
    if (!row) return;
    var pScore = row.querySelector(".post-score-val");
    if (!pScore) return;
    var pBase = parseInt(pScore.dataset.base, 10) || 0;
    if (vote.classList.contains("upvoted")) {
      vote.classList.remove("upvoted");
      pScore.textContent = pBase + " point" + (pBase !== 1 ? "s" : "");
    } else {
      vote.classList.add("upvoted");
      pScore.textContent = (pBase + 1) + " point" + (pBase + 1 !== 1 ? "s" : "");
    }
  });
})();
`;

function CommentItem({
  node,
  depth,
  refNow,
}: {
  node: CommentNode;
  depth: number;
  refNow: number;
}) {
  const c = node.comment;
  const classes = ["comment"];
  if (c.is_deleted) classes.push("deleted");
  if (c.score < 0) classes.push("negative");

  return (
    <div class={classes.join(" ")} data-id={c.id} style={`margin-left: ${depth * 40}px;`}>
      <div class="comment-main">
        <div class="comment-head">
          <span class="c-upvote" data-vote="up" title="upvote">
            ▲
          </span>
          <span class={`comment-user ${c.is_op ? "is-op" : ""}`}>
            <a href="#">{c.is_deleted ? "[deleted]" : c.author}</a>
          </span>
          <span
            class={`comment-score${c.controversiality ? " controversial" : ""}`}
            data-base={c.score}
          >
            {c.score} point{c.score !== 1 ? "s" : ""}
          </span>
          <span class="comment-time">
            <a href="#">{timeAgoLong(c.created_utc, refNow)}</a>
          </span>
          <span class="comment-toggle" data-collapse={c.id}>
            [–]
          </span>
        </div>
        <div class="comment-body">
          <div class="comment-text" dangerouslySetInnerHTML={{ __html: c.body_html }} />
        </div>
        <div class="comment-actions">
          <span class="comment-reply">
            <a href="#">reply</a>
          </span>
        </div>
        <div class="comment-children">
          {node.children.map((child) => (
            <CommentItem key={child.comment.id} node={child} depth={depth + 1} refNow={refNow} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PostRow({
  post,
  commentCount,
  refNow,
}: {
  post: ScrutinyOutput["simulation"]["post"];
  commentCount: number;
  refNow: number;
}) {
  return (
    <div class="post-row">
      <div class="post-title-row">
        <span class="post-rank">1.</span>
        <span class="upvote" data-vote="up" title="upvote">
          ▲
        </span>
        <span class="post-title-text">
          <a href="#">{post.title}</a>
        </span>
        <span class="post-domain">(self)</span>
      </div>
      <div class="post-subline">
        <span class="post-score-val" data-base={post.score}>
          {post.score} point{post.score !== 1 ? "s" : ""}
        </span>{" "}
        by <a href="#">{post.author}</a> <span>{timeAgoLong(post.created_utc, refNow)}</span> |{" "}
        <a href="#">hide</a> |{" "}
        <a href="#">
          {commentCount}
          {" "}comment{commentCount !== 1 ? "s" : ""}
        </a>
      </div>
    </div>
  );
}

export function Page({ doc }: { doc: ScrutinyOutput }): VNode {
  const sim = doc.simulation;
  const post = sim.post;
  const commentCount = sim.comments.length;
  const refNow = refNowSeconds(doc.generated_at);
  const tree = buildCommentTree(sim.comments, post.id);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${doc.project.name} — reddit-scrutinizer`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div class="hn-center">
          <table width="100%" cellSpacing="0" cellPadding="0" style="background-color: #ff6600">
            <tr>
              <td style="padding: 2px">
                <div class="header-inner">
                  <div class="header-logo">Y</div>
                  <span class="header-nav">
                    <a href="#" class="hn-name">
                      Hacker News
                    </a>
                    <span class="pipe">|</span>
                    <a href="#">new</a>
                    <span class="pipe">|</span>
                    <a href="#">past</a>
                    <span class="pipe">|</span>
                    <a href="#">comments</a>
                    <span class="pipe">|</span>
                    <a href="#">ask</a>
                    <span class="pipe">|</span>
                    <a href="#">show</a>
                    <span class="pipe">|</span>
                    <a href="#">jobs</a>
                    <span class="pipe">|</span>
                    <a href="#">submit</a>
                  </span>
                  <span class="header-badge">SIMULATED</span>
                </div>
              </td>
            </tr>
          </table>

          <div id="app">
            <div class="content">
              <PostRow post={post} commentCount={commentCount} refNow={refNow} />
              {post.body_html ? (
                <div
                  class="post-body-container"
                  dangerouslySetInnerHTML={{ __html: post.body_html }}
                />
              ) : null}
              <div class="spacer" />
              <div class="comment-tree">
                {tree.map((node) => (
                  <CommentItem key={node.comment.id} node={node} depth={0} refNow={refNow} />
                ))}
              </div>
            </div>
            <div class="disclaimer">
              ⚠ This is a simulated Hacker News thread generated by reddit-scrutinizer using{" "}
              {doc.input.model}. No real users were involved. Generated{" "}
              {fmtDateUTC(doc.generated_at)}.
            </div>
            <div class="hn-footer">
              <a href="#">Guidelines</a>|<a href="#">FAQ</a>|<a href="#">Lists</a>|
              <a href="#">API</a>|<a href="#">Security</a>|<a href="#">Legal</a>|
              <a href="#">Apply to YC</a>|<a href="#">Contact</a>
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
