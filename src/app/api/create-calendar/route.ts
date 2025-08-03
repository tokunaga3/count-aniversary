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
    
    // ユーザーが指定した名前を使用
    const calendarName = `${userCalendarName}`;
    
    // 新しいカレンダーを作成
    const newCalendar = await calendar.calendars.insert({
      requestBody: {
        summary: calendarName,
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
      calendarName: newCalendar.data.summary
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}