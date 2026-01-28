"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/ga";


/* =========================
   DOMAIN TYPES
========================== */
type Job = {
  id: string;
  status: string;
  created_at: string;
  brief_final: {
    role_title?: string;
  } | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  type: string;
  created_at: string;
};

type CandidateProfile = {
  name?: string;
  current_role?: string;
  preferred_roles?: string;
  years_experience?: string;
  salary_expectation?: string;
  language?: string;
  skills?: string | string[];
  availability?: string;
};

type ShortlistItem = {
  score: number;
  summary: string;
  profile: CandidateProfile | null;
  candidateId: string; // ✅ ADD
};

/* =========================
   API RESPONSE TYPES
========================== */
type ShortlistApiItem = {
  score?: number;
  summary?: string;
  candidate?: {
    id?: string;
    profile?: CandidateProfile | string | null;
  };
};

type ShortlistApiResponse = {
  shortlist: ShortlistApiItem[];
};

/* =========================
   FULL CANDIDATE TYPE
========================== */
type JsonValue = Record<string, unknown>;

type FullCandidate = {
  id: string;
  name: string | null;
  email: string | null;
  profile: JsonValue | null;
  cv_profile: JsonValue | null;
  final_profile: JsonValue | null;
  cv_text: string | null;
  cv_summary: JsonValue | null;
  interview_profile: JsonValue | null;
};

