import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDb } from "@/lib/db";
import { User } from "@/models/User";
import { signAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; role?: "Admin" | "Sub-User" }
    | null;

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = body?.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (role !== "Admin" && role !== "Sub-User") {
    return NextResponse.json({ error: "Role must be Admin or Sub-User" }, { status: 400 });
  }

  await connectToDb();

  // Guardrail (DRD-aligned): only allow creating the FIRST Admin via public signup.
  if (role === "Admin") {
    const existingAdmin = await User.exists({ role: "Admin" });
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Admin already exists. Register as Sub-User." },
        { status: 403 }
      );
    }
  }

  const existingEmail = await User.exists({ email });
  if (existingEmail) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    email,
    passwordHash,
    role,
    assignedDevices: [],
  });

  const token = signAuthToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
    assignedDevices: user.assignedDevices,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
