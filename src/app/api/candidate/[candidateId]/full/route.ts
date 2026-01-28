// app/api/candidate/[candidateId]/full/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ candidateId: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing auth header" },
        { status: 401 }
      );
    }

    // ✅ FIX: await params
    const { candidateId } = await context.params;

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // ✅ AUTH USING BEARER TOKEN
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔓 CHECK JOB-LEVEL UNLOCK
    const { data: unlock } = await supabase
      .from("candidate_unlocks")
      .select("id")
      .eq("recruiter_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (!unlock) {
      return NextResponse.json(
        { error: "Job not unlocked" },
        { status: 401 }
      );
    }

    // ✅ FETCH FULL CANDIDATE
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select(`
        id,
        name,
        email,
        profile,
        cv_profile,
        final_profile,
        cv_text,
        cv_summary,
        interview_profile
      `)
      .eq("id", candidateId)
      .single();

    if (error || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ candidate });
  } catch (e) {
    console.error("FULL PROFILE ERROR:", e);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
