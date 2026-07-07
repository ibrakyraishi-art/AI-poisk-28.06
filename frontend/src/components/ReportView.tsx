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
  positive: "bg-green-500/15 text-green-300",
  negative: "bg-red-500/15 text-red-300",
  mixed: "bg-yellow-500/15 text-yellow-300",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "позитив",
  negative: "негатив",
  mixed: "смешанный",
};

const SWOT_CONFIG: Record<string, { label: string; accent: string }> = {
  strengths:     { label: "Сильные стороны", accent: "border-t-2 border-green-400/70" },
  weaknesses:    { label: "Слабые стороны",  accent: "border-t-2 border-red-400/70" },
  opportunities: { label: "Возможности",     accent: "border-t-2 border-blue-400/70" },
  threats:       { label: "Угрозы",          accent: "border-t-2 border-amber-400/70" },
};

const cardCls = "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm";

export function ReportView({ report }: { report: Report }) {
  const swot = report.swot ?? {};

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">Краткое резюме</h2>
        <p className="leading-relaxed text-slate-300">{report.executive_summary}</p>
      </section>

      {report.review_themes && report.review_themes.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Темы отзывов</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.review_themes.map((t) => (
              <div key={t.theme} className={`${cardCls} p-4`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-white">{t.theme}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SENTIMENT_COLOR[t.sentiment] ?? "bg-white/10 text-slate-300"}`}>
                    {SENTIMENT_LABEL[t.sentiment] ?? t.sentiment}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Упоминаний: {t.review_count}</p>
                {t.examples && t.examples.length > 0 && (
                  <blockquote className="mt-2 border-l-2 border-indigo-400/50 pl-3 text-sm italic text-slate-400">
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
          <h2 className="mb-3 text-xl font-semibold text-white">SWOT-анализ</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => {
              const cfg = SWOT_CONFIG[key];
              return (
                <div key={key} className={`${cardCls} p-4 ${cfg.accent}`}>
                  <h3 className="mb-2 font-semibold text-white">{cfg.label}</h3>
                  <ul className="space-y-1">
                    {(swot[key] ?? []).map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-500" />
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
          <h2 className="mb-3 text-xl font-semibold text-white">Обзор конкурентов</h2>
          <div className={`${cardCls} overflow-hidden`}>
            <CompetitorMatrix competitors={report.competitors} />
          </div>
        </section>
      )}

      {report.recommendations && report.recommendations.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Рекомендации</h2>
          <ol className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className={`flex items-start gap-3 ${cardCls} p-4`}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/30">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-300">{rec}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
