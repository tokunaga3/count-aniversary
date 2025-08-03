import AnniversaryForm from "@/components/AnniversaryForm";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="container mx-auto px-6 max-w-7xl py-8">
        {/* ヘッダーセクション */}
        <header className="mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-blue-600 mb-4 flex items-center gap-3">
            思い出カレンダー
          </h1>
          <p className="text-blue-500 text-lg md:text-xl mb-8">楽しい予定と大切な記念日をメモしよう！</p>
          
          {/* ログイン情報と操作ボタンを水平に配置 */}
          {session && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-white/50 rounded-lg px-6 py-4 backdrop-blur-sm">
              <p className="text-blue-600 text-base md:text-lg">
                ログイン中: <span className="font-semibold">{session.user?.email}</span>
              </p>
              <LogoutButton />
            </div>
          )}
        </header>

        {/* メインコンテンツ */}
        <div className="space-y-8">
          {session ? (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <AnniversaryForm />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-lg mx-auto">
              <p className="text-xl text-blue-600 mb-4">Googleアカウントでログインしてください。</p>
              <div className="flex justify-center">
                <LoginButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
