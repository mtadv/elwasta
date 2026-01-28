// app/api/candidate/unlock/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const { jobId } = await req.json();

    if (!authHeader || !jobId) {
      return NextResponse.json(
        { error: "Missing auth or jobId" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = await supabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("AUTH ERROR:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("candidate_unlocks")
      .insert({
        recruiter_id: user.id,
        job_id: jobId,
        candidate_id: null, // job-level unlock
      });

    if (error && error.code !== "23505") {
      console.error("Unlock failed:", error);
      return NextResponse.json(
        { error: "Failed to unlock job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ unlocked: true });
  } catch (e) {
    console.error("UNLOCK ERROR:", e);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
