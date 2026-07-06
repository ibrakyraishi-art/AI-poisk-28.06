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
    `transition-colors hover:text-white ${pathname === href ? "text-white font-medium" : "text-slate-400"}`;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b16]/70 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
          <span aria-hidden>🔭</span>
          <span>CompetitorScope</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className={linkCls("/dashboard")}>Кабинет</Link>
          <Link href="/settings" className={linkCls("/settings")}>API-ключи</Link>
          <button onClick={signOut} className="text-slate-400 transition-colors hover:text-white">Выйти</button>
        </nav>
      </div>
    </header>
  );
}
