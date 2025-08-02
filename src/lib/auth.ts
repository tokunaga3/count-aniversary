import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";

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