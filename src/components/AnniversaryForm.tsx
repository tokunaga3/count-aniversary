"use client";

import { useState } from "react";

export default function AnniversaryForm() {
  const [startDate, setStartDate] = useState<string>("");
  const [intervalType, setIntervalType] = useState<"yearly" | "monthly">(
    "yearly"
  );
  const [count, setCount] = useState<number>(10);
  const [comment, setComment] = useState<string>("");
  const [calenderId, setCalenderId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    const response = await fetch("/api/anniversary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, intervalType, count, comment, calenderId, title }),
    });

    if (response.ok) {
      alert("記念日を追加しました！");
    } else {
      alert("エラーが発生しました");
    }
    setShowConfirmation(false);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  return (
    <div>
      {showConfirmation ? (
        <div className="confirmation">
          <h2>確認画面</h2>
          <p>カレンダーID: {calenderId}</p>
          <p>タイトル: {title}</p>
          <p>記念日開始日: {startDate}</p>
          <p>間隔: {intervalType === "yearly" ? "年ごと" : "月ごと"}</p>
          <p>何回目まで記録するか: {count}</p>
          <p>コメント: {comment}</p>
          <button onClick={handleConfirm}>Googleカレンダーに追加</button>
          <button onClick={handleCancel}>キャンセル</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }} className="text-black">
          <label className="text-white">カレンダーID:</label>
          <input
            type="text"
            value={calenderId}
            onChange={(e) => setCalenderId(e.target.value)}
            required
          />
          <label className="text-white">タイトル (空白にすると「🎉 #回目の記念日 🎉」となります)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-white">記念日開始日:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <label className="text-white">間隔:</label>
          <select
            value={intervalType}
            onChange={(e) =>
              setIntervalType(e.target.value as "yearly" | "monthly")
            }
          >
            <option value="yearly">年ごと</option>
            <option value="monthly">月ごと</option>
          </select>

          <label className="text-white">何回目まで記録するか:</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min="1"
            required
          />

          <label className="text-white">コメント:</label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />
          <button className="text-white" type="submit">確認する</button>
        </form>
      )}
    </div>
  );
}