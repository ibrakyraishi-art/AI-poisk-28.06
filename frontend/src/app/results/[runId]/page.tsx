"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAnalysisRun, getSignedDocxUrl, AnalysisRun } from "@/lib/api";
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
      setError(e instanceof Error ? e.message : "Failed to load results");
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
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </button>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push("/dashboard")} className="text-sm text-indigo-600 hover:underline mb-2 block">
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold">{run.company}</h1>
          <p className="text-sm text-gray-400">{run.period} · started {new Date(run.created_at).toLocaleString()}</p>
        </div>
        {run.status === "completed" && docxUrl && (
          <a
            href={docxUrl}
            download
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white font-semibold hover:bg-indigo-700"
          >
            Download .docx
          </a>
        )}
      </div>

      {run.status === "running" && (
        <div className="rounded-xl border bg-blue-50 px-6 py-8 text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <p className="font-medium text-blue-800">Analysis in progress…</p>
          <p className="text-sm text-blue-600">Collecting reviews, news and competitor data. This takes 3–8 minutes.</p>
        </div>
      )}

      {run.status === "failed" && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-6 py-6">
          <p className="font-semibold text-red-700 mb-2">Analysis failed</p>
          <pre className="text-xs text-red-600 whitespace-pre-wrap">{run.error ?? "Unknown error"}</pre>
        </div>
      )}

      {run.status === "completed" && run.report_json && (
        <ReportView report={run.report_json as unknown as Parameters<typeof ReportView>[0]["report"]} />
      )}
    </main>
  );
}
