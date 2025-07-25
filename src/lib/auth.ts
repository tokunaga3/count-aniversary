import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";


declare module "next-auth" {
    interface Session {
      accessToken?: string;
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
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      }),
    ],
    callbacks: {
      async signIn({ profile }) {
        if (profile?.email) {
          const allowedEmails = process.env.ALLOWED_GOOGLE_EMAILS?.split(",") || [];
          if (allowedEmails.includes(profile.email)) {
            return true; // 許可されたユーザーのみログイン可
          }
        }
        return false; // その他のユーザーは拒否
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken as string;
        return session;
      },
      async jwt({ token, account }) {
        if (account) {
          token.accessToken = account.access_token!;
        }
        return token;
      },
    },
  };
  
 export const handler = NextAuth(authOptions);