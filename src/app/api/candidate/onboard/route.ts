export const runtime = "edge";

import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { extractText } from "unpdf";

/* =========================
   CONFIG
========================== */
const MAX_CHARS_PER_CHUNK = 6_000; // safe for gpt-4o-mini
const MAX_CHUNKS = 4; // hard cap to avoid runaway tokens

/* =========================
   TYPES
========================== */
type CVProfile = {
  name: string | null;
  current_role: string | null;
  years_experience: number | null;
  skills: string[];
  previous_roles: string[];
  industries: string[];
  education: string[];
};

/* =========================
   HELPERS
========================== */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < MAX_CHUNKS) {
    chunks.push(text.slice(start, start + MAX_CHARS_PER_CHUNK));
    start += MAX_CHARS_PER_CHUNK;
  }

  return chunks;
}

function emptyProfile(): CVProfile {
  return {
    name: null,
    current_role: null,
    years_experience: null,
    skills: [],
    previous_roles: [],
    industries: [],
    education: [],
  };
}

function mergeProfiles(base: CVProfile, incoming: CVProfile): CVProfile {
  return {
    name: incoming.name ?? base.name,
    current_role: incoming.current_role ?? base.current_role,
    years_experience:
      incoming.years_experience ?? base.years_experience,
    skills: Array.from(new Set([...base.skills, ...incoming.skills])),
    previous_roles: Array.from(
      new Set([...base.previous_roles, ...incoming.previous_roles])
    ),
    industries: Array.from(
      new Set([...base.industries, ...incoming.industries])
    ),
    education: Array.from(
      new Set([...base.education, ...incoming.education])
    ),
  };
}

/* =========================
   ROUTE
========================== */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string | null;
    const email = formData.get("email") as string | null;
    const cvFile = formData.get("cv") as File | null;

    if (!name || !email || !cvFile) {
      return new Response("Missing data", { status: 400 });
    }

    /* =========================
       1️⃣ PDF → TEXT (EDGE SAFE)
    ========================== */
    const buffer = new Uint8Array(await cvFile.arrayBuffer());
    const result = await extractText(buffer);

    const cvText = Array.isArray(result.text)
      ? result.text.join("\n").trim()
      : "";

    if (!cvText) {
      return new Response("Empty CV text", { status: 400 });
    }

    /* =========================
       2️⃣ CHUNK CV
    ========================== */
    const chunks = chunkText(cvText);

    /* =========================
       3️⃣ STRUCTURED PROFILE (DETERMINISTIC)
    ========================== */
    let finalProfile = emptyProfile();

    for (const chunk of chunks) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
You extract structured CV data.
Return ONLY valid JSON with:
name (string|null)
current_role (string|null)
years_experience (number|null)
skills (string[])
previous_roles (string[])
industries (string[])
education (string[])
`,
          },
          { role: "user", content: chunk },
        ],
      });

      if (!completion.choices.length) continue;

      const parsed = completion.choices[0].message.content;
      if (!parsed) continue;

      const partial = JSON.parse(parsed) as CVProfile;
      finalProfile = mergeProfiles(finalProfile, partial);
    }

    /* =========================
       4️⃣ HUMAN SUMMARY (SAFE INPUT)
    ========================== */
    const summaryCompletion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
Write a short professional CV summary
in Egyptian Arabic with a friendly HR tone.
`,
          },
          {
            role: "user",
            content: JSON.stringify(finalProfile),
          },
        ],
      });

    const cvSummary =
      summaryCompletion.choices[0]?.message?.content ?? "";

    /* =========================
       5️⃣ UPSERT CANDIDATE
    ========================== */
    const { data: existing, error: fetchError } =
      await supabase
        .from("candidates")
        .select("id")
        .eq("email", email)
        .limit(1)
        .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    let candidateId: string;

    if (existing?.id) {
      candidateId = existing.id;

      await supabase
        .from("candidates")
        .update({
          name,
          cv_text: cvText,
          cv_profile: finalProfile,
          cv_summary: cvSummary,
          final_profile: finalProfile,
        })
        .eq("id", candidateId);
    } else {
      const { data, error } = await supabase
        .from("candidates")
        .insert({
          name,
          email,
          cv_text: cvText,
          cv_profile: finalProfile,
          cv_summary: cvSummary,
          interview_profile: {},
          final_profile: finalProfile,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        throw error ?? new Error("Insert failed");
      }

      candidateId = data.id;
    }

    /* =========================
       6️⃣ RESPONSE
    ========================== */
    return Response.json({ candidateId });
  } catch (err) {
    console.error("❌ ONBOARD ERROR:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
