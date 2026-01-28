import { openai } from "@/lib/openai";
import { supabaseServer } from "@/lib/supabase/server";
import { sessionMemory } from "../intake/route";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const { sessionId, jobId } = await req.json();

    if (!sessionId || !jobId) {
      return new Response(
        "Missing sessionId or jobId",
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ LOAD JOB (SOURCE OF recruiter_id)
    ========================== */
    const supabase = await supabaseServer();

    const { data: job } = await supabase
      .from("jobs")
      .select("recruiter_id")
      .eq("id", jobId)
      .single();

    if (!job?.recruiter_id) {
      return new Response("Job not found", { status: 404 });
    }

    const recruiterId = job.recruiter_id;

    /* =========================
       2️⃣ LOAD CONVERSATION
    ========================== */
    const messages: Message[] =
      sessionMemory.get(sessionId) ?? [];

    if (!messages.length) {
      return Response.json({
        summary: "No conversation recorded.",
      });
    }

    /* =========================
       3️⃣ BUILD INPUT
    ========================== */
    const recruiterInput = messages
      .filter((m) => m.role === "user")
      .map((m) => `- ${m.content}`)
      .join("\n");

    /* =========================
       4️⃣ GENERATE SUMMARY
    ========================== */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a senior recruitment consultant.
Summarize the hiring request clearly for a recruiter dashboard.

Rules:
- Professional tone
- Clear and concise
- One short paragraph
- Focus on role, seniority, skills, and hiring conditions
`,
        },
        {
          role: "user",
          content: recruiterInput,
        },
      ],
    });

    const summary =
      completion.choices[0]?.message?.content ??
      "Summary unavailable.";

    /* =========================
       5️⃣ SAVE SUMMARY + STATUS
    ========================== */
    
    await supabase
  .from("jobs")
  .update({
    brief_final: {
      summary,               // human-readable summary
      source: "osama",
    },
    status: "intake_completed",
    last_extracted: new Date().toISOString(),
    ai_version: "osama-v1",
  })
  .eq("id", jobId);


    /* =========================
       6️⃣ CREATE TASK
    ========================== */
    await supabase
      .from("tasks")
      .insert({
        recruiter_id: recruiterId,
        job_id: jobId,
        type: "job_intake_review",
        title: "Review job intake & start matching",
        status: "pending",
        source: "osama",
      });

    return Response.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error("🔥 Osama summary error:", err);
    return new Response("Summary failed", { status: 500 });
  }
}
