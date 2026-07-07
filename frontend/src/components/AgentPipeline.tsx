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

/** Typical sub-steps of each agent's real task — rotated in the speech bubble
 *  so you can see what the active robot is (approximately) doing right now.
 *  Completion marks are real (from the backend); these phrases are the flavour. */
const ACTIVITIES: Record<string, string[]> = {
  business_context_agent: [
    "Гуглю категорию и рынок…",
    "Изучаю целевую аудиторию…",
    "Ищу прямых конкурентов…",
    "Сохраняю факты в общую память…",
  ],
  reviews_agent: [
    "Собираю отзывы из App Store…",
    "Собираю отзывы из Google Play…",
    "Группирую отзывы по темам…",
    "Оцениваю тональность каждой темы…",
  ],
  news_agent: [
    "Просматриваю свежую прессу…",
    "Ищу запуски продуктов и релизы…",
    "Отбираю релевантные статьи…",
    "Сохраняю выжимки в память…",
  ],
  competitor_finder_agent: [
    "Ищу данные по каждому конкуренту…",
    "Сравниваю рейтинги и цены…",
    "Выявляю сильные и слабые стороны…",
    "Собираю матрицу сравнения…",
  ],
  analyst_agent: [
    "Читаю общую память команды…",
    "Свожу отзывы и новости воедино…",
    "Строю SWOT-анализ…",
    "Формулирую стратегические выводы…",
  ],
  report_writer_agent: [
    "Пишу executive summary…",
    "Собираю разделы отчёта…",
    "Проставляю источники…",
    "Формирую итоговый .docx…",
  ],
};

const CHIP: Record<string, string> = {
  done:    "bg-green-500/10 text-green-300 ring-1 ring-green-500/25",
  active:  "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/25",
  pending: "bg-white/5 text-slate-500 ring-1 ring-white/10",
};

interface Props {
  startedAt: string; // ISO timestamp
  status: "running" | "completed" | "failed";
  progressPct?: number | null;
  progressMsg?: string | null;
}

export function AgentPipeline({ startedAt, status, progressPct, progressMsg }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, (Date.now() - start) / 1000));
    tick();
    if (status !== "running") return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  // Rotate the active robot's "what am I doing" phrase.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setPhraseIdx((i) => i + 1), 3500);
    return () => clearInterval(id);
  }, [status]);

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
  const workersDone = WORKER_ORDER.filter((k) => doneSet.has(k)).length;

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
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{workersDone} из {WORKER_ORDER.length} готово</span>
          <span className="tabular-nums">{mm}:{ss}</span>
        </div>
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
          const isActiveWorker = st === "active" && a.key !== "manager_agent";
          const phrases = ACTIVITIES[a.key];
          const phrase = isActiveWorker && phrases ? phrases[phraseIdx % phrases.length] : null;
          // Data "flows" down every connector above the active stage.
          const flowing = !done && (st === "done" || a.key === "manager_agent");

          return (
            <li key={a.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && (
                <span
                  className={`absolute left-[15px] top-10 bottom-0 w-px ${
                    st === "done" ? "bg-indigo-500/40" : "bg-white/10"
                  }`}
                >
                  {flowing && (
                    <span className="animate-flow-down absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.9)]" />
                  )}
                </span>
              )}

              <div className="relative z-10 flex-shrink-0">
                {st === "done" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-sm text-green-300 ring-1 ring-green-500/30">
                    ✓
                  </div>
                ) : st === "active" ? (
                  <div className="animate-bob relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-base ring-2 ring-indigo-400">
                    {a.icon}
                    <span className="animate-spin-slow absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] ring-1 ring-indigo-400/50">
                      ⚙️
                    </span>
                  </div>
                ) : (
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-base opacity-50 ring-1 ring-white/10 grayscale">
                    {a.icon}
                    <span className="absolute -right-1 -top-1 text-[10px] opacity-80">💤</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 pt-1">
                <p className={`flex flex-wrap items-center gap-2 text-sm font-medium ${st === "pending" ? "text-slate-500" : "text-white"}`}>
                  {a.name}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP[st]}`}>
                    {st === "done" ? "готово" : st === "pending" ? "ожидает" : a.key === "manager_agent" ? "координирует" : "выполняется"}
                  </span>
                </p>
                <p className="text-xs text-slate-400">{a.desc}</p>

                {phrase && (
                  <div
                    key={phrase}
                    className="animate-bubble-in mt-2 inline-flex items-center gap-1.5 rounded-xl rounded-tl-sm border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200"
                  >
                    <span>{phrase}</span>
                    <span className="inline-flex gap-0.5">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="typing-dot h-1 w-1 rounded-full bg-indigo-300"
                          style={{ animationDelay: `${d * 0.2}s` }}
                        />
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
