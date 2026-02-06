import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { verifyAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { dbConnect } from "@/lib/mongodb";
import { Device } from "@/lib/models/Device";

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

function toClientDevice(doc: any) {
	return {
		id: String(doc._id),
		serialNumber: String(doc.serialNumber),
		name: String(doc.name ?? ""),
		type: String(doc.type ?? ""),
		macAddress: String(doc.macAddress ?? ""),
		firmwareVersion: String(doc.firmwareVersion ?? ""),
		status: doc.status,
		location: doc.location ?? "—",
		protocol: doc.protocol ?? "MQTT",
	};
}

function normalizeStatus(input: unknown) {
	const raw = String(input ?? "").trim().toLowerCase();
	if (raw === "online") return "Online";
	if (raw === "offline") return "Offline";
	if (raw === "warning") return "Warning";
	return String(input ?? "Offline").trim();
}

export async function GET() {
	const auth = await getAuth();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await dbConnect();
	if (auth.role === "Admin") {
		const devices = await Device.find({}).sort({ createdAt: -1 }).lean();
		return NextResponse.json({ devices: devices.map(toClientDevice) });
	}

	// Sub-User: return assigned devices only (DRD 2.1).
	// Internship demo fallback (DRD 2.3): if none assigned, return a small sample
	// so the dashboard is not empty for recruiters.
	const assignedQuery = { assignedUsers: new mongoose.Types.ObjectId(auth.sub) };
	const assigned = await Device.find(assignedQuery).sort({ createdAt: -1 }).lean();
	if (assigned.length > 0) {
		return NextResponse.json({ devices: assigned.map(toClientDevice) });
	}

	const sample = await Device.find({}).sort({ createdAt: -1 }).limit(3).lean();
	return NextResponse.json({ devices: sample.map(toClientDevice) });
}

export async function POST(request: Request) {
	const auth = await getAuth();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (auth.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const body = (await request.json().catch(() => null)) as any;
	const serialNumber = String(body?.serialNumber ?? "").trim();
	const name = String(body?.name ?? "").trim();
	const type = String(body?.type ?? "").trim();
	const macAddress = String(body?.macAddress ?? "").trim();
	const firmwareVersion = String(body?.firmwareVersion ?? "").trim();
	const status = normalizeStatus(body?.status ?? "Offline");

	if (!/^\d{10}$/.test(serialNumber)) {
		return NextResponse.json({ error: "serialNumber must be exactly 10 digits" }, { status: 400 });
	}
	if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
	if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });
	if (!macAddress) return NextResponse.json({ error: "macAddress is required" }, { status: 400 });
	if (!firmwareVersion) return NextResponse.json({ error: "firmwareVersion is required" }, { status: 400 });
	if (!/[\S]/.test(status)) return NextResponse.json({ error: "status is required" }, { status: 400 });

	await dbConnect();

	try {
		const created = await Device.create({
			serialNumber,
			name,
			type,
			macAddress,
			firmwareVersion,
			status,
			assignedUsers: Array.isArray(body?.assignedUsers) ? body.assignedUsers : [],
			location: body?.location,
			protocol: body?.protocol,
		});

		return NextResponse.json({ device: toClientDevice(created) }, { status: 201 });
	} catch (err: any) {
		if (err?.code === 11000) {
			return NextResponse.json(
				{ error: "A device with this serialNumber already exists" },
				{ status: 409 }
			);
		}
		throw err;
	}
}

