import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { startServer } from "../src/ui/server";

const FIXTURE_JSON = join(import.meta.dir, "fixtures/sample-scrutiny.json");

let servers: Array<{ stop: () => void }> = [];

const originalServe = Bun.serve;
const startBunServer = originalServe.bind(Bun) as (...args: unknown[]) => { stop: () => void };

afterEach(() => {
  for (const server of servers) {
    try {
      server.stop();
    } catch {}
  }
  servers = [];
});

// Monkey-patch Bun.serve to track servers for cleanup
Bun.serve = ((...args: unknown[]) => {
  const server = startBunServer(...args);
  servers.push(server);
  return server;
}) as typeof Bun.serve;

afterAll(() => {
  Bun.serve = originalServe;
});

describe("startServer", () => {
  test("starts server on the requested port", async () => {
    const port = 19876;
    const actualPort = await startServer(FIXTURE_JSON, port, false, "reddit");

    expect(actualPort).toBe(port);
  });

  test("serves server-rendered HTML with baked content on /", async () => {
    const port = 19877;
    await startServer(FIXTURE_JSON, port, false, "reddit");

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain("</html>");
    expect(body).toContain("I built a test project"); // post title baked into markup
  });

  test("returns 404 for unknown routes", async () => {
    const port = 19879;
    await startServer(FIXTURE_JSON, port, false, "reddit");

    const res = await fetch(`http://localhost:${port}/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("serves hackernews theme", async () => {
    const port = 19881;
    await startServer(FIXTURE_JSON, port, false, "hackernews");

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Hacker News");
    expect(body).toContain("</html>");
  });

  test("serves producthunt theme", async () => {
    const port = 19882;
    await startServer(FIXTURE_JSON, port, false, "producthunt");

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Product Hunt");
    expect(body).toContain("</html>");
  });

  test("reddit theme contains baked reddit content", async () => {
    const port = 19883;
    await startServer(FIXTURE_JSON, port, false, "reddit");

    const res = await fetch(`http://localhost:${port}/`);
    const body = await res.text();
    expect(body).toContain("reddit-scrutinizer");
    expect(body).toContain("I built a test project");
  });

  test("invalid theme throws an error", () => {
    expect(startServer(FIXTURE_JSON, 19884, false, "nonexistent")).rejects.toThrow();
  });
});
