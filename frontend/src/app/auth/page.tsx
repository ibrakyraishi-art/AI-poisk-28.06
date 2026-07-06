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
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">CompetitorScope</h1>
          <p className="text-sm text-gray-500 mt-1">Анализ конкурентов на автопилоте.</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#4f46e5",
                  brandAccent: "#4338ca",
                  brandButtonText: "#ffffff",
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
