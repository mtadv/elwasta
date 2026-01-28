import { supabase } from "@/lib/supabase";
import { matchCandidateToJob } from "@/lib/matching";
import { isValidMatchResult } from "@/lib/matching";
import type { JobBrief } from "@/types/matching";
 // ✅ make sure this exists

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobId: string | undefined = body?.jobId;

    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    console.log("🚀 MATCHING STARTED FOR JOB:", jobId);

    const { data: existing } = await supabase
  .from("matches")
  .select("id")
  .eq("job_id", jobId)
  .gte("score", 60)
  .limit(1);

if (existing && existing.length >= 3) {
  console.log("⏭️ Matching already completed for job:", jobId);
  return Response.json({ status: "already-complete" });
}


    /* =========================
       1️⃣ FETCH JOB
    ========================== */
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, brief_final")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("❌ JOB NOT FOUND:", jobError);
      return new Response("Job not found", { status: 404 });
    }

    /* =========================
       2️⃣ VALIDATE JOB BRIEF
    ========================== */
    if (!job.brief_final || typeof job.brief_final !== "object") {
      console.warn("⛔ INVALID OR EMPTY brief_final FOR JOB:", job.id);
      return Response.json({
        status: "skipped",
        reason: "job brief_final missing or invalid",
      });
    }

    // ✅ IMPORTANT: DO NOT stringify
    const jobBrief: JobBrief = job.brief_final as JobBrief;

    /* =========================
       3️⃣ FETCH CANDIDATES
    ========================== */
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("id, profile");

    if (candidatesError || !candidates || candidates.length === 0) {
      console.warn("⚠️ NO CANDIDATES FOUND");
      return Response.json({ status: "no candidates" });
    }

    /* =========================
       4️⃣ MATCH LOOP (ENGINE)
    ========================== */
    for (const candidate of candidates) {
      try {
        if (!candidate.profile) {
          console.warn("⏭️ Candidate missing profile:", candidate.id);
          continue;
        }

        /* 🔒 Prevent duplicate matches */
        const { data: existingMatch } = await supabase
          .from("matches")
          .select("id")
          .eq("job_id", job.id)
          .eq("candidate_id", candidate.id)
          .maybeSingle();

        if (existingMatch) {
          console.log("⏭️ Match already exists:", candidate.id);
          continue;
        }

        /* 🧠 RUN AI MATCHING */
        const result = await matchCandidateToJob(
          candidate.profile,
          jobBrief
        );

        console.log(
          "🧠 MATCH RESULT RAW:",
          JSON.stringify(result, null, 2)
        );

        /* ❌ Validate AI response */
        if (!isValidMatchResult(result)) {
          console.warn("❌ INVALID MATCH RESULT:", candidate.id);
          continue;
        }

        /* ⛔ Enforce minimum score */
        if (result.overall_score < 60)  {
          console.log(
            "⛔ BELOW THRESHOLD:",
            candidate.id,
            result.overall_score
          );
          continue;
        }

        /* ✅ INSERT MATCH */
        const { error: insertError } = await supabase
          .from("matches")
          .insert({
            candidate_id: candidate.id,
            job_id: job.id,
            score: result.overall_score,
            summary: result.summary,
            breakdown: result.breakdown,
          });

        if (insertError) {
          console.error("❌ INSERT FAILED:", insertError);
          continue;
        }

        console.log("✅ MATCH INSERTED:", {
          candidate: candidate.id,
          score: result.overall_score,
        });
      } catch (e) {
        console.error(
          "🔥 MATCHING ERROR FOR CANDIDATE:",
          candidate.id,
          e
        );
      }
    }

    /* =========================
       DONE
    ========================== */
    return Response.json({
      status: "matching completed",
    });
  } catch (err) {
    console.error("🔥 MATCHING ROUTE ERROR:", err);
    return new Response("Server error", { status: 500 });
  }
}
