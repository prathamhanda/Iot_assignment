"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudDownload, Settings2, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

type TabKey = "system" | "users" | "ota";

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition " +
        (active
          ? "bg-blue-700 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
      }
    >
      {icon}
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const { user, isAdmin, role } = useAuth();
  const [tab, setTab] = useState<TabKey>("system");
  const [updateSource, setUpdateSource] = useState<"AWS S3" | "FTP">("AWS S3");

  const [users, setUsers] = useState<Array<{ id: string; email: string; role: "Admin" | "Sub-User" }>>(
    []
  );
  const [devices, setDevices] = useState<Array<{ id: string; name: string; serialNumber: string }>>(
    []
  );
  const [manageUserId, setManageUserId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [manageMsg, setManageMsg] = useState<string | null>(null);

  async function refreshUsersAndDevices() {
    if (!isAdmin) return;

    const [uRes, dRes] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/devices", { cache: "no-store" }),
    ]);

    if (uRes.ok) {
      const data = (await uRes.json()) as { users?: Array<{ id: string; email: string; role: "Admin" | "Sub-User" }> };
      setUsers(Array.isArray(data.users) ? data.users : []);
    }

    if (dRes.ok) {
      const data = (await dRes.json()) as { devices?: Array<{ id: string; name: string; serialNumber: string }> };
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    }
  }

  async function assignDeviceToUser(userId: string) {
    setManageMsg(null);
    if (!selectedDeviceId) {
      setManageMsg("Select a device to assign.");
      return;
    }
    const res = await fetch("/api/admin/devices/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, deviceId: selectedDeviceId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setManageMsg(data?.error ?? "Assign failed");
      return;
    }
    setManageMsg("Assigned successfully.");
  }

  // DRD 2.1 / Section 7: Sub-Users must not access System Config or OTA.
  useEffect(() => {
    if (role === "Sub-User") {
      if (tab === "system" || tab === "ota") setTab("users");
    }
  }, [role, tab]);

  useEffect(() => {
    void refreshUsersAndDevices();
  }, [isAdmin]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">System configuration and access controls.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <TabButton
            active={tab === "system"}
            label="System Config"
            icon={<Settings2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setTab("system")}
          />
        ) : null}

        <TabButton
          active={tab === "users"}
          label="User Management"
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setTab("users")}
        />

        {isAdmin ? (
          <TabButton
            active={tab === "ota"}
            label="OTA Updates"
            icon={<CloudDownload className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setTab("ota")}
          />
        ) : null}
      </div>

      {tab === "system" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold text-slate-900">System Config</div>
          <div className="mt-1 text-sm text-slate-600">
            Placeholder for broker endpoints, data retention, and threshold settings.
          </div>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500">Current Session</div>
            <div className="mt-1 text-sm text-slate-900">
              Signed in as <span className="font-semibold">{user?.email ?? "—"}</span>
            </div>
            <div className="mt-1 text-sm text-slate-700">
              Role: <span className="font-semibold">{user?.role ?? "—"}</span>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">User Management</div>
              <div className="mt-1 text-sm text-slate-600">
                Admin vs Sub-User (View Only) access model.
              </div>
            </div>

            <div className="text-xs font-medium text-slate-500">RBAC</div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Mode</th>
                  {isAdmin ? (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{u.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {u.role === "Admin" ? "Full Access" : "View Only"}
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3 text-right">
                        {u.role === "Sub-User" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setManageMsg(null);
                              setSelectedDeviceId("");
                              setManageUserId((prev) => (prev === u.id ? null : u.id));
                            }}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Manage
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}

                {isAdmin && manageUserId ? (
                  <tr>
                    <td className="px-4 py-4" colSpan={4}>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Assign Device</div>
                        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                          <select
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 md:max-w-md"
                          >
                            <option value="">Select a device…</option>
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.serialNumber})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void assignDeviceToUser(manageUserId)}
                            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Assign
                          </button>
                        </div>
                        {manageMsg ? (
                          <div className="mt-2 text-xs text-slate-600">{manageMsg}</div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Current app mode: <span className="font-semibold">{isAdmin ? "Admin" : "View Only"}</span>
          </div>

          {isAdmin ? (
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Login Activity</div>
              <div className="mt-1 text-sm text-slate-600">Admin-only view (DRD 2.1).</div>
              <div className="mt-3 text-xs text-slate-500">
                View raw activity via <span className="font-mono">/api/admin/activity</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "ota" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold text-slate-900">OTA Firmware Updates</div>
          <div className="mt-1 text-sm text-slate-600">
            Placeholder UI aligned to DRD Section 7 (Firmware Updates).
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">Update Source</div>
              <select
                value={updateSource}
                onChange={(e) => setUpdateSource(e.target.value as "AWS S3" | "FTP")}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="AWS S3">AWS S3</option>
                <option value="FTP">FTP</option>
              </select>
              <div className="mt-2 text-xs text-slate-500">
                Selected: <span className="font-semibold">{updateSource}</span>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">Firmware Updates</div>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
              >
                <CloudDownload className="h-4 w-4" aria-hidden="true" />
                Check for Updates
              </button>
              <div className="mt-2 text-xs text-slate-500">
                No update logic wired yet (placeholder).
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

