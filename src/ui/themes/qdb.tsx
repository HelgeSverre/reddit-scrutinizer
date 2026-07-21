import { Fragment, type VNode } from "preact";
import { type Comment, type ScrutinyOutput, stripHtml } from "../shared";

const CSS = `
      body {
        background-color: #ffffff;
        color: #000000;
        margin: 0;
        padding: 0;
        font-family: arial, helvetica, sans-serif;
        font-size: smaller;
      }
      a {
        color: #0000ee;
      }
      a:visited {
        color: #551a8b;
      }
      .header-bar {
        background-color: #c08000;
        padding: 2px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: arial, helvetica, sans-serif;
      }
      .header-bar .title {
        font-size: 14pt;
        font-weight: bold;
        font-style: italic;
        color: #000000;
      }
      .header-bar .quote-title {
        font-size: 12pt;
        font-weight: bold;
        color: #000000;
      }
      .nav-bar {
        background-color: #e0e0e0;
        padding: 1px 8px;
        font-family: arial, helvetica, sans-serif;
        font-size: smaller;
        text-align: right;
      }
      .nav-bar a {
        color: #0000ee;
        text-decoration: none;
      }
      .nav-bar a:hover {
        text-decoration: underline;
      }
      .golden-bar {
        background-color: #c08000;
        height: 6px;
        font-size: 0;
      }
      .footer-info {
        text-align: right;
        padding: 2px 8px;
        font-family: arial, helvetica, sans-serif;
        font-size: smaller;
        color: #000000;
      }
      .content {
        padding: 16px 8px 8px 8px;
      }
      .vote-line {
        font-family:
          courier new,
          lucida console,
          fixed;
        font-size: 10pt;
        margin-bottom: 2px;
      }
      .vote-line a.qnum {
        color: #c08000;
        font-weight: bold;
      }
      .vote-line .vote-link {
        font-size: 8pt;
        color: #0000ee;
        text-decoration: none;
        cursor: pointer;
        background: none;
        border: none;
        font-family: inherit;
        padding: 0;
      }
      .vote-line .vote-link:hover {
        text-decoration: underline;
      }
      .vote-line .score {
        color: #000000;
      }
      .vote-line .flag {
        font-size: 8pt;
        color: #888888;
        text-decoration: none;
        cursor: pointer;
        background: none;
        border: none;
        font-family: inherit;
        padding: 0;
      }
      .qt {
        font-family:
          courier new,
          lucida console,
          fixed;
        font-size: 10pt;
        margin-top: 0px;
        white-space: pre-line;
      }
      .simulated-badge {
        background: #cc0000;
        color: #ffffff;
        font-size: 8pt;
        font-weight: bold;
        padding: 0px 4px;
        margin-left: 6px;
        font-style: normal;
      }
      /* IRC nick colors */
      .irc-nick {
        font-weight: bold;
      }
      .irc-action {
        color: #8b008b;
      }
      .irc-context {
        color: #888888;
      }
      .irc-deleted {
        color: #999999;
      }
      .irc-flair {
        color: #888888;
      }
      .irc-separator {
        color: #aaaaaa;
      }
      .heart {
        text-align: center;
        padding: 8px;
        font-size: smaller;
      }
      .heart a {
        text-decoration: none;
      }
`;

const ENHANCE = `
(function () {
  document.addEventListener("click", function (e) {
    var el = e.target;
    var flag = el.closest("[data-flag]");
    if (flag) { flag.textContent = "[flagged]"; flag.disabled = true; return; }
    var vote = el.closest("[data-vote]");
    if (!vote) return;
    var line = vote.closest(".vote-line");
    if (!line) return;
    var scoreEl = line.querySelector(".score");
    if (!scoreEl) return;
    var base = parseInt(scoreEl.getAttribute("data-base"), 10) || 0;
    var cur = scoreEl.hasAttribute("data-cur")
      ? parseInt(scoreEl.getAttribute("data-cur"), 10)
      : base;
    cur += vote.getAttribute("data-vote") === "up" ? 1 : -1;
    scoreEl.setAttribute("data-cur", String(cur));
    scoreEl.textContent = String(cur);
  });
})();
`;

