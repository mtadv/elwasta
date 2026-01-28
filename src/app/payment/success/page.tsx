import { Suspense } from "react";
import PaymentSuccessClient from "./PaymentSuccessClient";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-8">Finalizing payment…</div>}>
      <PaymentSuccessClient />
    </Suspense>
  );
}
