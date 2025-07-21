import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { DeleteConfirmationModalProps } from './types';

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  deleteCalendarId,
  isLoading,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          予定を削除しますか？
        </h2>
        <p className="text-gray-600 mb-6">
          カレンダーID「{deleteCalendarId}」に関連する全ての予定を削除します。<br />
          この操作は取り消せません。本当に削除してもよろしいですか？
        </p>
        <div className="flex gap-4">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white py-2.5 px-6 rounded-lg text-base font-bold hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                削除中...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                削除する
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-700 py-2.5 px-6 rounded-lg text-base font-bold hover:bg-gray-300 transition-all duration-300"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};