import { openai } from "@/lib/openai";
import { supabaseServer } from "@/lib/supabase/server";

/* =========================
   TYPES
========================== */
type GPTShortlistItem = {
  candidateId: string;
  score: number; // 0–100
  rank?: number; // optional
  reason: string;
};

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    /* =========================
       INIT SUPABASE (FIX)
    ========================== */
    const supabase = await supabaseServer();

    /* =========================
       1️⃣ LOAD JOB
    ========================== */
    const { data: job } = await supabase
      .from("jobs")
      .select("id, brief_final")
      .eq("id", jobId)
      .single();

    if (!job || !job.brief_final) {
      return new Response("Job not found", { status: 404 });
    }

    /* =========================
       2️⃣ LOAD CANDIDATES
    ========================== */
    const { data: candidates } = await supabase
      .from("candidates")
      .select(`
        id,
        final_profile,
        interview_profile,
        cv_text
      `);

    if (!candidates || candidates.length === 0) {
      return Response.json({
        success: true,
        message: "No candidates available yet.",
      });
    }

    /* =========================
       3️⃣ BUILD GPT INPUT
    ========================== */
    const candidateBlock = candidates
      .map(
        (c) => `
CANDIDATE_ID: ${c.id}

FINAL_PROFILE:
${JSON.stringify(c.final_profile ?? {}, null, 2)}

INTERVIEW_PROFILE:
${JSON.stringify(c.interview_profile ?? {}, null, 2)}

CV_TEXT:
${c.cv_text?.slice(0, 1500) ?? "N/A"}
`
      )
      .join("\n---\n");

    /* =========================
       4️⃣ GPT MATCHING
    ========================== */
    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a senior recruiter.

Rules:
- Use ONLY provided data
- Do NOT invent information
- Score candidates from 0–100
- Higher score = better fit
- Use EXACT candidateId
- Return ONLY valid JSON

Format:
[
  {
    "candidateId": "uuid",
    "score": 78,
    "reason": "Strong alignment with required skills"
  }
]
`,
          },
          {
            role: "user",
            content: `
JOB REQUIREMENTS:
${JSON.stringify(job.brief_final, null, 2)}

CANDIDATES:
${candidateBlock}
`,
          },
        ],
      });

    const raw =
      completion.choices[0]?.message?.content ?? "[]";

    let parsed: GPTShortlistItem[];

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("❌ GPT invalid JSON:", raw);
      return new Response("Invalid GPT output", { status: 500 });
    }

    /* =========================
       5️⃣ SAVE SHORTLIST
    ========================== */
    for (const item of parsed) {
      if (!item.candidateId) continue;

      await supabase
        .from("shortlists")
        .upsert(
          {
            job_id: jobId,
            candidate_id: item.candidateId,
            score: Math.min(100, Math.max(0, item.score)),
            rank: item.rank ?? null,
            locked: true,
            reason: item.reason,
          },
          {
            onConflict: "job_id,candidate_id",
          }
        );
    }

    return Response.json({
      success: true,
      matched: parsed.length,
    });
  } catch (err) {
    console.error("🔥 Matching error:", err);
    return new Response("Matching failed", { status: 500 });
  }
}
