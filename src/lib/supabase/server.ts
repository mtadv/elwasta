import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function supabaseServer(accessToken?: string) {
  const cookieStore = await cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          // 🔑 CRITICAL: attach JWT so Postgres sees auth.uid()
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),

          // ✅ keep cookies for routes that rely on them
          Cookie: cookieStore
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
      },
    }
  );
}
