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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-bold tracking-tight">
              🐕 DealHound
            </Link>
            <Link href="/" className="text-zinc-600 hover:text-zinc-900">Deal Inbox</Link>
            <Link href="/ingest" className="text-zinc-600 hover:text-zinc-900">Ingest Listing</Link>
            <Link href="/profiles" className="text-zinc-600 hover:text-zinc-900">Search Profiles</Link>
            <Link href="/alerts" className="text-zinc-600 hover:text-zinc-900">Alerts</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-3 text-center text-xs text-zinc-400">
          Estimates are planning-grade. Always verify title, history, and condition before purchase.
        </footer>
      </body>
    </html>
  );
}