// Deterministic "bash.org"-style quote number from an arbitrary string.
function quoteNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 900000) + 10000;
}

const NICK_COLORS = [
  "#006600",
  "#0000cc",
  "#cc0000",
  "#008080",
  "#800080",
  "#808000",
  "#c06000",
  "#0066cc",
  "#660066",
  "#006666",
  "#336633",
  "#333399",
] as const;

function nickColor(name: string): string {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return NICK_COLORS[hash % NICK_COLORS.length]!;
}

// Deterministic IRC-style timestamp, UTC-based so exports are reproducible.
function fmtDate(utc: number): string {
  const d = new Date(utc * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]!} ${months[d.getUTCMonth()]!} ${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}

function wrapText(text: string, maxLen: number): string[] {
  const result: string[] = [];
  const rawLines = text.split(/\n/);
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxLen) {
      result.push(trimmed);
    } else {
      let remaining = trimmed;
      while (remaining.length > maxLen) {
        let breakAt = remaining.lastIndexOf(" ", maxLen);
        if (breakAt <= 0) breakAt = maxLen;
        result.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trim();
      }
      if (remaining) result.push(remaining);
    }
  }
  return result;
}

type Line =
  | { type: "separator"; text: string }
  | { type: "action"; nick: string; text: string }
  | { type: "msg"; nick: string; text: string; isOp: boolean; flair: string | null }
  | { type: "context"; replyTo: string; text: string }
  | { type: "deleted"; nick: string };

function buildLines(doc: ScrutinyOutput): Line[] {
  const sim = doc.simulation;
  const project = doc.project;
  const post = sim.post;
  const comments = sim.comments;
  const channel = "#" + sim.subreddit.name;

  const lines: Line[] = [];

  lines.push({ type: "separator", text: `--- Log opened ${fmtDate(post.created_utc)} ---` });
  lines.push({ type: "action", nick: post.author, text: `has joined ${channel}` });
  lines.push({
    type: "separator",
    text: `--- Topic for ${channel}: ${project.tagline || project.name} ---`,
  });

  const postText = stripHtml(post.body_html);
  lines.push({
    type: "msg",
    nick: post.author,
    text: post.title,
    isOp: true,
    flair: post.author_flair,
  });

  const bodyLines = wrapText(postText, 90);
  for (const bl of bodyLines.slice(0, 15)) {
    lines.push({ type: "msg", nick: post.author, text: bl, isOp: true, flair: null });
  }
  if (bodyLines.length > 15) {
    lines.push({
      type: "msg",
      nick: post.author,
      text: `[... ${bodyLines.length - 15} more lines, use a pastebin ffs]`,
      isOp: true,
      flair: null,
    });
  }

  lines.push({ type: "separator", text: "" });

  const byParent = new Map<string, Comment[]>();
  for (const c of comments) {
    const list = byParent.get(c.parent_id);
    if (list) list.push(c);
    else byParent.set(c.parent_id, [c]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.created_utc - b.created_utc);
  }

  const walkComments = (parentId: string, depth: number): void => {
    const kids = byParent.get(parentId);
    if (!kids) return;
    for (const c of kids) {
      if (c.is_deleted) {
        lines.push({ type: "deleted", nick: c.author || "unknown" });
      } else {
        const text = stripHtml(c.body_html);
        const wrapped = wrapText(text, 90);

        if (depth > 0 && c.parent_id !== post.id) {
          const parent = comments.find((p) => p.id === c.parent_id);
          if (parent && !parent.is_deleted) {
            const ctx = stripHtml(parent.body_html).slice(0, 60);
            lines.push({ type: "context", replyTo: parent.author, text: ctx });
          }
        }

        for (let i = 0; i < Math.min(wrapped.length, 8); i++) {
          lines.push({
            type: "msg",
            nick: c.author,
            text: wrapped[i]!,
            isOp: c.is_op,
            flair: i === 0 ? c.author_flair : null,
          });
        }
        if (wrapped.length > 8) {
          lines.push({
            type: "msg",
            nick: c.author,
            text: `[... ${wrapped.length - 8} more lines]`,
            isOp: c.is_op,
            flair: null,
          });
        }
      }
      walkComments(c.id, depth + 1);
    }
  };

  walkComments(post.id, 0);

  lines.push({ type: "separator", text: "" });
  lines.push({
    type: "action",
    nick: post.author,
    text: `has left ${channel} ("thanks for the feedback I guess")`,
  });

  return lines;
}

