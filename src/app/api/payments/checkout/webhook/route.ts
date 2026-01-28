import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   WEBHOOK
========================== */
export async function POST(req: Request) {
  try {
    /* =========================
       RAW BODY
    ========================== */
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("cko-signature");

    if (!signatureHeader) {
      return new NextResponse("Missing signature", { status: 401 });
    }

    /* =========================
       VERIFY SIGNATURE
    ========================== */
    const secret = process.env.CHECKOUT_WEBHOOK_SECRET!;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    // Checkout may send multiple signatures
    const receivedSignatures = signatureHeader
      .split(",")
      .map((s) => s.trim());

    const valid = receivedSignatures.includes(expectedSignature);

    if (!valid) {
      console.error("❌ Invalid webhook signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }

    /* =========================
       PARSE EVENT
    ========================== */
    const event = JSON.parse(rawBody);

    if (event.type !== "payment_approved") {
      // Acknowledge all other events
      return NextResponse.json({ received: true });
    }

    const snapshotId: string | undefined = event.data?.reference;
    const paymentId: string | undefined = event.data?.id;

    if (!snapshotId || !paymentId) {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    /* =========================
       UPDATE DATABASE
    ========================== */
    const supabase = await supabaseServer();

    const { data: snapshot } = await supabase
      .from("job_pricing_snapshot")
      .update({
        status: "paid",
        payment_reference: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", snapshotId)
      .eq("status", "pending") // ✅ idempotency
      .select()
      .single();

    if (!snapshot) {
      // Already processed or invalid snapshot
      return NextResponse.json({ received: true });
    }

    /* =========================
       UNLOCK JOB
    ========================== */
    await supabase.from("candidate_unlocks").insert({
      recruiter_id: snapshot.recruiter_id,
      job_id: snapshot.job_id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("CHECKOUT WEBHOOK ERROR:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
