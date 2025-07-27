"use client";

import React, { useState } from 'react';
import { Calendar, Trash2, Loader2, Info } from 'lucide-react';

interface SpecialDate {
  id: string;
  calendarId: string;
  title: string;
  date: string;
  description: string;
  countType: 'years' | 'months' | 'yearsAndMonths';
  repeatCount: number;
}

export default function AnniversaryForm() {
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [deleteCalendarId, setDeleteCalendarId] = useState<string>('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [isDeleteMode, setIsDeleteMode] = useState<boolean>(false);
  const [currentProcessing, setCurrentProcessing] = useState<{
    current: number;
    total: number;
    currentDate: string;
    summary: string;
  }>({
    current: 0,
    total: 0,
    currentDate: '',
    summary: ''
  });
  const [isDeleting, setIsDeleting] = useState<boolean>(false);


  const addSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !calendarId || !endDate) return;
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('記念日の登録を開始しています...');
    
    try {
      const intervalType = 'monthly'; // 月単位固定
      const titleToSend = title.trim() === '' ? '🎉 #回目の記念日 🎉' : title;
      
      // 予定される記念日の総数を計算（概算）
      const startDateTime = new Date(date);
      const endDateTime = new Date(endDate);
      const monthsDiff = (endDateTime.getFullYear() - startDateTime.getFullYear()) * 12 + 
                        (endDateTime.getMonth() - startDateTime.getMonth()) + 1;
      
      console.log('Sending data to API:', {
        startDate: date,
        endDate: endDate,
        intervalType,
        comment: description,
        calenderId: calendarId,
        title: titleToSend,
        estimatedCount: monthsDiff
      });

      // 進捗シミュレーション（より詳細に）
      setProgressMessage(`約${monthsDiff}件の記念日を登録準備中...`);
      setProgress(10);
      setCurrentProcessing({
        current: 0,
        total: monthsDiff,
        currentDate: date,
        summary: '登録準備中...'
      });

      // 段階的進捗更新
      const progressSteps = [
        { 
          delay: 300, 
          progress: 20, 
          message: 'カレンダー接続中...', 
          current: 0,
          currentDate: date,
          summary: 'カレンダー接続準備中'
        },
        { 
          delay: 600, 
          progress: 35, 
          message: `${monthsDiff}件の記念日を処理中...`, 
          current: Math.floor(monthsDiff * 0.1),
          currentDate: date,
          summary: titleToSend
        },
        { 
          delay: 1200, 
          progress: 55, 
          message: '記念日データを生成中...', 
          current: Math.floor(monthsDiff * 0.4),
          currentDate: date,
          summary: titleToSend
        },
        { 
          delay: 1800, 
          progress: 75, 
          message: 'カレンダーに登録中...', 
          current: Math.floor(monthsDiff * 0.7),
          currentDate: date,
          summary: titleToSend
        }
      ];

      progressSteps.forEach(step => {
        setTimeout(() => {
          setProgress(step.progress);
          setProgressMessage(step.message);
          setCurrentProcessing({
            current: step.current,
            total: monthsDiff,
            currentDate: step.currentDate,
            summary: step.summary
          });
        }, step.delay);
      });
      
      const response = await fetch("/api/anniversary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: date,
          endDate: endDate,
          intervalType,
          comment: description,
          calenderId: calendarId,
          title: titleToSend
        }),
      });

      setProgress(90);
      setProgressMessage('最終処理中...');
      setCurrentProcessing({
        current: monthsDiff,
        total: monthsDiff,
        currentDate: endDate,
        summary: '登録完了処理中'
      });

      if (response.ok) {
        setProgress(100);
        setProgressMessage('🎉 登録完了！');
        setCurrentProcessing({
          current: monthsDiff,
          total: monthsDiff,
          currentDate: endDate,
          summary: '全ての記念日が登録されました'
        });
        
        const newDate: SpecialDate = {
          id: crypto.randomUUID(),
          calendarId,
          title: titleToSend || '🎉 #回目の記念日 🎉',
          date,
          description,
          countType: 'months', // 月単位固定
          repeatCount: 0 // 使用しないが型定義のため
        };
        setSpecialDates([...specialDates, newDate]);
        setCalendarId('');
        setTitle('');
        setDate('');
        setEndDate('');
        setDescription('');
        
        // 完了アニメーションを少し長めに表示
        setTimeout(() => {
          setProgress(0);
          setProgressMessage('');
          setCurrentProcessing({
            current: 0,
            total: 0,
            currentDate: '',
            summary: ''
          });
          setIsLoading(false);
          alert(`${monthsDiff}件の記念日を登録しました！`);
        }, 2000);
      } else {
        setProgress(0);
        setProgressMessage('');
        setIsLoading(false);
        alert("エラーが発生しました");
      }
    } catch {
      setProgress(0);
      setProgressMessage('');
      setIsLoading(false);
      alert("エラーが発生しました");
    }
  };

  const handleDeleteByCalendarId = async () => {
    if (!deleteCalendarId) return;
    setIsLoading(true);
    setIsDeleting(true);
    setProgress(0);
    setProgressMessage('削除処理を開始しています...');
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: '削除準備中...'
    });
    
    // 開発環境用にSSEを試行し、即座にフォールバックするオプション
    const useSSE = process.env.NODE_ENV === 'production'; // 本番環境でのみSSEを使用
    
    if (useSSE) {
      console.log('Attempting SSE connection for delete...');
      trySSEDelete();
    } else {
      console.log('Using fallback delete approach for development...');
      performFallbackDelete();
    }
  };

  // SSE削除を試行する関数
  const trySSEDelete = async () => {
    try {
      const eventSource = new EventSource(`/api/anniversary?calendarId=${encodeURIComponent(deleteCalendarId)}&streaming=true`);
      
      // 短いタイムアウト（5秒）で早めにフォールバック
      const timeout = setTimeout(() => {
        console.log('SSE connection timeout - switching to fallback');
        eventSource.close();
        performFallbackDelete();
      }, 5000);
      
      eventSource.onopen = () => {
        console.log('SSE connection opened successfully');
        setProgressMessage('リアルタイム削除処理に接続中...');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setProgress(data.progress);
            setProgressMessage(data.message);
          } else if (data.type === 'complete') {
            clearTimeout(timeout);
            setProgress(100);
            setProgressMessage('🗑️ 削除完了！');
            
            setSpecialDates(specialDates.filter(date => date.calendarId !== deleteCalendarId));
            setDeleteCalendarId('');
            setShowDeleteConfirmation(false);
            eventSource.close();
            
            setTimeout(() => {
              setProgress(0);
              setProgressMessage('');
              setIsLoading(false);
              alert(`${data.deletedCount || 0}件の予定を削除しました！`);
            }, 2000);
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            eventSource.close();
            console.error('SSE reported error, switching to fallback');
            performFallbackDelete();
          }
        } catch (parseError) {
          console.error('SSE parse error, switching to fallback:', parseError);
          clearTimeout(timeout);
          eventSource.close();
          performFallbackDelete();
        }
      };
      
      eventSource.onerror = () => {
        console.log('SSE connection error, switching to fallback immediately');
        clearTimeout(timeout);
        eventSource.close();
        performFallbackDelete();
      };
      
    } catch (initError) {
      console.error('Failed to initialize SSE, using fallback:', initError);
      performFallbackDelete();
    }
  };

  // フォールバック用の通常削除処理（進捗バー付き）
  const performFallbackDelete = async () => {
    try {
      setIsLoading(true);
      setProgress(10);
      setProgressMessage('削除対象の予定を検索中...');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '削除対象を検索中'
      });
      
      // 段階的な進捗シミュレーション
      const deleteSteps = [
        { 
          delay: 200, 
          progress: 20, 
          message: 'カレンダーに接続中...',
          current: 0,
          summary: 'カレンダー接続中'
        },
        { 
          delay: 500, 
          progress: 40, 
          message: '削除対象を特定中...',
          current: 0,
          summary: '記念日を検索中'
        },
        { 
          delay: 800, 
          progress: 60, 
          message: '予定を削除中...',
          current: 0,
          summary: '記念日を削除中'
        },
        { 
          delay: 1200, 
          progress: 80, 
          message: '削除処理を完了中...',
          current: 0,
          summary: '削除処理完了中'
        }
      ];

      deleteSteps.forEach(step => {
        setTimeout(() => {
          setProgress(step.progress);
          setProgressMessage(step.message);
          setCurrentProcessing({
            current: step.current,
            total: 0,
            currentDate: '',
            summary: step.summary
          });
        }, step.delay);
      });
      
      const response = await fetch(`/api/anniversary?calendarId=${encodeURIComponent(deleteCalendarId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        setProgress(100);
        setProgressMessage('🗑️ 削除完了！');
        setCurrentProcessing({
          current: result.deletedCount || 0,
          total: result.deletedCount || 0,
          currentDate: '',
          summary: '全ての記念日が削除されました'
        });
        
        setSpecialDates(specialDates.filter(date => date.calendarId !== deleteCalendarId));
        setDeleteCalendarId('');
        setShowDeleteConfirmation(false);
        
        setTimeout(() => {
          setProgress(0);
          setProgressMessage('');
          setCurrentProcessing({
            current: 0,
            total: 0,
            currentDate: '',
            summary: ''
          });
          setIsLoading(false);
          setIsDeleting(false);
          alert(`${result.deletedCount || 0}件の予定を削除しました！`);
        }, 2000);
      } else {
        const errorData = await response.json();
        setProgress(0);
        setProgressMessage('');
        setCurrentProcessing({
          current: 0,
          total: 0,
          currentDate: '',
          summary: ''
        });
        setIsLoading(false);
        setIsDeleting(false);
        alert(errorData.error || "削除処理でエラーが発生しました");
      }
    } catch (fallbackError) {
      console.error('Fallback delete failed:', fallbackError);
      setProgress(0);
      setProgressMessage('');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: ''
      });
      setIsLoading(false);
      setIsDeleting(false);
      alert("削除処理でエラーが発生しました");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      {/* 進捗バーオーバーレイ */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform scale-100 transition-all duration-300">
            <div className="text-center space-y-4">
              {/* アニメーション付きローダー */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  {progressMessage.includes('削除') ? (
                    <>
                      <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
                      <div className="absolute inset-0 w-12 h-12 border-2 border-red-200 rounded-full animate-pulse"></div>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                      <div className="absolute inset-0 w-12 h-12 border-2 border-blue-200 rounded-full animate-pulse"></div>
                    </>
                  )}
                </div>
              </div>
              
              {/* 進捗メッセージ */}
              <h3 className="text-xl font-bold text-gray-800">{progressMessage}</h3>
              
              {/* 進捗パーセンテージ */}
              <div className={`text-lg font-semibold ${progressMessage.includes('削除') ? 'text-red-600' : 'text-blue-600'}`}>
                {progress}%完了
              </div>
              
              {/* 進捗バー */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full transition-all duration-700 ease-out relative overflow-hidden ${
                      progressMessage.includes('削除') 
                        ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700' 
                        : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600'
                    }`}
                    style={{ width: `${progress}%` }}
                  >
                    {/* 進捗バーのアニメーション効果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                </div>
                
                {/* 進捗ステップ表示 */}
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  {progressMessage.includes('削除') ? (
                    <>
                      <span className={progress >= 10 ? "text-red-600 font-semibold" : ""}>検索</span>
                      <span className={progress >= 20 ? "text-red-600 font-semibold" : ""}>開始</span>
                      <span className={progress >= 50 ? "text-red-600 font-semibold" : ""}>削除中</span>
                      <span className={progress >= 90 ? "text-red-600 font-semibold" : ""}>完了処理</span>
                      <span className={progress >= 100 ? "text-green-600 font-semibold" : ""}>完了</span>
                    </>
                  ) : (
                    <>
                      <span className={progress >= 10 ? "text-blue-600 font-semibold" : ""}>開始</span>
                      <span className={progress >= 30 ? "text-blue-600 font-semibold" : ""}>処理中</span>
                      <span className={progress >= 60 ? "text-blue-600 font-semibold" : ""}>登録中</span>
                      <span className={progress >= 90 ? "text-blue-600 font-semibold" : ""}>最終処理</span>
                      <span className={progress >= 100 ? "text-green-600 font-semibold" : ""}>完了</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* 詳細進捗情報表示 */}
              {(currentProcessing.total > 0 || currentProcessing.summary) && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    {/* 処理数表示 */}
                    {currentProcessing.total > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">進捗:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {currentProcessing.current} / {currentProcessing.total}
                        </span>
                      </div>
                    )}
                    
                    {/* 現在の処理対象 */}
                    {currentProcessing.summary && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">状況:</span>
                        <span className="text-sm text-gray-800 font-medium">
                          {currentProcessing.summary}
                        </span>
                      </div>
                    )}
                    
                    {/* 現在の日付 */}
                    {currentProcessing.currentDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">現在の日付:</span>
                        <span className="text-sm text-gray-800 font-mono">
                          {currentProcessing.currentDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 完了時のアニメーション */}
              {progress === 100 && (
                <div className={`animate-bounce ${progressMessage.includes('削除') ? 'text-red-600' : 'text-green-600'}`}>
                  <div className="text-2xl">
                    {progressMessage.includes('削除') ? '🗑️' : '✅'}
                  </div>
                  <div className="text-sm font-medium">
                    {progressMessage.includes('削除') ? '削除完了！' : '登録完了！'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex gap-4">
              <button
                onClick={() => setIsDeleteMode(true)}
                className="bg-red-500 text-white py-2 px-4 rounded-lg text-sm font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                予定を削除
              </button>
            </div>
          </div>

          {isDeleteMode ? (
            <div className={`bg-white rounded-2xl shadow-xl p-8 mb-8 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-2xl font-bold text-red-600 mb-4">予定を削除</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    カレンダーID 🔑
                  </label>
                  <input
                    type="text"
                    value={deleteCalendarId}
                    onChange={(e) => setDeleteCalendarId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    placeholder="例：family-calendar"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="flex-1 bg-red-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!deleteCalendarId || isLoading}
                  >
                    <Trash2 className="w-6 h-6" />
                    削除する
                  </button>
                  <button
                    onClick={() => {
                      setIsDeleteMode(false);
                      setDeleteCalendarId('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl text-lg font-bold hover:bg-gray-300 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`bg-white rounded-2xl shadow-xl p-8 mb-8 transform hover:scale-[1.02] transition-transform duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <form onSubmit={addSpecialDate} className="space-y-4">
                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    カレンダーID 🔑
                  </label>
                  <input
                    type="text"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    placeholder="例：family-calendar"
                    required
                  />
                </div>

                <div>
                  <label className="text-lg font-medium text-blue-600 mb-2 flex items-center gap-2">
                    タイトル ✨
                    <div className="group relative">
                      <Info className="w-5 h-5 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-3 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        <div className="text-xs font-semibold mb-2">使用可能なプレースホルダー：</div>
                        <div className="space-y-1 text-xs">
                          <div><strong>{'{{count}}'}</strong>：通し番号（1〜）</div>
                          <div><strong>{'{{years}}'}</strong>：経過年数</div>
                          <div><strong>{'{{months}}'}</strong>：残りの月数（0〜11）</div>
                          <div><strong>{'{{ym}}'}</strong>：X年Yヶ月形式</div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    placeholder="例：結婚{{ym}}記念日💍、祝！{{years}}年{{months}}ヶ月記念"
                  />
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="font-semibold mb-1">プレースホルダー例：</div>
                    <div className="space-y-1 text-xs">
                      <div>• <code className="bg-gray-100 px-1 rounded">結婚{'{{count}}'}ヶ月目記念日🎉</code> → 結婚13ヶ月目記念日🎉</div>
                      <div>• <code className="bg-gray-100 px-1 rounded">結婚{'{{ym}}'}記念日💍</code> → 結婚1年1ヶ月記念日💍</div>
                      <div>• <code className="bg-gray-100 px-1 rounded">祝！{'{{years}}'}年{'{{months}}'}ヶ月記念</code> → 祝！1年1ヶ月記念</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    日付 
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    required
                  />
                </div>

                <div>
                  <label className="text-lg font-medium text-blue-600 mb-2 flex items-center gap-2">
                    終了日 �
                    <div className="group relative">
                      <Info className="w-5 h-5 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        記念日の生成をいつまで続けるかを指定します。この日付まで月単位で記念日が作成されます。
                      </div>
                    </div>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    required
                  />
                </div>

                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    メモ 📝
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    placeholder="楽しい予定の詳細を書いてね！"
                    rows={3}
                  />
                </div>



                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-blue-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      登録中...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-6 h-6" />
                      予定を登録する
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {showDeleteConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold text-red-600 mb-4">予定を削除しますか？</h2>
                <p className="text-gray-600 mb-6">
                  カレンダーID「{deleteCalendarId}」に関連する全ての予定を削除します。<br />
                  この操作は取り消せません。本当に削除してもよろしいですか？
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleDeleteByCalendarId}
                    className="flex-1 bg-red-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        削除中...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-6 h-6" />
                        削除する
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirmation(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl text-lg font-bold hover:bg-gray-300 transform hover:scale-105 transition-all duration-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}