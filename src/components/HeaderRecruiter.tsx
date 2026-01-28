"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function HeaderRecruiter() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabaseClient.auth.getUser();
      setEmail(data.user?.email ?? null);
    };

    loadUser();
  }, []);

  const logout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/");
  };

  return (
    <header className="border-b border-black">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img
            src="/elwasta-logo.png"
            alt="Elwasta"
            className="h-10 md:h-12"
          />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-6 text-sm">

          {/* Profile link */}
          <Link
            href="/recruiter/dashboard"
            className="flex items-center gap-2 hover:opacity-80"
          >
            <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center">
              👤
            </div>
            <span>{email}</span>
          </Link>

          {/* Payment History */}
          <Link
            href="/recruiter/payments"
            className="text-gray-500 hover:text-black"
          >
            Payment history
          </Link>

          {/* Logout */}
          <button
            onClick={logout}
            className="text-gray-500 hover:text-black"
          >
            Logout
          </button>

        </div>
      </div>
    </header>
  );
}
