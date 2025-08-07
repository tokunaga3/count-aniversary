import { google } from "googleapis";
import { NextResponse } from "next/server";

// スプレッドシートIDと範囲を環境変数から取得
const SPREADSHEET_ID = process.env.ALLOWED_USERS_SPREADSHEET_ID;
const RANGE = process.env.ALLOWED_USERS_RANGE || 'Sheet1!A:A'; // デフォルトはA列

/**
 * 許可されたユーザーのリストをスプレッドシートから取得
 */
export async function GET() {
  try {
    if (!SPREADSHEET_ID) {
      console.error('ALLOWED_USERS_SPREADSHEET_ID が設定されていません');
      return NextResponse.json({ 
        error: "スプレッドシート設定エラー",
        allowedUsers: [] 
      }, { status: 500 });
    }

    // サービスアカウントキーの設定
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません');
      return NextResponse.json({ 
        error: "認証設定エラー",
        allowedUsers: [] 
      }, { status: 500 });
    }

    // サービスアカウント認証
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // スプレッドシートからデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const values = response.data.values || [];
    
    // メールアドレスのリストを作成（空行や無効なメールアドレスを除外）
    const allowedUsers = values
      .flat()
      .filter(email => email && typeof email === 'string' && email.includes('@'))
      .map(email => email.trim().toLowerCase());

    console.log(`許可されたユーザー数: ${allowedUsers.length}`);

    return NextResponse.json({ 
      success: true,
      allowedUsers,
      count: allowedUsers.length 
    });

  } catch (error) {
    console.error('スプレッドシートからの許可ユーザー取得エラー:', error);
    return NextResponse.json({ 
      error: "スプレッドシートアクセスエラー",
      allowedUsers: [],
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
