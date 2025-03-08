import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { startDate, intervalType, count, comment } = await req.json();
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    let currentDate = new Date(startDate);
    for (let i = 1; i <= count; i++) {
      const event = {
        summary: `🎉 ${i}回目の記念日 🎉`,
        description: comment,
        start: { dateTime: currentDate.toISOString(), timeZone: "Asia/Tokyo" },
        end: {
          dateTime: new Date(currentDate.getTime() + 3600000).toISOString(),
          timeZone: "Asia/Tokyo",
        },
      };

      await calendar.events.insert({
        calendarId: "primary",
        resource: event,
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
