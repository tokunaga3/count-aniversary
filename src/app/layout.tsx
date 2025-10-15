"use client";


import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <header className="bg-white/80 backdrop-blur sticky top-0 z-50 border-b">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="text-lg font-bold text-blue-600">思い出カレンダー</Link>
              <nav className="flex gap-3 text-sm">
                <Link href="/anniversary" className="px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700">記念日</Link>
                <Link href="/memorial" className="px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700">法要</Link>
                <Link href="/biweekly" className="px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700">隔週</Link>
                <Link href="/calendar-setup" className="px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700">セットアップ</Link>
                <Link href="/api/auth/signout" className="px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-600">ログアウト</Link>
              </nav>
            </div>
          </header>
          <main className="pt-2">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
