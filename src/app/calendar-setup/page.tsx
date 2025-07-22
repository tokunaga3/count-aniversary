"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function CalendarSetup() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [calendarCreated, setCalendarCreated] = useState(false);
  const [calendarId, setCalendarId] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [userCalendarName, setUserCalendarName] = useState('思い出カレンダー');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // useEffectフックを使って認証チェックとリダイレクトを行う
  useEffect(() => {
    if (session === null) {
      router.push('/');
    }
  }, [session, router]);

  // セッションロード中は何も表示しない
  if (session === undefined) {
    return null;
  }

  const handleCreateCalendar = async () => {
    setIsCreating(true);
    setError('');
    
    try {
      const res = await fetch('/api/create-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarName: userCalendarName }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setCalendarCreated(true);
        setCalendarId(data.calendarId);
        setCalendarName(data.calendarName);
      } else {
        setError(data.error || 'カレンダーの作成に失敗しました');
      }
    } catch (err) {
      setError('サーバーとの通信中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(calendarId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToMainApp = () => {
    router.push(`/?calendarId=${encodeURIComponent(calendarId)}`);
  };

  // セッションがなく、かつロード中でない場合は何も表示しない（useEffectでリダイレクトされるため）
  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">カレンダー設定</h1>
        
        {!calendarCreated ? (
          <>
            <p className="text-lg text-gray-700 mb-6">
              思い出カレンダーを作成するには、まずGoogleカレンダーに専用のカレンダーを作成しましょう。
              カレンダーIDはあとで記念日を登録する際に必要になります。
            </p>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-lg font-medium text-blue-600 mb-2">
                カレンダー名 📅
              </label>
              <input
                type="text"
                value={userCalendarName}
                onChange={(e) => setUserCalendarName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                placeholder="例：家族の思い出カレンダー"
                required
              />
            </div>
            
            <button
              onClick={handleCreateCalendar}
              disabled={isCreating || !userCalendarName.trim()}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-blue-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  作成中...
                </>
              ) : (
                'カレンダーを作成'
              )}
            </button>
            
            <button
              onClick={goToMainApp}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-xl text-md font-medium hover:bg-gray-300 transition-all duration-300"
            >
              スキップ
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4">
                カレンダーの作成が完了しました！
              </div>
              <p className="text-lg text-gray-700 mb-2">
                カレンダー名: <span className="font-bold">{calendarName}</span>
              </p>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">カレンダーID (記念日登録時に必要です):</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 p-3 rounded-lg text-gray-800 font-mono break-all">
                  {calendarId}
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`p-2 rounded-lg ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} hover:bg-gray-200`}
                  title="IDをコピー"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              {copied && (
                <p className="text-green-600 text-sm mt-1">コピーしました！</p>
              )}
            </div>
            
            <button
              onClick={goToMainApp}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-blue-600 transition-all duration-300"
            >
              思い出カレンダーを使い始める
            </button>
          </>
        )}
      </div>
    </main>
  );
}