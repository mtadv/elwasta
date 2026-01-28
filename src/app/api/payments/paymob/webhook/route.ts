import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   PAYMOB WEBHOOK
========================== */
export async function POST(req: Request) {
  try {
    /* =========================
       PARSE BODY
    ========================== */
    const body = await req.json();

    const receivedHmac = body.hmac;
    if (!receivedHmac) {
      return new NextResponse("Missing HMAC", { status: 401 });
    }

    /* =========================
       VERIFY HMAC
    ========================== */
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET!;
    const hmacFields = [
      "amount_cents",
      "created_at",
      "currency",
      "error_occured",
      "has_parent_transaction",
      "id",
      "integration_id",
      "is_3d_secure",
      "is_auth",
      "is_capture",
      "is_refunded",
      "is_standalone_payment",
      "is_voided",
      "order",
      "owner",
      "pending",
      "source_data_pan",
      "source_data_sub_type",
      "source_data_type",
      "success",
    ];

    const concatenated = hmacFields
      .map((field) => body[field] ?? "")
      .join("");

    const calculatedHmac = crypto
      .createHmac("sha512", hmacSecret)
      .update(concatenated)
      .digest("hex");

    if (calculatedHmac !== receivedHmac) {
      console.error("❌ Invalid Paymob HMAC");
      return new NextResponse("Invalid HMAC", { status: 401 });
    }

    /* =========================
       CHECK PAYMENT STATUS
    ========================== */
    if (body.success !== true) {
      // Payment failed or pending — acknowledge but do nothing
      return NextResponse.json({ received: true });
    }

    /* =========================
       EXTRACT REFERENCES
    ========================== */
    const snapshotId = body.order?.merchant_order_id;
    const paymentId = body.id;

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
    console.error("🔥 PAYMOB WEBHOOK ERROR:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
