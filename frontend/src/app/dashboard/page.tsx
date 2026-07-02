"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisRun } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/auth");
        return;
      }
      loadRuns();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRuns() {
    setLoading(true);
    const { data } = await supabase
      .from("analysis_runs")
      .select("id, company, period, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setRuns((data as AnalysisRun[]) ?? []);
    setLoading(false);
  }

  function handleStarted(runId: string) {
    router.push(`/results/${runId}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    running:   { color: "bg-blue-100 text-blue-700",   label: "Running",   icon: "⟳" },
    completed: { color: "bg-green-100 text-green-700", label: "Done",      icon: "✓" },
    failed:    { color: "bg-red-100 text-red-700",     label: "Failed",    icon: "✕" },
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-800">API keys</Link>
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </div>

      <AnalysisForm onStarted={handleStarted} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Past analyses</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">No analyses yet</p>
            <p className="text-xs text-gray-400 mt-1">Enter an app name above and hit Run analysis.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => {
              const s = STATUS_CONFIG[r.status] ?? { color: "bg-gray-100 text-gray-600", label: r.status, icon: "·" };
              return (
                <li key={r.id}>
                  <Link
                    href={`/results/${r.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      <p className="font-medium">{r.company}</p>
                      <p className="text-xs text-gray-400">{r.period} · {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${s.color}`}>
                      <span>{s.icon}</span>{s.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
