"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";


export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/recruiter/dashboard");
    }
  };

  const signUp = async () => {
    setLoading(true);
    setError(null);
  
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });
  
    setLoading(false);
  
    if (error) {
      setError(error.message);
      return;
    }
  
    // Email confirmation is enabled
    if (!data.session) {
      alert("Check your email to confirm your account.");
      return;
    }
  
    router.push("/recruiter/dashboard");
  };
  

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 border rounded">
        <h1 className="text-2xl font-bold mb-6">Recruiter Login</h1>

        <input
          className="w-full border p-2 mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2 mb-4"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="text-red-600 text-sm mb-3">
            {error}
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full bg-black text-white py-2 mb-2"
        >
          Sign In
        </button>

        <button
          onClick={signUp}
          disabled={loading}
          className="w-full border py-2"
        >
          Sign Up
        </button>
      </div>
    </main>
  );
}
