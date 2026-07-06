"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const KEY_FIELDS = [
  { id: "anthropic_api_key", label: "Ключ Anthropic API", placeholder: "sk-ant-..." },
  { id: "google_api_key", label: "Ключ Google AI API", placeholder: "AIza..." },
  { id: "serper_api_key", label: "Ключ Serper API (веб-поиск)", placeholder: "..." },
  { id: "news_api_key", label: "Ключ NewsAPI (опционально)", placeholder: "..." },
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
    <main className="max-w-lg mx-auto mt-16 px-4">
      <h1 className="text-2xl font-bold mb-2">API-ключи (свои ключи)</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ключи хранятся в вашей приватной строке Supabase под защитой Row-Level Security — читать их может только ваш аккаунт.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        {KEY_FIELDS.map(({ id, label, placeholder }) => (
          <div key={id}>
            <label className="block text-sm font-medium mb-1" htmlFor={id}>
              {label}
            </label>
            <input
              id={id}
              type="password"
              placeholder={placeholder}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={values[id] ?? ""}
              onChange={(ev) => setValues((v) => ({ ...v, [id]: ev.target.value }))}
              autoComplete="off"
            />
          </div>
        ))}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-green-600 text-sm">Сохранено!</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Сохранить ключи
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border px-5 py-2 font-semibold hover:bg-gray-50 transition-colors"
          >
            В кабинет
          </button>
        </div>
      </form>
    </main>
  );
}
