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
    remaining?: number;
    batchInfo?: string; // バッチ処理情報を追加
  }>({
    current: 0,
    total: 0,
    currentDate: '',
    summary: ''
  });


  const addSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !calendarId || !endDate) return;
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('記念日の登録を開始しています...');
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: ''
    });
    
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

      // SSE登録を試行
      await trySSERegistration(titleToSend, intervalType, monthsDiff);
      
    } catch (error) {
      console.error('記念日登録エラー:', error);
      setProgressMessage('❌ 登録中にエラーが発生しました');
      setProgress(0);
      setIsLoading(false);
    }
  };

  // SSE登録を試行する関数
  const trySSERegistration = async (titleToSend: string, intervalType: string, estimatedCount: number) => {
    try {
      const params = new URLSearchParams({
        startDate: date,
        endDate: endDate,
        intervalType,
        comment: description,
        calenderId: calendarId,
        title: titleToSend,
        streaming: 'true'
      });
      
      const eventSource = new EventSource(`/api/anniversary?${params.toString()}`);
      // let timeoutId: NodeJS.Timeout | null = null; // タイムアウト無制限のためコメントアウト
      let lastMessageTime = Date.now();
      let hasReceivedData = false;
      
      // タイムアウトを無制限に設定
      const setConnectionTimeout = () => {
        // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
        // タイムアウトなし - コメントアウト
        // timeoutId = setTimeout(() => {
        //   console.log('SSE connection timeout - no activity for 2 minutes');
        //   eventSource.close();
        //   if (hasReceivedData) {
        //     console.log('Had received data, continuing with fallback from last position');
        //   }
        //   performFallbackRegistration(titleToSend, intervalType, estimatedCount);
        // }, 120000); // 2分のアイドルタイムアウト
      };
      
      // 初期タイムアウトを無制限に設定（コメントアウト）
      // timeoutId = setTimeout(() => {
      //   console.log('SSE initial connection timeout - switching to fallback');
      //   eventSource.close();
      //   performFallbackRegistration(titleToSend, intervalType, estimatedCount);
      // }, 30000);
      
      eventSource.onopen = () => {
        console.log('SSE registration connection opened successfully');
        setProgressMessage('リアルタイム登録処理に接続中...');
        // 接続成功後は長めのアイドルタイムアウトに切り替え
        setConnectionTimeout();
      };
      
      eventSource.onmessage = (event) => {
        try {
          console.log('SSE message received:', event.data);
          const data = JSON.parse(event.data);
          lastMessageTime = Date.now();
          hasReceivedData = true;
          
          // メッセージ受信時にタイムアウトをリセット
          setConnectionTimeout();
          
          if (data.type === 'progress') {
            setProgress(data.progress);
            setProgressMessage(data.message);
            
            // 登録処理の詳細進捗情報を更新（残り件数を含む）
            setCurrentProcessing({
              current: data.current || 0,
              total: data.total || 0,
              currentDate: data.currentDate || date,
              summary: data.summary || data.eventTitle || '登録処理中',
              remaining: data.remaining || 0
            });
          } else if (data.type === 'complete') {
            // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
            setProgress(100);
            setProgressMessage('🎉 登録完了！');
            
            // 登録完了後の処理
            const newDate: SpecialDate = {
              id: crypto.randomUUID(),
              calendarId,
              title: titleToSend || '🎉 #回目の記念日 🎉',
              date,
              description,
              countType: 'months',
              repeatCount: 0
            };
            setSpecialDates([...specialDates, newDate]);
            setCalendarId('');
            setTitle('');
            setDate('');
            setEndDate('');
            setDescription('');
            eventSource.close();
            
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
              alert(`${data.createdCount || estimatedCount}件の記念日を登録しました！`);
            }, 2000);
          } else if (data.type === 'error') {
            // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
            eventSource.close();
            
            if (data.error === 'auth_expired') {
              // 認証エラーの場合
              setProgress(0);
              setProgressMessage('❌ 認証の期限が切れました');
              setCurrentProcessing({
                current: 0,
                total: 0,
                currentDate: '',
                summary: ''
              });
              setIsLoading(false);
              
              alert(`認証の期限が切れました。${data.processed || 0}件の記念日が登録されました。\n再度ログインしてから残りの登録を行ってください。`);
              
              // ログアウトして再認証を促す
              window.location.href = '/api/auth/signout';
            } else {
              // その他のエラーの場合はフォールバック
              console.error('SSE reported error, switching to fallback');
              performFallbackRegistration(titleToSend, intervalType, estimatedCount);
            }
          }
        } catch (parseError) {
          console.error('SSE parse error, switching to fallback:', parseError);
          // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
          eventSource.close();
          performFallbackRegistration(titleToSend, intervalType, estimatedCount);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        console.log('EventSource readyState:', eventSource.readyState);
        console.log('Time since last message:', Date.now() - lastMessageTime, 'ms');
        // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
        eventSource.close();
        
        if (hasReceivedData) {
          console.log('Had received some data via SSE, continuing with fallback');
        } else {
          console.log('No data received via SSE, starting fresh with fallback');
        }
        performFallbackRegistration(titleToSend, intervalType, estimatedCount);
      };
      
    } catch (initError) {
      console.error('Failed to initialize SSE registration, using fallback:', initError);
      performFallbackRegistration(titleToSend, intervalType, estimatedCount);
    }
  };

  // フォールバック用の通常登録処理（進捗バー付き）
  const performFallbackRegistration = async (titleToSend: string, intervalType: string, estimatedCount: number) => {
    try {
      setProgressMessage('通常の登録方式に切り替えました...');
      
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
        current: estimatedCount,
        total: estimatedCount,
        currentDate: endDate,
        summary: '登録完了処理中'
      });

      if (response.ok) {
        setProgress(100);
        setProgressMessage('🎉 登録完了！');
        setCurrentProcessing({
          current: estimatedCount,
          total: estimatedCount,
          currentDate: endDate,
          summary: '全ての記念日が登録されました'
        });
        
        const newDate: SpecialDate = {
          id: crypto.randomUUID(),
          calendarId,
          title: titleToSend || '🎉 #回目の記念日 🎉',
          date,
          description,
          countType: 'months',
          repeatCount: 0
        };
        setSpecialDates([...specialDates, newDate]);
        setCalendarId('');
        setTitle('');
        setDate('');
        setEndDate('');
        setDescription('');
        
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
          alert(`${estimatedCount}件の記念日を登録しました！`);
        }, 2000);
      } else {
        setProgress(0);
        setProgressMessage('❌ 登録に失敗しました');
        setIsLoading(false);
        alert("エラーが発生しました");
      }
    } catch (error) {
      console.error('Fallback registration error:', error);
      setProgress(0);
      setProgressMessage('❌ 登録中にエラーが発生しました');
      setIsLoading(false);
      alert("エラーが発生しました");
    }
  };

  const handleDeleteByCalendarId = async () => {
    if (!deleteCalendarId) return;
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('削除処理を開始しています...');
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: '削除準備中...',
      batchInfo: ''
    });
    
    // 開発環境でもSSEを有効にして詳細な進捗表示をテスト
    const useSSE = true; // 常にSSEを使用
    
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
      console.log('=== SSE削除処理開始 ===');
      console.log('削除対象カレンダーID:', deleteCalendarId);
      
      const sseUrl = `/api/anniversary?calendarId=${encodeURIComponent(deleteCalendarId)}&streaming=true&action=delete`;
      console.log('SSE削除URL:', sseUrl);
      
      const eventSource = new EventSource(sseUrl);
      console.log('EventSource作成完了');
      
      // 削除処理用タイムアウトを無制限に設定（コメントアウト）
      // const timeout = setTimeout(() => {
      //   console.log('⚠️ SSE削除接続タイムアウト - フォールバックに切り替え');
      //   eventSource.close();
      //   performFallbackDelete();
      // }, 30000);
      
      eventSource.onopen = () => {
        console.log('✅ SSE削除接続が正常に開始されました');
        setProgressMessage('リアルタイム削除処理に接続しました...');
      };
      
      eventSource.onmessage = (event) => {
        try {
          console.log('📨 削除SSEメッセージ受信:', event.data);
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setProgress(data.progress);
            setProgressMessage(data.message);
            
            // 削除処理の詳細進捗情報を更新（残り件数とバッチ情報を含む）
            setCurrentProcessing({
              current: data.current || 0,
              total: data.total || 0,
              currentDate: data.currentDate || '',
              summary: data.summary || data.eventTitle || '削除処理中',
              remaining: data.remaining || 0,
              batchInfo: data.batchInfo || '' // バッチ情報を追加
            });
            
            // より詳細な進捗メッセージに更新
            if (data.current && data.total) {
              const percentage = Math.round((data.current / data.total) * 100);
              const remaining = data.total - data.current;
              setProgressMessage(`削除中: ${data.current}/${data.total}件 (${percentage}%) - 残り${remaining}件`);
            }
            
            console.log('削除進捗更新:', {
              current: data.current,
              total: data.total,
              summary: data.summary,
              remaining: data.remaining,
              currentDate: data.currentDate
            });
          } else if (data.type === 'complete') {
            console.log('✅ 削除完了メッセージ受信');
            // clearTimeout(timeout); // タイムアウト無制限のためコメントアウト
            setProgress(100);
            setProgressMessage('🗑️ 削除完了！');
            
            // 完了時の詳細情報を設定
            setCurrentProcessing({
              current: data.current || data.deletedCount || 0,
              total: data.total || data.deletedCount || 0,
              currentDate: '',
              summary: data.summary || `${data.deletedCount || 0}件の記念日の並列削除が完了しました`,
              remaining: 0,
              batchInfo: '全バッチ処理完了'
            });
            
            setSpecialDates(specialDates.filter(date => date.calendarId !== deleteCalendarId));
            setDeleteCalendarId('');
            setShowDeleteConfirmation(false);
            
            // EventSourceを閉じる
            eventSource.close();
            
            setTimeout(() => {
              setProgress(0);
              setProgressMessage('');
              setCurrentProcessing({
                current: 0,
                total: 0,
                currentDate: '',
                summary: '',
                remaining: 0,
                batchInfo: ''
              });
              setIsLoading(false);
              alert(`${data.deletedCount || 0}件の予定を削除しました！`);
            }, 3000);
          } else if (data.type === 'error') {
            console.log('❌ 削除エラーメッセージ受信:', data);
            // clearTimeout(timeout); // タイムアウト無制限のためコメントアウト
            eventSource.close();
            
            if (data.error === 'auth_expired') {
              // 認証エラーの場合
              setProgress(0);
              setProgressMessage('❌ 認証の期限が切れました');
              setCurrentProcessing({
                current: 0,
                total: 0,
                currentDate: '',
                summary: '',
                batchInfo: ''
              });
              setIsLoading(false);
              setShowDeleteConfirmation(false);
              
              alert(`認証の期限が切れました。${data.processed || 0}件の予定が削除されました。\n再度ログインしてから残りの削除を行ってください。`);
              
              // ログアウトして再認証を促す
              window.location.href = '/api/auth/signout';
            } else {
              // その他のエラーの場合はフォールバック
              console.error('SSE reported error, switching to fallback');
              performFallbackDelete();
            }
          }
        } catch (parseError) {
          console.error('❌ SSE parse error, switching to fallback:', parseError);
          // clearTimeout(timeout); // タイムアウト無制限のためコメントアウト
          eventSource.close();
          performFallbackDelete();
        }
      };
      
      eventSource.onerror = (error) => {
        console.log('❌ SSE削除接続エラー:', error);
        console.log('EventSource readyState:', eventSource.readyState);
        console.log('即座にフォールバックに切り替えます');
        // clearTimeout(timeout); // タイムアウト無制限のためコメントアウト
        eventSource.close();
        performFallbackDelete();
      };
      
    } catch (initError) {
      console.error('❌ SSE削除初期化失敗, フォールバックを使用:', initError);
      performFallbackDelete();
    }
  };

  // フォールバック用の通常削除処理（詳細進捗バー付き）
  const performFallbackDelete = async () => {
    try {
      console.log('フォールバック削除処理を開始');
      setIsLoading(true);
      setProgress(10);
      setProgressMessage('削除対象の予定を検索中...');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '削除対象を検索中',
        remaining: 0
      });
      
      // まず削除対象を取得するAPIコールをシミュレート
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress(30);
      setProgressMessage('削除処理を開始しています...');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '削除処理準備中',
        remaining: 0
      });
      
      // 実際の削除リクエスト
      const response = await fetch(`/api/anniversary?calendarId=${encodeURIComponent(deleteCalendarId)}&action=delete`, {
        method: "GET",
      });

      if (response.ok) {
        const result = await response.json();
        const deletedCount = result.deletedCount || 0;
        
        // 削除中の進捗をシミュレート（並列処理フォールバック）
        if (deletedCount > 0) {
          setCurrentProcessing({
            current: 0,
            total: deletedCount,
            currentDate: '',
            summary: `${deletedCount}件の記念日を並列削除中...`,
            remaining: deletedCount,
            batchInfo: '通常処理モード（並列化）'
          });
          
          // 並列処理をシミュレート（5件ずつのバッチ）
          const BATCH_SIZE = 5;
          const batches = Math.ceil(deletedCount / BATCH_SIZE);
          
          for (let batch = 1; batch <= batches; batch++) {
            const currentBatchSize = Math.min(BATCH_SIZE, deletedCount - (batch - 1) * BATCH_SIZE);
            const processedSoFar = (batch - 1) * BATCH_SIZE + currentBatchSize;
            const remaining = deletedCount - processedSoFar;
            
            await new Promise(resolve => setTimeout(resolve, 300)); // バッチ処理の遅延をシミュレート
            
            const progress = 30 + Math.floor((processedSoFar / deletedCount) * 60); // 30%から90%まで
            
            setProgress(progress);
            setProgressMessage(`並列削除中: ${processedSoFar}/${deletedCount}件 (${Math.round((processedSoFar/deletedCount)*100)}%) - バッチ${batch}/${batches}完了`);
            setCurrentProcessing({
              current: processedSoFar,
              total: deletedCount,
              currentDate: new Date().toLocaleDateString('ja-JP'),
              summary: `バッチ${batch}/${batches}: ${currentBatchSize}件並列削除完了`,
              remaining: remaining,
              batchInfo: `バッチ${batch}/${batches} (${currentBatchSize}件並列処理)`
            });
          }
        }
        
        setProgress(100);
        setProgressMessage(`🗑️ 並列削除完了！ ${deletedCount}件の記念日を削除しました`);
        setCurrentProcessing({
          current: deletedCount,
          total: deletedCount,
          currentDate: '',
          summary: `${deletedCount}件の記念日の並列削除が完了しました`,
          remaining: 0,
          batchInfo: '全バッチ処理完了'
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
            summary: '',
            remaining: 0
          });
          setIsLoading(false);
          alert(`${deletedCount}件の予定を削除しました！`);
        }, 3000);
      } else {
        setProgress(0);
        setProgressMessage('❌ 削除に失敗しました');
        setCurrentProcessing({
          current: 0,
          total: 0,
          currentDate: '',
          summary: '',
          remaining: 0
        });
        setIsLoading(false);
        alert("削除中にエラーが発生しました");
      }
    } catch (error) {
      console.error('フォールバック削除エラー:', error);
      setProgress(0);
      setProgressMessage('❌ 削除中にエラーが発生しました');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '',
        remaining: 0
      });
      setIsLoading(false);
      alert("削除中にエラーが発生しました");
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
                <div className={`mt-4 p-4 rounded-lg border ${
                  progressMessage.includes('削除') 
                    ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                }`}>
                  <div className="space-y-3">
                    {/* 全体進捗表示 - 削除処理用に詳細化 */}
                    {currentProcessing.total > 0 && (
                      <div className={`rounded-lg p-4 shadow-sm border-2 ${
                        progressMessage.includes('削除') 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-lg font-bold ${
                            progressMessage.includes('削除') ? 'text-red-700' : 'text-blue-700'
                          }`}>
                            {progressMessage.includes('削除') ? '🗑️ 削除進捗' : '📝 登録進捗'}
                          </span>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              progressMessage.includes('削除') ? 'text-red-600' : 'text-blue-600'
                            }`}>
                              {currentProcessing.current} / {currentProcessing.total}
                            </div>
                            <div className="text-sm text-gray-600">
                              {progressMessage.includes('削除') ? '個削除済み' : '個登録済み'}
                            </div>
                          </div>
                        </div>
                        
                        {/* 進捗バー */}
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${
                              progressMessage.includes('削除') 
                                ? 'bg-gradient-to-r from-red-500 to-red-700' 
                                : 'bg-gradient-to-r from-blue-400 to-blue-600'
                            }`}
                            style={{ 
                              width: currentProcessing.total > 0 
                                ? `${Math.round((currentProcessing.current / currentProcessing.total) * 100)}%` 
                                : '0%' 
                            }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-medium ${
                            progressMessage.includes('削除') ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {currentProcessing.total > 0 
                              ? `${Math.round((currentProcessing.current / currentProcessing.total) * 100)}%完了`
                              : '0%完了'
                            }
                          </span>
                          <span className="text-sm font-medium text-gray-600">
                            全{currentProcessing.total}件
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* バッチ処理情報表示 */}
                    {currentProcessing.batchInfo && (
                      <div className={`rounded-lg p-3 border-2 ${
                        progressMessage.includes('削除') 
                          ? 'bg-purple-50 border-purple-200' 
                          : 'bg-indigo-50 border-indigo-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">並列処理状況:</span>
                          <div className="text-right">
                            <span className={`text-lg font-bold ${
                              progressMessage.includes('削除') ? 'text-purple-600' : 'text-indigo-600'
                            }`}>
                              {currentProcessing.batchInfo}
                            </span>
                            <div className="text-xs text-gray-500">
                              {progressMessage.includes('削除') ? '5件ずつ並列削除中' : '並列処理中'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 残り件数表示 - より目立つように */}
                    {currentProcessing.remaining !== undefined && currentProcessing.remaining > 0 && (
                      <div className={`rounded-lg p-3 border-2 ${
                        progressMessage.includes('削除') 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">残り件数:</span>
                          <div className="text-right">
                            <span className={`text-xl font-bold ${
                              progressMessage.includes('削除') ? 'text-orange-600' : 'text-yellow-600'
                            }`}>
                              {currentProcessing.remaining}件
                            </span>
                            <div className="text-xs text-gray-500">
                              {progressMessage.includes('削除') ? '削除待ち' : '登録待ち'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 現在の処理対象 - より詳細に */}
                    {currentProcessing.summary && (
                      <div className={`rounded-lg p-4 border-2 ${
                        progressMessage.includes('削除') 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className={`text-sm font-bold ${
                            progressMessage.includes('削除') ? 'text-red-700' : 'text-green-700'
                          }`}>
                            {progressMessage.includes('削除') ? '🗑️ 削除中の予定:' : '📝 現在の処理:'}
                          </span>
                        </div>
                        <div className={`p-3 rounded border ${
                          progressMessage.includes('削除') 
                            ? 'bg-white border-red-100' 
                            : 'bg-white border-green-100'
                        }`}>
                          <span className={`text-sm font-medium ${
                            progressMessage.includes('削除') ? 'text-red-800' : 'text-gray-800'
                          }`}>
                            {currentProcessing.summary}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* 現在の日付 */}
                    {currentProcessing.currentDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">処理日付:</span>
                        <span className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded">
                          {currentProcessing.currentDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 完了時の詳細アニメーション */}
              {progress === 100 && (
                <div className={`p-4 rounded-lg border-2 text-center ${
                  progressMessage.includes('削除') 
                    ? 'bg-red-50 border-red-200 text-red-700' 
                    : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                  <div className="animate-bounce text-3xl mb-2">
                    {progressMessage.includes('削除') ? '🗑️' : '✅'}
                  </div>
                  <div className="text-lg font-bold mb-1">
                    {progressMessage.includes('削除') ? '削除完了！' : '登録完了！'}
                  </div>
                  {currentProcessing.total > 0 && (
                    <div className="text-sm font-medium">
                      {progressMessage.includes('削除') 
                        ? `${currentProcessing.total}個のイベントの削除が完了しました`
                        : `${currentProcessing.total}個のイベントの登録が完了しました`
                      }
                    </div>
                  )}
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