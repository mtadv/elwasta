import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("🟢 /api/jobs/create called");

  try {
    /* =========================
       1️⃣ AUTH HEADER
    ========================== */
    const authHeader = req.headers.get("authorization");
    console.log("🔹 Auth header:", authHeader ? "FOUND" : "MISSING");

    if (!authHeader) {
      return Response.json(
        { error: "Missing auth header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("🔹 Token length:", token.length);

    /* =========================
       2️⃣ INIT SUPABASE (JWT BOUND)
    ========================== */
    console.log("🔹 Initializing Supabase server client WITH TOKEN");

    const supabase = await supabaseServer(token);

    console.log("✅ Supabase client initialized");

    /* =========================
       3️⃣ VERIFY USER
    ========================== */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(); // ✅ NO TOKEN HERE

    if (authError || !user) {
      console.error("❌ Auth failed:", authError);
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("✅ Authenticated user:", user.id);

    /* =========================
       4️⃣ INSERT JOB
    ========================== */
    console.log("🔹 Inserting job for recruiter:", user.id);

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        recruiter_id: user.id,
        status: "intake",
      })
      .select("id")
      .single();

    if (error) {
      console.error("❌ Job insert error:", error);
      return Response.json(
        {
          error: "Insert failed",
          details: error.message,
        },
        { status: 500 }
      );
    }

    console.log("✅ Job created successfully:", data.id);

    /* =========================
       5️⃣ SUCCESS
    ========================== */
    return Response.json({ jobId: data.id });

  } catch (e) {
    console.error("🔥 Unexpected server error:", e);

    return Response.json(
      {
        error: "Unexpected server error",
        message:
          e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
