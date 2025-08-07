# アクセス制御設定ガイド

## 概要

このアプリケーションでは、Googleスプレッドシートを使用してログインを許可するユーザーを制御できます。

## 設定手順

### 1. Googleサービスアカウントの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（または新規作成）
3. 「APIとサービス」→「認証情報」を選択
4. 「認証情報を作成」→「サービスアカウント」を選択
5. サービスアカウント名を入力（例：`spreadsheet-reader`）
6. 作成後、サービスアカウントをクリック
7. 「キー」タブ→「鍵を追加」→「新しい鍵を作成」
8. 「JSON」を選択してダウンロード

### 2. Google Sheets APIの有効化

1. Google Cloud Consoleで「APIとサービス」→「ライブラリ」
2. "Google Sheets API" を検索
3. 「有効にする」をクリック

### 3. スプレッドシートの作成と設定

1. [Google Sheets](https://sheets.google.com/) で新しいスプレッドシートを作成
2. A列に許可するGmailアドレスを入力：
   ```
   A1: user1@gmail.com
   A2: user2@example.com
   A3: admin@company.com
   ```
3. スプレッドシートのURLからスプレッドシートIDをコピー
   - URL例: `https://docs.google.com/spreadsheets/d/1ABC...XYZ/edit`
   - スプレッドシートID: `1ABC...XYZ`
4. スプレッドシートを作成したサービスアカウントと共有
   - 「共有」ボタンをクリック
   - サービスアカウントのメールアドレスを追加
   - 「閲覧者」権限を付与

### 4. 環境変数の設定

`.env.local` ファイルに以下を追加：

```env
# 許可されたユーザーのスプレッドシート設定
ALLOWED_USERS_SPREADSHEET_ID=1ABC...XYZ
ALLOWED_USERS_RANGE=Sheet1!A:A

# サービスアカウントキー（JSON形式）
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

## 設定パラメータ

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `ALLOWED_USERS_SPREADSHEET_ID` | 許可ユーザーリストのスプレッドシートID | `1ABC123DEF456...` |
| `ALLOWED_USERS_RANGE` | 読み取る範囲（省略可） | `Sheet1!A:A` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントのJSONキー | `'{"type":"service_account",...}'` |

## 動作仕様

### アクセス制御の流れ

1. ユーザーがGoogleログインを試行
2. システムがスプレッドシートから許可ユーザーリストを取得
3. ログインしようとするGmailアドレスがリストに含まれているかチェック
4. 含まれている場合のみログインを許可

### フェイルセーフ機能

以下の場合は全ユーザーのログインを許可します（システムダウンを防ぐため）：

- `ALLOWED_USERS_SPREADSHEET_ID` が設定されていない
- `GOOGLE_SERVICE_ACCOUNT_KEY` が設定されていない
- スプレッドシートへのアクセスでエラーが発生
- 許可ユーザーリストが空

### ログ出力

システムは以下の情報をログ出力します：

- 許可されたユーザー数
- ログイン試行の成功/失敗
- エラー情報

## トラブルシューティング

### 「スプレッドシートアクセスエラー」

**原因**:
- サービスアカウントキーが無効
- スプレッドシートIDが間違っている
- サービスアカウントに共有権限がない

**解決策**:
1. サービスアカウントキーの再確認
2. スプレッドシートIDの確認
3. スプレッドシートの共有設定を確認

### 「認証設定エラー」

**原因**:
- 環境変数が正しく設定されていない
- JSONキーの形式が無効

**解決策**:
1. `.env.local` の設定を確認
2. JSONキーをシングルクォートで囲む
3. 改行文字が `\\n` でエスケープされているか確認

### ログインが拒否される

**原因**:
- メールアドレスがスプレッドシートのリストにない
- 大文字小文字の違い
- 余分なスペースが含まれている

**解決策**:
1. スプレッドシートのメールアドレスを確認
2. 小文字で統一する
3. 余分なスペースを削除

## セキュリティ考慮事項

- サービスアカウントキーは機密情報として適切に管理
- スプレッドシートには必要最小限の権限（閲覧者）のみ付与
- 定期的にアクセスログを確認
- 不要になったユーザーは速やかにリストから削除

## API エンドポイント

### 許可ユーザーリストの確認

```
GET /api/allowed-users
```

レスポンス例：
```json
{
  "success": true,
  "allowedUsers": [
    "user1@gmail.com",
    "user2@example.com"
  ],
  "count": 2
}
```

このエンドポイントは管理者が設定を確認する際に使用できます。
