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
    const { endDate, comment, calenderId: calendarId, startDate, title} = await req.json();
    console.log('Received data:', { endDate, comment, calendarId, startDate, title });
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const start = startDate + 'T00:00:00.285Z'
    const end = endDate + 'T23:59:59.999Z'
    const calendar = google.calendar({ version: "v3", auth });
    
    const currentDate = new Date(new Date(start).getTime() - 9 * 60 * 60 * 1000);
    const endDateTime = new Date(new Date(end).getTime() - 9 * 60 * 60 * 1000);
    let eventTitle;
    let iteration = 1;
    
    // プレースホルダー置換関数
    const replacePlaceholders = (template: string, iteration: number) => {
      // 月単位の場合
      const years = Math.floor(iteration / 12);
      const months = iteration % 12;
      
      // ymString の生成
      let ymString;
      if (iteration <= 11) {
        // 11ヶ月以下の場合は「Xヶ月」
        ymString = `${iteration}ヶ月`;
      } else {
        // 12ヶ月以上の場合は「X年Yヶ月」
        if (months === 0) {
          ymString = `${years}年0ヶ月`;
        } else {
          ymString = `${years}年${months}ヶ月`;
        }
      }
      
      console.log(`Iteration ${iteration}: years=${years}, months=${months}, ymString=${ymString}`);
      
      // years と months の値を決定
      let yearsValue, monthsValue;
      if (iteration <= 11) {
        // 11ヶ月以下の場合
        yearsValue = '0';  // 0年
        monthsValue = iteration.toString();  // 実際の月数
      } else {
        // 12ヶ月以上の場合
        yearsValue = years.toString();
        monthsValue = months.toString();
      }
      
      return template
        .replace(/\{\{count\}\}/g, iteration.toString())
        .replace(/\{\{years\}\}/g, yearsValue)
        .replace(/\{\{months\}\}/g, monthsValue)
        .replace(/\{\{ym\}\}/g, ymString);
    };
    
    
    // 終了日付に達するまで月単位でループ
    while (currentDate <= endDateTime) {
      console.log('Generating title for iteration:', iteration);
      console.log('Current title template:', title);
      console.log('Current date:', currentDate.toISOString());
      console.log('End date:', endDateTime.toISOString());
      
      if (title === null || title === undefined || title.trim() === '') {
        // タイトルが指定されていない場合のデフォルト（月単位）
        const years = Math.floor((iteration - 1) / 12);
        const months = ((iteration - 1) % 12) + 1;
        eventTitle = years === 0 
          ? `🎉 ${months}ヶ月目の記念日 🎉`
          : `🎉 ${years}年${months}ヶ月目の記念日 🎉`;
      } else {
        // 新しいプレースホルダーシステムを使用
        if (title.includes('{{') && title.includes('}}')) {
          eventTitle = replacePlaceholders(title, iteration);
        } else {
          // 従来の#置換システム（後方互換性のため残す）
          const years = Math.floor((iteration - 1) / 12);
          const months = ((iteration - 1) % 12) + 1;
          
          if (title.includes("#年##ヶ月")) {
            if (years === 0) {
              eventTitle = title.replace("#年##ヶ月", `${months}ヶ月`);
            } else {
              eventTitle = title.replace("#年##ヶ月", `${years}年${months}ヶ月`);
            }
          } else if (title.includes("#回目")) {
            eventTitle = title.replace("#", iteration.toString());
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

      // 月単位で日付を進める（より確実な方法）
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentDay = currentDate.getDate();
      
      // 次の月の同じ日を計算
      let nextMonth = currentMonth + 1;
      let nextYear = currentYear;
      
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear = currentYear + 1;
      }
      
      // 次の日付を設定
      currentDate.setFullYear(nextYear);
      currentDate.setMonth(nextMonth);
      currentDate.setDate(currentDay);
      
      // 日付が存在しない場合（例：1/31の次の月が2/31になってしまう場合）の調整
      if (currentDate.getMonth() !== nextMonth) {
        // 月末日に調整
        currentDate.setDate(0);
      }
      
      iteration++;
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