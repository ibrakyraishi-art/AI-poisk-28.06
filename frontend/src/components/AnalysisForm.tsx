"use client";

import { FormEvent, useState } from "react";
import { startAnalysis, AnalyzeRequest } from "@/lib/api";

interface Props {
  onStarted: (runId: string) => void;
}

const PERIODS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
];

const MODELS = [
  { value: "", label: "Default (Gemini Flash)" },
  { value: "haiku", label: "Claude Haiku (fast)" },
  { value: "sonnet", label: "Claude Sonnet (balanced)" },
  { value: "opus", label: "Claude Opus (best, ~$2)" },
  { value: "gemini-flash", label: "Gemini Flash (cheap)" },
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
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company.trim()) return setError("Company name is required");
    if (model === "opus") {
      setShowCostWarning(true);
    } else {
      submit();
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">New analysis</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Company / App name</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Duolingo"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Period</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyzeRequest["period"])}
            >
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Platform</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as AnalyzeRequest["platform"])}
            >
              <option value="both">Both stores</option>
              <option value="ios">App Store only</option>
              <option value="android">Google Play only</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Model</label>
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
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Starting…" : "Run analysis"}
        </button>
      </form>

      {showCostWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Claude Opus cost warning</h3>
            <p className="text-sm text-gray-600">
              Running the full 7-agent pipeline with Claude Opus can cost <strong>~$2 per analysis</strong>.
              Continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCostWarning(false); submit(); }}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-white font-semibold hover:bg-indigo-700"
              >
                Yes, continue
              </button>
              <button
                onClick={() => setShowCostWarning(false)}
                className="flex-1 rounded-lg border py-2 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
