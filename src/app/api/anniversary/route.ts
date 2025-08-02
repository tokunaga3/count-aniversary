import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Vercel configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds (maximum for Vercel hobby plan)

// 日付範囲の記念日を生成する関数
function generateAnniversaries(startDate: string, endDate: string, titleTemplate?: string, description?: string, countType: 'years' | 'months' = 'months'): Array<{
  title: string;
  date: string;
  description?: string;
}> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const anniversaries = [];
  let iteration = 1;

  const current = new Date(start);

  // 年単位か月単位かを判定
  const isYearsOnly = countType === 'years' || 
    (titleTemplate && titleTemplate.includes('{{years}}') && 
     !titleTemplate.includes('{{months}}') && 
     !titleTemplate.includes('{{ym}}') && 
     !titleTemplate.includes('{{count}}'));

  // 最初の記念日日付を設定
  if (isYearsOnly) {
    current.setFullYear(start.getFullYear() + 1);
  } else {
    current.setMonth(start.getMonth() + 1);
  }

  // プレースホルダー置換関数
  const replacePlaceholders = (template: string, iteration: number) => {
    if (isYearsOnly) {
      // 年単位の場合
      return template
        .replace(/\{\{count\}\}/g, iteration.toString())
        .replace(/\{\{years\}\}/g, iteration.toString())
        .replace(/\{\{months\}\}/g, '0')
        .replace(/\{\{ym\}\}/g, `${iteration}年`);
    } else {
      // 月単位の場合
      const years = Math.floor(iteration / 12);
      const months = iteration % 12;
      
      let ymString;
      if (iteration <= 11) {
        ymString = `${iteration}ヶ月`;
      } else {
        if (months === 0) {
          ymString = `${years}年0ヶ月`;
        } else {
          ymString = `${years}年${months}ヶ月`;
        }
      }
      
      return template
        .replace(/\{\{count\}\}/g, iteration.toString())
        .replace(/\{\{years\}\}/g, years.toString())
        .replace(/\{\{months\}\}/g, months.toString())
        .replace(/\{\{ym\}\}/g, ymString);
    }
  };

  while (current <= end) {
    let title;
    if (titleTemplate) {
      if (titleTemplate.includes('{{') && titleTemplate.includes('}}')) {
        title = replacePlaceholders(titleTemplate, iteration);
      } else {
        // 従来の#置換システム（後方互換性）
        const years = Math.floor((iteration - 1) / 12);
        const months = ((iteration - 1) % 12) + 1;
        
        if (titleTemplate.includes("#年##ヶ月")) {
          if (years === 0) {
            title = titleTemplate.replace("#年##ヶ月", `${months}ヶ月`);
          } else {
            title = titleTemplate.replace("#年##ヶ月", `${years}年${months}ヶ月`);
          }
        } else if (titleTemplate.includes("#回目")) {
          title = titleTemplate.replace("#", iteration.toString());
        } else {
          title = titleTemplate.replace("#", isYearsOnly ? `${iteration}年` : `${iteration}回目`);
        }
      }
    } else {
      if (isYearsOnly) {
        title = `🎉 ${iteration}年記念日 🎉`;
      } else {
        title = `🎉 ${iteration}回目の記念日 🎉`;
      }
    }

    anniversaries.push({
      title,
      date: current.toISOString().split('T')[0],
      description: description || ''
    });

    iteration++;
    
    // 次の日付を計算
    if (isYearsOnly) {
      current.setFullYear(current.getFullYear() + 1);
    } else {
      const currentYear = current.getFullYear();
      const currentMonth = current.getMonth();
      const currentDay = current.getDate();
      
      let nextMonth = currentMonth + 1;
      let nextYear = currentYear;
      
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear = currentYear + 1;
      }
      
      current.setFullYear(nextYear);
      current.setMonth(nextMonth);
      current.setDate(currentDay);
      
      // 日付が存在しない場合の調整
      if (current.getMonth() !== nextMonth) {
        current.setDate(0);
      }
    }
  }

  return anniversaries;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 認証エラーがある場合は再認証を促す
  if (session.error === "RefreshAccessTokenError") {
    console.log("リフレッシュトークンエラー - 再認証が必要");
    return NextResponse.json({ 
      error: "auth_expired",
      message: "認証の期限が切れました。再度ログインしてください。" 
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('POST リクエスト受信:', body);
    
    const { action, calendarId, eventTitle, eventDate, description } = body;
    
    if (action === 'create-single') {
      // 単一イベント作成
      if (!calendarId || !eventTitle || !eventDate) {
        return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: "v3", auth });

      const event = {
        summary: eventTitle,
        description: description || "",
        start: {
          date: eventDate,
          timeZone: "Asia/Tokyo",
        },
        end: {
          date: eventDate,
          timeZone: "Asia/Tokyo",
        },
      };

      try {
        const createdEvent = await calendar.events.insert({
          calendarId,
          requestBody: event,
        });

        return NextResponse.json({
          success: true,
          message: "記念日を作成しました",
          eventId: createdEvent.data.id
        });
      } catch (error: unknown) {
        console.error("イベント作成エラー:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // 認証関連のエラーを詳細にチェック
        if (errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401')) {
          console.log("認証エラーを検出 - 再認証が必要");
          return NextResponse.json({ 
            success: false, 
            error: "auth_expired",
            message: "認証が期限切れです。再度ログインしてください。" 
          }, { status: 401 });
        }
        
        // カレンダーが見つからない場合
        if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
          return NextResponse.json({ 
            success: false, 
            error: "calendar_not_found",
            message: `カレンダーID '${calendarId}' が見つかりません。正しいカレンダーIDを確認してください。` 
          }, { status: 404 });
        }
        
        // その他のエラー
        return NextResponse.json({ 
          success: false, 
          error: "event_creation_failed",
          message: "イベントの作成に失敗しました",
          details: errorMessage 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 認証エラーがある場合は再認証を促す
    if (session.error === "RefreshAccessTokenError") {
      console.log("リフレッシュトークンエラー - 再認証が必要");
      return NextResponse.json({ 
        error: "auth_expired",
        message: "認証の期限が切れました。再度ログインしてください。" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    
    // デバッグ用ログ
    console.log('GET リクエスト受信:', {
      url: request.url,
      action,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // 削除対象取得または削除処理
    if (action === "delete") {
      const calendarId = searchParams.get("calendarId");
      const streaming = searchParams.get("streaming") === "true";
      
      if (!calendarId) {
        return NextResponse.json({ error: "カレンダーIDが必要です" }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: "v3", auth });

      let anniversaryEvents: calendar_v3.Schema$Event[] = [];

      try {
        // 記念日イベントを検索
        const eventsResponse = await calendar.events.list({
          calendarId,
          q: "記念日",
          maxResults: 2500,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = eventsResponse.data.items || [];
        anniversaryEvents = events.filter(event => 
          event.summary?.includes("記念日") || 
          event.summary?.includes("anniversary")
        );
      } catch (error: unknown) {
        console.error("Calendar API エラー:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // 認証関連のエラーを詳細にチェック
        if (errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401')) {
          return NextResponse.json({ 
            error: "auth_expired",
            message: "認証が期限切れです。再度ログインしてください。" 
          }, { status: 401 });
        }
        
        // カレンダーが見つからない場合
        if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
          return NextResponse.json({ 
            error: "calendar_not_found",
            message: `カレンダーID '${calendarId}' が見つかりません。` 
          }, { status: 404 });
        }
        
        return NextResponse.json({ 
          error: "calendar_api_error",
          message: "カレンダーAPIでエラーが発生しました",
          details: errorMessage 
        }, { status: 500 });
      }

      // ストリーミング削除処理（後方互換性）
      if (streaming) {
        console.log('SSE形式での削除処理開始');
        
        const encoder = new TextEncoder();
        let deletedCount = 0;
        
        const stream = new ReadableStream({
          async start(controller) {
            let isControllerClosed = false;
            
            const safeEnqueue = (data: Uint8Array) => {
              if (!isControllerClosed) {
                try {
                  controller.enqueue(data);
                } catch (error) {
                  console.error('Controller enqueue error:', error);
                  isControllerClosed = true;
                }
              }
            };
            
            const safeClose = () => {
              if (!isControllerClosed) {
                try {
                  controller.close();
                  isControllerClosed = true;
                } catch (error) {
                  console.error('Controller close error:', error);
                  isControllerClosed = true;
                }
              }
            };
            
            try {
              const eventCount = anniversaryEvents.length;
              
              if (eventCount === 0) {
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'complete', 
                  progress: 100, 
                  message: '削除対象の予定が見つかりませんでした', 
                  deletedCount: 0 
                })}\n\n`));
                safeClose();
                return;
              }

              // 初期進捗
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'progress', 
                progress: 0, 
                message: `削除開始: 0/${eventCount}件`,
                current: 0,
                total: eventCount,
                currentDate: '',
                summary: `${eventCount}件の記念日の削除を開始します`,
                remaining: eventCount
              })}\n\n`));
              
              // 各イベントを削除
              for (let i = 0; i < anniversaryEvents.length; i++) {
                const event = anniversaryEvents[i];
                
                if (event.id) {
                  try {
                    await calendar.events.delete({
                      calendarId,
                      eventId: event.id,
                    });
                    deletedCount++;
                    console.log(`deleted: ${event.summary}`);
                  } catch (deleteError: unknown) {
                    const error = deleteError as { status?: number; code?: number };
                    console.error(`Error deleting event ${event.id}:`, error);
                    
                    // 認証エラーの場合
                    if (error.status === 401 || error.code === 401) {
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'auth_expired',
                        message: '認証が期限切れになりました。再ログインしてください。',
                        processed: deletedCount,
                        total: eventCount
                      })}\n\n`));
                      
                      safeClose();
                      return;
                    }
                  }
                }
                
                // 進捗を送信
                const progress = Math.round(((i + 1) / eventCount) * 100);
                const remaining = eventCount - deletedCount;
                const eventDate = event.start?.dateTime || event.start?.date || '';
                const currentDateStr = eventDate ? new Date(eventDate).toLocaleDateString('ja-JP') : '';
                
                const currentEventTitle = event.summary ? 
                  (event.summary.length > 50 ? event.summary.substring(0, 50) + '...' : event.summary) : 
                  '予定を削除中';
                
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'progress', 
                  progress, 
                  message: `削除中: ${deletedCount}/${eventCount}件`,
                  current: deletedCount,
                  total: eventCount,
                  currentDate: currentDateStr,
                  summary: currentEventTitle,
                  remaining: remaining
                })}\n\n`));
                
                // レート制限対策
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // 完了通知
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                progress: 100, 
                message: `削除完了: ${deletedCount}/${eventCount}件`, 
                current: deletedCount,
                total: eventCount,
                summary: `${deletedCount}件の記念日を削除しました`,
                deletedCount 
              })}\n\n`));
              
              safeClose();
            } catch (error) {
              console.error('削除SSEストリームエラー:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                message: errorMessage
              })}\n\n`));
              safeClose();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // 通常のJSON応答（削除対象リストのみ）
      return NextResponse.json({
        success: true,
        events: anniversaryEvents.map(event => ({
          id: event.id,
          summary: event.summary,
          start: event.start?.date || event.start?.dateTime
        })),
        totalCount: anniversaryEvents.length
      });
    }

    // 単一イベント削除
    if (action === "delete-event") {
      const calendarId = searchParams.get("calendarId");
      const eventId = searchParams.get("eventId");
      
      if (!calendarId || !eventId) {
        return NextResponse.json({ error: "カレンダーIDとイベントIDが必要です" }, { status: 400 });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: session.accessToken });
      const calendar = google.calendar({ version: "v3", auth });

      try {
        await calendar.events.delete({
          calendarId,
          eventId
        });

        return NextResponse.json({ success: true, message: "イベントを削除しました" });
      } catch (error: unknown) {
        console.error("イベント削除エラー:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ 
          success: false, 
          error: "イベントの削除に失敗しました",
          details: errorMessage 
        }, { status: 500 });
      }
    }

    // 記念日生成（リストのみ）または登録処理
    if (action === "generate") {
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const title = searchParams.get("title");
      const description = searchParams.get("comment");
      const streaming = searchParams.get("streaming") === "true";
      const calenderId = searchParams.get("calenderId");

      if (!startDate || !endDate) {
        return NextResponse.json({ error: "開始日と終了日が必要です" }, { status: 400 });
      }

      const anniversaries = generateAnniversaries(
        startDate, 
        endDate, 
        title || undefined, 
        description || undefined
      );
      
      // ストリーミング要求の場合（後方互換性）
      if (streaming && calenderId) {
        console.log('SSE形式での登録処理開始');
        
        const encoder = new TextEncoder();
        let createdCount = 0;
        
        const stream = new ReadableStream({
          async start(controller) {
            let isControllerClosed = false;
            
            const safeEnqueue = (data: Uint8Array) => {
              if (!isControllerClosed) {
                try {
                  controller.enqueue(data);
                } catch (error) {
                  console.error('Controller enqueue error:', error);
                  isControllerClosed = true;
                }
              }
            };
            
            const safeClose = () => {
              if (!isControllerClosed) {
                try {
                  controller.close();
                  isControllerClosed = true;
                } catch (error) {
                  console.error('Controller close error:', error);
                  isControllerClosed = true;
                }
              }
            };
            
            try {
              const auth = new google.auth.OAuth2();
              auth.setCredentials({ access_token: session.accessToken });
              const calendar = google.calendar({ version: "v3", auth });
              
              const totalCount = anniversaries.length;
              
              // 初期進捗
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                progress: 0,
                message: `0/${totalCount}件目を登録中...`,
                current: 0,
                total: totalCount,
                currentDate: '',
                summary: '登録開始',
                remaining: totalCount
              })}\n\n`));
              
              // 各記念日を登録
              for (let i = 0; i < anniversaries.length; i++) {
                const anniversary = anniversaries[i];
                
                try {
                  const event = {
                    summary: anniversary.title,
                    description: anniversary.description || "",
                    start: {
                      date: anniversary.date,
                      timeZone: "Asia/Tokyo",
                    },
                    end: {
                      date: anniversary.date,
                      timeZone: "Asia/Tokyo",
                    },
                  };

                  await calendar.events.insert({
                    calendarId: calenderId,
                    requestBody: event,
                  });
                  
                  createdCount++;
                  
                  const progress = Math.round((createdCount / totalCount) * 100);
                  const remaining = totalCount - createdCount;
                  
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'progress',
                    progress,
                    message: `${createdCount}/${totalCount}件目を登録中...`,
                    current: createdCount,
                    total: totalCount,
                    currentDate: new Date(anniversary.date).toLocaleDateString('ja-JP'),
                    summary: anniversary.title,
                    remaining: remaining
                  })}\n\n`));
                  
                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  console.error(`イベント作成エラー: ${anniversary.title}`, errorMessage);
                  
                  // 認証エラーの場合は処理を中断
                  if (errorMessage.includes('auth')) {
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'error',
                      error: 'auth_expired',
                      message: '認証が期限切れになりました。再ログインしてください。',
                      processed: createdCount,
                      total: totalCount
                    })}\n\n`));
                    
                    safeClose();
                    return;
                  }
                }
                
                // レート制限対策
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // 完了メッセージ
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                message: '登録完了！',
                createdCount
              })}\n\n`));
              
              safeClose();
              
            } catch (error) {
              console.error('SSE stream error:', error);
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: 'エラーが発生しました',
                error: (error as Error).message
              })}\n\n`));
              safeClose();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
          },
        });
      }
      
      // 通常のJSON応答（リストのみ）
      return NextResponse.json({
        success: true,
        anniversaries,
        totalCount: anniversaries.length
      });
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });

  } catch (error: unknown) {
    console.error("API エラー:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: "サーバーエラーが発生しました",
      details: errorMessage 
    }, { status: 500 });
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