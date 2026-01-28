import { supabase } from "@/lib/supabase";
import { MatchResult } from "@/types/matching";

type ShortlistCandidate = {
  match_id: string;
  candidate_id: string;
  score: number;
  breakdown: MatchResult["breakdown"];
  summary: string;
};

export async function generateTop3Shortlist(jobId: string) {
  // 1️⃣ Fetch eligible matches
  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .eq("job_id", jobId)
    .gte("score", 70)
    .order("score", { ascending: false });

  if (error || !matches || matches.length === 0) {
    return { shortlist: [], reason: "No suitable candidates" };
  }

  // 2️⃣ Filter by skills score
  const filtered = matches.filter(
    (m) => (m.breakdown?.skills ?? 0) >= 25
  );

  // 3️⃣ Take top 3
  const top3 = filtered.slice(0, 3);

  // 4️⃣ Mark as shortlisted
  const shortlistIds = top3.map((m) => m.id);

  await supabase
    .from("matches")
    .update({ shortlisted: true })
    .in("id", shortlistIds);

  // 5️⃣ Prepare output
  const shortlist: ShortlistCandidate[] = top3.map((m) => ({
    match_id: m.id,
    candidate_id: m.candidate_id,
    score: m.score,
    breakdown: m.breakdown,
    summary: m.summary,
  }));

  return { shortlist };
}
