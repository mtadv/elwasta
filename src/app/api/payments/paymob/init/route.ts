import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { usdToEgp, usdToEgpCents, INTERNAL_USD_EGP_RATE } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   PRICING
========================== */
type PricingResult = {
  tier: "junior" | "mid" | "senior";
  price: number; // USD
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
  console.log("🔥 PAYMOB PAYMENTS INIT");
  // 🔍 DEBUG ENV
  console.log("Paymob iframe:", process.env.PAYMOB_IFRAME_ID);
  console.log("Paymob integration:", process.env.PAYMOB_INTEGRATION_ID);

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
    const { jobId } = await req.json();
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
      return NextResponse.json({ error: "Job not found" }, { status: 400 });
    }

    if (job.recruiter_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!job.brief_final?.years_experience) {
      return NextResponse.json({ error: "Invalid job data" }, { status: 400 });
    }

    /* =========================
       PRICING
    ========================== */
    const pricing = resolveJobPricing(job.brief_final.years_experience);

    const priceUsd = pricing.price;
    const priceEgp = usdToEgp(priceUsd);
    const amountCents = usdToEgpCents(priceUsd);

    console.log("💰 PRICING:", { priceUsd, priceEgp });

    /* =========================
       SNAPSHOT
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
          price_usd: priceUsd,
          price_egp: priceEgp,
          fx_rate: INTERNAL_USD_EGP_RATE,
          status: "pending",
          payment_provider: "paymob",
        })
        .select()
        .single();

      if (error || !newSnapshot) {
        return NextResponse.json(
          { error: "Failed to create snapshot" },
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
       PAYMOB AUTH TOKEN
    ========================== */
    const authRes = await fetch(
      "https://accept.paymob.com/api/auth/tokens",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.PAYMOB_API_KEY,
        }),
      }
    );

    const { token } = await authRes.json();

    /* =========================
       PAYMOB ORDER
    ========================== */
    const orderRes = await fetch(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          delivery_needed: false,
          amount_cents: amountCents.toString(),
          currency: "EGP",
          merchant_order_id: snapshot.id,
          items: [
            {
              name: "Candidate Unlock",
              amount_cents: amountCents.toString(),
              description: pricing.tier,
              quantity: 1,
            },
          ],
        }),
      }
    );

    const order = await orderRes.json();

    /* =========================
       PAYMENT KEY
    ========================== */
    const paymentKeyRes = await fetch(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          amount_cents: amountCents.toString(),
          expiration: 3600,
          order_id: order.id,
          billing_data: {
            email: user.email ?? "test@elwasta.com",
            first_name: "Elwasta",
            last_name: "Recruiter",
            phone_number: "0000000000",
            country: "EG",
            city: "Cairo",
            street: "NA",
            building: "NA",
            floor: "NA",
            apartment: "NA",
          },
          currency: "EGP",
          integration_id: process.env.PAYMOB_INTEGRATION_ID,
        }),
      }
    );

    const paymentKey = await paymentKeyRes.json();

    // 🔍 DEBUG PAYMENT KEY
console.log("Payment key response:", paymentKey);
console.log("Redirect URL:", 
  `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey.token}`
);

    return NextResponse.json({
      iframe_url: `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey.token}`,
    });
  } catch (err) {
    console.error("🔥 PAYMOB INIT ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
