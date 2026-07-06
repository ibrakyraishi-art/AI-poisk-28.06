"use client";

import { useEffect, useState } from "react";

/** The 7 agents of the CrewAI pipeline, in execution order. */
const AGENTS = [
  { key: "manager",     icon: "🧭", name: "Менеджер пайплайна",   desc: "Планирует и координирует работу агентов" },
  { key: "market",      icon: "🔍", name: "Исследование рынка",    desc: "Собирает контекст о компании и рынке" },
  { key: "reviews",     icon: "⭐", name: "Анализ отзывов",        desc: "App Store и Google Play: темы и тональность" },
  { key: "news",        icon: "📰", name: "Анализ новостей",       desc: "Пресса, запуски продуктов, движения рынка" },
  { key: "competitors", icon: "🎯", name: "Поиск конкурентов",     desc: "Находит и профилирует конкурентов" },
  { key: "strategy",    icon: "🧠", name: "Стратегический анализ", desc: "SWOT и стратегические выводы" },
  { key: "report",      icon: "📝", name: "Составление отчёта",    desc: "Собирает финальный отчёт" },
];

// Estimated duration of each stage (seconds). Sum ≈ 5.5 min — matches the
// "3–8 minutes" the pipeline typically takes. Purely for the progress animation.
const STAGE_SECONDS = [12, 55, 70, 60, 55, 45, 40];
const TOTAL = STAGE_SECONDS.reduce((a, b) => a + b, 0);

interface Props {
  startedAt: string; // ISO timestamp
  status: "running" | "completed" | "failed";
}

export function AgentPipeline({ startedAt, status }: Props) {
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

  // Which stage is currently active, based on elapsed time.
  let activeIndex = AGENTS.length;
  if (status === "running") {
    let acc = 0;
    activeIndex = STAGE_SECONDS.length - 1;
    for (let i = 0; i < STAGE_SECONDS.length; i++) {
      acc += STAGE_SECONDS[i];
      if (elapsed < acc) { activeIndex = i; break; }
    }
  }

  const progress = done ? 100 : Math.min(96, (elapsed / TOTAL) * 100);
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");

  function stateOf(i: number): "done" | "active" | "pending" {
    if (done || i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "pending";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">Агенты за работой</h3>
        </div>
        <span className="text-xs tabular-nums text-slate-400">{mm}:{ss}</span>
      </div>

      {/* overall progress */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol>
        {AGENTS.map((a, i) => {
          const st = stateOf(i);
          const last = i === AGENTS.length - 1;
          return (
            <li key={a.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  className={`absolute left-[15px] top-9 bottom-1 w-px ${
                    st === "done" ? "bg-indigo-500/40" : "bg-white/10"
                  }`}
                />
              )}
              <div className="relative z-10 flex-shrink-0">
                {st === "done" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-sm text-indigo-300 ring-1 ring-indigo-500/40">
                    ✓
                  </div>
                ) : st === "active" ? (
                  <div className="flex h-8 w-8 animate-pulse-glow items-center justify-center rounded-full bg-indigo-500/20 text-base ring-2 ring-indigo-400">
                    {a.icon}
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-base opacity-50 ring-1 ring-white/10 grayscale">
                    {a.icon}
                  </div>
                )}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-medium ${st === "pending" ? "text-slate-500" : "text-white"}`}>
                  {a.name}
                  {st === "active" && <span className="ml-2 text-xs font-normal text-indigo-300">выполняется…</span>}
                </p>
                <p className="text-xs text-slate-500">{a.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
