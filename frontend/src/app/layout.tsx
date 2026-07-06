import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CompetitorScope",
  description: "AI-анализ конкурентов",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔭</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen bg-[#07070e] text-slate-200 antialiased font-sans selection:bg-indigo-500/30">
        {/* Decorative background — soft brand-coloured glows */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-[-12%] h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[130px]" />
          <div className="absolute bottom-[-12%] right-[-6%] h-[380px] w-[380px] rounded-full bg-fuchsia-600/10 blur-[130px]" />
          <div className="absolute bottom-[10%] left-[-8%] h-[320px] w-[320px] rounded-full bg-violet-700/10 blur-[130px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
