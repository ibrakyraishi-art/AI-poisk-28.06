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
      <div className="max-w-2xl space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-300 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
          </span>
          Конвейер из 7 AI-агентов
        </span>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Знай свой рынок
          </span>
          <br />
          <span className="animate-shimmer bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            до следующего спринта.
          </span>
        </h1>

        <p className="mx-auto max-w-lg text-lg text-slate-400">
          Отзывы, новости и конкуренты — семь агентов собирают их в один отчёт, пока вы наблюдаете за их работой вживую.
        </p>
      </div>

      <Link
        href="/auth"
        className="group rounded-lg bg-indigo-500 px-7 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-400 hover:shadow-indigo-400/40 active:scale-[0.98]"
      >
        Начать бесплатно
        <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </Link>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5 text-left backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/20">
              {f.icon}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">{f.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>

      <footer className="pt-6 text-xs text-slate-400">
        © 2026 CompetitorScope · AI-анализ конкурентов
      </footer>
    </main>
  );
}
