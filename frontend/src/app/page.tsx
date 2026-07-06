import Link from "next/link";

const FEATURES = [
  {
    title: "Темы отзывов",
    desc: "App Store и Google Play — сгруппированы по темам и оценены по тональности.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.12 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.59 0l-4.72 2.88a.56.56 0 01-.84-.61l1.28-5.38a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.48-.35L11.48 3.5z" />
      </svg>
    ),
  },
  {
    title: "Анализ новостей",
    desc: "Свежая пресса, запуски продуктов, движения рынка — за последние 30–180 дней.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.38c.62 0 1.12.5 1.12 1.13V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.88c0-.62-.5-1.13-1.13-1.13H4.13C3.5 3.75 3 4.25 3 4.88V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
  },
  {
    title: "Профили конкурентов",
    desc: "Рейтинги, цены, сильные и слабые стороны топ-конкурентов — рядом.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.13C3 12.5 3.5 12 4.13 12h2.25c.62 0 1.12.5 1.12 1.13v6.75c0 .62-.5 1.12-1.12 1.12H4.13A1.13 1.13 0 013 19.88v-6.75zM9.75 8.63c0-.63.5-1.13 1.13-1.13h2.25c.62 0 1.12.5 1.12 1.13v11.25c0 .62-.5 1.12-1.12 1.12h-2.25a1.13 1.13 0 01-1.13-1.12V8.63zM16.5 4.13c0-.63.5-1.13 1.13-1.13h2.25c.62 0 1.12.5 1.12 1.13v15.75c0 .62-.5 1.12-1.12 1.12h-2.25a1.13 1.13 0 01-1.13-1.12V4.13z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div className="max-w-xl space-y-4">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase">CompetitorScope</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Знай свой рынок<br />до следующего спринта.
        </h1>
        <p className="text-lg text-gray-500">
          Конвейер из 7 AI-агентов — отзывы, новости, конкуренты — в одном отчёте.
        </p>
      </div>

      <Link
        href="/auth"
        className="rounded-lg bg-indigo-600 px-7 py-3 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
      >
        Начать бесплатно →
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl w-full">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-white px-5 py-5 text-left shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {f.icon}
            </div>
            <h3 className="mt-3 font-semibold text-sm">{f.title}</h3>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
