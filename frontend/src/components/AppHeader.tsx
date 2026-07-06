"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const linkCls = (href: string) =>
    `hover:text-gray-900 transition-colors ${pathname === href ? "text-gray-900 font-medium" : ""}`;

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900">
          <span aria-hidden>🔭</span>
          <span>CompetitorScope</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/dashboard" className={linkCls("/dashboard")}>Кабинет</Link>
          <Link href="/settings" className={linkCls("/settings")}>API-ключи</Link>
          <button onClick={signOut} className="hover:text-gray-900 transition-colors">Выйти</button>
        </nav>
      </div>
    </header>
  );
}
