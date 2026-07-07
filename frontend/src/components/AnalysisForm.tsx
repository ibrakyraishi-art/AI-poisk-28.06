"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { startAnalysis, AnalyzeRequest } from "@/lib/api";

interface Props {
  onStarted: (runId: string) => void;
}

const PERIODS = [
  { value: "30d", label: "Последние 30 дней" },
  { value: "90d", label: "Последние 90 дней" },
  { value: "6m", label: "Последние 6 месяцев" },
];

// Global model (applies to every agent unless overridden per-agent below).
const MODELS = [
  { value: "", label: "Авто (по вашим ключам)" },
  { value: "haiku", label: "Claude Haiku (быстро)" },
  { value: "sonnet", label: "Claude Sonnet (баланс)" },
  { value: "opus", label: "Claude Opus (лучшее, ~$2)" },
  { value: "gemini-flash", label: "Gemini Flash (дёшево)" },
];

// The 7 agents whose "brain" (LLM) can be chosen individually.
const AGENTS = [
  { key: "manager_agent",           name: "Менеджер пайплайна",    icon: "🧭" },
  { key: "business_context_agent",  name: "Исследование рынка",     icon: "🔍" },
  { key: "reviews_agent",           name: "Анализ отзывов",         icon: "⭐" },
  { key: "news_agent",              name: "Анализ новостей",        icon: "📰" },
  { key: "competitor_finder_agent", name: "Поиск конкурентов",      icon: "🎯" },
  { key: "analyst_agent",           name: "Стратегический анализ",  icon: "🧠" },
  { key: "report_writer_agent",     name: "Составление отчёта",     icon: "📝" },
];

// Per-agent dropdown — "" means "inherit the global model above".
const AGENT_MODEL_OPTIONS = [
  { value: "", label: "— как выше —" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "haiku", label: "Claude Haiku" },
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "opus", label: "Claude Opus (~$2)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export function AnalysisForm({ onStarted }: Props) {
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState<AnalyzeRequest["period"]>("30d");
  const [platform, setPlatform] = useState<AnalyzeRequest["platform"]>("both");
  const [model, setModel] = useState("");
  const [agentModels, setAgentModels] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCostWarning, setShowCostWarning] = useState(false);

  function applyPreset(kind: "economy" | "balanced" | "max") {
    if (kind === "economy") setAgentModels(Object.fromEntries(AGENTS.map((a) => [a.key, "haiku"])));
    else if (kind === "max") setAgentModels(Object.fromEntries(AGENTS.map((a) => [a.key, "opus"])));
    else setAgentModels({}); // баланс = встроенные дефолты (дёшево на сборе, умно на анализе)
  }

  const overrides = Object.fromEntries(Object.entries(agentModels).filter(([, v]) => v));
  const usesOpus = model === "opus" || Object.values(overrides).includes("opus");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const { run_id } = await startAnalysis({
        company,
        period,
        platform,
        model: model || undefined,
        agent_models: Object.keys(overrides).length ? overrides : undefined,
      });
      onStarted(run_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      setError(
        /failed to fetch|networkerror|load failed|fetch/i.test(msg)
          ? "Не удалось связаться с сервером. Бесплатный бэкенд мог заснуть после простоя — подождите ~минуту и повторите."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company.trim()) return setError("Укажите название компании");
    if (usesOpus) setShowCostWarning(true);
    else submit();
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold text-white">Новый анализ</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Компания / Приложение</label>
          <input
            className={inputCls}
            placeholder="напр. Duolingo"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Период</label>
            <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value as AnalyzeRequest["period"])}>
              {PERIODS.map((p) => <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Платформа</label>
            <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value as AnalyzeRequest["platform"])}>
              <option value="both" className="bg-slate-900">Обе платформы</option>
              <option value="ios" className="bg-slate-900">Только App Store</option>
              <option value="android" className="bg-slate-900">Только Google Play</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Модель для всех агентов</label>
          <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
          </select>
        </div>

        {/* Per-agent "сменные мозги" */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200"
          >
            <span>⚙ Модель для каждого агента</span>
            <span className="text-slate-500">
              {Object.keys(overrides).length > 0 && <span className="mr-2 text-indigo-300">{Object.keys(overrides).length} задано</span>}
              {showAdvanced ? "▲" : "▼"}
            </span>
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t border-white/10 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-xs text-slate-500">Пресет:</span>
                {([
                  { k: "economy", label: "Эконом", hint: "всё на Haiku" },
                  { k: "balanced", label: "Баланс", hint: "сбор дёшево, анализ умно" },
                  { k: "max", label: "Максимум", hint: "всё на Opus" },
                ] as const).map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    title={p.hint}
                    onClick={() => applyPreset(p.k)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:border-indigo-400/50 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {AGENTS.map((a) => (
                  <div key={a.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-slate-300">
                      <span className="mr-1">{a.icon}</span>{a.name}
                    </span>
                    <select
                      className={inputCls}
                      value={agentModels[a.key] ?? ""}
                      onChange={(e) => setAgentModels((prev) => ({ ...prev, [a.key]: e.target.value }))}
                    >
                      {AGENT_MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                «— как выше —» = агент берёт общую модель. Для Gemini нужен ключ Google, для Claude — Anthropic, для GPT — OpenAI.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <p>{error}</p>
            <Link href="/settings" className="mt-1 inline-block text-xs font-medium text-indigo-300 hover:text-indigo-200">
              Проверить API-ключи →
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-400 disabled:opacity-50"
        >
          {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {loading ? "Запуск…" : "Запустить анализ"}
        </button>
      </form>

      {showCostWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Предупреждение о стоимости Claude Opus</h3>
            <p className="text-sm text-slate-400">
              Хотя бы один агент настроен на Claude Opus — это может стоить <strong className="text-slate-200">~$2 за анализ</strong>. Продолжить?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCostWarning(false); submit(); }}
                className="flex-1 rounded-lg bg-indigo-500 py-2 font-semibold text-white hover:bg-indigo-400"
              >
                Да, продолжить
              </button>
              <button
                onClick={() => setShowCostWarning(false)}
                className="flex-1 rounded-lg border border-white/15 py-2 font-semibold text-slate-200 hover:bg-white/5"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
