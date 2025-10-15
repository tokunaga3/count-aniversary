# 機能別ページ化 計画書

最終更新: 2025-10-15

## 1. 目的
- 新機能（法要自動生成、隔週スケジューリング等）を機能単位でページ分割し、ユーザーが目的別に迷わず操作できる UI を提供する。
- トップ/セットアップ/各機能間の遷移を明快にし、保守性と拡張性を高める。

## 2. 対象機能（初期）
- 記念日一括登録（既存メイン機能）
- 法要自動生成（NEW: 命日→初七日〜五十回忌）
- 隔週スケジューリング（NEW: 曜日＋時間、祝日除外）

## 3. ルーティング設計（App Router）
- `/` … ホーム（またはメインダッシュボード）
- `/calendar-setup` … カレンダー作成/ID取得（既存）
- `/anniversary` … 記念日一括登録（既存のフォームをここに集約）
- `/memorial` … 法要自動生成（NEW）
- `/biweekly` … 隔週スケジューリング（NEW）

備考: 共通レイアウト（`src/app/layout.tsx`）にグローバルヘッダー/ナビを配置し、各ページへ遷移できるボタン/リンクを提供。

## 4. ナビゲーション/UI
- ヘッダー（共通）
  - ロゴ/タイトル
  - ナビ: 「記念日」「法要」「隔週」「セットアップ」「ログアウト」
- `/calendar-setup` にも、各機能ページへのショートカットボタンを配置（作成後の導線強化）
- 各ページの冒頭に機能説明、必要な入力項目、注意点（制限/警告）を記載

## 5. ページ仕様（概要）
### 5.1 `/anniversary`
- 入力: カレンダーID、記念日、何年分、タイトル（テンプレート）、メモ
- 出力: 月次イベントの生成・登録、進捗・停止
- 既存の `AnniversaryForm` を転用

### 5.2 `/memorial`（NEW）
- 入力: カレンダーID、命日、タイトルテンプレート（`{{houyou}}`, `{{year}}`, `{{base_date}}`）、メモ
- 出力: 初七日〜五十回忌までの法要イベントを生成・登録
- 注意: 四十九日（忌明け）の表記、年次マイルストーンのずれない計算

### 5.3 `/biweekly`（NEW）
- 入力: カレンダーID、開始日/終了日、曜日、時間帯、タイトル、祝日除外フラグ
- 出力: 2週おきに該当曜日の時間帯でイベント作成
- 祝日除外: 祝日カレンダー（既定: `ja.japanese#holiday@group.v.calendar.google.com`）参照

## 6. API 設計（高レベル）
- 既存 `/api/anniversary` を拡張 or 新規エンドポイント追加
  - 生成: `GET /api/anniversary?action=generate&...`
  - 単発登録: `POST /api/anniversary` body: `{ action: 'create-single', ... }`
- 新設 `/api/memorial`
  - 生成: `GET /api/memorial?action=generate&baseDate=...&title=...`
  - 登録: `POST /api/memorial` body: `{ action: 'create-single', calendarId, eventTitle, eventDate, description }`
- 新設 `/api/biweekly`
  - 生成: `GET /api/biweekly?action=generate&startDate=...&endDate=...&weekday=...&time=...&title=...&skipHolidays=true|false`
  - 登録: `POST /api/biweekly` body: `{ action: 'create-single', ... }`

共通事項:
- 認証必須（NextAuth セッション）
- 401/403/400/500 のエラー整備と JSON レスポンス
- 進捗・停止はクライアント側で逐次 POST ループを共通化

## 7. 実装手順（マイルストーン）
1) ルーティング骨格の用意（空ページ作成: `/anniversary`, `/memorial`, `/biweekly`）
2) 共通レイアウトにナビ追加（Link/ボタン）
3) 既存フォームを `/anniversary` に移設（またはルーティング調整）
4) `/memorial` の生成ロジックとUI（一覧→逐次登録）
5) `/biweekly` の生成ロジックとUI（祝日参照）
6) API エンドポイントの実装（memorial/biweekly）
7) QA: 受け入れ基準の動作確認、ガイド/要件の更新

## 8. 受け入れ基準
- ヘッダーの各ボタンから目的ページへ遷移できる
- `/anniversary` で既存の記念日登録フローが完走する
- `/memorial` で法要が正しい日付で生成・登録される
- `/biweekly` で隔週・祝日除外が正しく反映される
- 未ログイン時は `/` へ誘導

## 9. スケジュール（目安）
- M1: ルーティング・ナビ実装（0.5日）
- M2: 記念日ページ移設（0.5日）
- M3: 法要ページ（1.5日）
- M4: 隔週ページ（1.5日）
- M5: API 実装/QA/ドキュメント更新（1.5日）

## 10. リスク/対応
- 祝日判定のズレ → 公式祝日カレンダー参照、テストデータで検証
- API クォータ/レート制限 → 逐次登録・遅延・リトライ
- タイトルテンプレート差異 → プレースホルダーの最終整合
