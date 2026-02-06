import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import { verifyAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { connectToDb } from "@/lib/db";
import { Device } from "@/lib/models/Device";
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

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { userId?: string; deviceId?: string }
    | null;

  const userId = String(body?.userId ?? "").trim();
  const deviceId = String(body?.deviceId ?? "").trim();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(deviceId)) {
    return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
  }

  await connectToDb();

  const user = await User.findById(userId).lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role !== "Sub-User") {
    return NextResponse.json({ error: "Only Sub-Users can be assigned devices" }, { status: 400 });
  }

  const updated = await Device.findOneAndUpdate(
    { _id: deviceId },
    { $addToSet: { assignedUsers: new mongoose.Types.ObjectId(userId) } },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
