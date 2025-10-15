"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BiweeklyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [weekday, setWeekday] = useState<string>("1"); // 1: Monday default
  const [timeRange, setTimeRange] = useState<string>("10:00-11:00");
  const [title, setTitle] = useState<string>("ミーティング（隔週）");
  const [comment, setComment] = useState<string>("");
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);
  const [calendarId, setCalendarId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [preview, setPreview] = useState<Array<{ title: string; startDateTime: string; endDateTime: string }>>([]);
  const [createResult, setCreateResult] = useState<
    | null
    | { createdCount: number; totalCount: number; results: Array<{ index: number; success: boolean; id?: string; error?: string }> }
  >(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [current, setCurrent] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

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

  const disabled = useMemo(() => !startDate || !endDate || !calendarId || loading, [startDate, endDate, calendarId, loading]);

  const handlePreview = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setCreateResult(null);
    try {
      const url = new URL("/api/biweekly", window.location.origin);
      url.searchParams.set("action", "generate");
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);
      url.searchParams.set("weekday", weekday);
      url.searchParams.set("time", timeRange);
      url.searchParams.set("title", title);
      url.searchParams.set("comment", comment);
      url.searchParams.set("skipHolidays", String(skipHolidays));
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "生成に失敗しました");
      setPreview(data.events as Array<{ title: string; startDateTime: string; endDateTime: string }>);
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
    setProgress(0);
    setProgressMsg("登録を開始しています...");
    setCurrent(0);
    setTotal(preview.length);
    setCreateResult(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let created = 0;
      for (let i = 0; i < preview.length; i++) {
        const ev = preview[i];
        setProgressMsg(`${i + 1}/${preview.length}件目を登録中...`);
        const res = await fetch("/api/biweekly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create-single", calendarId, event: ev }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          created++;
        } else {
          if (data?.error === 'auth_expired') throw new Error('認証の期限が切れました。再度ログインしてください。');
          // 失敗はスキップして次へ
        }
        const p = Math.round(((i + 1) / preview.length) * 100);
        setCurrent(i + 1);
        setProgress(p);
        await new Promise((r) => setTimeout(r, 80)); // レート制限対策
      }
      alert(`登録完了: ${created}/${preview.length}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "登録に失敗しました";
      alert(message);
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressMsg("");
      setCurrent(0);
      setTotal(0);
      abortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">隔週スケジューリング（祝日除外対応）</h1>
        <p className="text-gray-700 mb-6">期間・曜日・時間帯を指定して2週間おきの予定を作成します。祝日を自動で除外できます。</p>
        <div className="bg-white rounded-2xl p-5 border grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800">開始日</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">終了日</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">曜日</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                >
                  <option value="0">日</option>
                  <option value="1">月</option>
                  <option value="2">火</option>
                  <option value="3">水</option>
                  <option value="4">木</option>
                  <option value="5">金</option>
                  <option value="6">土</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">時間帯 (HH:MM-HH:MM)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">タイトル</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">メモ（説明）</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input id="skip-holidays" type="checkbox" className="h-4 w-4 accent-blue-600" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} />
                <label htmlFor="skip-holidays" className="text-sm text-gray-800">祝日を除外する</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800">カレンダーID</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="example@gmail.com など"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">セットアップで作成したIDを利用。calendar-setupから遷移すると自動入力されます。</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handlePreview} disabled={loading || !startDate || !endDate} className={`px-4 py-2 rounded-md text-white ${loading || !startDate || !endDate ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>生成プレビュー</button>
              <button onClick={handleCreate} disabled={disabled || preview.length === 0} className={`px-4 py-2 rounded-md text-white ${disabled || preview.length === 0 ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>カレンダーに登録</button>
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
                  <li key={`${e.startDateTime}-${idx}`} className="bg-white border rounded-md px-3 py-2">
                    <div className="text-sm text-gray-700">{e.title}</div>
                    <div className="text-xs text-gray-500">{new Date(e.startDateTime).toLocaleString('ja-JP')} - {new Date(e.endDateTime).toLocaleString('ja-JP')}</div>
                  </li>
                ))}
              </ul>
            )}
            {createResult && (
              <div className="mt-3 text-sm text-gray-700">登録結果: {createResult.createdCount}/{createResult.totalCount}</div>
            )}
          </div>
        </div>
      </div>
      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[92vw] max-w-md shadow-lg">
            <div className="font-semibold text-gray-800 mb-2">登録中...</div>
            <div className="text-sm text-gray-600 mb-3">{progressMsg}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-green-500 h-2 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-xs text-gray-600">{current}/{total} 件</div>
            <div className="mt-4 text-right">
              <button
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50"
                onClick={() => {
                  if (abortRef.current) abortRef.current.abort('user');
                }}
              >停止</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
