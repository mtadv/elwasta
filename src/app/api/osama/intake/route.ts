import {
  ASSEMBLYAI_API_KEY,
  ASSEMBLYAI_BASE_URL,
} from "@/lib/assemblyai";
import { openai } from "@/lib/openai";
import { OSAMA_SYSTEM_PROMPT } from "@/lib/prompts/osama";
import { supabaseServer } from "@/lib/supabase/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type JobBrief = {
  role_title?: string;
  seniority?: string;
  years_experience?: string;
  skills?: string[];
  tools?: string[];
  industry?: string;
  language?: string;
};

/* =========================
   🧠 SESSION MEMORY
========================== */
export const sessionMemory = new Map<string, Message[]>();

function isEnglish(text: string) {
  return /^[A-Za-z0-9\s.,!?'"()-]+$/.test(text);
}

/* =========================
   🧠 JOB BRIEF EXTRACTOR
========================== */
async function extractJobBrief(messages: Message[]) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Return ONLY valid JSON with:
role_title,
seniority,
years_experience,
skills,
tools,
industry,
language
If info is missing, leave it empty.
Do not add text before or after the JSON.
`,
      },
      ...messages,
    ],
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

/* =========================
   🚀 MAIN HANDLER
========================== */
export async function POST(req: Request) {
  console.log("➡️ Osama: Received audio");

  try {
    const formData = await req.formData();

    const audioFile = formData.get("audio") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const jobId = formData.get("jobId") as string | null;

    if (!sessionId) {
      return new Response("Missing sessionId", { status: 400 });
    }

    const messages =
      sessionMemory.get(sessionId) ?? [];

    const userTurns =
      messages.filter(m => m.role === "user").length;

    const isWarmUp = userTurns < 2;

    /* =========================
       🧠 FIRST CALL — OSAMA SPEAKS
    ========================== */
    if (!audioFile && messages.length === 0) {
      const openingMessage = `
أهلاً، أنا أسامة.
هساعدك نحدد الوظيفة اللي محتاج تعيّن عليها
ونظبط كل التفاصيل خطوة خطوة.
خلينا نبدأ — إيه المنصب اللي بتفكر فيه؟
`;

      messages.push({
        role: "assistant",
        content: openingMessage,
      });

      sessionMemory.set(sessionId, messages);

      const speech = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: openingMessage,
      });

      return new Response(
        Buffer.from(await speech.arrayBuffer()),
        {
          headers: {
            "Content-Type": "audio/mpeg",
            ...(jobId ? { "x-job-id": jobId } : {}),
          },
        }
      );
    }

    /* =========================
       ❌ NO AUDIO → SKIP TURN
    ========================== */
    if (!audioFile) {
      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
      
    }

    /* =========================
       1️⃣ UPLOAD AUDIO
    ========================== */
    const uploadRes = await fetch(
      `${ASSEMBLYAI_BASE_URL}/upload`,
      {
        method: "POST",
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
        },
        body: audioFile,
      }
    );

    const uploadJson = await uploadRes.json();
    const uploadUrl: string | undefined =
      uploadJson.upload_url;

    if (!uploadUrl) {
      throw new Error("AssemblyAI upload failed");
    }

    /* =========================
       2️⃣ CREATE TRANSCRIPT
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
          audio_url: uploadUrl,
          language_detection: true,
          punctuate: true,
        }),
      }
    );

    const transcriptJson = await transcriptRes.json();
    const transcriptId: string | undefined =
      transcriptJson.id;

    if (!transcriptId) {
      throw new Error("Transcript creation failed");
    }

    /* =========================
       3️⃣ POLL TRANSCRIPTION
    ========================== */
    let transcriptText = "";
    let attempts = 0;

    while (attempts < 12) {
      attempts++;

      const pollRes = await fetch(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: {
            authorization: ASSEMBLYAI_API_KEY,
          },
        }
      );

      const pollJson = await pollRes.json();

      if (
        pollJson.status === "completed" &&
        pollJson.text
      ) {
        transcriptText = pollJson.text;
        break;
      }

      if (pollJson.status === "failed") {
        throw new Error("Transcription failed");
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!transcriptText || transcriptText.trim().length < 2) {
      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
      
    }

    console.log("🧠 Recruiter said:", transcriptText);

    /* =========================
       4️⃣ MEMORY — USER
    ========================== */
    messages.push({
      role: "user",
      content: transcriptText,
    });

    sessionMemory.set(sessionId, messages);

    /* =========================
       5️⃣ OSAMA THINKS
    ========================== */
    const detectedLanguage =
      isEnglish(transcriptText) ? "EN" : "AR";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
${OSAMA_SYSTEM_PROMPT}

MODE: ${isWarmUp ? "WARM_UP" : "STRUCTURED"}

LANGUAGE: ${detectedLanguage}

RULES:
- Detect language from the LAST user message only
- English → reply in English
- Arabic → reply in Egyptian Arabic ONLY
- Never use Gulf Arabic
- Use a professional Egyptian HR tone
- Ask ONE question only

${isWarmUp ? `
WARM UP:
- Be conversational
- Ask open-ended questions
- Let the recruiter explain freely
` : `
STRUCTURED:
- Be concise and specific
- Focus on role clarity, seniority, skills
`}
`,
        },
        ...messages,
      ],
    });

    const reply =
      completion.choices[0]?.message?.content ??
      (detectedLanguage === "EN"
        ? "Can you tell me more?"
        : "ممكن توضّحلي أكتر؟");

    console.log("🗣️ Osama reply:", reply);

    /* =========================
       6️⃣ MEMORY — ASSISTANT
    ========================== */
    messages.push({
      role: "assistant",
      content: reply,
    });

    sessionMemory.set(sessionId, messages);

    /* =========================
       7️⃣ SAVE JOB BRIEF (CLEAN)
    ========================== */
    const userMessages =
      messages.filter(m => m.role === "user");

    if (jobId && userMessages.length >= 4) {
      try {
        const briefRaw =
          await extractJobBrief(messages);

        let briefParsed: JobBrief = {};

        try {
          briefParsed = JSON.parse(briefRaw);
        } catch {
          briefParsed = {};
        }

        if (Object.keys(briefParsed).length === 0) {
          briefParsed = {
            role_title: userMessages
              .map(m => m.content)
              .join(" ")
              .slice(0, 300),
          };
        }

        const supabase = await supabaseServer();

await supabase
  .from("jobs")
  .update({
    brief_final: briefParsed,
    status: "shortlisting",
  })
  .eq("id", jobId);

      } catch (e) {
        console.error("❌ Job brief save failed", e);
      }
    }

    /* =========================
       8️⃣ TEXT → SPEECH
    ========================== */
    const speech =
      await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: reply,
        speed: 1.15,
      });

    return new Response(
      Buffer.from(await speech.arrayBuffer()),
      {
        headers: {
          "Content-Type": "audio/mpeg",
          ...(jobId ? { "x-job-id": jobId } : {}),
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("🔥 Osama error:", message);
    return new Response(message, { status: 500 });
  }
}