function renderLine(line: Line): VNode | null {
  switch (line.type) {
    case "msg": {
      const color = nickColor(line.nick);
      const opTag = line.isOp ? " [OP]" : "";
      return (
        <>
          <span class="irc-nick" style={`color:${color}`}>
            {`<${line.nick}${opTag}>`}
          </span>
          {line.flair ? (
            <>
              {" "}
              <span class="irc-flair">{`[${line.flair}]`}</span>
            </>
          ) : null}{" "}
          {line.text}
        </>
      );
    }
    case "action":
      return <span class="irc-action">{`* ${line.nick} ${line.text}`}</span>;
    case "context":
      return (
        <span class="irc-context">
          {`  > <${line.replyTo}> ${line.text}${line.text.length >= 60 ? "..." : ""}`}
        </span>
      );
    case "deleted":
      return <span class="irc-deleted">{`<${line.nick}> [message deleted]`}</span>;
    case "separator":
      return line.text ? <span class="irc-separator">{line.text}</span> : null;
    default:
      return null;
  }
}

export function Page({ doc }: { doc: ScrutinyOutput }): VNode {
  const sim = doc.simulation;
  const post = sim.post;
  const comments = sim.comments;
  const qNum = quoteNum(post.id);
  const total = post.score + comments.reduce((s, c) => s + c.score, 0);
  const lines = buildLines(doc);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${doc.project.name} — reddit-scrutinizer`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div class="header-bar">
          <span class="title">
            QDB<span class="simulated-badge">SIMULATED</span>
          </span>
          <span class="quote-title" id="quote-title">{`Quote #${qNum}`}</span>
        </div>
        <div class="nav-bar">
          <a href="#">Home</a> / <a href="#">Latest</a> / <a href="#">Browse</a> /{" "}
          <a href="#">Random</a>&gt;0 / <a href="#">Top 100</a>-200
        </div>

        <div id="app">
          <div class="content">
            <div class="vote-line">
              <a class="qnum" href="#">{`#${qNum}`}</a>{" "}
              <button class="vote-link" data-vote="up">
                +
              </button>{" "}
              (
              <span class="score" data-base={total}>
                {total}
              </span>
              ){" "}
              <button class="vote-link" data-vote="down">
                -
              </button>{" "}
              <button class="flag" data-flag="1">
                [X]
              </button>
            </div>
            <p class="qt">
              {lines.map((line, i) => (
                <Fragment key={i}>
                  {renderLine(line)}
                  {i < lines.length - 1 ? "\n" : null}
                </Fragment>
              ))}
            </p>
          </div>
        </div>

        <div class="nav-bar" style="margin-top: 8px">
          <a href="#">Home</a> / <a href="#">Latest</a> / <a href="#">Browse</a> /{" "}
          <a href="#">Random</a>&gt;0 / <a href="#">Top 100</a>-200
        </div>
        <div class="golden-bar" />
        <div class="footer-info" id="footer-count">
          {`${quoteNum(doc.generated_at)} quotes approved`}
        </div>
        <div class="heart">
          <a href="#">&lt;3</a>
        </div>

        <script dangerouslySetInnerHTML={{ __html: ENHANCE }} />
      </body>
    </html>
  );
}
