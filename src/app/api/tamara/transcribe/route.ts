import {
  ASSEMBLYAI_API_KEY,
  ASSEMBLYAI_BASE_URL,
} from "@/lib/assemblyai";
import { openai } from "@/lib/openai";
import { TAMARA_SYSTEM_PROMPT } from "@/lib/prompts/tamara";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export const sessionMemory = new Map<string, Message[]>();

const WARM_UP_TURNS = 3;

/* =========================
   HELPERS
========================= */

function isEnglish(text: string) {
  return /^[A-Za-z0-9\s.,!?'"()-]+$/.test(text);
}

function isWarmUp(messages: Message[]) {
  return messages.filter(m => m.role === "user").length < WARM_UP_TURNS;
}

async function ensureCandidate(candidateId?: string | null) {
  if (candidateId) return candidateId;

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      source: "tamara",
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Failed to create candidate");
  }

  return data.id;
}

async function loadCandidateContext(
  candidateId: string,
  warmUp: boolean
) {
  if (warmUp) return null;

  const { data } = await supabase
    .from("candidates")
    .select("cv_text, profile")
    .eq("id", candidateId)
    .single();

  return {
    cv: data?.cv_text ?? null,
    profile: data?.profile ?? null,
  };
}

async function extractCandidateProfile(messages: Message[]) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Extract a structured candidate profile from the conversation.
Return ONLY valid JSON with these fields:
name, email, mobile_number, current_role, years_experience,
skills, preferred_roles, salary_expectation, availability, language.
If info is missing, leave it empty.
Do not add text before or after the JSON.
`,
      },
      ...messages,
    ],
  });

  return completion.choices[0]?.message?.content;
}

/* =========================
   ROUTE
========================= */

export async function POST(req: Request) {
  try {
    console.log("➡️ Tamara: Received audio");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const sessionId = formData.get("sessionId") as string;
    let candidateId = formData.get("candidateId") as string | null;

    if (!sessionId) {
      return new Response("Missing session", { status: 400 });
    }

    const previousMessages =
      sessionMemory.get(sessionId) ?? [];

    /* =========================
       FIRST CALL — TAMARA SPEAKS
    ========================== */
    if (!audioFile && previousMessages.length === 0) {
      const openingMessage = `
Hi أنا تمارا، مسؤولة HR.
حابّة أتكلم معاك شوية عن خبرتك
ونفهم مع بعض إيه الخطوة الجاية المناسبة ليك.
`;

      previousMessages.push({
        role: "assistant",
        content: openingMessage,
      });

      sessionMemory.set(sessionId, previousMessages);

      const speech = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input: openingMessage,
      });

      return new Response(
        Buffer.from(await speech.arrayBuffer()),
        { headers: { "Content-Type": "audio/mpeg" } }
      );
    }

    /* =========================
       ASSEMBLY AI — UPLOAD
    ========================== */
    const uploadRes = await fetch(
      `${ASSEMBLYAI_BASE_URL}/upload`,
      {
        method: "POST",
        headers: { authorization: ASSEMBLYAI_API_KEY },
        body: audioFile!,
      }
    );

    const uploadData = await uploadRes.json();
    if (!uploadData.upload_url) {
      throw new Error("AssemblyAI upload failed");
    }

    /* =========================
       TRANSCRIPTION
    ========================== */
    const transcriptRes = await fetch(
      `${ASSEMBLYAI_BASE_URL}/transcript`,
      {
        method: "POST",
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: uploadData.upload_url,
          language_detection: true,
          punctuate: true,
        }),
      }
    );

    const transcriptData = await transcriptRes.json();
    if (!transcriptData.id) {
      throw new Error("Transcript creation failed");
    }

    let transcriptText = "";
    let attempts = 0;

    while (attempts < 12) {
      attempts++;
      const pollRes = await fetch(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptData.id}`,
        { headers: { authorization: ASSEMBLYAI_API_KEY } }
      );

      const pollData = await pollRes.json();

      if (pollData.status === "completed" && pollData.text) {
        transcriptText = pollData.text;
        break;
      }

      if (pollData.status === "failed") {
        throw new Error("Transcription failed");
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    if (!transcriptText || transcriptText.trim().length < 2) {
      return new Response("", { status: 204 });
    }

    console.log("🧠 User said:", transcriptText);

    previousMessages.push({
      role: "user",
      content: transcriptText,
    });

    const warmUp = isWarmUp(previousMessages);

    /* =========================
       CREATE CANDIDATE (DEFERRED)
    ========================== */
    if (!candidateId && previousMessages.length >= 2) {
      candidateId = await ensureCandidate(candidateId);
    }

    const candidateContext =
      candidateId
        ? await loadCandidateContext(candidateId, warmUp)
        : null;

    /* =========================
       TAMARA THINKS
    ========================== */
    const systemPrompt = `
${TAMARA_SYSTEM_PROMPT}

MODE: ${warmUp ? "WARM_UP" : "STRUCTURED"}

${!warmUp && candidateContext ? `
CANDIDATE CONTEXT:
${JSON.stringify(candidateContext)}
` : ""}

RULES:
- Detect language from LAST user message only
- English → reply in English
- Arabic → reply in Egyptian Arabic only

${warmUp ? `
WARM UP:
- Be friendly and conversational
- Ask ONE open-ended question
- Let the candidate talk freely
` : `
STRUCTURED:
- Ask ONE clear HR question
- Keep reply under 25 words
`}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...previousMessages,
      ],
    });

    const reply =
      completion.choices[0]?.message?.content ??
      (isEnglish(transcriptText)
        ? "Could you tell me more?"
        : "ممكن تحكيلي أكتر؟");

    previousMessages.push({
      role: "assistant",
      content: reply,
    });

    sessionMemory.set(sessionId, previousMessages);

    /* =========================
       SAVE PROFILE (SAFE)
    ========================== */
    if (!warmUp && candidateId && previousMessages.length >= 4) {
      try {
        const profileJson =
          await extractCandidateProfile(previousMessages);

        if (profileJson) {
          let parsed;
          try {
            parsed = JSON.parse(profileJson);
          } catch {
            parsed = { raw: profileJson };
          }

          await supabase
            .from("candidates")
            .upsert(
              { id: candidateId, profile: parsed },
              { onConflict: "id" }
            );
        }
      } catch (e) {
        console.error("❌ Profile save error:", e);
      }
    }

    /* =========================
       TAMARA SPEAKS
    ========================== */
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: reply,
    });

    return new Response(
      Buffer.from(await speech.arrayBuffer()),
      { headers: { "Content-Type": "audio/mpeg" } }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("🔥 Tamara error:", message);
    return new Response(message, { status: 500 });
  }
}
