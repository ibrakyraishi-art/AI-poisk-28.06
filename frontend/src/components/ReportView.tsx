"use client";

import { CompetitorMatrix } from "./CompetitorMatrix";

interface Theme {
  theme: string;
  sentiment: "positive" | "negative" | "mixed";
  review_count: number;
  examples?: string[];
}

interface SwotData {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}

interface Competitor {
  name: string;
  rating?: number;
  price_model?: string;
  strengths?: string[];
  weaknesses?: string[];
}

interface Report {
  company: string;
  period: string;
  executive_summary: string;
  review_themes?: Theme[];
  swot?: SwotData;
  recommendations?: string[];
  competitors?: Competitor[];
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  negative: "bg-red-100 text-red-800",
  mixed: "bg-yellow-100 text-yellow-800",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "позитив",
  negative: "негатив",
  mixed: "смешанный",
};

const SWOT_CONFIG: Record<string, { label: string; accent: string }> = {
  strengths:     { label: "Сильные стороны", accent: "border-t-4 border-green-400" },
  weaknesses:    { label: "Слабые стороны",  accent: "border-t-4 border-red-400" },
  opportunities: { label: "Возможности",     accent: "border-t-4 border-blue-400" },
  threats:       { label: "Угрозы",          accent: "border-t-4 border-amber-400" },
};

export function ReportView({ report }: { report: Report }) {
  const swot = report.swot ?? {};

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-2">Краткое резюме</h2>
        <p className="text-gray-700 leading-relaxed">{report.executive_summary}</p>
      </section>

      {report.review_themes && report.review_themes.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Темы отзывов</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.review_themes.map((t) => (
              <div key={t.theme} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{t.theme}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_COLOR[t.sentiment] ?? "bg-gray-100"}`}>
                    {SENTIMENT_LABEL[t.sentiment] ?? t.sentiment}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Упоминаний: {t.review_count}</p>
                {t.examples && t.examples.length > 0 && (
                  <blockquote className="mt-2 border-l-2 border-indigo-200 pl-3 text-sm italic text-gray-600">
                    «{t.examples[0]}»
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(["strengths", "weaknesses", "opportunities", "threats"] as const).some(
        (k) => swot[k] && (swot[k] as string[]).length > 0,
      ) && (
        <section>
          <h2 className="text-xl font-semibold mb-3">SWOT-анализ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => {
              const cfg = SWOT_CONFIG[key];
              return (
                <div key={key} className={`rounded-xl border bg-white p-4 shadow-sm ${cfg.accent}`}>
                  <h3 className="font-semibold mb-2">{cfg.label}</h3>
                  <ul className="space-y-1">
                    {(swot[key] ?? []).map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {report.competitors && report.competitors.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Обзор конкурентов</h2>
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <CompetitorMatrix competitors={report.competitors} />
          </div>
        </section>
      )}

      {report.recommendations && report.recommendations.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Рекомендации</h2>
          <ol className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 items-start rounded-xl border bg-white p-4 shadow-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
