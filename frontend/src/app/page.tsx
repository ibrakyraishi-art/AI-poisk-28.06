import Link from "next/link";

const FEATURES = [
  { icon: "★", title: "Review Themes", desc: "App Store & Google Play — clustered by topic, scored by sentiment." },
  { icon: "◎", title: "News Intelligence", desc: "Recent press, product launches, market moves — last 30–180 days." },
  { icon: "⟁", title: "Competitor Profiles", desc: "Ratings, pricing, key strengths and gaps of top rivals, side by side." },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 text-center">
      <div className="max-w-xl space-y-3">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase">CompetitorScope</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Know your market<br />before your next sprint.
        </h1>
        <p className="text-lg text-gray-500">
          7-agent AI pipeline — reviews, news, competitors — in one report.
        </p>
      </div>

      <Link
        href="/auth"
        className="rounded-lg bg-indigo-600 px-7 py-3 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
      >
        Get started free →
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-2xl w-full">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-white px-5 py-4 text-left">
            <span className="text-indigo-500 text-lg">{f.icon}</span>
            <h3 className="mt-1 font-semibold text-sm">{f.title}</h3>
            <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
