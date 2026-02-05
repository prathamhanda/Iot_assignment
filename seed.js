/*
  Seed devices into MongoDB (oes_db) for internship submission.

  Usage:
    1) Ensure MongoDB is running
    2) Ensure .env.local has MONGODB_URI (already present)
    3) Run:
         node seed.js

  Notes:
    - Upserts by serialNumber (safe to re-run)
    - Writes into the same collection used by the app: devices
*/

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (process.env[key] == null) process.env[key] = value;
  }
}

if (!process.env.MONGODB_URI) loadEnvLocal();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Put it in .env.local");
  process.exit(1);
}

function normalizeStatus(input) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "online") return "Online";
  if (raw === "offline") return "Offline";
  if (raw === "warning") return "Warning";
  return "Offline";
}

async function main() {
  const filePath = path.join(__dirname, "seed-devices.json");
  const devices = JSON.parse(fs.readFileSync(filePath, "utf8"));

  await mongoose.connect(MONGODB_URI);

  const collection = mongoose.connection.db.collection("devices");

  let upserted = 0;
  let modified = 0;

  for (const d of devices) {
    const serialNumber = String(d.serialNumber ?? "").trim();
    if (!/^\d{10}$/.test(serialNumber)) {
      throw new Error(`Invalid serialNumber (expected 10 digits): ${serialNumber}`);
    }

    const doc = {
      serialNumber,
      name: String(d.name ?? "").trim(),
      type: String(d.type ?? "").trim(),
      location: String(d.location ?? "—").trim() || "—",
      macAddress: String(d.macAddress ?? "").trim(),
      firmwareVersion: String(d.firmwareVersion ?? "").trim(),
      protocol: String(d.protocol ?? "MQTT").trim() || "MQTT",
      status: normalizeStatus(d.status),
      assignedUsers: Array.isArray(d.assignedUsers) ? d.assignedUsers : [],
      updatedAt: new Date(),
    };

    const res = await collection.updateOne(
      { serialNumber },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    if (res.upsertedCount) upserted += res.upsertedCount;
    if (res.modifiedCount) modified += res.modifiedCount;
  }

  console.log(`Seed complete. Upserted: ${upserted}, Modified: ${modified}`);

  const count = await collection.countDocuments();
  console.log(`devices collection count: ${count}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
