"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CandidateOnboarding() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !cv) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("cv", cv);

    const res = await fetch("/api/candidate/onboard", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    router.push(`/tamara?candidateId=${data.candidateId}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Start your call with Tamara</h1>

      <input
        className="border p-2 w-64"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="border p-2 w-64"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setCv(e.target.files?.[0] ?? null)}
      />

      <button
        onClick={submit}
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded"
      >
        {loading ? "Preparing call..." : "Start Call"}
      </button>
    </main>
  );
}
