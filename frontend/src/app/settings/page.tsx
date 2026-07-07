"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";

const KEY_FIELDS = [
  {
    id: "anthropic_api_key",
    label: "Ключ Anthropic API",
    placeholder: "sk-ant-...",
    desc: "Для моделей Claude (Haiku / Sonnet / Opus) — самые качественные отчёты.",
    href: "https://console.anthropic.com/settings/keys",
    hrefText: "console.anthropic.com",
  },
  {
    id: "google_api_key",
    label: "Ключ Google AI API",
    placeholder: "AIza...",
    desc: "Для моделей Gemini — дешёвый вариант по умолчанию.",
    href: "https://aistudio.google.com/app/apikey",
    hrefText: "aistudio.google.com",
  },
  {
    id: "serper_api_key",
    label: "Ключ Serper API (веб-поиск)",
    placeholder: "...",
    desc: "Поиск конкурентов и новостей через Google. Бесплатно 2500 запросов. Ключ — после регистрации в разделе Dashboard.",
    href: "https://serper.dev",
    hrefText: "serper.dev",
  },
  {
    id: "news_api_key",
    label: "Ключ NewsAPI (опционально)",
    placeholder: "...",
    desc: "Свежие новости о компании. Без ключа новости берутся из демо-данных.",
    href: "https://newsapi.org/register",
    hrefText: "newsapi.org",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push("/auth"); return; }
      const { data: row } = await supabase
        .from("user_api_keys")
        .select("keys")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      if (row?.keys) setValues(row.keys as Record<string, string>);
    });
  }, [router]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/auth");

    // Upsert into user_api_keys table (one row per user, jsonb column "keys")
    const { error: dbErr } = await supabase
      .from("user_api_keys")
      .upsert({ user_id: session.user.id, keys: values }, { onConflict: "user_id" });

    if (dbErr) setError(dbErr.message);
    else setSaved(true);
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2 text-white">API-ключи (свои ключи)</h1>
        <p className="text-sm text-slate-400 mb-4">
          Анализ работает на ваших ключах. Они хранятся в вашей приватной строке Supabase под
          защитой Row-Level Security — читать их может только ваш аккаунт.
        </p>

        <div className="mb-6 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3 text-xs leading-relaxed text-slate-300">
          Нужен минимум <span className="font-medium text-white">один LLM-ключ</span> — Anthropic или
          Google AI. <span className="font-medium text-white">Serper</span> — для веб-поиска конкурентов
          и новостей. <span className="font-medium text-white">NewsAPI</span> — по желанию.
          Ключ вставляется один раз и обычно бесплатен на старте.
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <form onSubmit={handleSave} className="space-y-5">
            {KEY_FIELDS.map(({ id, label, placeholder, desc, href, hrefText }) => (
              <div key={id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor={id}>
                    {label}
                  </label>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-xs font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    Получить ключ ↗
                  </a>
                </div>
                <p className="mb-1.5 text-xs text-slate-400">
                  {desc} <span className="text-slate-500">· {hrefText}</span>
                </p>
                <input
                  id={id}
                  type="password"
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={values[id] ?? ""}
                  onChange={(ev) => setValues((v) => ({ ...v, [id]: ev.target.value }))}
                  autoComplete="off"
                />
              </div>
            ))}

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {saved && <p className="text-green-400 text-sm">Сохранено!</p>}

            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-5 py-2 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors"
            >
              Сохранить ключи
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
