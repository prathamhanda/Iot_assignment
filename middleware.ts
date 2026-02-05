import { NextResponse, type NextRequest } from "next/server";
import { verifyJwtEdge } from "./lib/auth/jwt-edge";
import { AUTH_COOKIE_NAME } from "./lib/auth/constants";

const PROTECTED_PREFIXES = ["/dashboard", "/devices", "/alerts", "/settings"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (pathname === "/login" || pathname === "/signup") {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.next();
    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.next();
    const payload = await verifyJwtEdge(token, secret);
    if (!payload) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (isProtectedPath(pathname) || pathname === "/") {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const payload = await verifyJwtEdge(token, secret);
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/api/admin") && payload.role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return new NextResponse("Forbidden", { status: 403 });
    const secret = process.env.JWT_SECRET;
    if (!secret) return new NextResponse("Forbidden", { status: 403 });
    const payload = await verifyJwtEdge(token, secret);
    if (!payload || payload.role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/devices/:path*",
    "/alerts/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/api/admin/:path*",
  ],
};
