"use client";

import { LogIn } from 'lucide-react';
import { signIn } from 'next-auth/react';

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/calendar-setup' })}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 font-medium rounded-lg transition-colors duration-300"
    >
      <LogIn className="w-5 h-5" />
      Googleでログイン
    </button>
  );
}
