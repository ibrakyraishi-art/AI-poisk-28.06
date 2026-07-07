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
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold text-white">
          <span aria-hidden>🔭</span>
          <span className="text-sm sm:text-base">CompetitorScope</span>
        </Link>
        <nav className="flex items-center gap-3 whitespace-nowrap text-xs sm:gap-4 sm:text-sm">
          {/* "Кабинет" is redundant with the logo on phones — hide it there */}
          <Link href="/dashboard" className={`hidden sm:inline ${linkCls("/dashboard")}`}>Кабинет</Link>
          <Link href="/settings" className={linkCls("/settings")}>API-ключи</Link>
          <button onClick={signOut} className="text-slate-400 transition-colors hover:text-white">Выйти</button>
        </nav>
      </div>
    </header>
  );
}