/* =========================
   COMPONENT
========================== */
export default function DashboardPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [recruiterId, setRecruiterId] = useState<string | null>(null);

  const [shortlist, setShortlist] = useState<ShortlistItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobSummary, setJobSummary] = useState<string | null>(null);
  const [jobUnlocked, setJobUnlocked] = useState(false);

  /* 🔓 UNLOCK STATE (ADDED) */
  const [unlockedCandidates, setUnlockedCandidates] = useState<
    Record<string, FullCandidate>
  >({});

  /* =========================
     LOAD AUTH + JOBS
  ========================== */
  useEffect(() => {
    const loadJobs = async () => {
      const { data } = await supabaseClient.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setRecruiterId(data.user.id);

      const { data: jobs } = await supabaseClient
        .from("jobs")
        .select("id, status, created_at, brief_final")
        .eq("recruiter_id", data.user.id)
        .order("created_at", { ascending: false });

      setJobs(jobs ?? []);
      setLoading(false);
    };

    loadJobs();
  }, [router]);

  /* =========================
     LOAD DASHBOARD DATA
  ========================== */
  useEffect(() => {
    if (!selectedJobId || !recruiterId) return;

    const loadDashboard = async () => {
      try {
        /* =========================
           RUN MATCHING FIRST
        ========================== */
        await fetch("/api/matching/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: selectedJobId }),
        });

        /* =========================
           FETCH SHORTLIST
        ========================== */
        const shortlistRes = await fetch(
          `/api/shortlist/${selectedJobId}`
        );

        if (shortlistRes.ok) {
          const apiData: ShortlistApiResponse =
            await shortlistRes.json();

          const normalized: ShortlistItem[] = apiData.shortlist.map(
            (item) => {
              let profile: CandidateProfile | null = null;
              const rawProfile = item.candidate?.profile ?? null;

              try {
                if (typeof rawProfile === "string") {
                  const cleaned = rawProfile
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/\s*```$/i, "")
                    .trim();

                  profile = JSON.parse(cleaned);
                } else if (rawProfile && typeof rawProfile === "object") {
                  profile = rawProfile as CandidateProfile;
                }
              } catch (e) {
                console.error("❌ Failed to parse candidate profile", e);
                profile = null;
              }

              return {
                score: item.score ?? 0,
                summary: item.summary ?? "",
                profile,
                candidateId: item.candidate?.id ?? "",
              };
            }
          );

          setShortlist(normalized);
        }
      } catch (e) {
        console.error("Shortlist fetch failed", e);
      }

      /* =========================
         EXISTING DASHBOARD LOGIC
      ========================== */
      const dashboardRes = await fetch(
        "/api/recruiter/dashboard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: selectedJobId,
            recruiterId,
          }),
        }
      );

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setTasks(data.tasks ?? []);
        setJobSummary(data.job?.summary ?? null);
      }
    };

    loadDashboard();
  }, [selectedJobId, recruiterId]);

  /* =========================
     CREATE NEW JOB REQUEST
  ========================== */
  const createNewRequest = async () => {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) {
      router.push("/login");
      return;
    }

    const res = await fetch("/api/jobs/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });

    if (!res.ok) {
      alert("Failed to create request");
      return;
    }

    const json = await res.json();
    router.push(`/osama/${json.jobId}`);
  };

  /* =========================
     UNLOCK HANDLER (PAYMOB)
  ========================== */
  const unlockJob = async () => {
    if (!selectedJobId) return;
  
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }
  
    const res = await fetch("/api/payments/paymob/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ jobId: selectedJobId }),
    });
  
    if (!res.ok) {
      alert("Failed to start payment");
      return;
    }
  
    const { iframe_url } = await res.json();
    trackEvent("payment_initiated", {
      job_id: selectedJobId,
      currency: "EGP",
      value: 12500, // or dynamic later
    });
    
    window.location.href = iframe_url;
  };
  
  /* =========================
     UI
  ========================== */
  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Requests</h1>
        <button
          onClick={createNewRequest}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + New Request
        </button>
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="mb-6">
         <div
  className="border p-4 rounded cursor-pointer"
  onClick={() =>
    setSelectedJobId(
      selectedJobId === job.id ? null : job.id
    )
  }
>
  <div className="space-y-1">
    <div className="font-medium">{(() => {
  try {
    const brief =
      typeof job.brief_final === "string"
        ? JSON.parse(job.brief_final)
        : job.brief_final;

    return brief?.role_title ?? "Untitled role";
  } catch {
    return "Untitled role";
  }
})()}
</div>

    <div>
      <b>Status:</b> {job.status}
    </div>

    <div className="text-sm text-gray-500">
      {new Date(job.created_at).toLocaleString()}
    </div>
  </div>
</div>


          {selectedJobId === job.id && (
            <div className="mt-4 space-y-4">
              {shortlist.map((item, i) => {
                const candidateId = item.candidateId; // ✅ REAL ID
                const unlocked = unlockedCandidates[candidateId];

                return (
                  <div key={i} className="border rounded-lg p-4">
                    <h3 className="font-bold mb-2">
                      Match Score: {item.score}%
                    </h3>

                    <p className="text-gray-600 mb-2">
                      {item.summary}
                    </p>

                    {unlocked ? (
  /* =========================
     UNLOCKED VIEW
  ========================== */
  <div className="text-sm text-gray-700 space-y-2">
    <div>
      <b>Name:</b> {unlocked.name}
    </div>

    <div>
      <b>Email:</b> {unlocked.email}
    </div>

    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
      {unlocked.cv_text}
    </pre>

    {/* 📄 Download CV (ONLY AFTER UNLOCK) */}
    {jobUnlocked && (
      <button
        onClick={async () => {
          const { data } = await supabaseClient.auth.getSession();
          if (!data.session) return;

          const res = await fetch(
            `/api/candidate/${candidateId}/cv-pdf?jobId=${selectedJobId}`,
            {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`,
              },
            }
          );

          if (!res.ok) {
            alert("Please unlock the job to download CVs");
            return;
          }

          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = `${unlocked.name ?? "candidate"}-CV.pdf`;
          a.click();

          URL.revokeObjectURL(url);
        }}
        className="text-blue-600 underline text-sm"
      >
        📄 Download CV (PDF)
      </button>
    )}
  </div>
) : (
  /* =========================
     LOCKED VIEW
  ========================== */
  <>
    <div className="text-sm text-gray-700 space-y-1">
      <div>
        <b>Role:</b>{" "}
        {item.profile?.current_role ?? "See full profile"}
      </div>

      <div>
        <b>Preferred Role:</b>{" "}
        {item.profile?.preferred_roles ?? "See full profile"}
      </div>

      <div>
        <b>Experience:</b>{" "}
        {item.profile?.years_experience ?? "See full profile"}
      </div>

      <div>
        <b>Skills:</b>{" "}
        {Array.isArray(item.profile?.skills)
          ? item.profile.skills.join(", ")
          : item.profile?.skills ?? "See full profile"}
      </div>

      <div>
        <b>Availability:</b>{" "}
        {item.profile?.availability ?? "See full profile"}
      </div>

      <div>
        <b>Language:</b>{" "}
        {item.profile?.language ?? "See full profile"}
      </div>

      <div>
        <b>Salary Expectation:</b>{" "}
        {item.profile?.salary_expectation ?? "See full profile"}
      </div>
    </div>

    {/* 🔓 Unlock button – once per job */}
    {!jobUnlocked && i === 0 && (
      <button
        onClick={unlockJob}
        className="mt-3 border px-3 py-1 rounded text-sm"
      >
        🔓 Unlock all shortlisted candidates
      </button>
    )}
  </>
)}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
