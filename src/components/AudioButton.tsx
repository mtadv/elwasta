"use client";

import { useRef, useState, useEffect } from "react";

type Props = {
  src: string;
};

export default function AudioButton({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const update = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    audio.addEventListener("timeupdate", update);
    audio.addEventListener("ended", () => setPlaying(false));

    return () => {
      audio.removeEventListener("timeupdate", update);
    };
  }, []);

  return (
    <div className="space-y-2">
      <button
        onClick={toggle}
        className="border px-4 py-2 rounded text-sm"
      >
        {playing ? "⏸ Pause" : "▶️ Listen"}
      </button>

      {/* Waveform */}
      <div className="h-1 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <audio ref={audioRef} src={src} />
    </div>
  );
}
