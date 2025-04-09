import AnniversaryForm from "@/components/AnniversaryForm";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-sky-100">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-blue-600">記念日登録アプリ</h1>
              {session && (
                <p className="text-blue-500 mt-2">
                  ログイン中: <span className="font-medium">{session.user?.email}</span>
                </p>
              )}
            </div>
            <div>
              {session ? <LogoutButton /> : <LoginButton />}
            </div>
          </div>

          {session ? (
            <AnniversaryForm />
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <p className="text-xl text-blue-600">Googleアカウントでログインしてください。</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
