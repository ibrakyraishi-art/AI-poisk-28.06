"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAnalysisRun, getSignedDocxUrl, AnalysisRun } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { AgentPipeline } from "@/components/AgentPipeline";
import { PlanReview } from "@/components/PlanReview";
import { ReportView } from "@/components/ReportView";

const POLL_INTERVAL = 5000;

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [error, setError] = useState("");
  const [docxUrl, setDocxUrl] = useState("");

  const fetchRun = useCallback(async () => {
    try {
      const data = await getAnalysisRun(runId);
      setRun(data);
      setError("");  // successful poll clears any prior transient error

      if (data.status === "completed" && data.report_docx_path && !docxUrl) {
        getSignedDocxUrl(data.report_docx_path)
          .then(setDocxUrl)
          .catch(() => {/* storage may be local-only */});
      }
    } catch (e: unknown) {
      // A single failed poll (Render cold-start blip) must NOT destroy an
      // in-progress view — we only surface this fatally when there is no run
      // to show yet (see `error && !run` below). Otherwise it shows as a soft
      // "reconnecting" banner and the next poll recovers.
      setError(e instanceof Error ? e.message : "Не удалось загрузить результаты");
    }
  }, [runId, docxUrl]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/auth");
      else fetchRun();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!run || (run.status !== "running" && run.status !== "planning")) return;
    const timer = setInterval(fetchRun, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [run, fetchRun]);

  if (error && !run) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="font-medium text-red-400">{error}</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <button onClick={fetchRun} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
              Повторить
            </button>
            <button onClick={() => router.push("/dashboard")} className="text-sm text-slate-400 hover:text-slate-200">
              Назад в кабинет
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!run) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-400">Загрузка…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")} className="mb-2 block text-sm text-indigo-400 hover:text-indigo-300">
              ← Кабинет
            </button>
            <h1 className="text-2xl font-bold text-white">{run.company}</h1>
            <p className="text-sm text-slate-400">{run.period} · начат {new Date(run.created_at).toLocaleString("ru-RU")}</p>
          </div>
          {run.status === "completed" && docxUrl && (
            <a
              href={docxUrl}
              download
              className="shrink-0 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
            >
              Скачать .docx
            </a>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            Соединение прервалось — переподключаемся…
          </div>
        )}

        {run.status === "planning" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center backdrop-blur-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="font-medium text-white">Готовлю план анализа…</p>
            <p className="mt-1 text-sm text-slate-400">Агент изучает рынок и подбирает конкурентов. Это займёт ~минуту.</p>
          </div>
        )}

        {run.status === "awaiting_approval" && (
          <PlanReview run={run} onApproved={fetchRun} />
        )}

        {run.status === "running" && (
          <AgentPipeline
            startedAt={run.created_at}
            status="running"
            progressPct={run.progress_pct}
            progressMsg={run.progress_msg}
          />
        )}

        {run.status === "failed" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6">
            <p className="mb-2 font-semibold text-red-300">Анализ не удался</p>
            <pre className="whitespace-pre-wrap text-xs text-red-400/90">{run.error ?? "Неизвестная ошибка"}</pre>
          </div>
        )}

        {run.status === "completed" && run.report_json && (
          <ReportView report={run.report_json as unknown as Parameters<typeof ReportView>[0]["report"]} />
        )}
      </main>
    </>
  );
}
