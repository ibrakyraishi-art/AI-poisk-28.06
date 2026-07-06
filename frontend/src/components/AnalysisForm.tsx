"use client";

import { FormEvent, useState } from "react";
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
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
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
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Новый анализ</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Компания / Приложение</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="напр. Duolingo"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Период</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyzeRequest["period"])}
            >
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Платформа</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as AnalyzeRequest["platform"])}
            >
              <option value="both">Обе платформы</option>
              <option value="ios">Только App Store</option>
              <option value="android">Только Google Play</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Модель</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {loading ? "Запуск…" : "Запустить анализ"}
        </button>
      </form>

      {showCostWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Предупреждение о стоимости Claude Opus</h3>
            <p className="text-sm text-gray-600">
              Полный конвейер из 7 агентов на Claude Opus может стоить <strong>~$2 за анализ</strong>.
              Продолжить?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCostWarning(false); submit(); }}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-white font-semibold hover:bg-indigo-700"
              >
                Да, продолжить
              </button>
              <button
                onClick={() => setShowCostWarning(false)}
                className="flex-1 rounded-lg border py-2 font-semibold hover:bg-gray-50"
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
