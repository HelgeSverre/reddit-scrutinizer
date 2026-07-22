/** @jsxImportSource preact */
import { render } from "preact-render-to-string";
import type { VNode } from "preact";
import type { Theme } from "../cli";
import type { ScrutinyOutput } from "./shared";
import { Page as BlueskyPage } from "./themes/bluesky";
import { Page as HackerNewsPage } from "./themes/hackernews";
import { Page as ProductHuntPage } from "./themes/producthunt";
import { Page as QdbPage } from "./themes/qdb";
import { Page as RedditPage } from "./themes/reddit";
import { Page as TwitterPage } from "./themes/twitter";

type PageComponent = (props: { doc: ScrutinyOutput }) => VNode;

const THEME_PAGES: Record<Theme, PageComponent> = {
  reddit: RedditPage,
  hackernews: HackerNewsPage,
  producthunt: ProductHuntPage,
  twitter: TwitterPage,
  bluesky: BlueskyPage,
  qdb: QdbPage,
};

/**
 * Server-render a theme into a complete, self-contained HTML document. Shared by
 * `serve` and `export`; the content is baked into the markup (readable with JS off).
 */
export function renderThemeDocument(theme: Theme, doc: ScrutinyOutput): string {
  const Page = THEME_PAGES[theme];
  if (!Page) throw new Error(`unknown theme: ${theme}`);
  return `<!doctype html>\n${render(<Page doc={doc} />)}\n`;
}
