"use client";

import { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";

export default function OsamaPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const listeningRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const osamaAudioRef = useRef<HTMLAudioElement | null>(null);
  const callActiveRef = useRef(true);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const callStartedRef = useRef(false);
  const speakingRef = useRef(false);
  const micMutedRef = useRef(false);
const streamRef = useRef<MediaStream | null>(null);
const supabase = supabaseClient;



  /* =========================
     🎙️ AUTO LISTEN (SILENCE)
  ========================== */
  const autoListen = async () => {
    if (!callActiveRef.current || listeningRef.current) return;
    listeningRef.current = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
streamRef.current = stream;
const toggleMic = () => {
  micMutedRef.current = !micMutedRef.current;

  streamRef.current?.getAudioTracks().forEach(track => {
    track.enabled = !micMutedRef.current;
  });
};


    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    let silenceTimer: NodeJS.Timeout | null = null;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const detectSilence = () => {
      analyser.getByteFrequencyData(data);
      const volume = data.reduce((a, b) => a + b, 0) / data.length;

      if (volume > 8 && !userSpeakingRef.current) {
        userSpeakingRef.current = true;
        osamaAudioRef.current?.pause();
      }

      if (volume < 5) {
        if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            mediaRecorder.stop();
          }, 1200);
        }
      } else {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = null;
      }

      if (mediaRecorder.state === "recording") {
        requestAnimationFrame(detectSilence);
      }
    };

    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      listeningRef.current = false;
      userSpeakingRef.current = false;
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      if (audioBlob.size < 1500) {
        autoListen();
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("sessionId", sessionIdRef.current);
      formData.append("jobId", jobId);

      const res = await fetch("/api/osama/intake", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        autoListen();
        return;
      }

      const replyBlob = await res.blob();
      const replyUrl = URL.createObjectURL(replyBlob);
      setAudioURL(replyUrl);

      const audio = new Audio(replyUrl);
      osamaAudioRef.current = audio;
      audio.play();

      audio.onended = () => autoListen();
    };

    mediaRecorder.start();
    detectSilence();
  };

/* =========================
   📞 START CALL (Osama speaks first)
========================== */
useEffect(() => {
  if (!jobId) return;

  // 🔒 Guard: run only once
  if (callStartedRef.current) return;
  callStartedRef.current = true;

  const startCall = async () => {
    try {
      const formData = new FormData();
      formData.append("sessionId", sessionIdRef.current);
      formData.append("jobId", jobId);

      const res = await fetch("/api/osama/intake", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Osama start call failed");
        return;
      }

      const audioBlob = await res.blob();
      if (audioBlob.size === 0) {
        console.warn("No opening audio from Osama");
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      osamaAudioRef.current = audio;

      audio.play();

      audio.onended = () => {
        autoListen(); // 🔁 start silence-based loop
      };
    } catch (err) {
      console.error("Osama start call error", err);
    }
  };


  startCall();
}, [jobId]);

/* =========================
   🛑 END CALL
========================== */
const endCall = async () => {
  callActiveRef.current = false;
  mediaRecorderRef.current?.stop();

  await fetch("/api/osama/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: sessionIdRef.current,
      jobId,
    }),
  });

  window.location.href = "/recruiter/dashboard";
};

return (
  <main className="flex min-h-screen flex-col items-center justify-center gap-6">
    {/* Avatar */}
    <div className="relative">
      <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 animate-spin-slow" />
      <div className="absolute inset-0 rounded-full border-4 border-blue-300 animate-ping" />
    </div>

   {/* Name */}
<h1 className="text-2xl font-bold">أسامة Osama</h1>
<p className="text-sm text-gray-500 mt-1">
  Osama speaks English · أسامة بيتكلم عربي
</p>

    {/* Waveform */}
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-2 h-8 bg-blue-400 animate-bounce"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>

    {/* Status */}
    <div className="text-blue-500 border border-blue-300 px-4 py-1 rounded-full">
      Listening
    </div>

    {/* Controls */}
<div className="flex gap-4 bg-gray-100 px-6 py-4 rounded-full">
  <button className="w-12 h-12 rounded-full bg-gray-200">⋯</button>


  <button className="w-12 h-12 rounded-full bg-gray-200">
    ⌨️
  </button>

  <button className="w-12 h-12 rounded-full bg-gray-200 text-orange-500">
    ⚠️
  </button>

  <button
    onClick={endCall}
    className="w-12 h-12 rounded-full bg-red-500 text-white"
  >
    📞
  </button>
</div>

    {audioURL && <audio src={audioURL} className="hidden" />}
  </main>
);
}
