This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Access control (Google Sheets) / 環境変数

このアプリは、Google スプレッドシートに記載されたメールアドレスだけにログインを許可する「許可ユーザー制限」をサポートしています。

- 実装箇所: `src/lib/auth.ts` の `signIn` コールバック
- 仕組み: Google サインイン後、スプレッドシートの許可リストにユーザーのメールが存在するかを確認します。

### フラグ: IS_ALLOWED_GOOGLE_AUTH_ENABLED

許可ユーザー制限の有効/無効を切り替える機能トグルです。

- `true`: 許可リストにあるユーザーのみログイン許可（推奨: 本番）
- `false` または未設定: 許可リストチェックをスキップし、Google サインインに成功した全ユーザーを許可（開発・一時運用向け）

注意: 制限を有効化（`true`）した場合、スプレッドシートの取得に失敗したり、必要な環境変数が未設定だとログインは拒否されます。

### 必要な環境変数

- `IS_ALLOWED_GOOGLE_AUTH_ENABLED` … 許可リスト制御のオン/オフ
- `ALLOWED_USERS_SPREADSHEET_ID` … 許可メールアドレスを記載したスプレッドシートのID
- `GOOGLE_SERVICE_ACCOUNT_KEY` … スプレッドシートを読み取るサービスアカウントのJSON（文字列）
- `ALLOWED_USERS_RANGE` … 読み取り範囲（省略可、既定値: `Sheet1!A:A`）

### .env の例

```bash
# Access control toggle
IS_ALLOWED_GOOGLE_AUTH_ENABLED=true

# Google Sheets (allowed users)
ALLOWED_USERS_SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_USERS_RANGE=Sheet1!A:A

# サービスアカウントキー（1行JSON）
# 例: GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...", ... }'
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"your-sa@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-sa%40your-project.iam.gserviceaccount.com"}'

# NextAuth / Google OAuth
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### スプレッドシートの書式

- 指定範囲（例: `Sheet1!A:A`）のセルに、1行につき1つのメールアドレスを記載
- 例:
	- `user1@example.com`
	- `user2@gmail.com`

### トラブルシューティング

- 制限を有効にしているのに全員拒否される
	- `ALLOWED_USERS_SPREADSHEET_ID` と `GOOGLE_SERVICE_ACCOUNT_KEY` が正しいか確認
	- サービスアカウントに対象スプレッドシートの閲覧権限が付与されているか確認
- 開発中は制限をオフにしたい
	- `.env` で `IS_ALLOWED_GOOGLE_AUTH_ENABLED=false` を設定
