import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = 'nodejs';
export const maxDuration = 60;

type GeneratedEvent = {
  title: string;
  startDateTime: string; // ISO string with timezone offset or Z
  endDateTime: string; // ISO
  description?: string;
};

const DEFAULT_HOLIDAY_CAL_ID = process.env.JAPANESE_HOLIDAY_CALENDAR_ID || 'ja.japanese#holiday@group.v.calendar.google.com';

function parseTimeRange(timeRange: string): { start: string; end: string } {
  // timeRange example: "10:00-11:00"
  const m = timeRange.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!m) throw new Error('time の形式は HH:MM-HH:MM で指定してください');
  return { start: m[1], end: m[2] };
}

function getNextWeekdayOnOrAfter(date: Date, weekday: number): Date {
  // weekday: 0=Sun..6=Sat
  const d = new Date(date);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

async function fetchHolidayDates(authToken: string, start: Date, end: Date): Promise<Set<string>> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: authToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)).toISOString();
  const res = await calendar.events.list({
    calendarId: DEFAULT_HOLIDAY_CAL_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 2500,
    orderBy: 'startTime',
  });
  const set = new Set<string>();
  for (const ev of res.data.items || []) {
    // 日本の祝日は終日イベントなので start.date が基本
    if (ev.start?.date) {
      set.add(ev.start.date);
    } else if (ev.start?.dateTime) {
      // 念のため dateTime の場合もサポート（UTC基準で日付を抽出）
      set.add(new Date(ev.start.dateTime).toISOString().split('T')[0]);
    }
  }
  return set;
}

// JST(+09:00)でのローカル時刻を明示的に作る（サーバーのタイムゾーンに影響されない）
function toJstDateTime(date: Date, timeHHMM: string): string {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(hh).padStart(2, '0');
  const mi = String(mm).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mi}:00+09:00`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json({ error: 'auth_expired', message: '認証の期限が切れました。再度ログインしてください。' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'generate') {
      const startDateStr = searchParams.get('startDate');
      const endDateStr = searchParams.get('endDate');
      const weekdayStr = searchParams.get('weekday'); // 0-6 (Sun-Sat) or label
      const time = searchParams.get('time'); // HH:MM-HH:MM
      const title = searchParams.get('title') || '隔週予定';
      const description = searchParams.get('comment') || '';
      const skipHolidays = (searchParams.get('skipHolidays') || 'false') === 'true';

      if (!startDateStr || !endDateStr || !weekdayStr || !time) {
        return NextResponse.json({ error: 'startDate, endDate, weekday, time が必要です' }, { status: 400 });
      }

      const { start, end } = parseTimeRange(time);
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: '日付の形式が不正です' }, { status: 400 });
      }

      let weekday: number;
      if (/^\d$/.test(weekdayStr)) {
        weekday = parseInt(weekdayStr, 10);
      } else {
        const key = weekdayStr.toLowerCase();
        const map: Record<string, number> = {
          sun: 0, sunday: 0, '日': 0,
          mon: 1, monday: 1, '月': 1,
          tue: 2, tuesday: 2, '火': 2,
          wed: 3, wednesday: 3, '水': 3,
          thu: 4, thursday: 4, '木': 4,
          fri: 5, friday: 5, '金': 5,
          sat: 6, saturday: 6, '土': 6,
        };
        weekday = map[key] ?? 1; // default Monday
      }

      // 祝日取得
      const holidaySet = skipHolidays ? await fetchHolidayDates(session.accessToken as string, startDate, endDate) : new Set<string>();

      // 最初の対象曜日
      let cursor = getNextWeekdayOnOrAfter(startDate, weekday);
      const events: GeneratedEvent[] = [];

      while (cursor <= endDate) {
        const yyyyMMdd = cursor.toISOString().split('T')[0];
        const isHoliday = holidaySet.has(yyyyMMdd);

        if (!skipHolidays || !isHoliday) {
          events.push({
            title,
            startDateTime: toJstDateTime(cursor, start),
            endDateTime: toJstDateTime(cursor, end),
            description,
          });
        }

        // 2週間後へ
        const next = new Date(cursor);
        next.setDate(next.getDate() + 14);
        cursor = next;
      }

      return NextResponse.json({ success: true, events, totalCount: events.length });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Biweekly API GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'server_error', message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.error === 'RefreshAccessTokenError') {
    return NextResponse.json({ error: 'auth_expired', message: '認証の期限が切れました。再度ログインしてください。' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body || {};

    if (action === 'create-single') {
      const { calendarId, event } = body as { calendarId?: string; event?: GeneratedEvent };
      if (!calendarId || !event) {
        return NextResponse.json({ error: 'calendarId と event が必要です' }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: 'v3', auth });

      try {
        const requestBody: calendar_v3.Schema$Event = {
          summary: event.title,
          description: event.description || '',
          start: { dateTime: event.startDateTime, timeZone: 'Asia/Tokyo' },
          end: { dateTime: event.endDateTime, timeZone: 'Asia/Tokyo' },
        };
        const created = await calendar.events.insert({ calendarId, requestBody });
        return NextResponse.json({ success: true, eventId: created.data.id });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('Invalid Credentials') || msg.includes('401') || msg.includes('unauthorized')) {
          return NextResponse.json({ success: false, error: 'auth_expired', message: '認証が期限切れです。再度ログインしてください。' }, { status: 401 });
        }
        if (msg.includes('Not Found') || msg.includes('404')) {
          return NextResponse.json({ success: false, error: 'calendar_not_found', message: 'カレンダーが見つかりません' }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: 'event_creation_failed', message: msg }, { status: 500 });
      }
    }

    if (action === 'create-batch') {
      const { calendarId, events } = body as { calendarId?: string; events?: GeneratedEvent[] };
      if (!calendarId || !Array.isArray(events)) {
        return NextResponse.json({ error: 'calendarId と events 配列が必要です' }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: 'v3', auth });

      const results: Array<{ index: number; success: boolean; id?: string; error?: string }> = [];
      let createdCount = 0;

      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        try {
          const requestBody: calendar_v3.Schema$Event = {
            summary: e.title,
            description: e.description || '',
            // dateTime に +09:00 を含めているため timeZone 指定は省略
            start: { dateTime: e.startDateTime },
            end: { dateTime: e.endDateTime },
          };
          const created = await calendar.events.insert({ calendarId, requestBody });
          results.push({ index: i, success: true, id: created.data.id || undefined });
          createdCount++;
          await new Promise((r) => setTimeout(r, 100));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (msg.includes('Invalid Credentials') || msg.includes('401') || msg.includes('unauthorized')) {
            return NextResponse.json({ success: false, error: 'auth_expired', message: '認証が期限切れです。再度ログインしてください。', createdCount, results }, { status: 401 });
          }
          results.push({ index: i, success: false, error: msg });
        }
      }

      return NextResponse.json({ success: true, createdCount, totalCount: events.length, results });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Biweekly API POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'server_error', message: errorMessage }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
