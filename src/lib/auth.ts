import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { google } from "googleapis";

/**
 * スプレッドシートから許可されたユーザーリストを取得
 */
async function getAllowedUsers(): Promise<string[]> {
  try {
    const SPREADSHEET_ID = process.env.ALLOWED_USERS_SPREADSHEET_ID;
    const RANGE = process.env.ALLOWED_USERS_RANGE || 'Sheet1!A:A';

    if (!SPREADSHEET_ID) {
      console.log('ALLOWED_USERS_SPREADSHEET_ID が設定されていません');
      throw new Error('ALLOWED_USERS_SPREADSHEET_ID が設定されていません');
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.log('GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません');
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません');
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const values = response.data.values || [];
    const allowedUsers = values
      .flat()
      .filter(email => email && typeof email === 'string' && email.includes('@'))
      .map(email => email.trim().toLowerCase());

    console.log(`許可されたユーザー数: ${allowedUsers.length}`);
    return allowedUsers;

  } catch (error) {
    console.error('スプレッドシートからの許可ユーザー取得エラー:', error);
    // エラーの場合は空配列を返して全ユーザーを拒否
    throw error;
  }
}

/**
 * リフレッシュトークンを使用してアクセストークンを更新
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    console.log("アクセストークンをリフレッシュしています...");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
      method: "POST",
    });

    const tokens = await response.json();

    if (!response.ok) {
      console.error("リフレッシュトークンエラー:", tokens);
      throw tokens;
    }

    console.log("アクセストークンの更新に成功しました");

    return {
      ...token,
      accessToken: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
      refreshToken: tokens.refresh_token ?? token.refreshToken, // 新しいリフレッシュトークンがあれば更新
    };
  } catch (error) {
    console.error("アクセストークンのリフレッシュに失敗:", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}


declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expires_at?: number;
    error?: string;
  }
}


export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET!,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "https://www.googleapis.com/auth/calendar openid email profile",
          prompt: "select_account", // consentからselect_accountに変更して警告を軽減
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google認証の場合のみチェック
      if (account?.provider === 'google' && user.email) {
        const flag = process.env.IS_ALLOWED_GOOGLE_AUTH_ENABLED === 'true';
        if (!flag) {
          console.log('許可ユーザー制限は現在無効化されています (IS_ALLOWED_GOOGLE_AUTH_ENABLED=false)');
          return true; // 制限OFF
        }
        try {
          const allowedUsers = await getAllowedUsers();

          // スプレッドシートに記載されたユーザーのみ許可
          const userEmail = user.email.toLowerCase();
          const isAllowed = allowedUsers.includes(userEmail);

          if (isAllowed) {
            console.log(`ユーザー ${userEmail} のログインを許可しました`);
            return true;
          } else {
            console.log(`ユーザー ${userEmail} はアクセス許可リストにありません`);
            return false;
          }
        } catch (error) {
          console.error('ユーザー許可チェック中にエラーが発生しました:', error);
          // エラーの場合はログインを拒否
          return false;
        }
      }

      return true;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.error = token.error as string;
      return session;
    },
    async jwt({ token, account }) {
      // 初回認証時：アカウント情報からトークンを保存
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expires_at: Math.floor(Date.now() / 1000 + (account.expires_at || 3600)),
        };
      }

      // アクセストークンがまだ有効な場合はそのまま返す
      if (token.expires_at && Date.now() < (token.expires_at as number) * 1000) {
        return token;
      }

      // アクセストークンが期限切れの場合、リフレッシュを試行
      return await refreshAccessToken(token);
    },
  },
};

export const handler = NextAuth(authOptions);