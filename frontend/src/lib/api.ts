import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface AnalyzeRequest {
  company: string;
  period: "30d" | "90d" | "6m";
  platform: "ios" | "android" | "both";
  model?: string;
  /** Optional per-agent LLM overrides, e.g. { analyst_agent: "opus" }. */
  agent_models?: Record<string, string>;
}

export interface AnalysisRun {
  id: string;
  user_id: string;
  company: string;
  period: string;
  status: "running" | "completed" | "failed";
  progress_pct: number | null;
  progress_msg: string | null;
  report_json: Record<string, unknown> | null;
  report_docx_path: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function startAnalysis(req: AnalyzeRequest): Promise<{ run_id: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Не удалось запустить анализ");
  }
  return res.json();
}

export async function getAnalysisRun(runId: string): Promise<AnalysisRun> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/analyze/${runId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Не удалось загрузить анализ");
  }
  return res.json();
}

export async function getSignedDocxUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(path.replace("reports/", ""), 300); // 5-minute URL
  if (error || !data?.signedUrl) throw new Error("Не удалось создать ссылку на скачивание");
  return data.signedUrl;
}

/** Poll until status !== "running" or timeout (default 15 min). */
export async function pollUntilDone(
  runId: string,
  onTick: (run: AnalysisRun) => void,
  intervalMs = 5000,
  timeoutMs = 15 * 60 * 1000,
): Promise<AnalysisRun> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await getAnalysisRun(runId);
    onTick(run);
    if (run.status !== "running") return run;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Время ожидания анализа истекло");
}
