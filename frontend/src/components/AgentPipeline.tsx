"use client";

import { useEffect, useState } from "react";

/** The 7 agents of the CrewAI pipeline, in execution order. Keys match the
 *  agent identifiers the backend writes to analysis_runs.progress_msg. */
const AGENTS = [
  { key: "manager_agent",           icon: "🧭", name: "Менеджер пайплайна",   desc: "Планирует и координирует работу агентов" },
  { key: "business_context_agent",  icon: "🔍", name: "Исследование рынка",    desc: "Собирает контекст о компании и рынке" },
  { key: "reviews_agent",           icon: "⭐", name: "Анализ отзывов",        desc: "App Store и Google Play: темы и тональность" },
  { key: "news_agent",              icon: "📰", name: "Анализ новостей",       desc: "Пресса, запуски продуктов, движения рынка" },
  { key: "competitor_finder_agent", icon: "🎯", name: "Поиск конкурентов",     desc: "Находит и профилирует конкурентов" },
  { key: "analyst_agent",           icon: "🧠", name: "Стратегический анализ", desc: "SWOT и стратегические выводы" },
  { key: "report_writer_agent",     icon: "📝", name: "Составление отчёта",    desc: "Собирает финальный отчёт" },
];

// Worker stages in the order the progress bar advances (manager excluded — it
// coordinates throughout rather than being a discrete stage).
const WORKER_ORDER = [
  "business_context_agent",
  "reviews_agent",
  "news_agent",
  "competitor_finder_agent",
  "analyst_agent",
  "report_writer_agent",
];

interface Props {
  startedAt: string; // ISO timestamp
  status: "running" | "completed" | "failed";
  progressPct?: number | null;
  progressMsg?: string | null;
}

export function AgentPipeline({ startedAt, status, progressPct, progressMsg }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, (Date.now() - start) / 1000));
    tick();
    if (status !== "running") return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  const done = status === "completed";

  // Parse the real progress the backend writes: {done: [...agentKeys], note}.
  let doneKeys: string[] = [];
  let note = "";
  if (progressMsg) {
    try {
      const parsed = JSON.parse(progressMsg);
      if (Array.isArray(parsed?.done)) doneKeys = parsed.done;
      if (typeof parsed?.note === "string") note = parsed.note;
    } catch {
      note = progressMsg; // plain-text fallback
    }
  }
  const doneSet = new Set(doneKeys);

  // The currently-active worker = first one in pipeline order not yet done.
  const activeWorker = done ? null : WORKER_ORDER.find((k) => !doneSet.has(k)) ?? null;

  function stateOf(key: string): "done" | "active" | "pending" {
    if (done) return "done";
    if (key === "manager_agent") return "active"; // coordinates the whole run
    if (doneSet.has(key)) return "done";
    if (key === activeWorker) return "active";
    return "pending";
  }

  const progress = done ? 100 : Math.max(2, Math.min(99, progressPct ?? 0));
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">Агенты за работой</h3>
        </div>
        <span className="text-xs tabular-nums text-slate-400">{mm}:{ss}</span>
      </div>

      {note && <p className="mb-3 text-xs text-slate-400">{note}</p>}

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol>
        {AGENTS.map((a, i) => {
          const st = stateOf(a.key);
          const last = i === AGENTS.length - 1;
          return (
            <li key={a.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span className={`absolute left-[15px] top-9 bottom-1 w-px ${st === "done" ? "bg-indigo-500/40" : "bg-white/10"}`} />
              )}
              <div className="relative z-10 flex-shrink-0">
                {st === "done" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-sm text-indigo-300 ring-1 ring-indigo-500/40">✓</div>
                ) : st === "active" ? (
                  <div className="flex h-8 w-8 animate-pulse-glow items-center justify-center rounded-full bg-indigo-500/20 text-base ring-2 ring-indigo-400">{a.icon}</div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-base opacity-50 ring-1 ring-white/10 grayscale">{a.icon}</div>
                )}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-medium ${st === "pending" ? "text-slate-500" : "text-white"}`}>
                  {a.name}
                  {st === "active" && a.key !== "manager_agent" && <span className="ml-2 text-xs font-normal text-indigo-300">выполняется…</span>}
                  {st === "active" && a.key === "manager_agent" && <span className="ml-2 text-xs font-normal text-indigo-300">координирует</span>}
                </p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
