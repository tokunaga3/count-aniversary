import AnniversaryForm from "@/components/AnniversaryForm";
import LoginButton from "@/components/LoginButton";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>記念日登録アプリ</h1>
      <LoginButton />

      {session ? (
        <>
          <p>ログイン中: {session.user?.email}</p>
          <AnniversaryForm />
        </>
      ) : (
        <p>Googleアカウントでログインしてください。</p>
      )}
    </main>
  );
}
