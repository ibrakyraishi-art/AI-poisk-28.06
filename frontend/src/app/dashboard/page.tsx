"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
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

  const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    running:   { color: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25",   label: "Идёт",   icon: "⟳" },
    completed: { color: "bg-green-500/15 text-green-300 ring-1 ring-green-500/25", label: "Готово", icon: "✓" },
    failed:    { color: "bg-red-500/15 text-red-300 ring-1 ring-red-500/25",       label: "Ошибка", icon: "✕" },
  };

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-white">Кабинет</h1>
          <p className="text-sm text-slate-400 mt-1">Запустите анализ и следите за работой агентов.</p>
        </div>

        <AnalysisForm onStarted={handleStarted} />

        <section>
          <h2 className="text-lg font-semibold mb-3 text-white">Прошлые анализы</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Загрузка…</p>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-200">Пока нет анализов</p>
              <p className="text-xs text-slate-500 mt-1">Введите название приложения выше и нажмите «Запустить анализ».</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {runs.map((r) => {
                const s = STATUS_CONFIG[r.status] ?? { color: "bg-white/10 text-slate-300", label: r.status, icon: "·" };
                return (
                  <li key={r.id}>
                    <Link
                      href={`/results/${r.id}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <div>
                        <p className="font-medium text-white">{r.company}</p>
                        <p className="text-xs text-slate-500">{r.period} · {new Date(r.created_at).toLocaleDateString("ru-RU")}</p>
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
    </>
  );
}
