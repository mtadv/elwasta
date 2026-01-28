"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Payment = {
  id: string;
  job_id: string;
  price_egp: number | null;
  price_usd: number | null;
  status: string;
  payment_reference: string | null;
  created_at: string;
};

export default function RecruiterPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadPayments = async () => {
      const { data: session } = await supabaseClient.auth.getSession();

      if (!session.session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabaseClient
        .from("job_pricing_snapshot")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPayments(data);
      }

      setLoading(false);
    };

    loadPayments();
  }, [router]);

  if (loading) {
    return <div className="p-8">Loading payments…</div>;
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Payment History</h1>

      {payments.length === 0 ? (
        <p className="text-gray-600">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-black text-sm">
            <thead className="border-b border-black">
              <tr className="text-left">
                <th className="p-3">Date</th>
                <th className="p-3">Job</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reference</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="p-3">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </td>

                  <td className="p-3 font-mono text-xs">
                    {payment.job_id.slice(0, 8)}…
                  </td>

                  <td className="p-3">
                    {payment.price_egp
                      ? `${payment.price_egp} EGP`
                      : `${payment.price_usd} USD`}
                  </td>

                  <td className="p-3 capitalize">
                    {payment.status}
                  </td>

                  <td className="p-3 text-xs text-gray-600">
                    {payment.payment_reference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
