"use client";

let audioCtxRef: AudioContext | null = null;

export function playBeep(volume = 0.18) {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef) audioCtxRef = new Ctor();
    const ctx = audioCtxRef;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const beepTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    beepTone(880, 0, 0.12);
    beepTone(660, 0.16, 0.18);
  } catch {
    /* ignore — audio context permission denied */
  }
}
