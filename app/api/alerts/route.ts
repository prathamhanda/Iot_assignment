import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import { verifyAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { connectToDb } from "@/lib/db";
import { Device } from "@/lib/models/Device";
import { Alert } from "@/lib/models/Alert";

type AuthPayload = ReturnType<typeof verifyAuthToken>;

async function getAuth(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

function toClientAlert(doc: any) {
  return {
    id: String(doc._id),
    device_id: String(doc.deviceSerial),
    timestamp: new Date(doc.timestamp).toISOString(),
    metric: "voltage" as const,
    value: Number(doc.value),
    threshold: Number(doc.threshold),
    severity: "warning" as const,
    message: String(doc.message ?? ""),
  };
}

async function getAssignedSerialsForUser(userId: string) {
  const rows = await Device.find({ assignedUsers: new mongoose.Types.ObjectId(userId) })
    .select({ serialNumber: 1 })
    .lean();
  return rows.map((d) => String(d.serialNumber));
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDb();

  const query =
    auth.role === "Admin"
      ? {}
      : { deviceSerial: { $in: await getAssignedSerialsForUser(auth.sub) } };

  const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(100).lean();
  return NextResponse.json({ alerts: alerts.map(toClientAlert) });
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as any;

  const deviceSerial = String(body?.device_id ?? body?.deviceSerial ?? "").trim();
  const metric = String(body?.metric ?? "voltage").trim();
  const value = Number(body?.value);
  const threshold = Number(body?.threshold);
  const message = String(body?.message ?? "").trim();
  const timestampRaw = body?.timestamp;
  const timestamp = new Date(timestampRaw ?? Date.now());

  if (!/^\d{10}$/.test(deviceSerial)) {
    return NextResponse.json({ error: "device_id must be a 10-digit serial" }, { status: 400 });
  }
  if (metric !== "voltage") {
    return NextResponse.json({ error: "Unsupported metric" }, { status: 400 });
  }
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) {
    return NextResponse.json({ error: "Invalid value/threshold" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }

  await connectToDb();

  // Sub-Users can only create alerts for devices assigned to them.
  if (auth.role !== "Admin") {
    const allowed = await Device.exists({
      serialNumber: deviceSerial,
      assignedUsers: new mongoose.Types.ObjectId(auth.sub),
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const created = await Alert.create({
    deviceSerial,
    timestamp,
    metric: "voltage",
    value,
    threshold,
    severity: "warning",
    message,
  });

  return NextResponse.json({ alert: toClientAlert(created) }, { status: 201 });
}

export async function DELETE() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDb();

  if (auth.role === "Admin") {
    await Alert.deleteMany({});
    return NextResponse.json({ ok: true });
  }

  const serials = await getAssignedSerialsForUser(auth.sub);
  if (serials.length === 0) return NextResponse.json({ ok: true });
  await Alert.deleteMany({ deviceSerial: { $in: serials } });
  return NextResponse.json({ ok: true });
}
