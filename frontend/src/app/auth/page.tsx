"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") router.push("/dashboard");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🔭</div>
          <h1 className="text-2xl font-bold text-white">CompetitorScope</h1>
          <p className="mt-1 text-sm text-slate-400">Анализ конкурентов на автопилоте.</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#6366f1",
                  brandAccent: "#818cf8",
                  brandButtonText: "#ffffff",
                  defaultButtonBackground: "rgba(255,255,255,0.05)",
                  defaultButtonBackgroundHover: "rgba(255,255,255,0.1)",
                  defaultButtonBorder: "rgba(255,255,255,0.12)",
                  defaultButtonText: "#e2e8f0",
                  inputBackground: "rgba(255,255,255,0.04)",
                  inputBorder: "rgba(255,255,255,0.12)",
                  inputBorderHover: "rgba(255,255,255,0.22)",
                  inputBorderFocus: "#6366f1",
                  inputText: "#f1f5f9",
                  inputLabelText: "#94a3b8",
                  inputPlaceholder: "#64748b",
                  messageText: "#94a3b8",
                  messageTextDanger: "#f87171",
                  anchorTextColor: "#94a3b8",
                  anchorTextHoverColor: "#e2e8f0",
                  dividerBackground: "rgba(255,255,255,0.1)",
                },
                radii: {
                  borderRadiusButton: "0.5rem",
                  inputBorderRadius: "0.5rem",
                },
              },
            },
          }}
          providers={[]}
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email",
                password_label: "Пароль",
                email_input_placeholder: "Ваш email",
                password_input_placeholder: "Ваш пароль",
                button_label: "Войти",
                loading_button_label: "Вход…",
                link_text: "Уже есть аккаунт? Войти",
              },
              sign_up: {
                email_label: "Email",
                password_label: "Пароль",
                email_input_placeholder: "Ваш email",
                password_input_placeholder: "Придумайте пароль",
                button_label: "Зарегистрироваться",
                loading_button_label: "Регистрация…",
                link_text: "Нет аккаунта? Зарегистрироваться",
                confirmation_text: "Проверьте почту — мы отправили ссылку для подтверждения",
              },
              forgotten_password: {
                email_label: "Email",
                email_input_placeholder: "Ваш email",
                button_label: "Отправить ссылку для сброса",
                loading_button_label: "Отправляем…",
                link_text: "Забыли пароль?",
                confirmation_text: "Проверьте почту — мы отправили ссылку для сброса пароля",
              },
            },
          }}
        />
      </div>
    </main>
  );
}
