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
    const { count, comment, calenderId: calendarId, startDate, title} = await req.json();
    console.log('Received data:', { count, comment, calendarId, startDate, title });
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const start = startDate + 'T00:00:00.285Z'
    const calendar = google.calendar({ version: "v3", auth });
    
    const currentDate = new Date(new Date(start).getTime() - 9 * 60 * 60 * 1000);
    let eventTitle;
    
    // プレースホルダー置換関数
    const replacePlaceholders = (template: string, iteration: number) => {
      // 月単位の場合
      const years = Math.floor((iteration - 1) / 12);
      const months = (iteration - 1) % 12 + 1;
      
      // ymString の生成
      let ymString;
      if (iteration <= 12) {
        // 12ヶ月以下の場合は「Xヶ月」
        ymString = `${iteration}ヶ月`;
      } else {
        // 13ヶ月以上の場合は「X年Yヶ月」
        const remainingMonths = (iteration - 1) % 12 + 1;
        ymString = `${years}年${remainingMonths}ヶ月`;
      }
      
      console.log(`Iteration ${iteration}: years=${years}, months=${months}, ymString=${ymString}`);
      
      // years と months の値を決定
      let yearsValue, monthsValue;
      if (iteration <= 12) {
        // 12ヶ月以下の場合
        yearsValue = '0';  // 0年
        monthsValue = iteration.toString();  // 実際の月数
      } else {
        // 13ヶ月以上の場合
        yearsValue = years.toString();
        monthsValue = ((iteration - 1) % 12 + 1).toString();
      }
      
      return template
        .replace(/\{\{count\}\}/g, iteration.toString())
        .replace(/\{\{years\}\}/g, yearsValue)
        .replace(/\{\{months\}\}/g, monthsValue)
        .replace(/\{\{ym\}\}/g, ymString);
    };
    
    for (let i = 1; i <= count; i++) {
      console.log('Generating title for iteration:', i);
      console.log('Current title template:', title);
      
      if (title === null || title === undefined || title.trim() === '') {
        // タイトルが指定されていない場合のデフォルト（月単位）
        const years = Math.floor((i - 1) / 12);
        const months = ((i - 1) % 12) + 1;
        eventTitle = years === 0 
          ? `🎉 ${months}ヶ月目の記念日 🎉`
          : `🎉 ${years}年${months}ヶ月目の記念日 🎉`;
      } else {
        // 新しいプレースホルダーシステムを使用
        if (title.includes('{{') && title.includes('}}')) {
          eventTitle = replacePlaceholders(title, i);
        } else {
          // 従来の#置換システム（後方互換性のため残す）
          const years = Math.floor((i - 1) / 12);
          const months = ((i - 1) % 12) + 1;
          
          if (title.includes("#年##ヶ月")) {
            if (years === 0) {
              eventTitle = title.replace("#年##ヶ月", `${months}ヶ月`);
            } else {
              eventTitle = title.replace("#年##ヶ月", `${years}年${months}ヶ月`);
            }
          } else if (title.includes("#回目")) {
            eventTitle = title.replace("#", i.toString());
          } else {
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

      // 月単位で日付を進める
      const newMonth = currentDate.getMonth() + 1;
      currentDate.setMonth(newMonth);
      if (newMonth > 11) {
        currentDate.setFullYear(currentDate.getFullYear() + Math.floor(newMonth / 12));
        currentDate.setMonth(newMonth % 12);
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