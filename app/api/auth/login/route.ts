import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Device } from "@/lib/models/Device";
import { signAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

function getIpAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  await dbConnect();
  const user = await User.findOne({ email });
  const ipAddress = getIpAddress(request);

  if (!user) {
    // Avoid user enumeration.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = Boolean(user.passwordHash) && (await bcrypt.compare(password, user.passwordHash));
  user.loginActivity.unshift({
    userId: user._id,
    timestamp: new Date(),
    ipAddress,
    success: ok,
  });
  if (user.loginActivity.length > 50) user.loginActivity.splice(50);
  await user.save();

  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const role = user.role;
  if (role !== "Admin" && role !== "Sub-User") {
    return NextResponse.json({ error: "Invalid user role" }, { status: 500 });
  }

  const assignedDevices =
    role === "Sub-User"
      ? (await Device.find({ assignedUsers: user._id }).select({ serialNumber: 1 }).lean()).map(
          (d) => String(d.serialNumber)
        )
      : [];

  const token = signAuthToken({
    sub: String(user._id),
    uid: String(user._id),
    email: user.email,
    role,
    assignedDevices,
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      email: user.email,
      role,
      assignedDevices,
    },
  });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
