"use client";

import { useState, KeyboardEvent } from "react";
import { AnalysisRun, approveAnalysis } from "@/lib/api";

export function PlanReview({ run, onApproved }: { run: AnalysisRun; onApproved: () => void }) {
  const plan = run.plan_json ?? {};
  const [competitors, setCompetitors] = useState<string[]>(run.competitors ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addCompetitor() {
    const v = input.trim();
    if (v && !competitors.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setCompetitors([...competitors, v]);
    }
    setInput("");
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCompetitor();
    }
  }

  async function approve() {
    setLoading(true);
    setError("");
    try {
      await approveAnalysis(run.id, competitors);
      onApproved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось запустить анализ");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
          План анализа
        </span>
        <h2 className="text-lg font-semibold text-white">Проверьте план перед запуском</h2>
      </div>

      {plan.approach && <p className="text-sm text-slate-300">{plan.approach}</p>}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plan.category && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <dt className="text-xs text-slate-500">Категория</dt>
            <dd className="mt-0.5 text-sm text-slate-200">{plan.category}</dd>
          </div>
        )}
        {plan.target_audience && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <dt className="text-xs text-slate-500">Аудитория</dt>
            <dd className="mt-0.5 text-sm text-slate-200">{plan.target_audience}</dd>
          </div>
        )}
      </dl>

      {plan.key_differentiators && plan.key_differentiators.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-slate-500">Ключевые отличия</p>
          <ul className="space-y-1">
            {plan.key_differentiators.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.market_context && <p className="text-sm text-slate-400">{plan.market_context}</p>}

      {/* Editable competitor list */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-200">
          Конкуренты для анализа <span className="text-slate-500">({competitors.length})</span>
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {competitors.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1.5 text-sm text-slate-200">
              {c}
              <button
                type="button"
                onClick={() => setCompetitors(competitors.filter((x) => x !== c))}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label={`Убрать ${c}`}
              >
                ×
              </button>
            </span>
          ))}
          {competitors.length === 0 && <span className="text-sm text-slate-500">Пока пусто — добавьте конкурентов ниже.</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Добавить конкурента и Enter"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            type="button"
            onClick={addCompetitor}
            className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            Добавить
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={approve}
          disabled={loading || competitors.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {loading ? "Запуск…" : "Запустить полный анализ →"}
        </button>
        {competitors.length === 0 && <span className="text-xs text-slate-500">Добавьте хотя бы одного конкурента.</span>}
      </div>
    </div>
  );
}
