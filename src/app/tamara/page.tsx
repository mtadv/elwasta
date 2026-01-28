"use client";

import { useRef, useState, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function TamaraPage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const callStartTimeRef = useRef<number | null>(null);
  const callActiveRef = useRef<boolean>(true);
  const mutedRef = useRef<boolean>(false);

  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callEnded, setCallEnded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const tamaraAudioRef = useRef<HTMLAudioElement | null>(null);
  const userSpeakingRef = useRef<boolean>(false);
  const callStartedRef = useRef<boolean>(false);
  const [callStarted, setCallStarted] = useState(false);
  const listeningRef = useRef<boolean>(false);
  const stopCalledRef = useRef<boolean>(false);
  const startedOnceRef = useRef<boolean>(false);
  const candidateIdRef = useRef<string | null>(null);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  candidateIdRef.current = params.get("candidateId");
}, []);





  



  /* =========================
     ⏱️ CALL TIMER
  ========================== */
  useEffect(() => {
    if (callEnded) return;

    const interval = setInterval(() => {
      setCallDuration(
        callStartTimeRef.current
  ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
  : 0

      );
    }, 1000);
  
    return () => clearInterval(interval);
  }, [callEnded]);
  

  /* =========================
     🎙️ AUTO LISTEN (SILENCE BASED)
  ========================== */
  const autoListen = async () => {
    if (!callActiveRef.current) return;
    if (listeningRef.current) return;
listeningRef.current = true;
    


    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    stopCalledRef.current = false;

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
      const volume =
  data.reduce((a, b) => a + b, 0) / data.length;

// 🛑 USER STARTED SPEAKING → STOP TAMARA
if (volume > 8 && !userSpeakingRef.current) {
  userSpeakingRef.current = true;
  tamaraAudioRef.current?.pause();
}

      if (volume < 5) {
        if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            if (stopCalledRef.current) return;
            stopCalledRef.current = true;
            mediaRecorder.stop();
          }, 1200);
        }
      } else {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      }

      if (mediaRecorder.state === "recording") {
        requestAnimationFrame(detectSilence);
      }
    };

    mediaRecorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    


    mediaRecorder.onstop = async () => {
      stopCalledRef.current = true;
    
      listeningRef.current = false;
      userSpeakingRef.current = false;
    
      stream.getTracks().forEach((t) => t.stop());
      if (!callActiveRef.current) return;
    
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
    
      if (audioBlob.size < 1500) {
        autoListen();
        return;
      }
    
      // fetch → play reply

      

      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");
      formData.append("sessionId", sessionIdRef.current);
      if (candidateIdRef.current) {
        formData.append("candidateId", candidateIdRef.current);
      }
      


      const res = await fetch("/api/tamara/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Tamara backend error");
        listeningRef.current = false;
        autoListen(); // recover loop
        return;
      }
      
      const replyBlob = await res.blob();

if (replyBlob.size === 0) {
  console.warn("⚠️ No audio reply — continuing listen");
  listeningRef.current = false;
  autoListen();
  return;
}

const replyUrl = URL.createObjectURL(replyBlob);
setAudioURL(replyUrl);

const audio = new Audio(replyUrl);
audio.muted = mutedRef.current;
audio.play();



      audio.onended = () => {
        listeningRef.current = false;
        autoListen(); // 🔁 LOOP
      };
    };

    mediaRecorder.start();
    detectSilence();
  };

  /* =========================
     📞 START CALL (Tamara speaks first)
  ========================== */
  useEffect(() => {
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;
  
    const startCall = async () => {
      callStartTimeRef.current = Date.now();
      setCallStarted(true);
  
      const formData = new FormData();
      formData.append("sessionId", sessionIdRef.current);
      if (candidateIdRef.current) {
        formData.append("candidateId", candidateIdRef.current);
      }
      
  
      const res = await fetch("/api/tamara/transcribe", {
        method: "POST",
        body: formData,
      });
  
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
  
      const audio = new Audio(audioUrl);
      tamaraAudioRef.current = audio;
      audio.muted = mutedRef.current;
      audio.play();
  
      audio.onended = () => {
        autoListen();
      };
    };
  
    startCall();
  }, []);
  

  /* =========================
     🛑 END CALL
  ========================== */
  const endCall = async () => {
    callActiveRef.current = false;
    setCallEnded(true);
    mediaRecorderRef.current?.stop();

    const res = await fetch("/api/tamara/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
      }),
    });

    const data = await res.json();
    setSummary(data.summary);
  };

  /* =========================
     🔇 MUTE
  ========================== */
  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  /* =========================
     🧾 END SCREEN
  ========================== */
  if (callEnded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-bold">المكالمة انتهت</h1>
        <p className="text-gray-600">
          مدة المكالمة: {callDuration} ثانية
        </p>

        {summary && (
          <div className="bg-gray-100 p-4 rounded max-w-xl text-center">
            <h2 className="font-bold mb-2">ملخص المقابلة</h2>
            <p>{summary}</p>
          </div>
        )}
      </main>
    );
  }

  /* =========================
     🎨 CALL UI
  ========================== */
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      {/* Avatar */}
      <div className="relative">
      <div className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-300 to-pruple-500 animate-spin-slow" />
        <div className="absolute inset-0 rounded-full border-4 border-purple-300 animate-ping" />
      </div>

      {/* Name */}
<h1 className="text-2xl font-bold"> Tamara تمارا</h1>
<p className="text-sm text-gray-500 mt-1">
  Tamara speaks English · تمارا بتتكلم عربي
</p>
      {/* Waveform */}
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-2 h-8 bg-purple-400 animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Duration */}
      <p className="text-gray-600">
        مدة المكالمة: {callDuration} ثانية
      </p>

   {/* Call Status */}
<div className="text-purple-500 border border-purple-300 px-4 py-1 rounded-full">
  {muted ? "Listening" : "Speaking"}
</div>

{/* Controls */}
<div className="flex gap-4 bg-gray-100 px-6 py-4 rounded-full">
  <button className="w-12 h-12 rounded-full bg-gray-200">⋯</button>

  <button
    onClick={toggleMute}
    className="w-12 h-12 rounded-full bg-gray-200"
  >
    🎤
  </button>

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
