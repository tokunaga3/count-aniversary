"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AnniversaryForm from "@/components/AnniversaryForm";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AnniversaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCalendarId = searchParams.get('calendarId') || undefined;

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">記念日 一括登録</h1>
        <p className="text-gray-700 mb-6">記念日と記録年数、タイトル、メモを入力して、月次イベントをまとめて作成します。</p>
        <div className="bg-white rounded-2xl p-4 border">
          <AnniversaryForm initialCalendarId={initialCalendarId} />
          <div className="mt-4">
            <Link href="/" className="text-blue-600 hover:underline">トップに戻る</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
