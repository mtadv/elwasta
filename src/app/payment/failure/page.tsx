"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/ga";

export default function PaymentFailurePage() {
  const router = useRouter();

  useEffect(() => {
    trackEvent("payment_failed");
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Payment Failed</h1>
        <p className="text-gray-600">
          The payment was not completed. Please try again.
        </p>

        <button
          onClick={() => router.push("/dashboard")}
          className="border px-4 py-2 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}
