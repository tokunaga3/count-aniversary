"use client";

import React, { useState } from 'react';
import { Calendar, Star, Trash2, Loader2 } from 'lucide-react';
import { signOut } from 'next-auth/react';

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
  const [countType, setCountType] = useState<'years' | 'months' | 'yearsAndMonths'>('years');
  const [repeatCount, setRepeatCount] = useState(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [deleteCalendarId, setDeleteCalendarId] = useState<string>('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [isDeleteMode, setIsDeleteMode] = useState<boolean>(false);


  const addSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !calendarId) return;
    setIsLoading(true);
    try {
      const intervalType = countType === 'years' ? 'yearly' : 'monthly';
      const titleToSend = title.trim() === '' ? '🎉 #回目の記念日 🎉' : title;
      console.log('Sending data to API:', {
        startDate: date,
        intervalType,
        count: repeatCount,
        comment: description,
        calenderId: calendarId,
        title: titleToSend
      });
      
      const response = await fetch("/api/anniversary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: date,
          intervalType,
          count: repeatCount,
          comment: description,
          calenderId: calendarId,
          title: titleToSend
        }),
      });

      if (response.ok) {
        const newDate: SpecialDate = {
          id: crypto.randomUUID(),
          calendarId,
          title: titleToSend || '🎉 #回目の記念日 🎉',
          date,
          description,
          countType,
          repeatCount
        };
        setSpecialDates([...specialDates, newDate]);
        setCalendarId('');
        setTitle('');
        setDate('');
        setDescription('');
        setRepeatCount(1);
        alert("記念日を追加しました！");
      } else {
        alert("エラーが発生しました");
      }
    } catch {
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteByCalendarId = async () => {
    if (!deleteCalendarId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/anniversary?calendarId=${deleteCalendarId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSpecialDates(specialDates.filter(date => date.calendarId !== deleteCalendarId));
        setDeleteCalendarId('');
        setShowDeleteConfirmation(false);
        alert("予定を削除しました！");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "エラーが発生しました");
      }
    } catch {
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="text-center animate-fade-in">
              <h1 className="text-4xl font-bold text-blue-600 mb-2 flex items-center justify-center gap-2">
                <Star className="text-yellow-400 animate-pulse" />
                思い出カレンダー
                <Star className="text-yellow-400 animate-pulse" />
              </h1>
              <p className="text-blue-500 text-lg">楽しい予定と大切な記念日をメモしよう！</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsDeleteMode(true)}
                className="bg-red-500 text-white py-2 px-4 rounded-lg text-sm font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                予定を削除
              </button>
              <button
                onClick={() => signOut()}
                className="bg-gray-500 text-white py-2 px-4 rounded-lg text-sm font-bold hover:bg-gray-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              >
                ログアウト
              </button>
            </div>
          </div>

          {isDeleteMode ? (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
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
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="flex-1 bg-red-500 text-white py-3 px-6 rounded-xl text-lg font-bold hover:bg-red-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!deleteCalendarId}
                  >
                    <Trash2 className="w-6 h-6" />
                    削除する
                  </button>
                  <button
                    onClick={() => {
                      setIsDeleteMode(false);
                      setDeleteCalendarId('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl text-lg font-bold hover:bg-gray-300 transform hover:scale-105 transition-all duration-300"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 transform hover:scale-[1.02] transition-transform duration-300">
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
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    タイトル ✨ (空白にすると「🎉 #回目の記念日 🎉」となります)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                    placeholder="例：誕生日パーティー🎉"
                  />
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
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    カウントタイプ 🔄
                  </label>
                  <select
                    value={countType}
                    onChange={(e) => setCountType(e.target.value as 'years' | 'months' | 'yearsAndMonths')}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-black"
                  >
                    <option value="years">年単位</option>
                    <option value="months">月単位</option>
                  </select>
                </div>

                <div>
                  <label className="block text-lg font-medium text-blue-600 mb-2">
                    記録回数 🔢
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(parseInt(e.target.value))}
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
                    required
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
    </div>
  );
}