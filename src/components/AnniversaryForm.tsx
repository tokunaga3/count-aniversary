"use client";

import React, { useState } from 'react';
import { Calendar, Loader2, Info } from 'lucide-react';

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
  const [recordYears, setRecordYears] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const [isStoppedByUser, setIsStoppedByUser] = useState<boolean>(false); // ユーザーによる停止状態
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null); // 現在のEventSource参照
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null); // 現在のAbortController参照
  const [yearValidationError, setYearValidationError] = useState<string>(''); // 年数バリデーションエラー
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

  // 年数バリデーション関数
  const validateYears = (years: number): string => {
    if (!years || years <= 0) {
      return '1年以上を指定してください。';
    }
    
    // 100年制限チェック
    if (years > 100) {
      return '期間は100年以内に設定してください。';
    }
    
    // 警告レベル（50年以上）
    if (years >= 50) {
      return `期間が${years}年間と長期間です。多数のイベントが作成されますがよろしいですか？`;
    }
    
    return '';
  };

  // 年数変更時のハンドラー
  const handleYearsChange = (newYears: number) => {
    setRecordYears(newYears);
    const error = validateYears(newYears);
    setYearValidationError(error);
  };

  // 停止ボタンの処理
  const handleStopProcessing = () => {
    console.log('ユーザーによる処理停止が要求されました');
    
    // 即座に停止状態を設定
    setIsStoppedByUser(true);
    
    // EventSourceを閉じる
    if (currentEventSource) {
      console.log('EventSourceを閉じています...');
      currentEventSource.close();
      setCurrentEventSource(null);
    }
    
    // 進行中のAPIリクエストをキャンセル
    if (currentAbortController) {
      console.log('進行中のAPIリクエストをキャンセルしています...');
      currentAbortController.abort('ユーザーによる処理停止');
      setCurrentAbortController(null);
    }
    
    // 停止時の状態を即座に表示
    const processType = progressMessage.includes('削除') ? '削除' : '登録';
    const stoppedMessage = `⏹️ ${processType}処理を停止中...`;
    
    setProgressMessage(stoppedMessage);
    
    // 現在の進捗情報を保持しつつ、停止状態を反映
    setCurrentProcessing(prev => ({
      ...prev,
      summary: `${processType}処理の停止処理中... - ${prev.current}/${prev.total}件完了`
    }));
    
    // 少し待ってから最終状態を設定
    setTimeout(() => {
      const completedCount = currentProcessing.current;
      const totalCount = currentProcessing.total;
      const processTypeJa = processType === '削除' ? '削除' : '登録';
      
      // 最終停止メッセージを設定
      setProgressMessage(`⏹️ ${processTypeJa}処理を停止しました`);
      setCurrentProcessing(prev => ({
        ...prev,
        summary: `${processTypeJa}処理が完全に停止されました - ${prev.current}/${prev.total}件完了`
      }));
      
      // アラートで結果を表示
      alert(`${processTypeJa}処理を停止しました。\n完了: ${completedCount}件/${totalCount}件\n\n残り${totalCount - completedCount}件は未処理です。`);
      
      // さらに少し待ってから状態をリセット
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setCurrentProcessing({
          current: 0,
          total: 0,
          currentDate: '',
          summary: '',
          batchInfo: ''
        });
        setIsLoading(false);
        setIsStoppedByUser(false);
        setCurrentEventSource(null);
        setCurrentAbortController(null); // AbortController もクリア
      }, 1000);
    }, 500);
  };


  const addSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !calendarId || !recordYears) return;
    
    // 年数バリデーション
    const validationError = validateYears(recordYears);
    if (validationError && validationError.includes('100年以内')) {
      alert(`エラー: ${validationError}`);
      return;
    }
    
    // 長期間の警告
    if (validationError && validationError.includes('長期間')) {
      const confirmed = confirm(`警告: ${validationError}`);
      if (!confirmed) {
        return;
      }
    }
    
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('記念日の登録を開始しています...');
    setIsStoppedByUser(false); // 停止状態をリセット
    setCurrentEventSource(null); // EventSource参照をリセット
    
    // 新しいAbortControllerを作成
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: ''
    });
    
    try {
      const intervalType = 'monthly'; // 月単位固定
      const titleToSend = title.trim() === '' ? '🎉 #回目の記念日 🎉' : title;
      
      // 予定される記念日の総数を計算（年数から算出）
      const monthsDiff = recordYears * 12;
      
      // 終了日を記念日から年数を計算して生成
      const startDateTime = new Date(date);
      const endDateTime = new Date(startDateTime);
      endDateTime.setFullYear(startDateTime.getFullYear() + recordYears);
      const endDateString = endDateTime.toISOString().split('T')[0];
      
      console.log('Sending data to API:', {
        startDate: date,
        endDate: endDateString,
        intervalType,
        comment: description,
        calenderId: calendarId,
        title: titleToSend,
        estimatedCount: monthsDiff,
        recordYears: recordYears
      });

      // 単発APIの繰り返し処理で記念日を登録
      await performFallbackRegistration(titleToSend, intervalType, monthsDiff, abortController, endDateString);
      
    } catch (error) {
      console.error('記念日登録エラー:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('APIリクエストがユーザーによってキャンセルされました');
        setProgressMessage('⏹️ 処理がキャンセルされました');
      } else {
        setProgressMessage('❌ 登録中にエラーが発生しました');
      }
      setProgress(0);
      setIsLoading(false);
      setCurrentAbortController(null);
    }
  };

  // SSE登録を試行する関数（現在は使用しない - 単発APIの繰り返し処理を使用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trySSERegistration = async (titleToSend: string, intervalType: string, estimatedCount: number) => {
    /*
    try {
      const params = new URLSearchParams({
        action: 'generate', // 新しいAPI仕様に合わせて修正
        startDate: date,
        endDate: endDate,
        comment: description,
        calenderId: calendarId,
        title: titleToSend,
        streaming: 'true'
      });
      
      const eventSource = new EventSource(`/api/anniversary?${params.toString()}`);
      setCurrentEventSource(eventSource); // EventSource参照を保存
      setIsStoppedByUser(false); // 停止状態をリセット
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
          // ユーザーによる停止チェック
          if (isStoppedByUser) {
            console.log('ユーザーによる停止が検出されました - 登録処理を中断');
            eventSource.close();
            setCurrentEventSource(null);
            return;
          }
          
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
            setCurrentEventSource(null); // EventSource参照をクリア
            
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
            setCurrentEventSource(null); // EventSource参照をクリア
            
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
          setCurrentEventSource(null); // EventSource参照をクリア
          performFallbackRegistration(titleToSend, intervalType, estimatedCount);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        console.log('EventSource readyState:', eventSource.readyState);
        console.log('Time since last message:', Date.now() - lastMessageTime, 'ms');
        // if (timeoutId) clearTimeout(timeoutId); // タイムアウト無制限のためコメントアウト
        eventSource.close();
        setCurrentEventSource(null); // EventSource参照をクリア
        
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
    */
    
    // 直接フォールバック処理を呼び出し（SSEを使用しない）
    console.log('単発APIの繰り返し処理を使用します');
    const fallbackAbortController = new AbortController();
    setCurrentAbortController(fallbackAbortController);
    
    // 終了日を記念日から年数を計算して生成
    const startDateTime = new Date(date);
    const endDateTime = new Date(startDateTime);
    endDateTime.setFullYear(startDateTime.getFullYear() + estimatedCount / 12);
    const endDateString = endDateTime.toISOString().split('T')[0];
    
    performFallbackRegistration(titleToSend, intervalType, estimatedCount, fallbackAbortController, endDateString);
  };

  // 単発APIの繰り返し処理による記念日登録（メイン処理）
  const performFallbackRegistration = async (titleToSend: string, _intervalType: string, _estimatedCount: number, abortController: AbortController, endDateString: string) => {
    try {
      // 停止チェック
      if (isStoppedByUser || abortController.signal.aborted) {
        console.log('単発API登録処理: ユーザーによる停止が検出されました');
        return;
      }
      
      console.log('単発APIの繰り返し処理による記念日登録を開始します');
      setProgressMessage('記念日リストを生成中...');
      setProgress(10);
      
      // まず記念日リストを生成（AbortController付き）
      const generateResponse = await fetch(`/api/anniversary?action=generate&startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(endDateString)}&title=${encodeURIComponent(titleToSend)}&comment=${encodeURIComponent(description)}`, {
        signal: abortController.signal
      });
      
      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        
        if (errorData.error === 'auth_expired') {
          setProgressMessage('❌ 認証の期限が切れました');
          alert('認証の期限が切れました。再度ログインしてください。');
          setTimeout(() => {
            window.location.href = '/api/auth/signout';
          }, 2000);
          return;
        }
        
        throw new Error(errorData.message || '記念日の生成に失敗しました');
      }
      
      const generateResult = await generateResponse.json();
      const anniversaries = generateResult.anniversaries || [];
      const totalCount = anniversaries.length;
      
      setProgress(20);
      setProgressMessage(`${totalCount}件の記念日を順次登録中...`);
      setCurrentProcessing({
        current: 0,
        total: totalCount,
        currentDate: date,
        summary: '個別登録処理中'
      });

      let createdCount = 0;
      
      // 各記念日を個別に登録
      for (let i = 0; i < anniversaries.length; i++) {
        // 停止チェック（AbortController も含む）
        if (isStoppedByUser || abortController.signal.aborted) {
          console.log('単発API登録: 個別登録中にユーザーによる停止が検出されました');
          console.log(`停止時点: ${createdCount}/${totalCount}件完了`);
          console.log('AbortController状態:', {
            isStoppedByUser,
            signalAborted: abortController.signal.aborted,
            abortReason: abortController.signal.reason
          });
          
          // 停止時の状態を更新
          setCurrentProcessing({
            current: createdCount,
            total: totalCount,
            currentDate: anniversaries[i]?.date || date,
            summary: `処理停止: ${createdCount}件完了、${totalCount - createdCount}件未処理`,
            remaining: totalCount - createdCount
          });
          
          return; // 即座に処理を終了
        }
        
        const anniversary = anniversaries[i];
        
        try {
          const createResponse = await fetch("/api/anniversary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal, // AbortController を追加
            body: JSON.stringify({
              action: 'create-single',
              calendarId: calendarId,
              eventTitle: anniversary.title,
              eventDate: anniversary.date,
              description: anniversary.description
            }),
          });
          
          // レスポンスをJSONとして解析
          const responseData = await createResponse.json();
          
          if (createResponse.ok && responseData.success) {
            createdCount++;
          } else if (responseData.error === 'auth_expired') {
            // 認証エラーの場合は処理を停止し、ユーザーに再認証を促す
            console.log('認証エラーが発生しました');
            setProgressMessage('❌ 認証の期限が切れました');
            setCurrentProcessing({
              current: createdCount,
              total: totalCount,
              currentDate: anniversary.date,
              summary: `認証エラー: ${createdCount}件完了、再認証が必要です`,
              remaining: totalCount - createdCount
            });
            
            alert(`認証の期限が切れました。\n${createdCount}件の記念日が登録されました。\n\n再度ログインしてから残りの登録を行ってください。`);
            
            // ログアウトして再認証を促す
            setTimeout(() => {
              window.location.href = '/api/auth/signout';
            }, 2000);
            
            return; // 処理を停止
          } else if (responseData.error === 'calendar_not_found') {
            // カレンダーが見つからない場合
            console.error('カレンダーが見つかりません:', responseData.message);
            setProgressMessage('❌ カレンダーが見つかりません');
            setCurrentProcessing({
              current: createdCount,
              total: totalCount,
              currentDate: anniversary.date,
              summary: `カレンダーエラー: ${responseData.message}`,
              remaining: totalCount - createdCount
            });
            
            alert(`カレンダーエラー: ${responseData.message}\n\n正しいカレンダーIDを確認してください。`);
            return; // 処理を停止
          } else {
            console.error(`イベント作成失敗: ${anniversary.title}`, responseData);
          }
          
          const progress = 20 + Math.floor((i + 1) / totalCount * 70); // 20%から90%まで
          setProgress(progress);
          setProgressMessage(`${createdCount}/${totalCount}件目を登録中...`);
          setCurrentProcessing({
            current: createdCount,
            total: totalCount,
            currentDate: anniversary.date,
            summary: anniversary.title,
            remaining: totalCount - createdCount
          });
          
          // レート制限対策の遅延処理（停止チェック付き）
          try {
            for (let delay = 0; delay < 100; delay += 10) {
              if (isStoppedByUser || abortController.signal.aborted) {
                console.log('単発API登録: 遅延処理中にユーザーによる停止が検出されました');
                return; // 即座に処理を終了
              }
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          } catch (delayError) {
            // 遅延処理中のAbortErrorも適切に処理
            if (delayError instanceof Error && delayError.name === 'AbortError') {
              console.log('登録遅延処理中にAbortErrorが発生しました');
              return;
            }
            console.error('登録遅延処理中に予期しないエラーが発生しました:', delayError);
          }
          
        } catch (error) {
          // AbortErrorの場合は、ユーザーによる停止として処理を終了
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`登録処理中断 (ユーザー停止): ${anniversary.title} - ${error.message}`);
            // AbortErrorの場合は即座に処理を終了
            return;
          }
          
          // その他のエラーの場合
          console.log(`イベント作成エラー: ${anniversary.title}`, error);
        }
      }

      setProgress(100);
      setProgressMessage('🎉 登録完了！');
      setCurrentProcessing({
        current: createdCount,
        total: totalCount,
        currentDate: endDateString,
        summary: `${createdCount}件の記念日が登録されました`
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
      setRecordYears(10);
      setDescription('');
      
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setCurrentProcessing({
          current: 0,
          total: 0,
          currentDate: '',
          summary: '',
          batchInfo: ''
        });
        setIsLoading(false);
        setCurrentAbortController(null); // AbortController をクリア
        alert(`${createdCount}件の記念日を登録しました！`);
      }, 2000);
        
    } catch (error) {
      console.error('単発API登録エラー:', error);
      setCurrentAbortController(null); // AbortController をクリア
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('APIリクエストがユーザーによってキャンセルされました:', error.message);
          setProgressMessage('⏹️ 処理がキャンセルされました');
        } else {
          console.error('予期しないエラー:', error.message);
          setProgressMessage('❌ 登録中にエラーが発生しました');
          alert(`処理中にエラーが発生しました: ${error.message}`);
        }
      } else {
        setProgressMessage('❌ 登録中にエラーが発生しました');
        alert("処理中にエラーが発生しました");
      }
      setProgress(0);
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* 進捗バーオーバーレイ */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] transform scale-100 transition-all duration-300 flex flex-col">
            <div className="p-8 overflow-y-auto">
              <div className="text-center space-y-4">
                {/* アニメーション付きローダー */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 border-2 border-blue-200 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* 進捗メッセージ */}
              <h3 className="text-xl font-bold text-gray-800">{progressMessage}</h3>
              
              {/* 進捗パーセンテージ */}
              <div className="text-lg font-semibold text-blue-600">
                {progress}%完了
              </div>
              
              {/* 停止ボタン */}
              {!isStoppedByUser && progress > 0 && progress < 100 && (
                <button
                  onClick={handleStopProcessing}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2"
                >
                  ⏹️ {progressMessage.includes('停止中') ? '停止処理中...' : '停止'}
                </button>
              )}
              
              {/* 停止処理中の表示 */}
              {progressMessage.includes('停止中') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <div className="text-yellow-600 font-medium">
                    🔄 処理を停止しています...
                  </div>
                  <div className="text-sm text-yellow-500 mt-1">
                    現在実行中の処理が完了するまでお待ちください
                  </div>
                </div>
              )}
              
              {/* 進捗バー */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-4 rounded-full transition-all duration-700 ease-out relative overflow-hidden bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600"
                    style={{ width: `${progress}%` }}
                  >
                    {/* 進捗バーのアニメーション効果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                </div>
                
                {/* 進捗ステップ表示 */}
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span className={progress >= 10 ? "text-blue-600 font-semibold" : ""}>開始</span>
                  <span className={progress >= 30 ? "text-blue-600 font-semibold" : ""}>処理中</span>
                  <span className={progress >= 60 ? "text-blue-600 font-semibold" : ""}>登録中</span>
                  <span className={progress >= 90 ? "text-blue-600 font-semibold" : ""}>最終処理</span>
                  <span className={progress >= 100 ? "text-green-600 font-semibold" : ""}>完了</span>
                </div>
              </div>
              
              {/* 詳細進捗情報表示 */}
              {(currentProcessing.total > 0 || currentProcessing.summary) && (
                <div className="mt-4 p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
           
                    {/* 処理期間表示 - 記念日と記録年数を表示 */}
                    {(date || recordYears) && (
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-2">処理期間:</div>
                        <div className="space-y-1">
                          {date && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">記念日:</span>
                              <span className="text-sm text-gray-800 font-mono bg-gray-50 px-2 py-1 rounded">
                                {new Date(date).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                          )}
                          {recordYears && date && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">記録期間:</span>
                              <span className="text-sm text-gray-800 font-mono bg-gray-50 px-2 py-1 rounded">
                                {recordYears}年分 (〜{(() => {
                                  const endDate = new Date(date);
                                  endDate.setFullYear(endDate.getFullYear() + recordYears);
                                  return endDate.toLocaleDateString('ja-JP');
                                })()})
                              </span>
                            </div>
                          )}
                          {/* 現在の処理日付 */}
                          {currentProcessing.currentDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">現在の処理日付:</span>
                              <span className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded">
                                {currentProcessing.currentDate}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* 全体進捗表示 - 削除処理用に詳細化 */}
                    {currentProcessing.total > 0 && (
                      <div className="rounded-lg p-4 shadow-sm border-2 bg-blue-50 border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-lg font-bold text-blue-700">
                            📝 登録進捗
                          </span>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                              {currentProcessing.current} / {currentProcessing.total}
                            </div>
                            <div className="text-sm text-gray-600">
                              個登録済み
                            </div>
                          </div>
                        </div>
                        
                        {/* 進捗バー */}
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div 
                            className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-400 to-blue-600"
                            style={{ 
                              width: currentProcessing.total > 0 
                                ? `${Math.round((currentProcessing.current / currentProcessing.total) * 100)}%` 
                                : '0%' 
                            }}
                          ></div>
                        </div>  
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-600">
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
                        
                    {/* 残り件数表示 - より目立つように */}
                    {(currentProcessing.remaining !== undefined && currentProcessing.remaining > 0) && (
                      <div className="rounded-lg p-3 border-2 bg-yellow-50 border-yellow-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">残り件数:</span>
                          <div className="text-right">
                            <span className="text-xl font-bold text-yellow-600">
                              {currentProcessing.remaining}件
                            </span>
                            <div className="text-xs text-gray-500">
                              登録待ち
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 現在の処理対象 - より詳細に */}
                    {currentProcessing.summary && (
                      <div className="rounded-lg p-4 border-2 bg-green-50 border-green-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-bold text-green-700">
                            📝 現在の処理:
                          </span>
                        </div>
                        <div className="p-3 rounded border bg-white border-green-100">
                          <span className="text-sm font-medium text-gray-800">
                            {currentProcessing.summary}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 停止時の詳細情報表示 */}
              {isStoppedByUser && (
                <div className="p-4 rounded-lg border-2 bg-gray-50 border-gray-300 text-center">
                  <div className="text-2xl mb-2">⏹️</div>
                  <div className="text-lg font-bold mb-1 text-gray-700">
                    処理を停止しました
                  </div>
                  {currentProcessing.total > 0 && (
                    <div className="text-sm text-gray-600">
                      完了: {currentProcessing.current}件 / 全{currentProcessing.total}件
                      <br />
                      未処理: {currentProcessing.total - currentProcessing.current}件
                    </div>
                  )}
                </div>
              )}
              
              {/* 完了時の詳細アニメーション */}
              {progress === 100 && (
                <div className="p-4 rounded-lg border-2 text-center bg-green-50 border-green-200 text-green-700">
                  <div className="animate-bounce text-3xl mb-2">
                    ✅
                  </div>
                  <div className="text-lg font-bold mb-1">
                    登録完了！
                  </div>
                  {currentProcessing.total > 0 && (
                    <div className="text-sm font-medium">
                      {currentProcessing.total}個のイベントの登録が完了しました
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
        <div className="container mx-auto p-6">
          <div className="bg-white rounded-2xl p-8 mb-8 ${isLoading ? 'opacity-50 pointer-events-none' : ''}">
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
                    placeholder="コピーしたカレンダーIDを入力してください"
                    required
                  />
                </div>

                <div>
                  <label className="text-lg font-medium text-blue-600 mb-2 flex items-center gap-2">
                    記念日名 ✨
                  </label>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                      placeholder="例：結婚{{ym}}記念日💍、祝！{{years}}年{{months}}ヶ月記念"
                    />
                    
                    {/* プレースホルダー自動入力ボタン */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">プレースホルダー自動入力:</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTitle(prev => prev +  '結婚' + '{{ym}}' + '記念日💍')}
                          className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex flex-col items-center gap-1"
                        >
                          <div className="font-bold text-lg text-green-800">{'{{ym}}'}</div>
                          <div className="text-xs text-center">結婚{'{{ym}}'}記念日💍<br />↓<br />結婚1年1ヶ月記念日💍</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTitle(prev => prev + '祝！' + '{{years}}' + '年')}
                          className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex flex-col items-center gap-1"
                        >
                          <div className="font-bold text-lg text-purple-800">{'{{years}}'}</div>
                          <div className="text-xs text-center">祝！{'{{years}}'}年{'{{months}}'}ヶ月記念🎂<br />↓<br />祝！1年1ヶ月記念🎂</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTitle(prev => prev + '{{months}}' + 'ヶ月記念')}
                          className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex flex-col items-center gap-1"
                        >
                          <div className="font-bold text-lg text-yellow-800">{'{{months}}'}</div>
                           <div className="text-xs text-center">祝！{'{{years}}'}年{'{{months}}'}ヶ月記念🎂<br />↓<br />祝！1年1ヶ月記念🎂</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTitle(prev => prev +  '結婚' + '{{count}}' + 'ヶ月目記念日🎉')}
                          className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex flex-col items-center gap-1"
                        >
                          <div className="font-bold text-lg text-pink-800">{'{{count}}'}</div>
                          <div className="text-xs text-center">結婚{'{{count}}'}ヶ月目記念日🎉<br />↓<br />結婚13ヶ月目記念日🎉</div>
                        </button>
                      </div>
                    </div>
                  </div>                                    
                </div>
                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    記念日 📅
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
                    何年分記録する？
                    <div className="relative group">
                      <Info className="w-5 h-5 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                        記念日から何年分の記念日を作成するかを指定します。月単位で記念日が作成されます。（最大100年まで）
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={recordYears}
                    onChange={(e) => handleYearsChange(Number(e.target.value))}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black ${
                      yearValidationError && yearValidationError.includes('100年以内')
                        ? 'border-red-500 bg-red-50' 
                        : yearValidationError && yearValidationError.includes('長期間')
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-blue-200'
                    }`}
                    placeholder="例: 10"
                    required
                  />
                  {yearValidationError && (
                    <div className={`mt-2 p-2 rounded-lg text-sm ${
                      yearValidationError.includes('100年以内')
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : yearValidationError.includes('長期間')
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">
                          {yearValidationError.includes('100年以内') ? '❌' : '⚠️'}
                        </span>
                        <span>{yearValidationError}</span>
                      </div>
                    </div>
                  )}
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
                  disabled={
                    isLoading || 
                    Boolean(yearValidationError && yearValidationError.includes('100年以内'))
                  }
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
        </div>
      </div>
    </div>
  );
}