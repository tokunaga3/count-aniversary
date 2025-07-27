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
    
    // タイトルに{{years}}のみが含まれているかチェック
    const isYearsOnly = title && title.includes('{{years}}') && 
                       !title.includes('{{months}}') && 
                       !title.includes('{{ym}}') && 
                       !title.includes('{{count}}');
    
    // プレースホルダー置換関数
    const replacePlaceholders = (template: string, iteration: number, isYearly = false) => {
      if (isYearly) {
        // 年単位の場合
        return template
          .replace(/\{\{count\}\}/g, iteration.toString())
          .replace(/\{\{years\}\}/g, iteration.toString())
          .replace(/\{\{months\}\}/g, '0')
          .replace(/\{\{ym\}\}/g, `${iteration}年`);
      } else {
        // 月単位の場合（従来通り）
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
      }
    };
    
    
    // 終了日付に達するまでループ（年単位または月単位）
    while (currentDate <= endDateTime) {
      console.log('Generating title for iteration:', iteration);
      console.log('Current title template:', title);
      console.log('Current date:', currentDate.toISOString());
      console.log('End date:', endDateTime.toISOString());
      
      if (title === null || title === undefined || title.trim() === '') {
        // タイトルが指定されていない場合のデフォルト
        if (isYearsOnly) {
          eventTitle = `🎉 ${iteration}年目の記念日 🎉`;
        } else {
          const years = Math.floor((iteration - 1) / 12);
          const months = ((iteration - 1) % 12) + 1;
          eventTitle = years === 0 
            ? `🎉 ${months}ヶ月目の記念日 🎉`
            : `🎉 ${years}年${months}ヶ月目の記念日 🎉`;
        }
      } else {
        // 新しいプレースホルダーシステムを使用
        if (title.includes('{{') && title.includes('}}')) {
          eventTitle = replacePlaceholders(title, iteration, isYearsOnly);
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

      // 日付を進める
      if (isYearsOnly) {
        // 年単位の場合：1年進める
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else {
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const comment = searchParams.get('comment');
    const calenderId = searchParams.get('calenderId');
    const title = searchParams.get('title');
    const streaming = searchParams.get('streaming') === 'true';

    if (!startDate || !endDate || !calenderId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!streaming) {
      return NextResponse.json({ error: "Only streaming mode supported" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const start = startDate + 'T00:00:00.285Z'
    const end = endDate + 'T23:59:59.999Z'
    const calendar = google.calendar({ version: "v3", auth });
    
    const encoder = new TextEncoder();
    let createdCount = 0;
    
      const stream = new ReadableStream({
        async start(controller) {
          let isControllerClosed = false;
          
          // コントローラーが閉じられたかどうかをチェックする関数
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
          
          // コントローラーが閉じられたかをチェックして安全に close する関数
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
            console.log('Starting SSE stream for registration');
            console.log('Parameters received:', { startDate, endDate, calenderId, title });
            
            const currentDate = new Date(new Date(start).getTime() - 9 * 60 * 60 * 1000);
            const endDateTime = new Date(new Date(end).getTime() - 9 * 60 * 60 * 1000);
            let iteration = 1;
            
            // タイトルに{{years}}のみが含まれているかチェック
            const isYearsOnly = title && title.includes('{{years}}') && 
                               !title.includes('{{months}}') && 
                               !title.includes('{{ym}}') && 
                               !title.includes('{{count}}');
            
            // 総数を計算
            const startDateTime = new Date(startDate);
            const endDateTimeCalc = new Date(endDate);
            let totalCount;
            
            if (isYearsOnly) {
              // 年単位の場合
              totalCount = endDateTimeCalc.getFullYear() - startDateTime.getFullYear() + 1;
            } else {
              // 月単位の場合
              totalCount = (endDateTimeCalc.getFullYear() - startDateTime.getFullYear()) * 12 + 
                          (endDateTimeCalc.getMonth() - startDateTime.getMonth()) + 1;
            }
            
            console.log(`Total events to create: ${totalCount} (${isYearsOnly ? 'yearly' : 'monthly'})`);
            
            // プレースホルダー置換関数
            const replacePlaceholders = (template: string, iteration: number, isYearly = false) => {
              if (isYearly) {
                // 年単位の場合
                return template
                  .replace(/\{\{count\}\}/g, iteration.toString())
                  .replace(/\{\{years\}\}/g, iteration.toString())
                  .replace(/\{\{months\}\}/g, '0')
                  .replace(/\{\{ym\}\}/g, `${iteration}年`);
              } else {
                // 月単位の場合（従来通り）
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
          
          while (currentDate <= endDateTime) {
            try {
              let eventTitle;
              if (title && title.trim() !== '') {
                eventTitle = replacePlaceholders(title, iteration, !!isYearsOnly);
              } else {
                if (isYearsOnly) {
                  eventTitle = `🎉 ${iteration}年目の記念日 🎉`;
                } else {
                  eventTitle = `🎉 ${iteration}回目の記念日 🎉`;
                }
              }
              
              const eventStartTime = currentDate.toISOString();
              const eventEndTime = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
              
              const event = {
                summary: eventTitle,
                description: comment || '',
                start: {
                  dateTime: eventStartTime,
                  timeZone: 'Asia/Tokyo',
                },
                end: {
                  dateTime: eventEndTime,
                  timeZone: 'Asia/Tokyo',
                },
              };
              
              try {
                await calendar.events.insert({
                  calendarId: calenderId,
                  requestBody: event,
                });
                
                createdCount++;
              } catch (insertError: unknown) {
                const error = insertError as { status?: number; code?: number };
                console.error(`Error creating event ${iteration + 1}:`, error);
                
                // 認証エラーの場合
                if (error.status === 401 || error.code === 401) {
                  console.log('Authentication error detected, sending error to client');
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
                
                // その他のエラーの場合、3回まで再試行
                let retryCount = 0;
                const maxRetries = 3;
                let retrySuccess = false;
                
                while (retryCount < maxRetries && !retrySuccess) {
                  retryCount++;
                  console.log(`Retrying event ${iteration + 1}, attempt ${retryCount}/${maxRetries}`);
                  
                  try {
                    // 1秒待機してから再試行
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await calendar.events.insert({
                      calendarId: calenderId,
                      requestBody: event,
                    });
                    
                    retrySuccess = true;
                    createdCount++;
                    console.log(`Event ${iteration + 1} created successfully on retry ${retryCount}`);
                  } catch (retryError: unknown) {
                    const retryErr = retryError as { status?: number; code?: number };
                    console.error(`Retry ${retryCount} failed for event ${iteration + 1}:`, retryErr);
                    
                    if (retryErr.status === 401 || retryErr.code === 401) {
                      console.log('Authentication error on retry, aborting');
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
                }
                
                if (!retrySuccess) {
                  console.log(`Failed to create event ${iteration + 1} after ${maxRetries} retries, continuing with next event`);
                  // 失敗したイベントをスキップして続行
                }
              }
              
              const progress = Math.round((createdCount / totalCount) * 100);
              const remaining = totalCount - createdCount;
              
              console.log(`Sending progress: ${createdCount}/${totalCount} (${progress}%)`);
              
              // 進捗データを送信
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                progress,
                message: `${createdCount}/${totalCount}件目を登録中...`,
                current: createdCount,
                total: totalCount,
                currentDate: currentDate.toLocaleDateString('ja-JP'),
                summary: eventTitle,
                remaining: remaining
              })}\n\n`));
              
              console.log(`Progress sent successfully for event ${createdCount}`);
              
              // 日付を進める
              if (isYearsOnly) {
                // 年単位の場合：1年進める
                currentDate.setFullYear(currentDate.getFullYear() + 1);
              } else {
                // 月単位の場合：1ヶ月進める
                currentDate.setMonth(currentDate.getMonth() + 1);
              }
              iteration++;
              
              // レート制限対策
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (eventError) {
              console.error(`Error creating event ${iteration}:`, eventError);
              // エラーが発生してもスキップして続行
              if (isYearsOnly) {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
              } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
              }
              iteration++;
            }
          }
          
          // 完了メッセージを送信
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
    const streaming = searchParams.get('streaming') === 'true';

    if (!calendarId) {
      return NextResponse.json({ error: "Calendar ID is required" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    // ストリーミング対応の場合
    if (streaming) {
      const encoder = new TextEncoder();
      let deletedCount = 0;
      
      const stream = new ReadableStream({
        async start(controller) {
          let isControllerClosed = false;
          
          // コントローラーが閉じられたかどうかをチェックする関数
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
          
          // コントローラーが閉じられたかをチェックして安全に close する関数
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
            console.log('Starting SSE stream for calendar:', calendarId);
            
            // 初期メッセージを送信
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              progress: 5, 
              message: '認証を確認中...' 
            })}\n\n`));

            // カレンダーIDに関連する全てのイベントを取得
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              progress: 10, 
              message: '削除対象の予定を検索中...' 
            })}\n\n`));

            const eventsRes = await calendar.events.list({
              calendarId,
              timeMin: new Date('1000/1/1').toISOString(),
              timeMax: new Date('9999/12/31').toISOString(),
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 2500,
            });
            
            const events = eventsRes.data.items || [];
            const eventCount = events.length;
            
            console.log(`Found ${eventCount} events to delete`);
            
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

            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress', 
              progress: 20, 
              message: `${eventCount}件の予定を削除中...`,
              current: 0,
              total: eventCount,
              currentDate: '',
              summary: '削除処理を開始します',
              remaining: eventCount
            })}\n\n`));
            
            // 各イベントを削除
            for (let i = 0; i < events.length; i++) {
              const event = events[i];
              
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
                    console.log('Authentication error during deletion, aborting');
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
                  
                  // その他のエラーの場合は1回再試行
                  try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await calendar.events.delete({
                      calendarId,
                      eventId: event.id,
                    });
                    deletedCount++;
                    console.log(`deleted on retry: ${event.summary}`);
                  } catch (retryError: unknown) {
                    const retryErr = retryError as { status?: number; code?: number };
                    console.error(`Retry failed for event ${event.id}:`, retryErr);
                    
                    if (retryErr.status === 401 || retryErr.code === 401) {
                      console.log('Authentication error on retry, aborting');
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
                    
                    console.log(`Failed to delete event: ${event.summary}, continuing with next event`);
                  }
                }
              }
              
              // 進捗を送信（20%から90%の範囲で）
              const progress = Math.min(90, 20 + Math.floor((i + 1) / eventCount * 70));
              const remaining = eventCount - deletedCount;
              const eventDate = event.start?.dateTime || event.start?.date || '';
              const currentDateStr = eventDate ? new Date(eventDate).toLocaleDateString('ja-JP') : '';
              
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'progress', 
                progress, 
                message: `${deletedCount}/${eventCount}件削除済み...`,
                current: deletedCount,
                total: eventCount,
                currentDate: currentDateStr,
                summary: event.summary || '予定を削除中',
                remaining: remaining
              })}\n\n`));
              
              // APIレート制限対策で少し遅延
              if (i % 5 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // 完了通知
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              progress: 100, 
              message: '削除完了！', 
              deletedCount 
            })}\n\n`));
            
            safeClose();
          } catch (error) {
            console.error('SSE Stream Error:', error);
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

    // 通常の削除処理（ストリーミングなし）
    const eventsRes = await calendar.events.list({
      calendarId,
      timeMin: new Date('1000/1/1').toISOString(),
      timeMax: new Date('9999/12/31').toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });
    
    const events = eventsRes.data.items || [];
    const eventCount = events.length;
    
    console.log(`Found ${eventCount} events to delete`);
    
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
      deletedCount: eventCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
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