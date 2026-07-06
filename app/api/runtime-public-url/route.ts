import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNTIME_PUBLIC_URL_FILE = ".qr-public-url";

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function getConfiguredBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_QR_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    "";

  return normalizeBaseUrl(configured);
}

function getRuntimeFileBaseUrl() {
  try {
    const runtimeFilePath = path.join(process.cwd(), RUNTIME_PUBLIC_URL_FILE);
    if (!fs.existsSync(runtimeFilePath)) return "";

    const firstUrlLine = fs
      .readFileSync(runtimeFilePath, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith("#"));

    return firstUrlLine ? normalizeBaseUrl(firstUrlLine) : "";
  } catch (error) {
    console.warn("Unable to read runtime QR public URL:", error);
    return "";
  }
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
}

function getRequestOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");

  return `${proto}://${host}`.replace(/\/+$/, "");
}

function getLocalNetworkAddress() {
  const interfaces = os.networkInterfaces();
  const candidates: Array<{ address: string; score: number }> = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    const networkEntries = (entries || []) as Array<{ family: string | number; address: string; internal: boolean }>;

    for (const entry of networkEntries) {
      const family = typeof entry.family === "string" ? entry.family : String(entry.family);
      const address = entry.address;

      if (family !== "IPv4" || entry.internal) continue;
      if (!address || address.startsWith("127.") || address.startsWith("169.254.")) continue;

      const interfaceName = name.toLowerCase();
      const isLikelyPhysical = /(wi-?fi|wlan|ethernet|local area)/i.test(interfaceName);
      const isLikelyVirtual = /(virtual|vmware|vbox|docker|wsl|hyper-v|vethernet|loopback)/i.test(interfaceName);
      const isPrivateLan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(address);

      let score = 0;
      if (isPrivateLan) score += 10;
      if (isLikelyPhysical) score += 8;
      if (isLikelyVirtual) score -= 8;

      candidates.push({ address, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address || "";
}

export async function GET(request: NextRequest) {
  const configuredBaseUrl = getConfiguredBaseUrl();
  if (configuredBaseUrl) {
    return NextResponse.json({
      baseUrl: configuredBaseUrl,
      source: "configured",
    });
  }

  const runtimeFileBaseUrl = getRuntimeFileBaseUrl();
  if (runtimeFileBaseUrl) {
    return NextResponse.json({
      baseUrl: runtimeFileBaseUrl,
      source: "runtime-file",
    });
  }

  const requestOrigin = getRequestOrigin(request);
  const originUrl = new URL(requestOrigin);

  if (!isLocalHost(originUrl.hostname)) {
    return NextResponse.json({
      baseUrl: requestOrigin,
      source: "request",
    });
  }

  const lanAddress = getLocalNetworkAddress();
  if (lanAddress) {
    originUrl.hostname = lanAddress;

    return NextResponse.json({
      baseUrl: originUrl.toString().replace(/\/+$/, ""),
      source: "lan",
      warning: "The QR uses your computer's local network address. Keep the phone on the same Wi-Fi network.",
    });
  }

  return NextResponse.json({
    baseUrl: requestOrigin,
    source: "local-fallback",
    warning: "No LAN address was detected. Open this app through a public URL or set NEXT_PUBLIC_QR_BASE_URL.",
  });
}
