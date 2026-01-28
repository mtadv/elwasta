import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file received" },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error: any) {
    console.error("Transcription error:", error);

    return NextResponse.json(
      {
        error: "Transcription failed",
        details: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
