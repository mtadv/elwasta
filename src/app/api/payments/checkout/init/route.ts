import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   PRICING
========================== */
type PricingResult = {
  tier: "junior" | "mid" | "senior";
  price: number;
  yearsRange: string;
};

function resolveJobPricing(yearsRaw: string): PricingResult {
  const cleaned = yearsRaw.replace(/\s/g, "");
  let maxYears = 0;

  if (cleaned.includes("+")) maxYears = parseInt(cleaned, 10);
  else if (cleaned.includes("-"))
    maxYears = parseInt(cleaned.split("-")[1], 10);
  else maxYears = parseInt(cleaned, 10);

  if (maxYears <= 5) return { tier: "junior", price: 100, yearsRange: yearsRaw };
  if (maxYears <= 9) return { tier: "mid", price: 150, yearsRange: yearsRaw };
  return { tier: "senior", price: 250, yearsRange: yearsRaw };
}

/* =========================
   ROUTE
========================== */
export async function POST(req: Request) {
  console.log("🔥 CHECKOUT PAYMENTS INIT");

  try {
    /* =========================
       AUTH
    ========================== */
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin;
    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* =========================
       INPUT
    ========================== */
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { jobId } = body as { jobId?: string };
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    console.log("🧾 JOB ID RECEIVED:", jobId);

    /* =========================
       LOAD JOB
    ========================== */
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("brief_final, recruiter_id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("❌ JOB QUERY ERROR:", jobError);
      return NextResponse.json({ error: "Job not found" }, { status: 400 });
    }

    if (job.recruiter_id !== user.id) {
      return NextResponse.json(
        { error: "Not authorized for this job" },
        { status: 403 }
      );
    }

    if (!job.brief_final?.years_experience) {
      return NextResponse.json({ error: "Invalid job data" }, { status: 400 });
    }

    /* =========================
       PRICING
    ========================== */
    const pricing = resolveJobPricing(job.brief_final.years_experience);
    console.log("💰 PRICING RESOLVED:", pricing);

    /* =========================
       SNAPSHOT (REUSE OR CREATE)
    ========================== */
    let { data: snapshot } = await supabase
      .from("job_pricing_snapshot")
      .select("*")
      .eq("job_id", jobId)
      .eq("recruiter_id", user.id)
      .single();

    if (!snapshot) {
      const { data: newSnapshot, error } = await supabase
        .from("job_pricing_snapshot")
        .insert({
          job_id: jobId,
          recruiter_id: user.id,
          tier: pricing.tier,
          years_range: pricing.yearsRange,
          price_usd: pricing.price,
          status: "pending",
          payment_provider: "checkout",
        })
        .select()
        .single();

      if (error || !newSnapshot) {
        console.error("❌ SNAPSHOT CREATE ERROR:", error);
        return NextResponse.json(
          { error: "Failed to create pricing snapshot" },
          { status: 500 }
        );
      }

      snapshot = newSnapshot;
    }

    if (snapshot.status === "paid") {
      return NextResponse.json(
        { error: "Job already unlocked" },
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ CREATE PAYMENT CONTEXT
    ========================== */
    console.log("🚀 CREATING PAYMENT CONTEXT");

    const contextRes = await fetch(
      "https://api.sandbox.checkout.com/payment-contexts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CHECKOUT_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Cko-Version": "2022-01-01",
        },
        body: JSON.stringify({
          reference: snapshot.id,
          amount: pricing.price * 100,
          currency: "USD",
          processing_channel_id:
            process.env.CHECKOUT_PROCESSING_CHANNEL_ID,
        // ──── ADD THIS ────
      source: {
        type: "card",                       // ← most common for redirect/hosted card payments
        // Optional: you can add more constraints if needed, e.g.
        // allowed_card_brands: ["VISA", "MASTERCARD", "AMEX"],
      },
      // ──────────────────    
        
          customer: {
            email: user.email ?? "test@elwasta.com",
            name: "Elwasta Recruiter",
          },
        
          success_url: "http://localhost:3000/payment/success",
          failure_url: "http://localhost:3000/payment/failed",
        }),
        
      }
    );

    const contextJson = await contextRes.json();

    if (!contextRes.ok || !contextJson?.id) {
      console.error("❌ PAYMENT CONTEXT ERROR:", contextJson);
      return NextResponse.json(
        { error: "Failed to create payment context", raw: contextJson },
        { status: 400 }
      );
    }

    /* =========================
       2️⃣ CREATE PAYMENT (REDIRECT)
    ========================== */
    console.log("🚀 CREATING PAYMENT");

    const paymentRes = await fetch(
      "https://api.sandbox.checkout.com/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CHECKOUT_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Cko-Version": "2022-01-01",
        },
        body: JSON.stringify({
          payment_context_id: contextJson.id,
          reference: snapshot.id,

          source: {
            type: "redirect",
          },
        }),
      }
    );

    const paymentJson = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("❌ CHECKOUT PAYMENT ERROR:", paymentJson);
      return NextResponse.json(
        { error: "Checkout payment failed", raw: paymentJson },
        { status: 400 }
      );
    }

    if (!paymentJson?._links?.redirect?.href) {
      return NextResponse.json(
        { error: "Missing redirect URL", raw: paymentJson },
        { status: 400 }
      );
    }

    console.log("✅ CHECKOUT REDIRECT READY");

    return NextResponse.json({
      checkout_url: paymentJson._links.redirect.href,
    });
  } catch (err) {
    console.error("🔥 CHECKOUT INIT CRASH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
