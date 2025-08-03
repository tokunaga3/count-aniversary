import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // リクエストからカレンダー名を取得
    const requestBody = await req.json();
    const userCalendarName = requestBody.calendarName || '思い出カレンダー';
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const calendar = google.calendar({ version: "v3", auth });
    
    // 既存のカレンダー一覧を取得して重複チェック
    const existingCalendars = await calendar.calendarList.list();
    const existingNames = existingCalendars.data.items?.map(cal => cal.summary) || [];
    
    // カレンダー名の重複チェックとユニーク名の生成
    let finalCalendarName = userCalendarName;
    let counter = 1;
    
    while (existingNames.includes(finalCalendarName)) {
      finalCalendarName = `${userCalendarName} (${counter})`;
      counter++;
      
      // 無限ループ防止（最大100回まで）
      if (counter > 100) {
        // ランダムなサフィックスを付けて確実にユニークにする
        const randomSuffix = randomBytes(4).toString('hex');
        finalCalendarName = `${userCalendarName} (${randomSuffix})`;
        break;
      }
    }
    
    console.log(`カレンダー名決定: 元の名前「${userCalendarName}」→ 最終名前「${finalCalendarName}」`);
    
    // 新しいカレンダーを作成
    const newCalendar = await calendar.calendars.insert({
      requestBody: {
        summary: finalCalendarName,
        description: "思い出と記念日を記録するためのカレンダーです。",
        timeZone: "Asia/Tokyo"
      }
    });

    if (!newCalendar.data.id) {
      throw new Error("カレンダーIDの取得に失敗しました");
    }

    return NextResponse.json({
      message: "カレンダーを作成しました！",
      calendarId: newCalendar.data.id,
      calendarName: newCalendar.data.summary,
      originalName: userCalendarName,
      wasRenamed: finalCalendarName !== userCalendarName
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}