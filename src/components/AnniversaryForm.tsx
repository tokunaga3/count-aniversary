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
  const [isStoppedByUser, setIsStoppedByUser] = useState<boolean>(false); // ユーザーによる停止状態
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null); // 現在のEventSource参照
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null); // 現在のAbortController参照
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
    if (!date || !calendarId || !endDate) return;
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

      // 単発APIの繰り返し処理で記念日を登録
      await performFallbackRegistration(titleToSend, intervalType, monthsDiff, abortController);
      
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
    performFallbackRegistration(titleToSend, intervalType, estimatedCount, fallbackAbortController);
  };

  // 単発APIの繰り返し処理による記念日登録（メイン処理）
  const performFallbackRegistration = async (titleToSend: string, _intervalType: string, _estimatedCount: number, abortController: AbortController) => {
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
      const generateResponse = await fetch(`/api/anniversary?action=generate&startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(endDate)}&title=${encodeURIComponent(titleToSend)}&comment=${encodeURIComponent(description)}`, {
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
          console.error(`イベント作成エラー: ${anniversary.title}`, error);
        }
      }

      setProgress(100);
      setProgressMessage('🎉 登録完了！');
      setCurrentProcessing({
        current: createdCount,
        total: totalCount,
        currentDate: endDate,
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

  const handleDeleteByCalendarId = async () => {
    if (!deleteCalendarId) return;
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('削除処理を開始しています...');
    setIsStoppedByUser(false); // 停止状態をリセット
    setCurrentEventSource(null); // EventSource参照をリセット
    
    // 新しいAbortControllerを作成
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: '削除準備中...',
      batchInfo: ''
    });
    
    // 削除処理は単発APIのレスポンスのみ使用
    console.log('Using direct API approach for delete...');
    performDirectDelete(abortController);
  };

  // フロントエンド繰り返し処理による削除（メイン処理）
  const performDirectDelete = async (abortController: AbortController) => {
    try {
      // 停止チェック
      if (isStoppedByUser || abortController.signal.aborted) {
        console.log('削除処理: ユーザーによる停止が検出されました');
        return;
      }
      
      console.log('フロントエンド繰り返し処理による削除を開始');
      setIsLoading(true);
      setProgress(10);
      setProgressMessage('カレンダーから削除対象の予定を検索中...');
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '削除対象イベントを検索中',
        remaining: 0
      });
      
      // 削除対象検索の進捗表示
      for (let delay = 0; delay < 300; delay += 50) {
        if (isStoppedByUser || abortController.signal.aborted) {
          console.log('削除対象検索中にユーザーによる停止が検出されました');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // まず削除対象のイベントリストを取得
      setProgress(15);
      setProgressMessage('削除対象イベントを取得中...');
      
      const listResponse = await fetch(`/api/anniversary?calendarId=${encodeURIComponent(deleteCalendarId)}&action=list`, {
        method: "GET",
        signal: abortController.signal
      });

      if (!listResponse.ok) {
        const errorData = await listResponse.json();
        
        if (errorData.error === 'auth_expired') {
          setProgressMessage('❌ 認証の期限が切れました');
          alert('認証の期限が切れました。再度ログインしてください。');
          setTimeout(() => {
            window.location.href = '/api/auth/signout';
          }, 2000);
          return;
        }
        
        throw new Error(errorData.message || '削除対象の取得に失敗しました');
      }

      const listResult = await listResponse.json();
      const eventsToDelete = listResult.events || [];
      const totalCount = eventsToDelete.length;
      
      if (totalCount === 0) {
        setProgress(100);
        setProgressMessage('削除対象のイベントが見つかりませんでした');
        setCurrentProcessing({
          current: 0,
          total: 0,
          currentDate: '',
          summary: '削除対象のイベントがありません',
          remaining: 0
        });
        
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
          setCurrentAbortController(null);
          alert('削除対象のイベントが見つかりませんでした。');
        }, 2000);
        return;
      }
      
      setProgress(20);
      setProgressMessage(`${totalCount}件の記念日を順次削除中...`);
      setCurrentProcessing({
        current: 0,
        total: totalCount,
        currentDate: '',
        summary: '個別削除処理を開始します',
        remaining: totalCount
      });

      let deletedCount = 0;
      let failedCount = 0;
      
      // 各イベントを個別に削除
      for (let i = 0; i < eventsToDelete.length; i++) {
        // 停止チェック（AbortController も含む）
        if (isStoppedByUser || abortController.signal.aborted) {
          console.log('個別削除処理中にユーザーによる停止が検出されました');
          console.log(`停止時点: ${deletedCount}/${totalCount}件完了`);
          console.log('AbortController状態:', {
            isStoppedByUser,
            signalAborted: abortController.signal.aborted,
            abortReason: abortController.signal.reason
          });
          
          // 停止時の状態を更新
          setCurrentProcessing({
            current: deletedCount,
            total: totalCount,
            currentDate: new Date().toLocaleDateString('ja-JP'),
            summary: `処理停止: ${deletedCount}件削除、${failedCount}件失敗、${totalCount - deletedCount - failedCount}件未処理`,
            remaining: totalCount - deletedCount - failedCount
          });
          
          return; // 即座に処理を終了
        }
        
        const event = eventsToDelete[i];
        const currentNum = i + 1;
        const remaining = totalCount - currentNum;
        
        try {
          const deleteResponse = await fetch("/api/anniversary", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              action: 'delete-single',
              calendarId: deleteCalendarId,
              eventId: event.id
            }),
          });
          
          const responseData = await deleteResponse.json();
          
          if (deleteResponse.ok && responseData.success) {
            deletedCount++;
          } else if (responseData.error === 'auth_expired') {
            // 認証エラーの場合は処理を停止し、ユーザーに再認証を促す
            console.log('認証エラーが発生しました');
            setProgressMessage('❌ 認証の期限が切れました');
            setCurrentProcessing({
              current: deletedCount,
              total: totalCount,
              currentDate: event.start?.date || new Date().toLocaleDateString('ja-JP'),
              summary: `認証エラー: ${deletedCount}件削除済み、再認証が必要です`,
              remaining: totalCount - deletedCount
            });
            
            alert(`認証の期限が切れました。\n${deletedCount}件の記念日が削除されました。\n\n再度ログインしてから残りの削除を行ってください。`);
            
            // ログアウトして再認証を促す
            setTimeout(() => {
              window.location.href = '/api/auth/signout';
            }, 2000);
            
            return; // 処理を停止
          } else {
            console.error(`イベント削除失敗: ${event.summary}`, responseData);
            failedCount++;
          }
          
        } catch (error) {
          // AbortErrorの場合は、ユーザーによる停止として処理を終了
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`削除処理中断 (ユーザー停止): ${event.summary} - ${error.message}`);
            // AbortErrorの場合は即座に処理を終了し、failedCountを増やさない
            return;
          }
          
          // その他のエラーの場合
          console.log(`イベント削除エラー: ${event.summary}`, error);
          failedCount++;
        }
        
        const progress = 20 + Math.floor((currentNum / totalCount) * 70); // 20%から90%まで
        setProgress(progress);
        setProgressMessage(`記念日削除中: ${deletedCount}件完了 (残り${remaining}件)`);
        
        // 削除されたイベントの詳細表示
        const eventTitle = event.summary || `記念日イベント ${currentNum}`;
        const eventDate = event.start?.date || new Date().toLocaleDateString('ja-JP');
        
        setCurrentProcessing({
          current: deletedCount,
          total: totalCount,
          currentDate: eventDate,
          summary: `削除処理中: ${eventTitle}`,
          remaining: remaining
        });
        
        // レート制限対策の遅延処理（停止チェック付き）
        try {
          for (let delay = 0; delay < 100; delay += 20) {
            if (isStoppedByUser || abortController.signal.aborted) {
              console.log('削除遅延処理中にユーザーによる停止が検出されました');
              return; // 即座に処理を終了
            }
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        } catch (delayError) {
          // 遅延処理中のAbortErrorも適切に処理
          if (delayError instanceof Error && delayError.name === 'AbortError') {
            console.log('削除遅延処理中にAbortErrorが発生しました');
            return;
          }
          console.error('削除遅延処理中に予期しないエラーが発生しました:', delayError);
        }
      }
      
      setProgress(100);
      const successMessage = failedCount > 0 
        ? `🗑️ 削除完了！ ${deletedCount}件成功、${failedCount}件失敗`
        : `🗑️ 削除完了！ ${deletedCount}件の記念日を削除しました`;
      
      setProgressMessage(successMessage);
      setCurrentProcessing({
        current: deletedCount,
        total: totalCount,
        currentDate: new Date().toLocaleDateString('ja-JP'),
        summary: `全ての削除処理が完了しました (成功: ${deletedCount}件, 失敗: ${failedCount}件)`,
        remaining: 0,
        batchInfo: '削除処理完了'
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
        setCurrentAbortController(null); // AbortController をクリア
        
        const message = failedCount > 0 
          ? `${deletedCount}件の予定を削除しました。\n${failedCount}件の削除に失敗しました。`
          : `${deletedCount}件の予定を削除しました！`;
        alert(message);
      }, 3000);
      
    } catch (error) {
      console.error('フロントエンド削除エラー:', error);
      setCurrentAbortController(null); // AbortController をクリア
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('削除APIリクエストがユーザーによってキャンセルされました:', error.message);
          setProgressMessage('⏹️ 削除処理がキャンセルされました');
        } else {
          console.error('予期しない削除エラー:', error.message);
          setProgressMessage('❌ 削除中にエラーが発生しました');
          alert(`削除中にエラーが発生しました: ${error.message}`);
        }
      } else {
        setProgressMessage('❌ 削除中にエラーが発生しました');
        alert("削除中にエラーが発生しました");
      }
      setProgress(0);
      setCurrentProcessing({
        current: 0,
        total: 0,
        currentDate: '',
        summary: '',
        remaining: 0
      });
      setIsLoading(false);
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
            <div></div> {/* 左側を空にする */}
            <div className="flex gap-4">
              {isDeleteMode ? (
                <button
                  onClick={() => setIsDeleteMode(false)}
                  className="bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-bold hover:bg-blue-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  カレンダー登録
                </button>
              ) : (
                <button
                  onClick={() => setIsDeleteMode(true)}
                  className="bg-red-500 text-white py-2 px-4 rounded-lg text-sm font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  予定を削除
                </button>
              )}
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
                    記念日名 ✨
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
                    記念日 
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
                    終了日
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