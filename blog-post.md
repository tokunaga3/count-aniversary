# 記念日カウントアプリの開発記録：Next.jsとGoogle Calendar APIを使った思い出カレンダー

## はじめに

2025年4月20日

こんにちは！今回は私が最近開発した「思い出カレンダー」というプロジェクトについて紹介します。大切な記念日を自動的にGoogleカレンダーに登録し、「○年○ヶ月目の記念日」といった形で記録できるWebアプリケーションです。

## プロジェクトの概要

「思い出カレンダー」は以下のような機能を持つアプリケーションです：

- Googleアカウントでログインして専用のカレンダーを作成
- 記念日の登録（年単位・月単位で自動計算）
- 記念日の削除
- カスタムタイトルの設定（例：「🎉 #回目の記念日 🎉」など）

## 使用した技術スタック

このプロジェクトでは以下の技術を使用しています：

- **フロントエンド**：
  - Next.js（App Router）
  - TypeScript
  - TailwindCSS
  - React Hooks

- **バックエンド**：
  - Next.js API Routes
  - NextAuth.js（認証）
  - Google Calendar API

## 主要コンポーネントの解説

### カレンダー設定画面

ユーザーが初めてアプリにログインすると、専用の「思い出カレンダー」をGoogleカレンダー上に作成するための画面が表示されます。この画面では：

1. カレンダー名を入力
2. GoogleのAPIを呼び出して新しいカレンダーを作成
3. 生成されたカレンダーIDをコピーして記念日登録に使用



### 記念日登録フォーム

記念日の登録フォームでは、以下の情報を入力できます：

- カレンダーID（URLから自動取得も可能）
- 記念日のタイトル
- 開始日
- 説明文
- カウント種類（年単位/月単位）
- 繰り返し回数



### Google Calendar APIとの連携

アプリケーションのバックエンド部分では、Google Calendar APIを使用して実際のカレンダーイベントを作成します。特に興味深い点は、記念日のタイトルを動的に生成する部分です：

ヶ月年ヶ月ヶ月年ヶ月

## 実装で苦労した点

### 1. 日付計算の正確性

記念日を月単位で計算する場合、単純に月を加算するだけでは不正確な結果になることがあります。例えば1月31日の1ヶ月後は？という問題です。これを正確に処理するためには、月をまたぐ場合の特別な処理が必要でした：



### 2. Google認証の実装

NextAuth.jsを使ったGoogle認証の実装は、初めは複雑に感じました。特に、Calendar APIへのアクセス権を適切にスコープで設定する部分は試行錯誤が必要でした。

### 3. エラーハンドリング

ユーザーが無効なカレンダーIDを入力した場合や、Google APIが一時的に利用できない場合など、様々なエラーパターンに対処する必要がありました。エラーメッセージを適切に表示し、ユーザー体験を損なわないようにすることに注力しました。

## 今後の拡張計画

このプロジェクトはまだ成長の余地があります。今後実装したい機能としては：

1. 複数のカレンダーの管理（家族用、恋人用など）
2. 記念日のリマインダー機能
3. カスタムテンプレートの保存機能
4. モバイルアプリ版の開発

## まとめ

Next.jsとGoogle Calendar APIを組み合わせることで、シンプルながらも実用的な「思い出カレンダー」アプリを開発することができました。このプロジェクトを通じて、OAuth認証やサードパーティAPIとの連携について学ぶことができました。

もし似たようなプロジェクトに取り組んでいる方がいれば、ぜひこの記事が参考になれば嬉しいです。

Happy Coding!

---

*※このブログ記事は私の個人的な開発記録です。実際のプロジェクトコードはGitHubなどで公開予定です。*
