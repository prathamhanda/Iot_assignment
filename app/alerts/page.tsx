"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Filter } from "lucide-react";
import { useEffect } from "react";

type AlertRow = {
  id: string;
  device_id: string;
  timestamp: string;
  metric: "voltage";
  value: number;
  threshold: number;
  severity: "warning";
  message: string;
};

type SeverityFilter = "all" | "critical";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [filter, setFilter] = useState<SeverityFilter>("all");

  async function refreshAlerts() {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { alerts?: AlertRow[] };
    setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
  }

  async function clearAlerts() {
    setAlerts([]);
    await fetch("/api/alerts", { method: "DELETE" });
  }

  useEffect(() => {
    void refreshAlerts();
  }, []);

  const rows = useMemo(() => {
    const mapped = alerts.map((a) => {
      const severity = a.value > a.threshold + 10 ? "Critical" : "Warning";
      return {
        ...a,
        severity,
      };
    });

    return filter === "critical"
      ? mapped.filter((r) => r.severity === "Critical")
      : mapped;
  }, [alerts, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alerts</h1>
          <p className="text-sm text-slate-600">Incident History</p>
        </div>

        <button
          type="button"
          onClick={clearAlerts}
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          Mark all as Read
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-slate-900">Alert History</div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Severity
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SeverityFilter)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="all">All</option>
            <option value="critical">Critical only</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold " +
                        (r.severity === "Critical"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-amber-200 bg-amber-50 text-amber-900")
                      }
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{r.message}</td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                    No alerts to show.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
