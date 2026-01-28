import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    // ✅ FIX: await params
    const { jobId } = await context.params;

    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
  .from("matches")
  .select(`
    id,
    score,
    summary,
    candidate:candidate_id (
      id,
      profile
    )
  `)
  .eq("job_id", jobId)
  .gte("score", 60)               // ✅ minimum 60%
  .order("score", { ascending: false })
  .limit(5);                      // ✅ top 5 only

    console.log("SHORTLIST API jobId:", jobId);
    console.log("SHORTLIST RAW:", data);

    if (error) {
      console.error("❌ Shortlist fetch error:", error);
      return new Response("Failed to load shortlist", { status: 500 });
    }

    return Response.json({
      shortlist: data ?? [],
    });
  } catch (err) {
    console.error("🔥 Fetch shortlist error:", err);
    return new Response("Server error", { status: 500 });
  }
}
