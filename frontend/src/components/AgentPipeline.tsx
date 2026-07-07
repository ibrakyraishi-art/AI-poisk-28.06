"use client";

import { memo, useEffect, useState, useSyncExternalStore } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Robot team scene: manager on top, shared memory in the centre, six worker
   robots on a ring. Task/data packets fly along the spokes on a shared 4.2s
   "conversation beat"; a comm feed below narrates the exchange.

   Completion states are REAL (backend writes progress_msg as tasks finish).
   The packet choreography and feed phrases illustrate each agent's actual
   task steps.
──────────────────────────────────────────────────────────────────────────── */

const MGR = { x: 400, y: 62 };
const MEM = { x: 400, y: 278 };
const NODE_R = 44;

const WORKERS = [
  { key: "business_context_agent",  icon: "🔍", name: "Рынок",      full: "Исследование рынка",    x: 320, y: 139 },
  { key: "reviews_agent",           icon: "⭐", name: "Отзывы",     full: "Анализ отзывов",        x: 480, y: 139 },
  { key: "news_agent",              icon: "📰", name: "Новости",    full: "Анализ новостей",       x: 560, y: 278 },
  { key: "competitor_finder_agent", icon: "🎯", name: "Конкуренты", full: "Поиск конкурентов",     x: 480, y: 417 },
  { key: "analyst_agent",           icon: "🧠", name: "SWOT",       full: "Стратегический анализ", x: 320, y: 417 },
  { key: "report_writer_agent",     icon: "📝", name: "Отчёт",      full: "Составление отчёта",    x: 240, y: 278 },
] as const;

const WORKER_ORDER = WORKERS.map((w) => w.key);
/** Agents that WRITE to memory; analyst & report writer READ from it. */
const WRITERS = new Set(["business_context_agent", "reviews_agent", "news_agent", "competitor_finder_agent"]);

/** Quadratic arc a→b, control point = midpoint + perpendicular offset. */
function q(a: { x: number; y: number }, b: { x: number; y: number }, k: number): string {
  const cx = (a.x + b.x) / 2 - k * (b.y - a.y);
  const cy = (a.y + b.y) / 2 + k * (b.x - a.x);
  return `M ${a.x} ${a.y} Q ${Math.round(cx)} ${Math.round(cy)} ${b.x} ${b.y}`;
}
const SPOKE: Record<string, string> = {}; // worker → memory
const MGRP: Record<string, string> = {};  // manager → worker
for (const w of WORKERS) {
  SPOKE[w.key] = q(w, MEM, 0.2);
  MGRP[w.key] = q(MGR, w, 0.15);
}

/** Typical sub-steps of each agent's real task (rotated in the comm feed). */
const ACTIVITIES: Record<string, string[]> = {
  business_context_agent: ["Гуглю категорию и рынок…", "Изучаю целевую аудиторию…", "Ищу прямых конкурентов…", "Сохраняю факты в общую память…"],
  reviews_agent: ["Собираю отзывы из App Store…", "Собираю отзывы из Google Play…", "Группирую отзывы по темам…", "Оцениваю тональность…"],
  news_agent: ["Просматриваю свежую прессу…", "Ищу запуски продуктов…", "Отбираю релевантные статьи…", "Сохраняю выжимки в память…"],
  competitor_finder_agent: ["Ищу данные по конкурентам…", "Сравниваю рейтинги и цены…", "Ищу сильные и слабые стороны…", "Собираю матрицу сравнения…"],
  analyst_agent: ["Читаю общую память команды…", "Свожу отзывы и новости…", "Строю SWOT-анализ…", "Формулирую выводы…"],
  report_writer_agent: ["Пишу executive summary…", "Собираю разделы отчёта…", "Проставляю источники…", "Формирую итоговый .docx…"],
};

const DELEGATE: Record<string, (c: string) => string> = {
  business_context_agent: (c) => `Изучи рынок «${c}» и найди конкурентов`,
  reviews_agent: (c) => `Собери отзывы «${c}» из App Store и Google Play`,
  news_agent: (c) => `Найди свежие новости про «${c}»`,
  competitor_finder_agent: () => "Исследуй конкурентов: цены, рейтинги, фичи",
  analyst_agent: () => "Сведи данные и построй SWOT",
  report_writer_agent: () => "Собери финальный отчёт",
};

