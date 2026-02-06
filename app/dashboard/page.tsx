"use client";

import { useMemo } from "react";
import { useIoTSimulator } from "@/hooks/useIoTSimulator";
import { useAuth } from "@/components/auth/AuthContext";

export default function DashboardPage() {
  const { devices, telemetryByDevice, alerts, onlineCount, clearAlerts } = useIoTSimulator();
  const { role } = useAuth();

  function normalizeStatus(status: unknown) {
    return String(status ?? "").toLowerCase();
  }

  const visibleDevices = useMemo(() => {
    // Server-side filtering is enforced by /api/devices.
    return devices;
  }, [devices]);

  const visibleAlerts = useMemo(() => {
    // Server-side filtering is enforced by /api/alerts.
    return alerts;
  }, [alerts]);

  const visibleOnlineCount = useMemo(() => {
    if (role !== "Sub-User") return onlineCount;
    return visibleDevices.filter((d) => normalizeStatus(d.status) !== "offline").length;
  }, [onlineCount, role, visibleDevices]);

  const latestByDevice = useMemo(() => {
    const latest = {} as Record<string, (typeof telemetryByDevice)[string][number] | undefined>;
    for (const device of visibleDevices) {
      const id = String(device.serialNumber);
      latest[id] = telemetryByDevice[id]?.[0];
    }
    return latest;
  }, [telemetryByDevice, visibleDevices]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Devices Online</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {visibleOnlineCount} / {visibleDevices.length}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Alerts</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{visibleAlerts.length}</div>
            </div>
            <button
              type="button"
              onClick={clearAlerts}
              className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Devices</div>
        <div className="divide-y divide-slate-100">
          {visibleDevices.map((d) => {
            const t = latestByDevice[String(d.serialNumber)];
            return (
              <div key={d.serialNumber} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{d.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {d.type} · {d.location} · {d.serialNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-700">{d.status}</div>
                  <div className="text-xs text-slate-500">
                    {t ? `V: ${t.voltage} · I: ${t.current} · P: ${t.power}` : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {visibleAlerts.length ? (
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Latest Alerts</div>
          <div className="divide-y divide-slate-100">
            {visibleAlerts.slice(0, 5).map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="text-sm font-medium text-slate-900">{a.message}</div>
                <div className="text-xs text-slate-500">
                  {a.device_id} · {a.timestamp}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
