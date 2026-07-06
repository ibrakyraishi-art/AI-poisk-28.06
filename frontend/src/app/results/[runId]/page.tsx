"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAnalysisRun, getSignedDocxUrl, AnalysisRun } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { AgentPipeline } from "@/components/AgentPipeline";
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

      if (data.status === "completed" && data.report_docx_path && !docxUrl) {
        getSignedDocxUrl(data.report_docx_path)
          .then(setDocxUrl)
          .catch(() => {/* storage may be local-only */});
      }
    } catch (e: unknown) {
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
    if (!run || run.status !== "running") return;
    const timer = setInterval(fetchRun, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [run, fetchRun]);

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="font-medium text-red-400">{error}</p>
          <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300">
            Назад в кабинет
          </button>
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

        {run.status === "running" && (
          <AgentPipeline startedAt={run.created_at} status="running" />
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
