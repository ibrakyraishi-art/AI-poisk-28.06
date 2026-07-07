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

const MODELS = [
  { value: "", label: "По умолчанию (Gemini Flash)" },
  { value: "haiku", label: "Claude Haiku (быстро)" },
  { value: "sonnet", label: "Claude Sonnet (баланс)" },
  { value: "opus", label: "Claude Opus (лучшее, ~$2)" },
  { value: "gemini-flash", label: "Gemini Flash (дёшево)" },
];

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export function AnalysisForm({ onStarted }: Props) {
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState<AnalyzeRequest["period"]>("30d");
  const [platform, setPlatform] = useState<AnalyzeRequest["platform"]>("both");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCostWarning, setShowCostWarning] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const { run_id } = await startAnalysis({ company, period, platform, model: model || undefined });
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
    if (model === "opus") {
      setShowCostWarning(true);
    } else {
      submit();
    }
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
            <select
              className={inputCls}
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyzeRequest["period"])}
            >
              {PERIODS.map((p) => <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Платформа</label>
            <select
              className={inputCls}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as AnalyzeRequest["platform"])}
            >
              <option value="both" className="bg-slate-900">Обе платформы</option>
              <option value="ios" className="bg-slate-900">Только App Store</option>
              <option value="android" className="bg-slate-900">Только Google Play</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Модель</label>
          <select
            className={inputCls}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
          </select>
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
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {loading ? "Запуск…" : "Запустить анализ"}
        </button>
      </form>

      {showCostWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Предупреждение о стоимости Claude Opus</h3>
            <p className="text-sm text-slate-400">
              Полный конвейер из 7 агентов на Claude Opus может стоить <strong className="text-slate-200">~$2 за анализ</strong>.
              Продолжить?
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
