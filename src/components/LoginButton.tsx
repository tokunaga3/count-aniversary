"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function LoginButton() {
  const { data: session } = useSession();

  return (
    <div>
      {session ? (
        <>
          <p>ログイン中: {session.user?.email}</p>
          <button onClick={() => signOut()}>ログアウト</button>
        </>
      ) : (
        <button onClick={() => signIn("google")}>Googleでログイン</button>
      )}
    </div>
  );
}
