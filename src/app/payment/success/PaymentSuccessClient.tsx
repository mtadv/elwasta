"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/ga";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Paymob sends order_id / transaction_id
  const paymentRef =
    searchParams.get("order_id") ||
    searchParams.get("transaction_id");

  useEffect(() => {
    if (paymentRef) {
      trackEvent("payment_success", {
        payment_ref: paymentRef,
      });
    }

    const finalizePayment = async () => {
      try {
        await fetch("/api/payments/paymob/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentRef,
          }),
        });

        // Give backend time to unlock
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } catch {
        trackEvent("payment_failed", {
          reason: "confirm_endpoint_error",
        });
        router.push("/payment/failure");
      }
    };

    finalizePayment();
  }, [paymentRef, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Payment Successful</h1>
        <p className="text-gray-600">
          Unlocking candidates and redirecting you…
        </p>
      </div>
    </main>
  );
}
