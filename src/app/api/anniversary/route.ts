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
    const { intervalType, count, comment, calenderId: calendarId, startDate, title} = await req.json();
    console.log('Received data:', { intervalType, count, comment, calendarId, startDate, title });
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const start = startDate + 'T00:00:00.285Z'
    const calendar = google.calendar({ version: "v3", auth });
    
    const currentDate = new Date(new Date(start).getTime() - 9 * 60 * 60 * 1000);
    let eventTitle;
    for (let i = 1; i <= count; i++) {
      console.log('Generating title for iteration:', i);
      console.log('Current title template:', title);
      
      if (title === null || title === undefined) {
        // タイトルが指定されていない場合のデフォルト
        if (intervalType === "yearly") {
          eventTitle = `🎉 ${i}回目の記念日 🎉`;
        } else if (intervalType === "monthly") {
          const years = Math.floor((i - 1) / 12);
          const months = ((i - 1) % 12) + 1;
          eventTitle = years === 0 
            ? `🎉 ${months}ヶ月目の記念日 🎉`
            : `🎉 ${years}年${months}ヶ月目の記念日 🎉`;
        }
      } else {
        if (intervalType === "yearly") {
          // 年単位の場合は単純に#を回数に置換
          eventTitle = title.replace("#", i.toString());
        } else {
          // 月数から年と月を計算
          const years = Math.floor((i - 1) / 12);
          const months = ((i - 1) % 12) + 1;
          
          if (title.includes("#年##ヶ月")) {
            // "付き合った記念日#年##ヶ月" のようなフォーマットの場合
            if (years === 0) {
              eventTitle = title.replace("#年##ヶ月", `${months}ヶ月`);
            } else {
              eventTitle = title.replace("#年##ヶ月", `${years}年${months}ヶ月`);
            }
          } else if (title.includes("#回目")) {
            // "🎉 #回目の記念日 🎉" のようなフォーマットの場合
            eventTitle = title.replace("#", i.toString());
          } else {
            // 通常の#置換の場合
            if (years === 0) {
              eventTitle = title.replace("#", `${months}ヶ月`);
            } else {
              eventTitle = title.replace("#", `${years}年${months}ヶ月`);
            }
          }
        }
      }
      
      console.log('Generated title:', eventTitle);

      const event = {
        summary: eventTitle,
        description: comment,
        start: { dateTime: currentDate.toISOString(), timeZone: "Asia/Tokyo" },
        end: {
          dateTime: new Date(currentDate.getTime() + 3600000).toISOString(),
          timeZone: "Asia/Tokyo",
        },
      };
      console.log(event)
      await calendar.events.insert({
        calendarId: calendarId || "primary",
        requestBody: event,
      });

      if (intervalType === "yearly") {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else {
        const newMonth = currentDate.getMonth() + 1;
        currentDate.setMonth(newMonth);
        if (newMonth > 11) {
          currentDate.setFullYear(currentDate.getFullYear() + Math.floor(newMonth / 12));
          currentDate.setMonth(newMonth % 12);
        }
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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: "Calendar ID is required" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    // カレンダーIDに関連する全てのイベントを取得
    const eventsRes = await calendar.events.list({
      calendarId,
      timeMin: new Date('1000/1/1').toISOString(),
      timeMax: new Date('9999/12/31').toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500, // 一応最大数
    });
    
    const events = eventsRes.data.items || [];
    
    for (const event of events) {
      if (event.id) {
        await calendar.events.delete({
          calendarId,
          eventId: event.id,
        });
      }
      console.log(`deleted: ${event.summary}`)
    }
    
    return NextResponse.json({
      message: "記念日を削除しました！",
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}