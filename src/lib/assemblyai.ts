export const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY as string;

export const  ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2";

if (!ASSEMBLYAI_API_KEY) {
  throw new Error("Missing ASSEMBLYAI_API_KEY in environment variables");
}
