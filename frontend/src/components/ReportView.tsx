"use client";

import { CompetitorMatrix } from "./CompetitorMatrix";

interface Theme {
  theme: string;
  sentiment: "positive" | "negative" | "mixed";
  count: number;
  sample_quote?: string;
}

interface SwotItem {
  point: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  rationale: string;
}

interface Competitor {
  name: string;
  rating?: number;
  price_model?: string;
  top_strength?: string;
  top_weakness?: string;
}

interface Report {
  company: string;
  period: string;
  executive_summary: string;
  review_themes?: Theme[];
  swot?: {
    strengths?: SwotItem[];
    weaknesses?: SwotItem[];
    opportunities?: SwotItem[];
    threats?: SwotItem[];
  };
  recommendations?: Recommendation[];
  competitors?: Competitor[];
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  negative: "bg-red-100 text-red-800",
  mixed: "bg-yellow-100 text-yellow-800",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-50 border-red-300",
  medium: "bg-yellow-50 border-yellow-300",
  low: "bg-gray-50 border-gray-200",
};

export function ReportView({ report }: { report: Report }) {
  const swot = report.swot ?? {};

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-2">Executive Summary</h2>
        <p className="text-gray-700 leading-relaxed">{report.executive_summary}</p>
      </section>

      {report.review_themes && report.review_themes.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Review Themes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.review_themes.map((t) => (
              <div key={t.theme} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{t.theme}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_COLOR[t.sentiment] ?? "bg-gray-100"}`}>
                    {t.sentiment}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Mentions: {t.count}</p>
                {t.sample_quote && (
                  <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600">
                    "{t.sample_quote}"
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {Object.values(swot).some((arr) => arr && arr.length > 0) && (
        <section>
          <h2 className="text-xl font-semibold mb-3">SWOT Analysis</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => (
              <div key={key} className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold capitalize mb-2">{key}</h3>
                <ul className="list-disc list-inside space-y-1">
                  {(swot[key] ?? []).map((item, i) => (
                    <li key={i} className="text-sm text-gray-700">{item.point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.competitors && report.competitors.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Competitor Overview</h2>
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <CompetitorMatrix competitors={report.competitors} />
          </div>
        </section>
      )}

      {report.recommendations && report.recommendations.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Recommendations</h2>
          <div className="space-y-3">
            {report.recommendations.map((rec, i) => (
              <div key={i} className={`rounded-xl border p-4 ${PRIORITY_COLOR[rec.priority] ?? "bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{rec.action}</p>
                  <span className="text-xs font-semibold uppercase text-gray-500 shrink-0">{rec.priority}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
