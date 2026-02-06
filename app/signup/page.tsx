"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "Sub-User">("Admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Signup failed");
        return;
      }
      setOk(true);
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-lg font-semibold">Create Account</div>
          <div className="mt-1 text-sm text-slate-300">
            Register as Admin or Sub-User (DRD Section 2.2).
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "Admin" | "Sub-User")}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              >
                <option value="Admin">Admin</option>
                <option value="Sub-User">Sub-User</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                required
                minLength={8}
              />
              <div className="mt-1 text-xs text-slate-400">Minimum 8 characters.</div>
            </div>

            {error ? (
              <div className="rounded-md border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            {ok ? (
              <div className="rounded-md border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
                Created. Redirecting…
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={
                "w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white " +
                (loading ? "opacity-70" : "hover:bg-blue-600")
              }
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-xs text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-slate-200 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
