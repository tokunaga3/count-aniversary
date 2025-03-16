import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { intervalType, count, comment, calenderId, startDate, title} = await req.json();
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    console.log(startDate);
    const start = startDate + 'T00:00:00.285Z'
    const calendar = google.calendar({ version: "v3", auth });
    const currentDate = new Date(new Date(start).getTime() - 9 * 60 * 60 * 1000);
    for (let i = 1; i <= count; i++) {
      const eventTitle = title ? title.replace("#", i.toString()) : `🎉 ${i}回目の記念日 🎉`;
      const event = {
        summary: eventTitle,
        description: comment,
        start: { dateTime: currentDate.toISOString(), timeZone: "Asia/Tokyo" },
        end: {
          dateTime: new Date(currentDate.getTime() + 3600000).toISOString(),
          timeZone: "Asia/Tokyo",
        },
      };

      calendar.events.insert({
        calendarId: calenderId || "primary",
        requestBody: event,
      });

      if (intervalType === "yearly") {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return NextResponse.json({
      message: "記念日をGoogleカレンダーに追加しました！",
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}