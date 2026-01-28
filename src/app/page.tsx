import Link from "next/link";
import AudioButton from "@/components/AudioButton";

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-6">
{/* Hero */}
<section className="pt-32 pb-4 flex flex-col items-center text-center space-y-35">

  {/* Logo */}
  <img
    src="/elwasta-logo.png"
    alt="Elwasta"
    className="w-48 md:w-64"
  />

  {/* Headline */}
  <h1 className="text-5xl font-bold leading-tight max-w-3xl">
    Hiring without wasta.
  </h1>

  {/* Description */}
  <div className="space-y-4 max-w-2xl">
    <p className="text-gray-600 text-lg">
      Elwasta is a hiring platform designed to remove favoritism from recruitment.
      We connect companies and candidates through structured interviews,
      AI-powered matching, and transparent decision-making.
    </p>

    <p className="text-gray-600 text-lg">
      Recruiters hire based on real requirements, and candidates are evaluated
      based on skills — not connections.
    </p>
  </div>

</section>

{/* Split screen */}
<section className="py-24 grid md:grid-cols-2 gap-12">

  {/* OSAMA – Recruiters */}
<div className="border rounded p-8 space-y-6">
  <h2 className="text-2xl font-bold">Osama</h2>
  <p className="text-gray-600">For Recruiters</p>

  <div className="space-y-2 text-gray-700">
    <p>• AI-ranked candidates based on your job</p>
    <p>• Pre-interviewed profiles</p>
    <p>• Pay only when you unlock</p>
  </div>

  {/* Trust + Pricing */}
  <div className="space-y-2 text-sm">
    <p className="text-gray-500">
      Most recruiters unlock within 48 hours
    </p>

    <p className="font-medium text-black">Pricing</p>
    <p className="text-gray-500">Pay per job. No subscriptions.</p>

    <div className="space-y-1 text-gray-700">
      <div className="flex justify-between">
        <span>Junior (0–5 years)</span>
        <span>100 USD</span>
      </div>
      <div className="flex justify-between">
        <span>Mid-level (6–9 years)</span>
        <span>150 USD</span>
      </div>
      <div className="flex justify-between">
        <span>Senior (10+ years)</span>
        <span>250 USD</span>
      </div>
    </div>
  </div>

  <AudioButton src="/audio/osama.mp3" />

  <Link
    href="/login"
    className="inline-block bg-black text-white px-6 py-3 rounded"
  >
    Start hiring
  </Link>
</div>

  {/* TAMARA – Candidates */}
  <div className="border rounded p-8 space-y-6">
    <h2 className="text-2xl font-bold">Tamara</h2>
    <p className="text-gray-600">For Candidates</p>

    <div className="space-y-2 text-gray-700">
      <p>• Fair evaluation based on skills</p>
      <p>• Structured interviews</p>
      <p>• No connections required</p>
    </div>

    {/* Reassurance + pricing */}
    <div className="space-y-1 text-sm text-gray-500">
      <p>Most candidates complete onboarding in under 10 minutes</p>
      <p>
        <span className="font-medium text-black">Pricing:</span> Always free
      </p>
    </div>

    <AudioButton src="/audio/tamara.mp3" />

    <Link
      href="/candidate/onboard"
      className="inline-block border px-6 py-3 rounded"
    >
      Join as a candidate
    </Link>
  </div>

</section>


    </main>
  );
}
