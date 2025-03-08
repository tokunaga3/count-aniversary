"use client";

import { useState } from "react";

export default function AnniversaryForm() {
  const [startDate, setStartDate] = useState<string>("");
  const [intervalType, setIntervalType] = useState<"yearly" | "monthly">(
    "yearly"
  );
  const [count, setCount] = useState<number>(10);
  const [comment, setComment] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/anniversary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, intervalType, count, comment }),
    });

    if (response.ok) {
      alert("記念日を追加しました！");
    } else {
      alert("エラーが発生しました");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>記念日開始日:</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
      />

      <label>間隔:</label>
      <select
        value={intervalType}
        onChange={(e) =>
          setIntervalType(e.target.value as "yearly" | "monthly")
        }
      >
        <option value="yearly">年ごと</option>
        <option value="monthly">月ごと</option>
      </select>

      <label>何回目まで記録するか:</label>
      <input
        type="number"
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        min="1"
        required
      />

      <label>コメント:</label>
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        required
      />
      <button type="submit">Googleカレンダーに追加</button>
    </form>
  );
}
