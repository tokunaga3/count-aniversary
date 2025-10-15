"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function MemorialPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [baseDate, setBaseDate] = useState<string>("");
  const [untilYears, setUntilYears] = useState<number>(49);
  const [calendarId, setCalendarId] = useState<string>("");
  const [titleTemplate, setTitleTemplate] = useState<string>("{{houyou}}（故人）🕊️");
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [preview, setPreview] = useState<Array<{ title: string; date: string }>>([]);
  const [createResult, setCreateResult] = useState<
    | null
    | {
        createdCount: number;
        totalCount: number;
        results: Array<{ index: number; success: boolean; id?: string; error?: string }>;
      }
  >(null);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push("/");
    }
  }, [status, session, router]);

  // preload from query
  useEffect(() => {
    const calId = searchParams.get("calendarId");
    if (calId) setCalendarId(calId);
  }, [searchParams]);

  const disabled = useMemo(() => !baseDate || !calendarId || loading, [baseDate, calendarId, loading]);

  const handlePreview = async () => {
    if (!baseDate) return;
    setLoading(true);
    setCreateResult(null);
    try {
      const url = new URL("/api/memorial", window.location.origin);
      url.searchParams.set("action", "generate");
      url.searchParams.set("baseDate", baseDate);
      url.searchParams.set("title", titleTemplate);
      url.searchParams.set("comment", comment);
      url.searchParams.set("untilYears", String(untilYears));
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "生成に失敗しました");
      setPreview(data.events as Array<{ title: string; date: string }>);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "プレビューに失敗しました";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (preview.length === 0 || !calendarId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-batch",
          calendarId,
          events: preview,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data?.message || data?.error || "登録に失敗しました");
      setCreateResult(data);
      alert(`登録完了: ${data.createdCount}/${data.totalCount}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "登録に失敗しました";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">法要 自動生成（命日から）</h1>
        <p className="text-gray-700 mb-6">命日を入力すると、初七日〜五十回忌までの法要を自動生成して登録します。</p>
        <div className="bg-white rounded-2xl p-5 border grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">命日（YYYY-MM-DD）</label>
                <input type="date" className="mt-1 w-full rounded-md border px-3 py-2"
                  value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">上限（何年分まで）</label>
                <input type="number" min={1} max={49} className="mt-1 w-full rounded-md border px-3 py-2"
                  value={untilYears} onChange={(e) => setUntilYears(Number(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">一周忌〜五十回忌まで（最大49年）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">カレンダーID</label>
                <input type="text" className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="example@gmail.com など"
                  value={calendarId} onChange={(e) => setCalendarId(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">セットアップで作成したIDを利用。calendar-setupから遷移すると自動入力されます。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">タイトルテンプレート</label>
                <input type="text" className="mt-1 w-full rounded-md border px-3 py-2"
                  value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">利用可: {'{{houyou}}'}, {'{{year}}'}, {'{{base_date}}'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">メモ（説明）</label>
                <textarea className="mt-1 w-full rounded-md border px-3 py-2"
                  rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handlePreview} disabled={loading || !baseDate}
                className={`px-4 py-2 rounded-md text-white ${loading || !baseDate ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>生成プレビュー</button>
              <button onClick={handleCreate} disabled={disabled || preview.length === 0}
                className={`px-4 py-2 rounded-md text-white ${disabled || preview.length === 0 ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>カレンダーに登録</button>
              <Link href="/calendar-setup" className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50">セットアップへ</Link>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto border rounded-md p-3 bg-gray-50">
            <h2 className="font-semibold text-gray-700 mb-2">プレビュー（{preview.length} 件）</h2>
            {preview.length === 0 ? (
              <p className="text-sm text-gray-500">「生成プレビュー」を押すと一覧が表示されます。</p>
            ) : (
              <ul className="space-y-2">
                {preview.map((e, idx) => (
                  <li key={`${e.date}-${idx}`} className="bg-white border rounded-md px-3 py-2">
                    <div className="text-sm text-gray-700">{e.title}</div>
                    <div className="text-xs text-gray-500">{new Date(e.date).toLocaleDateString('ja-JP')}</div>
                  </li>
                ))}
              </ul>
            )}
            {createResult && (
              <div className="mt-3 text-sm text-gray-700">
                登録結果: {createResult.createdCount}/{createResult.totalCount}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
