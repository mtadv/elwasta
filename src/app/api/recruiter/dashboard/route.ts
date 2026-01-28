import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { jobId, recruiterId } = await req.json();

  if (!jobId || !recruiterId) {
    return Response.json(
      { error: "Missing jobId or recruiterId" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();

  /* =========================
     1️⃣ LOAD JOB
  ========================== */
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, brief_final")
    .eq("id", jobId)
    .eq("recruiter_id", recruiterId)
    .single();

  if (!job) {
    return Response.json({ job: null, tasks: [], shortlist: [] });
  }

  /* =========================
     2️⃣ LOAD TASKS
  ========================== */
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, type, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  /* =========================
     3️⃣ LOAD SHORTLISTS
  ========================== */
  const { data: shortlists } = await supabase
    .from("shortlists")
    .select("candidate_id, score, locked, reason")
    .eq("job_id", jobId)
    .order("score", { ascending: false });

  if (!shortlists || shortlists.length === 0) {
    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        summary: job.brief_final?.summary ?? null,
      },
      tasks: tasks ?? [],
      shortlist: [],
    });
  }

  /* =========================
     4️⃣ LOAD CANDIDATES
  ========================== */
  const candidateIds = shortlists.map(s => s.candidate_id);

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, final_profile")
    .in("id", candidateIds);

  console.log("SHORTLISTS:", shortlists);
  console.log("CANDIDATES:", candidates);

  /* =========================
     5️⃣ MERGE (NO DROPPING)
  ========================== */
  const shortlist = shortlists.map((s) => {
    const c = candidates?.find(c => c.id === s.candidate_id);

    return {
      score: s.score,
      locked: s.locked,
      summary: s.reason,
      profile: {
        current_role: c?.final_profile?.current_role ?? "N/A",
        years_experience: c?.final_profile?.years_experience ?? "N/A",
        skills: c?.final_profile?.skills ?? [],
        availability: c?.final_profile?.availability ?? "N/A",
      },
    };
  });

  return Response.json({
    job: {
      id: job.id,
      status: job.status,
      summary: job.brief_final?.summary ?? null,
    },
    tasks: tasks ?? [],
    shortlist,
  });
}
