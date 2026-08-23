import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DealHound Car Finder",
  description: "Find and evaluate private-party vehicles priced substantially below market value",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#f5f2eb] text-[#1d2924]">
        <header className="border-b border-[#ded9cf] bg-[#fffdf8]/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-6xl items-center gap-5 px-4 py-4 text-sm sm:px-6">
            <Link href="/" className="mr-auto flex items-center gap-2 text-base font-bold tracking-[-0.03em]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#19392f] text-xs text-[#c6e49d]">D</span>
              DealHound
            </Link>
            <Link href="/" className="hidden text-[#687168] transition hover:text-[#19392f] sm:block">Radar</Link>
            <Link href="/ingest" className="hidden text-[#687168] transition hover:text-[#19392f] sm:block">Add listing</Link>
            <Link href="/profiles" className="hidden text-[#687168] transition hover:text-[#19392f] sm:block">Profiles</Link>
            <Link href="/alerts" className="rounded-full border border-[#c6e49d] bg-[#e5f1dc] px-3 py-1.5 text-xs font-semibold text-[#35604d] transition hover:bg-[#c6e49d]">Alerts</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <footer className="border-t border-[#ded9cf] bg-[#fffdf8] py-4 text-center text-xs text-[#7b8178]">
          Estimates are planning-grade. Always verify title, history, and condition before purchase.
        </footer>
      </body>
    </html>
  );
}
