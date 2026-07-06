import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SMOKE_TEST_PORT || 3102);
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetchWithTimeout("/");
      if (response.status < 500) return;
    } catch {
      await wait(500);
    }
  }

  throw new Error("Timed out waiting for the production server to start.");
}

async function readBody(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { text, json, contentType: response.headers.get("content-type") || "" };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectJson(path, expectedStatus, options = {}) {
  const response = await fetchWithTimeout(path, options);
  const body = await readBody(response);

  assert(response.status === expectedStatus, `${path} expected ${expectedStatus}, got ${response.status}: ${body.text.slice(0, 200)}`);
  assert(body.contentType.includes("application/json"), `${path} expected JSON content-type, got ${body.contentType || "(none)"}`);
  assert(body.json && typeof body.json === "object", `${path} expected valid JSON body.`);
  assert(!/<!doctype html|<html/i.test(body.text), `${path} returned HTML instead of JSON.`);

  return body.json;
}

async function expectJsonStatusIn(path, statuses, options = {}) {
  const response = await fetchWithTimeout(path, options);
  const body = await readBody(response);

  assert(statuses.includes(response.status), `${path} expected one of ${statuses.join(", ")}, got ${response.status}: ${body.text.slice(0, 200)}`);
  assert(body.contentType.includes("application/json"), `${path} expected JSON content-type, got ${body.contentType || "(none)"}`);
  assert(body.json && typeof body.json === "object", `${path} expected valid JSON body.`);
  assert(!/<!doctype html|<html/i.test(body.text), `${path} returned HTML instead of JSON.`);

  return { status: response.status, json: body.json };
}

async function main() {
  const server = spawn(process.execPath, [nextCli, "start", "-p", String(port)], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  let serverLog = "";
  server.stdout.on("data", chunk => {
    serverLog += chunk.toString();
  });
  server.stderr.on("data", chunk => {
    serverLog += chunk.toString();
  });

  try {
    await waitForServer();

    const restaurants = await expectJson("/api/restaurants", 401);
    assert(restaurants.error === "Could not load restaurants", "/api/restaurants should return a stable public error.");
    assert(restaurants.code === "UNAUTHENTICATED", "/api/restaurants should return UNAUTHENTICATED.");

    await expectJson("/api/dashboard-data", 405);
    await expectJson("/api/auth/session", 405);

    const mockDb = await expectJson("/api/mock-db", 403);
    assert(mockDb.code === "MOCK_DB_DISABLED", "/api/mock-db should be disabled in production server mode.");

    const publicMenu = await expectJsonStatusIn("/api/public-menu?slug=missing", [404, 500]);
    assert(
      publicMenu.status === 404 || publicMenu.json.code === "FIREBASE_ADMIN_CONFIG_ERROR",
      "/api/public-menu?slug=missing should return 404 when Firebase is configured, or a JSON Firebase config error locally."
    );

    const qrResponse = await fetchWithTimeout("/qr/test", { redirect: "manual" });
    assert(qrResponse.status < 500, `/qr/test should not return 500, got ${qrResponse.status}.`);

    console.log("Production route smoke tests passed.");
  } catch (error) {
    console.error(serverLog);
    throw error;
  } finally {
    server.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
