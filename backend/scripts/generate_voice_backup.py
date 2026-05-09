"""Generate voice-backup MP3s for the three demo incident IDs.

Usage:
    python backend/scripts/generate_voice_backup.py

Tries piper-tts first (offline, neural). Falls back to no-op if it's not
installed — the silent MP3s already committed to the repo keep the demo
audio path working even without TTS.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "voice_backup"

PHRASES = {
    "flight-8243": (
        "GPS spoofing detected on Flight 8243. "
        "Position drift exceeds three sigma. Recommend manual nav."
    ),
    "hormuz-2025": (
        "Maritime spoofing surge in the Strait of Hormuz. "
        "Multiple vessels reporting positions inside Bandar Abbas airport."
    ),
    "beirut-2024": (
        "Cluster spoofing event at Beirut airport. "
        "117 ships reporting identical position. Recommend cross-check with radar."
    ),
}


def have_piper() -> bool:
    return shutil.which("piper") is not None


def have_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def synth(name: str, text: str) -> bool:
    if not have_piper() or not have_ffmpeg():
        return False
    OUT.mkdir(parents=True, exist_ok=True)
    wav_path = OUT / f"{name}.wav"
    mp3_path = OUT / f"{name}.mp3"
    try:
        subprocess.run(
            ["piper", "--output_file", str(wav_path)],
            input=text.encode("utf-8"),
            check=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame",
             "-qscale:a", "5", str(mp3_path)],
            check=True,
        )
        wav_path.unlink(missing_ok=True)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"[warn] piper/ffmpeg failed for {name}: {exc}", file=sys.stderr)
        return False


def main() -> int:
    if not have_piper():
        print("piper-tts not on PATH — skipping. Silent backup MP3s remain in place.")
        return 0
    if not have_ffmpeg():
        print("ffmpeg not on PATH — install ffmpeg or pipe piper output through lame.")
        return 1
    for name, text in PHRASES.items():
        ok = synth(name, text)
        print(f"{name}: {'ok' if ok else 'failed'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
