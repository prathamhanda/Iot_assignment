import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { connectToDb } from "@/lib/db";
import { User } from "@/models/User";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyAuthToken(token);
    if (payload.role !== "Admin") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectToDb();
  const users = await User.find({}, { email: 1, role: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    users: users.map((u) => ({ id: String(u._id), email: u.email, role: u.role })),
  });
}
