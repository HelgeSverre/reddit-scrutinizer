import { describe, test, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { startServer } from "../src/ui/server";

const FIXTURE_JSON = join(import.meta.dir, "fixtures/sample-scrutiny.json");

let servers: Array<{ stop: () => void }> = [];

// Bun.serve returns a Server object we can track for cleanup
const originalServe = Bun.serve;

function trackServer<T>(server: T): T {
  servers.push(server as any);
  return server;
}

afterEach(() => {
  for (const server of servers) {
    try {
      server.stop();
    } catch {}
  }
  servers = [];
});

// Monkey-patch Bun.serve to track servers for cleanup
const _origServe = Bun.serve.bind(Bun);
// @ts-ignore
Bun.serve = function (...args: any[]) {
  const server = _origServe(...args);
  servers.push(server);
  return server;
};

describe("startServer", () => {
  test("starts server on the requested port", async () => {
    const port = 19876;
    const actualPort = await startServer(FIXTURE_JSON, port, false);

    expect(actualPort).toBe(port);
  });

  test("serves HTML on /", async () => {
    const port = 19877;
    await startServer(FIXTURE_JSON, port, false);

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain("</html>");
  });

  test("serves JSON on /api/data", async () => {
    const port = 19878;
    await startServer(FIXTURE_JSON, port, false);

    const res = await fetch(`http://localhost:${port}/api/data`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const data = await res.json();
    expect(data.schema_version).toBe("1.0");
    expect(data.simulation).toBeDefined();
    expect(data.simulation.post).toBeDefined();
    expect(data.simulation.comments).toBeArray();
  });

  test("returns 404 for unknown routes", async () => {
    const port = 19879;
    await startServer(FIXTURE_JSON, port, false);

    const res = await fetch(`http://localhost:${port}/nonexistent`);
    expect(res.status).toBe(404);
  });

  test("serves /api/data with CORS header", async () => {
    const port = 19880;
    await startServer(FIXTURE_JSON, port, false);

    const res = await fetch(`http://localhost:${port}/api/data`);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
