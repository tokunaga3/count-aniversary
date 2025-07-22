import React from 'react';
import { Calendar, Trash2, Key } from 'lucide-react';
import { DeleteFormProps } from './types';

export const DeleteForm: React.FC<DeleteFormProps> = ({
  deleteCalendarId,
  onDeleteCalendarIdChange,
  onDeleteConfirmationOpen,
  onSwitchToRegisterMode
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-medium text-red-600 flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> 予定の削除
        </h2>
        <button
          onClick={onSwitchToRegisterMode}
          className="text-blue-500 text-sm flex items-center gap-1 p-2 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          登録画面へ戻る
        </button>
      </div>

      <div className="space-y-4">
        <div className="form-group">
          <label className="block text-gray-700 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" /> カレンダーID 🔑
          </label>
          <input
            type="text"
            value={deleteCalendarId}
            onChange={(e) => onDeleteCalendarIdChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-red-100 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
            placeholder="例：family-calendar"
            required
          />
          <p className="mt-2 text-sm text-red-500">
            ※このIDに関連する全ての予定が削除されます
          </p>
        </div>

        <button
          onClick={onDeleteConfirmationOpen}
          className="w-full bg-red-500 text-white py-3 px-6 rounded-lg text-base font-medium hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          disabled={!deleteCalendarId}
        >
          <Trash2 className="w-5 h-5" />
          削除する
        </button>
      </div>
    </>
  );
};