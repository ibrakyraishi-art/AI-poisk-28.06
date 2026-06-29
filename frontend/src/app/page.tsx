import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">CompetitorScope</h1>
        <p className="text-xl text-gray-600">
          AI-powered competitive analysis: reviews, news, market context — delivered in minutes.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/auth"
          className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-300 px-6 py-3 font-semibold hover:bg-gray-100 transition-colors"
        >
          Dashboard
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-3xl">
        {[
          { title: "Reviews Analysis", desc: "App Store & Google Play sentiment, themes, and trends." },
          { title: "News Intelligence", desc: "Recent press coverage, product launches, and market moves." },
          { title: "Competitor Profiles", desc: "Ratings, pricing, strengths and gaps of top rivals." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-white p-6 shadow-sm text-left">
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
