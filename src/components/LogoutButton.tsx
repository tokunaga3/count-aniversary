"use client";

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors duration-300"
    >
      <LogOut className="w-5 h-5" />
      ログアウト
    </button>
  );
} 