import { sessionMemory } from "../transcribe/route";

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  const messages = sessionMemory.get(sessionId) ?? [];

  if (!messages.length) {
    return Response.json({ summary: "No conversation recorded." });
  }

  return Response.json({
    summary: messages
      .filter(m => m.role === "user")
      .map(m => `• ${m.content}`)
      .join("\n"),
  });
}