const DONE_MSG: Record<string, string> = {
  business_context_agent: "Категория, аудитория и конкуренты — в памяти ✓",
  reviews_agent: "Отзывы собраны: темы и тональность ✓",
  news_agent: "Ключевые новости отобраны ✓",
  competitor_finder_agent: "Профили конкурентов готовы ✓",
  analyst_agent: "SWOT и выводы переданы ✓",
  report_writer_agent: "Отчёт свёрстан ✓",
};

const FEED_ID: Record<string, { icon: string; name: string }> = {
  manager: { icon: "🧭", name: "Менеджер" },
  memory: { icon: "💾", name: "Память" },
  ...Object.fromEntries(WORKERS.map((w) => [w.key, { icon: w.icon, name: w.name }])),
};

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/* ── Elapsed timer (isolates the 1s interval from the scene) ─────────────── */
function ElapsedTimer({ startedAt, running }: { startedAt: string; running: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, (Date.now() - start) / 1000));
    tick();
    if (!running) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, running]);
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");
  return <span className="tabular-nums" aria-hidden>{mm}:{ss}</span>;
}

/* ── SVG scene (memoized: re-renders only on real state transitions) ─────── */
const RobotScene = memo(function RobotScene({
  doneCsv,
  activeWorker,
  motion,
}: {
  doneCsv: string;
  activeWorker: string | null;
  motion: boolean;
}) {
  const doneSet = new Set(doneCsv ? doneCsv.split(",") : []);
  const isReader = activeWorker ? !WRITERS.has(activeWorker) : false;
  const active = WORKERS.find((w) => w.key === activeWorker) ?? null;

  return (
    <svg viewBox="0 0 800 520" className="h-auto w-full" role="img"
      aria-label={`Схема команды агентов: готово ${doneSet.size} из 6${active ? `, сейчас работает ${active.full}` : ""}`}>
      <defs>
        <radialGradient id="cs-spot">
          <stop offset="0%" stopColor="rgba(129,140,248,0.14)" />
          <stop offset="100%" stopColor="rgba(129,140,248,0)" />
        </radialGradient>
      </defs>

      {/* layer 1: spokes (packets dive UNDER the nodes drawn later) */}
      <g>
        {active && <circle cx={active.x} cy={active.y} r={72} fill="url(#cs-spot)" />}
        {WORKERS.map((w) => {
          const st = doneSet.has(w.key) ? "done" : w.key === activeWorker ? "active" : "pending";
          return (
            <g key={w.key}>
              <path id={`cs-spoke-${w.key}`} d={SPOKE[w.key]} fill="none" vectorEffect="non-scaling-stroke"
                stroke={st === "done" ? "rgba(74,222,128,0.20)" : st === "active" ? "rgba(129,140,248,0.55)" : "rgba(148,163,184,0.10)"}
                strokeWidth={st === "active" ? 1.75 : 1.25} />
              {st === "active" && (
                <path d={SPOKE[w.key]} fill="none" stroke="rgba(165,180,252,0.9)" strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke" className="scene-dash" />
              )}
            </g>
          );
        })}
        {active && (
          <>
            <path id="cs-mgr-path" d={MGRP[active.key]} fill="none" stroke="rgba(129,140,248,0.30)"
              strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
            <path d={MGRP[active.key]} fill="none" stroke="rgba(165,180,252,0.7)" strokeWidth={1.25}
              vectorEffect="non-scaling-stroke" className="scene-dash" />
          </>
        )}
      </g>

      {/* layer 2: packets — one shared 4.2s beat (see design notes) */}
      {motion && active && (
        <g key={active.key}>
          {/* task packet: manager → active agent (moves 5%–26% of the beat) + comet trail */}
          <circle r={4.5} fill="#a5b4fc">
            <animateMotion dur="4.2s" repeatCount="indefinite" calcMode="linear"
              keyPoints="0;0;1;1" keyTimes="0;0.05;0.26;1">
              <mpath href="#cs-mgr-path" />
            </animateMotion>
            <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.05;0.08;0.23;0.26;1" dur="4.2s" repeatCount="indefinite" />
          </circle>
          <circle r={2.8} fill="#a5b4fc" opacity={0.45}>
            <animateMotion dur="4.2s" repeatCount="indefinite" calcMode="linear"
              keyPoints="0;0;1;1" keyTimes="0;0.07;0.28;1">
              <mpath href="#cs-mgr-path" />
            </animateMotion>
            <animate attributeName="opacity" values="0;0;0.45;0.45;0;0" keyTimes="0;0.07;0.1;0.25;0.28;1" dur="4.2s" repeatCount="indefinite" />
          </circle>

          {/* data packet: writers push agent→memory, readers pull memory→agent (36%–57%) */}
          <circle r={4.5} fill={isReader ? "#38bdf8" : "#34d399"}>
            <animateMotion dur="4.2s" repeatCount="indefinite" calcMode="linear"
              keyPoints={isReader ? "1;1;0;0" : "0;0;1;1"} keyTimes="0;0.36;0.57;1">
              <mpath href={`#cs-spoke-${active.key}`} />
            </animateMotion>
            <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.36;0.39;0.54;0.57;1" dur="4.2s" repeatCount="indefinite" />
          </circle>

          {/* memory reacts: absorb ring on write, emit blink on read */}
          {isReader ? (
            <circle cx={MEM.x} cy={MEM.y} r={42} fill="none" stroke="#38bdf8" strokeWidth={2} vectorEffect="non-scaling-stroke">
              <animate attributeName="opacity" values="0;0;0.55;0;0" keyTimes="0;0.33;0.37;0.44;1" dur="4.2s" repeatCount="indefinite" />
            </circle>
          ) : (
            <circle cx={MEM.x} cy={MEM.y} r={36} fill="none" stroke="#34d399" strokeWidth={2} vectorEffect="non-scaling-stroke">
              <animate attributeName="r" values="36;36;54;54" keyTimes="0;0.57;0.72;1" dur="4.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;0.5;0;0" keyTimes="0;0.57;0.6;0.72;1" dur="4.2s" repeatCount="indefinite" />
            </circle>
          )}

          {/* manager "speaks" at the start of each beat */}
          <circle cx={MGR.x} cy={MGR.y} r={48} fill="none" stroke="#a5b4fc" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
            <animate attributeName="opacity" values="0;0.7;0;0" keyTimes="0;0.04;0.09;1" dur="4.2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* ambient packets on completed spokes — the memory "keeps their data" */}
      {motion && WORKERS.map((w, i) =>
        doneSet.has(w.key) ? (
          <circle key={`amb-${w.key}`} r={2.5} fill="rgba(129,140,248,0.45)">
            <animateMotion dur="8.4s" repeatCount="indefinite" calcMode="linear"
              keyPoints="0;0;1;1" keyTimes="0;0.39;0.61;1" begin={`${-(i * 2.1 + 1.3)}s`}>
              <mpath href={`#cs-spoke-${w.key}`} />
            </animateMotion>
            <animate attributeName="opacity" values="0;0;0.5;0.5;0;0" keyTimes="0;0.39;0.43;0.57;0.61;1"
              dur="8.4s" repeatCount="indefinite" begin={`${-(i * 2.1 + 1.3)}s`} />
          </circle>
        ) : null,
      )}

      {/* layer 3: nodes */}
      {/* memory */}
      <g transform={`translate(${MEM.x}, ${MEM.y})`}>
        <g className={motion && activeWorker ? "scene-gulp" : undefined}>
          <circle r={36} fill="#10111e" stroke="rgba(148,163,184,0.35)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text fontSize={26} textAnchor="middle" dominantBaseline="central">💾</text>
        </g>
      </g>

      {/* manager */}
      <g transform={`translate(${MGR.x}, ${MGR.y})`}>
        <circle r={42} fill="#10111e" stroke="rgba(129,140,248,0.6)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <text fontSize={30} textAnchor="middle" dominantBaseline="central">🧭</text>
      </g>

      {/* workers */}
      {WORKERS.map((w) => {
        const st = doneSet.has(w.key) ? "done" : w.key === activeWorker ? "active" : "pending";
        return (
          <g key={w.key} transform={`translate(${w.x}, ${w.y})`} opacity={st === "pending" ? 0.45 : 1}>
            {st === "active" && motion && (
              <>
                <circle r={NODE_R} fill="none" stroke="#818cf8" strokeWidth={2} vectorEffect="non-scaling-stroke">
                  <animate attributeName="r" values="46;62" dur="2.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.55;0" dur="2.1s" repeatCount="indefinite" />
                </circle>
                <circle r={NODE_R} fill="none" stroke="#818cf8" strokeWidth={2} vectorEffect="non-scaling-stroke">
                  <animate attributeName="r" values="46;62" dur="2.1s" repeatCount="indefinite" begin="-1.05s" />
                  <animate attributeName="opacity" values="0.55;0" dur="2.1s" repeatCount="indefinite" begin="-1.05s" />
                </circle>
              </>
            )}
            <g className={st === "active" && motion ? "scene-bump" : undefined}>
              <g className={st === "active" && motion ? "scene-bob" : undefined}>
                <circle r={NODE_R} fill="#10111e" vectorEffect="non-scaling-stroke"
                  stroke={st === "done" ? "rgba(34,197,94,0.55)" : st === "active" ? "#818cf8" : "rgba(255,255,255,0.14)"}
                  strokeWidth={st === "active" ? 2.5 : st === "done" ? 2 : 1.25} />
                <text fontSize={30} textAnchor="middle" dominantBaseline="central"
                  className={st === "pending" ? "grayscale" : undefined}>{w.icon}</text>
                {st === "done" && (
                  <g transform="translate(30, -30)">
                    <circle r={13} fill="#16a34a" />
                    <text fontSize={16} fill="#ffffff" textAnchor="middle" dominantBaseline="central">✓</text>
                  </g>
                )}
                {st === "pending" && (
                  <text x={30} y={-30} fontSize={18} textAnchor="middle" dominantBaseline="central" opacity={0.85}>💤</text>
                )}
              </g>
            </g>
          </g>
        );
      })}

      {/* layer 4: labels (desktop only — hidden ≤640px via .svg-label) */}
      <g className="svg-label" stroke="#0b0b16" strokeWidth={4} fontWeight={500}>
        <text x={MGR.x + 52} y={MGR.y - 4} fontSize={20} fill="#e0e7ff" textAnchor="start">Менеджер</text>
        <text x={MGR.x + 52} y={MGR.y + 16} fontSize={14} fill="#818cf8" textAnchor="start">координирует</text>
        <text x={MEM.x} y={MEM.y + 58} fontSize={17} fill="#94a3b8" textAnchor="middle">Общая память</text>
        {WORKERS.map((w) => {
          const st = doneSet.has(w.key) ? "done" : w.key === activeWorker ? "active" : "pending";
          return (
            <text key={w.key} x={w.x} y={w.y + NODE_R + 22} fontSize={st === "active" ? 21 : 20} textAnchor="middle"
              fill={st === "active" ? "#ffffff" : st === "done" ? "#cbd5e1" : "#64748b"}
              fontWeight={st === "active" ? 600 : 500}>
              {w.name}
            </text>
          );
        })}
      </g>
    </svg>
  );
});

/* ── Communication feed (own interval; newest on top) ────────────────────── */
function CommFeed({ company, activeWorker, doneCsv }: { company: string; activeWorker: string | null; doneCsv: string }) {
  const [beat, setBeat] = useState(() => Math.floor(Date.now() / 4200));
  useEffect(() => {
    const id = setInterval(() => setBeat(Math.floor(Date.now() / 4200)), 1050);
    return () => clearInterval(id);
  }, []);

  const doneKeys = doneCsv ? doneCsv.split(",") : [];
  type Row = { from: string; to: string; text: string; live?: boolean; arrow?: string };
  const rows: Row[] = [];

  if (activeWorker && ACTIVITIES[activeWorker]) {
    const phrases = ACTIVITIES[activeWorker];
    const isReader = !WRITERS.has(activeWorker);
    rows.push({
      from: activeWorker, to: "memory",
      arrow: isReader ? "←" : "→",
      text: phrases[beat % phrases.length], live: true,
    });
    rows.push({ from: "manager", to: activeWorker, text: `«${DELEGATE[activeWorker](company)}»`, arrow: "→" });
  }
  for (let i = doneKeys.length - 1; i >= 0; i--) {
    const k = doneKeys[i];
    if (DONE_MSG[k]) rows.push({ from: k, to: "manager", text: DONE_MSG[k], arrow: "→" });
  }
  const visible = rows.slice(0, 5);
  const historyOpacity = ["", "opacity-70", "opacity-55", "opacity-40", "opacity-30"];

  if (visible.length === 0) return null;

  return (
    <div aria-hidden className="mt-4 h-[132px] space-y-1.5 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
      {visible.map((r, i) => {
        const from = FEED_ID[r.from];
        const to = FEED_ID[r.to];
        if (!from || !to) return null;
        return (
          <div
            key={`${r.from}-${r.to}-${r.text}`}
            className={`flex items-baseline gap-2 text-xs ${i === 0 && r.live ? "animate-bubble-in border-l-2 border-indigo-400 pl-2 text-[13px] text-slate-200" : `text-slate-400 ${historyOpacity[i] ?? "opacity-30"}`}`}
          >
            <span className={`w-[168px] flex-shrink-0 truncate ${r.from === "manager" ? "text-indigo-300" : ""}`}>
              {from.icon} {from.name} {r.arrow ?? "→"} {to.icon} {to.name}
            </span>
            <span className="min-w-0 truncate">{r.text}</span>
            {r.live && (
              <span className="inline-flex flex-shrink-0 gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="typing-dot h-1 w-1 rounded-full bg-indigo-300" style={{ animationDelay: `${d * 0.2}s` }} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
interface Props {
  startedAt: string; // ISO timestamp
  status: "running" | "completed" | "failed";
  progressPct?: number | null;
  progressMsg?: string | null;
  company?: string;
}

export function AgentPipeline({ startedAt, status, progressPct, progressMsg, company = "компании" }: Props) {
  const reduced = usePrefersReducedMotion();
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
  const activeWorker = done ? null : WORKER_ORDER.find((k) => !doneSet.has(k)) ?? null;
  const activeFull = WORKERS.find((w) => w.key === activeWorker)?.full ?? null;
  const lastDoneFull = doneKeys.length ? WORKERS.find((w) => w.key === doneKeys[doneKeys.length - 1])?.full : null;

  const progress = done ? 100 : Math.max(2, Math.min(99, progressPct ?? 0));
  const workersDone = WORKER_ORDER.filter((k) => doneSet.has(k)).length;
  // Stable primitive for the memoized scene (a fresh Set/array would defeat memo)
  const doneCsv = [...doneSet].sort().join(",");

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0e1c]/85 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] sm:bg-white/[0.03] sm:backdrop-blur-sm [contain:layout_paint]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">Агенты за работой</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{workersDone} из {WORKER_ORDER.length} готово</span>
          <ElapsedTimer startedAt={startedAt} running={status === "running"} />
        </div>
      </div>

      {note && <p className="mb-2 text-xs text-slate-400">{note}</p>}

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс анализа">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <RobotScene doneCsv={doneCsv} activeWorker={activeWorker} motion={!reduced} />

      <div aria-hidden className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#a5b4fc]" /> задача</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> данные в память</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#38bdf8]" /> чтение памяти</span>
      </div>

      <CommFeed company={company} activeWorker={activeWorker} doneCsv={doneCsv} />

      {/* Announce only real transitions to screen readers (the feed is decorative) */}
      <p role="status" className="sr-only">
        {lastDoneFull ? `${lastDoneFull}: готово. ` : ""}{activeFull ? `Сейчас работает: ${activeFull}` : ""}
      </p>
    </div>
  );
}
