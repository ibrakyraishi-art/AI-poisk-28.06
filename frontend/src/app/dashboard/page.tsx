"use client";

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

  const STATUS_COLORS: Record<string, string> = {
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
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
          <p className="text-sm text-gray-500">No analyses yet. Run your first one above.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/results/${r.id}`}
                  className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <p className="font-medium">{r.company}</p>
                    <p className="text-xs text-gray-400">{r.period} · {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
