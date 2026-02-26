import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BLOCKED_PAGE_PATHS = new Set(["/admin", "/login"]);
const BLOCKED_API_PATHS = new Set([
  "/api/mock/write",
  "/api/mock/enrich-one",
  "/api/mock/enrich-episodes",
  "/api/mock/enrich-preview",
  "/api/mock/repair-episode-urls",
  "/api/saveData",
  "/api/syncStreamtape",
]);

function getHostWithoutPort(hostHeader = "") {
  return String(hostHeader).split(":")[0].trim().toLowerCase();
}

function isLocalRequest(req) {
  const host = getHostWithoutPort(req.headers.get("host"));
  return LOCAL_HOSTS.has(host);
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isLocalRequest(req)) {
    return NextResponse.next();
  }

  if (BLOCKED_PAGE_PATHS.has(pathname)) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  if (BLOCKED_API_PATHS.has(pathname)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/login", "/api/:path*"],
};
