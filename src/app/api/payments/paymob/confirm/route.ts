import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendPaymentReceipt } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { paymentRef } = await req.json();

    if (!paymentRef) {
      return NextResponse.json(
        { error: "Missing payment reference" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // 1️⃣ Find pending snapshot
    const { data: snapshot } = await supabase
      .from("job_pricing_snapshot")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!snapshot) {
      // Already processed or invalid
      return NextResponse.json({ success: true });
    }

    // 2️⃣ Mark as paid (idempotent)
    await supabase
      .from("job_pricing_snapshot")
      .update({
        status: "paid",
        payment_reference: paymentRef,
        paid_at: new Date().toISOString(),
      })
      .eq("id", snapshot.id)
      .eq("status", "pending");

    // 3️⃣ Unlock job
    await supabase.from("candidate_unlocks").insert({
      recruiter_id: snapshot.recruiter_id,
      job_id: snapshot.job_id,
    });

    // 4️⃣ Fetch recruiter email
    const { data: recruiter } = await supabase
      .from("recruiters")
      .select("email")
      .eq("id", snapshot.recruiter_id)
      .single();

    // 5️⃣ Send email receipt (non-blocking logic)
    if (recruiter?.email) {
      await sendPaymentReceipt({
        to: recruiter.email,
        jobId: snapshot.job_id,
        amountEgp: snapshot.price_egp,
        paymentRef,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PAYMENT CONFIRM ERROR:", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
