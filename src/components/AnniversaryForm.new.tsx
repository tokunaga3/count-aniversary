"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Loader2, Info } from 'lucide-react';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';
import { DeleteForm } from './anniversary/DeleteForm';
import { DeleteConfirmationModal } from './anniversary/DeleteConfirmationModal';

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
  const [currentProcessing, setCurrentProcessing] = useState({
    current: 0,
    total: 0,
    currentDate: '',
    summary: ''
  });
  const [deleteCalendarId, setDeleteCalendarId] = useState<string>('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [isDeleteMode, setIsDeleteMode] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 記念日登録処理（SSE対応）
  const addSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !calendarId || !endDate) return;
    
    setIsLoading(true);
    setProgress(0);
    setProgressMessage('記念日の登録を開始しています...');
    setCurrentProcessing({ current: 0, total: 0, currentDate: '', summary: '' });
    
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
      await trySSEAddition(titleToSend, intervalType, monthsDiff);
      
    } catch (error) {
      console.error('記念日登録エラー:', error);
      setProgressMessage('❌ 登録中にエラーが発生しました');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  // SSE進捗受信での記念日登録処理
  const trySSEAddition = async (titleToSend: string, intervalType: string, estimatedCount: number) => {
    return new Promise<void>((resolve, reject) => {
      const eventSource = new EventSource('/api/anniversary?' + new URLSearchParams({
        startDate: date,
        endDate: endDate,
        intervalType,
        comment: description,
        calenderId: calendarId,
        title: titleToSend,
        streaming: 'true'
      }));
      
      const timeout = setTimeout(() => {
        console.log('SSE接続タイムアウト - フォールバック処理に切り替え');
        eventSource.close();
        performFallbackAddition(titleToSend, intervalType, estimatedCount);
        resolve();
      }, 30000);
      
      eventSource.onopen = () => {
        console.log('SSE接続が正常に開かれました');
        setProgressMessage('リアルタイム登録処理に接続中...');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('受信したSSEデータ:', data);
          
          if (data.type === 'progress') {
            setProgress(data.progress);
            setProgressMessage(data.message);
            
            // 詳細進捗情報を更新
            if (data.current && data.total) {
              setCurrentProcessing({
                current: data.current,
                total: data.total,
                currentDate: data.currentDate || '',
                summary: data.summary || data.eventTitle || ''
              });
            }
          } else if (data.type === 'complete') {
            clearTimeout(timeout);
            setProgress(100);
            setProgressMessage('✅ 登録完了！');
            setCurrentProcessing(prev => ({ 
              ...prev, 
              current: data.createdCount || prev.total 
            }));
            
            eventSource.close();
            
            // 登録完了後の処理
            setTitle('');
            setDate('');
            setDescription('');
            setEndDate('');
            fetchSpecialDates();
            
            setTimeout(() => {
              setProgress(0);
              setProgressMessage('');
              setCurrentProcessing({ current: 0, total: 0, currentDate: '', summary: '' });
            }, 3000);
            
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            eventSource.close();
            setProgressMessage(`❌ エラー: ${data.message}`);
            reject(new Error(data.message));
          }
        } catch (error) {
          console.error('SSEデータ解析エラー:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE接続エラー:', error);
        clearTimeout(timeout);
        eventSource.close();
        
        // フォールバック処理に切り替え
        setProgressMessage('SSE接続エラー - 通常処理に切り替え中...');
        performFallbackAddition(titleToSend, intervalType, estimatedCount);
        resolve();
      };
    });
  };

  // フォールバック記念日登録処理
  const performFallbackAddition = async (titleToSend: string, intervalType: string, estimatedCount: number) => {
    try {
      setProgressMessage('通常の登録処理を実行中...');
      
      // 進捗シミュレーション
      for (let i = 1; i <= estimatedCount; i++) {
        const progressPercent = Math.round((i / estimatedCount) * 100);
        setProgress(progressPercent);
        
        // 進行中の詳細情報をシミュレート
        const currentDate = new Date(date);
        currentDate.setMonth(currentDate.getMonth() + i - 1);
        
        setCurrentProcessing({
          current: i,
          total: estimatedCount,
          currentDate: currentDate.toISOString().split('T')[0],
          summary: titleToSend.replace('#回目', `${i}回目`)
        });
        
        setProgressMessage(`記念日を登録中... (${i}/${estimatedCount})`);
        
        // 少し待機してUIに反映
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 実際のAPI呼び出し
      const response = await fetch('/api/anniversary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: date,
          endDate: endDate,
          intervalType,
          comment: description,
          calenderId: calendarId,
          title: titleToSend
        })
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('API response:', result);

      setProgress(100);
      setProgressMessage('✅ 登録完了！');
      
      // 登録完了後の処理
      setTitle('');
      setDate('');
      setDescription('');
      setEndDate('');
      fetchSpecialDates();
      
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setCurrentProcessing({ current: 0, total: 0, currentDate: '', summary: '' });
      }, 3000);
      
    } catch (error) {
      console.error('フォールバック登録エラー:', error);
      setProgressMessage('❌ 登録に失敗しました');
      setProgress(0);
    }
  };

  // 記念日一覧取得
  const fetchSpecialDates = async () => {
    try {
      const response = await fetch('/api/anniversary');
      if (response.ok) {
        const data = await response.json();
        setSpecialDates(data);
      }
    } catch (error) {
      console.error('記念日データの取得に失敗:', error);
    }
  };

  // 削除確認モーダルを開く
  const openDeleteConfirmation = () => {
    setShowDeleteConfirmation(true);
  };

  // 削除確認モーダルを閉じる
  const closeDeleteConfirmation = () => {
    setShowDeleteConfirmation(false);
  };

  // SSEを使用した削除処理
  const trySSEDeletion = async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        streaming: 'true',
        calendarId: deleteCalendarId
      });
      
      const eventSource = new EventSource(`/api/anniversary?${params.toString()}`, {
        // DELETEメソッドはEventSourceで直接サポートされていないため、クエリパラメータで指定
      });
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('削除SSE data received:', data);
          
          if (data.type === 'progress') {
            setProgress(data.progress || 0);
            setProgressMessage(data.message || '削除処理中...');
            
            // 詳細進捗情報を更新
            setCurrentProcessing({
              current: data.deletedCount || data.current || 0,
              total: data.total || 0,
              currentDate: '',
              summary: data.message || '削除処理中'
            });
          } else if (data.type === 'complete') {
            setProgress(100);
            setProgressMessage(data.message || '削除完了！');
            setCurrentProcessing({
              current: data.deletedCount || 0,
              total: data.deletedCount || 0,
              currentDate: '',
              summary: '削除完了'
            });
            eventSource.close();
            resolve(true);
          } else if (data.type === 'error') {
            setProgressMessage(`エラー: ${data.message}`);
            eventSource.close();
            reject(new Error(data.message));
          }
        } catch (error) {
          console.error('Error parsing deletion SSE data:', error);
          eventSource.close();
          reject(error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('削除SSE connection error:', error);
        eventSource.close();
        reject(new Error('SSE connection failed'));
      };
      
      // タイムアウト設定（10分）
      setTimeout(() => {
        eventSource.close();
        reject(new Error('削除処理がタイムアウトしました'));
      }, 600000);
    });
  };

  // 記念日削除処理
  const handleDelete = async () => {
    if (!deleteCalendarId) return;
    
    setIsDeleting(true);
    setProgress(0);
    setProgressMessage('削除処理を開始しています...');
    setCurrentProcessing({
      current: 0,
      total: 0,
      currentDate: '',
      summary: ''
    });
    
    try {
      // SSEを試行
      try {
        await trySSEDeletion();
        
        // 成功時の処理
        await fetchSpecialDates();
        closeDeleteConfirmation();
        setDeleteCalendarId('');
        
      } catch (sseError) {
        console.error('削除SSE failed:', sseError);
        setProgressMessage('SSEでの削除処理に失敗しました。通常のDELETEリクエストを試行します...');
        
        // フォールバック: 従来のDELETEリクエスト
        const response = await fetch(`/api/anniversary?calendarId=${deleteCalendarId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        await response.json();
        setProgress(100);
        setProgressMessage('記念日を削除しました！');
        
        await fetchSpecialDates();
        closeDeleteConfirmation();
        setDeleteCalendarId('');
      }
      
    } catch (error) {
      console.error('削除エラー:', error);
      setProgressMessage(`削除エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert('削除中にエラーが発生しました');
    } finally {
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setCurrentProcessing({ current: 0, total: 0, currentDate: '', summary: '' });
        setIsDeleting(false);
      }, 3000);
    }
  };

  // 進捗詳細表示コンポーネント
  const ProgressDetails = () => {
    if ((!isLoading && !isDeleting) || currentProcessing.total === 0) return null;
    
    const isDeleteOperation = isDeleting;
    
    return (
      <div className={`mt-4 p-4 rounded-lg border ${
        isDeleteOperation 
          ? 'bg-red-50 border-red-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className={`flex items-center gap-2 font-medium mb-2 ${
          isDeleteOperation ? 'text-red-700' : 'text-blue-700'
        }`}>
          <Info className="w-4 h-4" />
          {isDeleteOperation ? '削除詳細' : '処理詳細'}
        </div>
        <div className={`space-y-1 text-sm ${
          isDeleteOperation ? 'text-red-600' : 'text-blue-600'
        }`}>
          <div>進捗: {currentProcessing.current} / {currentProcessing.total} 件</div>
          {currentProcessing.currentDate && (
            <div>現在の日付: {currentProcessing.currentDate}</div>
          )}
          {currentProcessing.summary && (
            <div>{isDeleteOperation ? '処理状況' : 'イベント名'}: {currentProcessing.summary}</div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchSpecialDates();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">記念日カレンダー</h1>
      
      <div className="mb-6 flex justify-between items-center">
        <LoginButton />
        <LogoutButton />
      </div>

      <form onSubmit={addSpecialDate} className="mb-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            カレンダーID
          </label>
          <input
            type="text"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="GoogleカレンダーのカレンダーIDを入力"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            記念日のタイトル（任意）
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="例: 🎉 #回目の記念日 🎉"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            記念日の開始日
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            記念日の終了日
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            説明（任意）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="記念日の説明を入力"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              登録中...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              月ごとの記念日を登録
            </>
          )}
        </button>
      </form>

      {/* 進捗表示エリア */}
      {(isLoading || isDeleting) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{progressMessage}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isDeleting ? 'bg-red-600' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* 進捗詳細 */}
          <ProgressDetails />
        </div>
      )}

      {/* 削除モード切り替えボタン */}
      <div className="mb-4">
        <button
          onClick={() => setIsDeleteMode(!isDeleteMode)}
          className={`px-4 py-2 rounded-md flex items-center gap-2 ${
            isDeleteMode 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          {isDeleteMode ? '削除モードを終了' : '削除モードに切り替え'}
        </button>
      </div>

      {/* 削除フォーム */}
      {isDeleteMode && (
        <DeleteForm 
          deleteCalendarId={deleteCalendarId}
          isLoading={isDeleting}
          onDeleteCalendarIdChange={setDeleteCalendarId}
          onDeleteConfirmationOpen={openDeleteConfirmation}
          onSwitchToRegisterMode={() => setIsDeleteMode(false)}
        />
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          deleteCalendarId={deleteCalendarId}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={closeDeleteConfirmation}
        />
      )}

      {/* 記念日一覧 */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">登録済み記念日</h2>
        {specialDates.length > 0 ? (
          <div className="grid gap-4">
            {specialDates.map((specialDate) => (
              <div key={specialDate.id} className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-lg">{specialDate.title}</h3>
                <p className="text-gray-600">開始日: {specialDate.date}</p>
                <p className="text-gray-600">カレンダーID: {specialDate.calendarId}</p>
                {specialDate.description && (
                  <p className="text-gray-600">説明: {specialDate.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">まだ記念日が登録されていません。</p>
        )}
      </div>
    </div>
  );
}
