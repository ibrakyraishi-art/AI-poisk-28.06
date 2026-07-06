"use client";

interface Competitor {
  name: string;
  rating?: number;
  price_model?: string;
  strengths?: string[];
  weaknesses?: string[];
}

interface Props {
  competitors: Competitor[];
}

export function CompetitorMatrix({ competitors }: Props) {
  if (!competitors.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04] text-left text-slate-300">
            <th className="px-4 py-2.5 font-semibold">Конкурент</th>
            <th className="px-4 py-2.5 font-semibold">Рейтинг</th>
            <th className="px-4 py-2.5 font-semibold">Цены</th>
            <th className="px-4 py-2.5 font-semibold">Гл. преимущество</th>
            <th className="px-4 py-2.5 font-semibold">Гл. недостаток</th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((c) => (
            <tr key={c.name} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-2.5 font-medium text-white">{c.name}</td>
              <td className="px-4 py-2.5">
                {c.rating != null ? (
                  <span className={c.rating >= 4.5 ? "text-green-400" : c.rating >= 4.0 ? "text-yellow-400" : "text-red-400"}>
                    {c.rating.toFixed(1)} ★
                  </span>
                ) : <span className="text-slate-600">—</span>}
              </td>
              <td className="px-4 py-2.5 text-slate-300">{c.price_model ?? "—"}</td>
              <td className="px-4 py-2.5 text-green-400/90">{c.strengths?.[0] ?? "—"}</td>
              <td className="px-4 py-2.5 text-red-400/90">{c.weaknesses?.[0] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
