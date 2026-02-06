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

function toClientDevice(doc: any) {
  return {
    id: String(doc._id),
    serialNumber: String(doc.serialNumber),
    name: String(doc.name ?? ""),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  await connectToDb();

  const user = await User.findById(id).select({ role: 1 }).lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role !== "Sub-User") {
    return NextResponse.json({ error: "Only Sub-Users have assigned devices" }, { status: 400 });
  }

  const devices = await Device.find({ assignedUsers: new mongoose.Types.ObjectId(id) })
    .sort({ createdAt: -1 })
    .select({ serialNumber: 1, name: 1 })
    .lean();

  return NextResponse.json({ devices: devices.map(toClientDevice) });
}
