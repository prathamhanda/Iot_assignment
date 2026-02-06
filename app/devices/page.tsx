"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RegisterDeviceModal } from "@/components/devices/RegisterDeviceModal";
import { DeviceTypeBadge, StatusBadge } from "@/components/devices/DeviceBadges";
import { useIoTSimulator } from "@/hooks/useIoTSimulator";
import { useAuth } from "@/components/auth/AuthContext";
import type { Device } from "@/lib/mock-data";

type StatusFilter = "all" | "connected" | "disconnected";

export default function DevicesPage() {
  const { devices, setDevices, refreshDevices } = useIoTSimulator();
  const { isAdmin } = useAuth();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(Device & { id?: string }) | null>(null);

  function normalizeStatus(status: unknown) {
    return String(status ?? "").trim().toLowerCase();
  }

  function toApiStatus(status: unknown) {
    const s = normalizeStatus(status);
    if (s === "online") return "Online";
    if (s === "offline") return "Offline";
    if (s === "warning") return "Warning";
    return "Offline";
  }

  const existingSerials = useMemo(
    () => new Set(devices.map((d) => d.serialNumber)),
    [devices]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return devices.filter((d) => {
      const matchesSerial = q ? d.serialNumber.includes(q) : true;
      const connected = normalizeStatus(d.status) !== "offline";
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "connected"
            ? connected
            : !connected;

      return matchesSerial && matchesStatus;
    });
  }, [devices, query, statusFilter]);

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(device: Device) {
    setEditTarget(device);
    setModalOpen(true);
  }

  async function handleSubmit(device: Device) {
    if (!isAdmin) return;

    const payload = {
      ...device,
      status: toApiStatus(device.status),
    };

    if (editTarget?.id) {
      const res = await fetch(`/api/devices/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.device) {
          setDevices((prev) =>
            prev.map((d) =>
              String(d.serialNumber) === String(device.serialNumber) ? data.device : d
            )
          );
        }
      }
      await refreshDevices();
      return;
    }

    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.device) setDevices((prev) => [data.device, ...prev]);
    }
    await refreshDevices();
  }

  async function handleDelete(row: Device & { id?: string }) {
    if (!isAdmin) return;
    if (!row.id) {
      setDevices((prev) => prev.filter((d) => d.serialNumber !== row.serialNumber));
      return;
    }
    const res = await fetch(`/api/devices/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setDevices((prev) => prev.filter((d) => String(d.id ?? "") !== String(row.id)));
    }
    await refreshDevices();
  }

  const mode = editTarget ? "edit" : "create";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Devices</h1>
          <p className="text-sm text-slate-600">
            Register, search, and manage devices.
            {!isAdmin ? " (View Only)" : ""}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Register New Device
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Serial Number"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-slate-500">Status</div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="all">All</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Registered Devices</div>
          <div className="text-xs text-slate-500">{filtered.length} shown</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Serial No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Device Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Device Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">MAC Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Firmware Version</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                {isAdmin ? (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                ) : null}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.serialNumber} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    <Link
                      href={`/devices/${d.serialNumber}`}
                      className="font-mono text-slate-900 hover:underline"
                    >
                      {d.serialNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{d.name}</td>
                  <td className="px-4 py-3">
                    <DeviceTypeBadge type={d.type} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.macAddress}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{d.firmwareVersion}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(d)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-sm text-slate-500"
                    colSpan={isAdmin ? 7 : 6}
                  >
                    No devices match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <RegisterDeviceModal
        open={modalOpen}
        mode={mode}
        initial={editTarget ?? undefined}
        existingSerials={existingSerials}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

