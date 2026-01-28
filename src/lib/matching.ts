import { openai } from "@/lib/openai";
import { MATCHING_SYSTEM_PROMPT } from "@/lib/prompts/matching";
import {
  CandidateProfile,
  JobBrief,
  MatchResult,
} from "@/types/matching";

export async function matchCandidateToJob(
  candidateProfile: CandidateProfile,
  jobBrief: JobBrief
): Promise<MatchResult | { raw: string }> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MATCHING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `
Candidate Profile:
${JSON.stringify(candidateProfile, null, 2)}

Job Brief:
${JSON.stringify(jobBrief, null, 2)}
`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;

  if (!raw) {
    throw new Error("No matching result");
  }

  try {
    return JSON.parse(raw) as MatchResult;
  } catch {
    return { raw };
  }
}

export function isValidMatchResult(
    result: unknown
  ): result is MatchResult {
    return (
      typeof result === "object" &&
      result !== null &&
      "overall_score" in result &&
      typeof (result as MatchResult).overall_score === "number" &&
      "summary" in result &&
      typeof (result as MatchResult).summary === "string"
    );
  }
  
  

