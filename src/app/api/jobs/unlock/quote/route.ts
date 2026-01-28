import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveJobPricing } from "@/lib/pricing/jobPricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    /* =========================
       AUTH
    ========================== */
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = await supabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    /* =========================
       INPUT
    ========================== */
    const { jobId } = await req.json();

    if (!jobId) {
      return new NextResponse("Missing jobId", { status: 400 });
    }

    /* =========================
       FETCH JOB
    ========================== */
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, recruiter_id, brief_final")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new NextResponse("Job not found", { status: 404 });
    }

    if (job.recruiter_id !== user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const brief = job.brief_final as {
      role_title?: string;
      seniority?: string;
      years_experience?: string;
    };

    if (!brief?.years_experience) {
      return new NextResponse(
        "Job years_experience missing",
        { status: 400 }
      );
    }

    /* =========================
       RESOLVE PRICING
    ========================== */
    const pricing = resolveJobPricing(
      brief.years_experience
    );

    /* =========================
       SNAPSHOT (IDEMPOTENT)
    ========================== */
    await supabase
      .from("job_pricing_snapshot")
      .upsert({
        job_id: job.id,
        tier: pricing.tier,
        years_range: pricing.yearsRange,
        price_usd: pricing.price,
      });

    /* =========================
       RESPONSE
    ========================== */
    return NextResponse.json({
      jobId: job.id,
      role: brief.role_title ?? null,
      seniority: brief.seniority ?? null,
      years_experience: pricing.yearsRange,
      tier: pricing.tier,
      price: pricing.price,
      currency: "USD",
    });
  } catch (err) {
    console.error("UNLOCK QUOTE ERROR:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
