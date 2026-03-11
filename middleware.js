import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BLOCKED_PAGE_PATHS = new Set(["/admin", "/login"]);
const BLOCKED_API_PATHS = new Set([
  "/api/mock/write",
  "/api/mock/enrich-one",
  "/api/mock/enrich-episodes",
  "/api/mock/repair-episode-urls",
  "/api/mock/discover-new",
  "/api/mock/discover-auto-import",
  "/api/mock/add-discovered",
  "/api/mock/login",
  "/api/mock/admin-dashboard",
  "/api/mock/admin-validate-urls",
  "/api/mock/admin-audit",
  "/api/mock/admin-snapshots",
]);

function getHostWithoutPort(hostHeader = "") {
  return String(hostHeader).split(":")[0].trim().toLowerCase();
}

function isLocalRequest(req) {
  const host = getHostWithoutPort(req.headers.get("host"));
  const forwardedHost = getHostWithoutPort(req.headers.get("x-forwarded-host"));
  const urlHost = getHostWithoutPort(req.nextUrl?.hostname || "");
  return LOCAL_HOSTS.has(host) || LOCAL_HOSTS.has(forwardedHost) || LOCAL_HOSTS.has(urlHost);
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
