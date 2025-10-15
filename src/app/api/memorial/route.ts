import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Vercel configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds (maximum for Vercel hobby plan)

type GeneratedEvent = {
  title: string;
  date: string; // YYYY-MM-DD (all-day)
  description?: string;
};

// 法要名の定義
// 一周忌までの7日毎（初七日〜四十九日）は「○日目」をベースに前日実施の慣習に合わせて
// 6,13,20,27,34,41,48日後で予定を作成（SYSTEM_REQUIREMENTS に準拠）
const DAY_MEMORIALS: Array<{ days: number; name: string }> = [
  { days: 0, name: '命日' },
  { days: 6, name: '初七日' },
  { days: 13, name: '二七日' },
  { days: 20, name: '三七日' },
  { days: 27, name: '四七日' },
  { days: 34, name: '五七日（三十五日忌）' },
  { days: 41, name: '六七日' },
  { days: 48, name: '七七日（四十九日）' },
  { days: 99, name: '百か日' },
];

const YEAR_MEMORIALS: Array<{ years: number; name: string }> = [
  { years: 1, name: '一周忌' },
  { years: 2, name: '三回忌' },
  { years: 6, name: '七回忌' },
  { years: 12, name: '十三回忌' },
  { years: 16, name: '十七回忌' },
  { years: 22, name: '二十三回忌' },
  { years: 26, name: '二十七回忌' },
  { years: 32, name: '三十三回忌（忌い上げ）' },
  { years: 36, name: '三十七回忌' },
  { years: 49, name: '五十回忌' },
];

function toDateOnlyString(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function replaceMemorialPlaceholders(
  template: string,
  params: { houyou: string; year: number; baseDate: string }
): string {
  return template
    .replace(/\{\{houyou\}\}/g, params.houyou)
    .replace(/\{\{year\}\}/g, String(params.year))
    .replace(/\{\{base_date\}\}/g, params.baseDate);
}

// 命日から法要イベントを生成
function generateMemorials(
  baseDate: string,
  options?: { untilYears?: number; includeBase?: boolean; titleTemplate?: string; description?: string }
): GeneratedEvent[] {
  const base = new Date(baseDate);
  if (isNaN(base.getTime())) {
    throw new Error('baseDate が不正です');
  }

  const untilYears = options?.untilYears ?? 49; // 五十回忌まで（49年後）
  const includeBase = options?.includeBase ?? true;
  const titleTemplate = options?.titleTemplate;
  const description = options?.description || '';

  const events: GeneratedEvent[] = [];

  // 日数ベースの法要
  for (const { days, name } of DAY_MEMORIALS) {
    if (days === 0 && !includeBase) continue;
    const date = addDays(base, days);
    const yearsFromBase = 0; // 日数法要の {{year}} は 0 とする
    const title = titleTemplate
      ? replaceMemorialPlaceholders(titleTemplate, {
          houyou: name,
          year: yearsFromBase,
          baseDate: toDateOnlyString(base),
        })
      : name;

    events.push({ title, date: toDateOnlyString(date), description });
  }

  // 年数ベースの法要（上限まで）
  for (const { years, name } of YEAR_MEMORIALS) {
    if (years > untilYears) continue;
    const date = addYears(base, years);
    const title = titleTemplate
      ? replaceMemorialPlaceholders(titleTemplate, {
          houyou: name,
          year: years,
          baseDate: toDateOnlyString(base),
        })
      : name;
    events.push({ title, date: toDateOnlyString(date), description });
  }

  // 日付順に整列
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json({ 
        error: "auth_expired",
        message: "認証の期限が切れました。再度ログインしてください。" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'generate') {
      const baseDate = searchParams.get('baseDate');
      const titleTemplate = searchParams.get('title') || undefined;
      const description = searchParams.get('comment') || undefined;
      const includeBase = (searchParams.get('includeBase') ?? 'true') === 'true';
      const untilYears = parseInt(searchParams.get('untilYears') || '49', 10);

      if (!baseDate) {
        return NextResponse.json({ error: 'baseDate が必要です' }, { status: 400 });
      }

      const events = generateMemorials(baseDate, {
        titleTemplate,
        description,
        includeBase,
        untilYears: isNaN(untilYears) ? 49 : untilYears,
      });

      return NextResponse.json({ success: true, events, totalCount: events.length });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Memorial API GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'server_error', message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ 
      error: "auth_expired",
      message: "認証の期限が切れました。再度ログインしてください。" 
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body || {};

    if (action === 'create-single') {
      const { calendarId, eventTitle, eventDate, description } = body;
      if (!calendarId || !eventTitle || !eventDate) {
        return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: "v3", auth });

      const event: calendar_v3.Schema$Event = {
        summary: eventTitle,
        description: description || "",
        start: { date: eventDate, timeZone: "Asia/Tokyo" },
        end: { date: eventDate, timeZone: "Asia/Tokyo" },
      };

      try {
        const createdEvent = await calendar.events.insert({
          calendarId,
          requestBody: event,
        });

        return NextResponse.json({
          success: true,
          message: "法要を作成しました",
          eventId: createdEvent.data.id,
        });
      } catch (error: unknown) {
        console.error("Memorial create-single error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401')) {
          return NextResponse.json({ 
            success: false, 
            error: "auth_expired",
            message: "認証が期限切れです。再度ログインしてください。" 
          }, { status: 401 });
        }
        if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
          return NextResponse.json({ 
            success: false, 
            error: "calendar_not_found",
            message: `カレンダーID '${calendarId}' が見つかりません。正しいカレンダーIDを確認してください。` 
          }, { status: 404 });
        }
        return NextResponse.json({ 
          success: false, 
          error: "event_creation_failed",
          message: "イベントの作成に失敗しました",
          details: errorMessage 
        }, { status: 500 });
      }
    }

    if (action === 'create-batch') {
      const { calendarId, events } = body as { calendarId?: string; events?: GeneratedEvent[] };
      if (!calendarId || !Array.isArray(events)) {
        return NextResponse.json({ error: "calendarId と events 配列が必要です" }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: "v3", auth });

      const results: Array<{ index: number; success: boolean; id?: string; error?: string }> = [];
      let createdCount = 0;

      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        try {
          const requestBody: calendar_v3.Schema$Event = {
            summary: e.title,
            description: e.description || "",
            start: { date: e.date, timeZone: "Asia/Tokyo" },
            end: { date: e.date, timeZone: "Asia/Tokyo" },
          };
          const created = await calendar.events.insert({ calendarId, requestBody });
          results.push({ index: i, success: true, id: created.data.id || undefined });
          createdCount++;
          await new Promise((r) => setTimeout(r, 100)); // レート制限対策
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          // 認証エラーはその場で返す
          if (msg.includes('Invalid Credentials') || msg.includes('401') || msg.includes('unauthorized')) {
            return NextResponse.json({ 
              success: false, 
              error: 'auth_expired', 
              message: '認証が期限切れです。再度ログインしてください。',
              createdCount,
              results,
            }, { status: 401 });
          }
          results.push({ index: i, success: false, error: msg });
        }
      }

      return NextResponse.json({ success: true, createdCount, totalCount: events.length, results });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Memorial API POST error:', error);
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
