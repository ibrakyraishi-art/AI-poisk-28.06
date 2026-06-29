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
                <p className="text-xs text-gray-500">Mentions: {t.review_count}</p>
                {t.examples && t.examples.length > 0 && (
                  <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600">
                    "{t.examples[0]}"
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
          <h2 className="text-xl font-semibold mb-3">SWOT Analysis</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => (
              <div key={key} className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="font-semibold capitalize mb-2">{key}</h3>
                <ul className="list-disc list-inside space-y-1">
                  {(swot[key] ?? []).map((item, i) => (
                    <li key={i} className="text-sm text-gray-700">{item}</li>
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
          <ol className="space-y-2 list-decimal list-inside">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-700 leading-relaxed">
                {rec}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
