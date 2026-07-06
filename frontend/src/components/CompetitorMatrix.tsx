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
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-4 py-2 font-semibold">Конкурент</th>
            <th className="px-4 py-2 font-semibold">Рейтинг</th>
            <th className="px-4 py-2 font-semibold">Цены</th>
            <th className="px-4 py-2 font-semibold">Гл. преимущество</th>
            <th className="px-4 py-2 font-semibold">Гл. недостаток</th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((c, i) => (
            <tr key={c.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-4 py-2 font-medium">{c.name}</td>
              <td className="px-4 py-2">
                {c.rating != null ? (
                  <span className={c.rating >= 4.5 ? "text-green-700" : c.rating >= 4.0 ? "text-yellow-700" : "text-red-600"}>
                    {c.rating.toFixed(1)} ★
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-2">{c.price_model ?? "—"}</td>
              <td className="px-4 py-2 text-green-700">{c.strengths?.[0] ?? "—"}</td>
              <td className="px-4 py-2 text-red-600">{c.weaknesses?.[0] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
