"""POST /api/alerts/{id}/speak — cockpit voice alert.

Tries piper-tts (offline neural TTS); falls back to a pre-recorded MP3 in
backend/app/data/voice_backup/{id}.mp3. Returns 503 if neither path works.
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])

_BACKUP_DIR = Path(__file__).resolve().parents[1] / "data" / "voice_backup"
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_PHRASES: dict[str, str] = {
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

_AUDIO_HEADERS = {"Cache-Control": "no-store"}


def _phrase_for(alert_id: str) -> str:
    if alert_id in _PHRASES:
        return _PHRASES[alert_id]
    if alert_id.startswith("flight-"):
        flight = alert_id.split("-", 1)[1].split("-", 1)[0]
        return (
            f"GPS spoofing detected on Flight {flight}. "
            "Position drift exceeds three sigma. Recommend manual nav."
        )
    return f"GPS spoofing alert for {alert_id}. Recommend manual navigation."


def _try_piper(text: str) -> bytes | None:
    if not settings.tts_enabled:
        return None
    if shutil.which("piper") is None:
        return None
    if shutil.which("ffmpeg") is None:
        logger.warning("piper present but ffmpeg missing — skipping TTS synthesis")
        return None
    try:
        with tempfile.TemporaryDirectory() as td:
            wav_path = Path(td) / "speak.wav"
            mp3_path = Path(td) / "speak.mp3"
            subprocess.run(
                ["piper", "--output_file", str(wav_path)],
                input=text.encode("utf-8"),
                check=True,
                timeout=15,
            )
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(wav_path),
                 "-codec:a", "libmp3lame", "-qscale:a", "5", str(mp3_path)],
                check=True,
                timeout=15,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return mp3_path.read_bytes()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        logger.warning("piper-tts failed: %s — falling back to backup MP3", exc)
        return None


def _backup_path_for(alert_id: str) -> Path | None:
    candidate = _BACKUP_DIR / f"{alert_id}.mp3"
    if candidate.exists():
        return candidate
    # Tolerate compound IDs like "flight-8243-spoof" by matching the prefix.
    for known in _PHRASES.keys():
        if alert_id.startswith(known):
            fallback = _BACKUP_DIR / f"{known}.mp3"
            if fallback.exists():
                return fallback
    return None


@router.post("/{alert_id}/speak")
def speak_alert(alert_id: str) -> Response:
    if not _VALID_ID.match(alert_id):
        raise HTTPException(status_code=400, detail="invalid alert id")

    audio = _try_piper(_phrase_for(alert_id))
    if audio is not None:
        return Response(content=audio, media_type="audio/mpeg", headers=_AUDIO_HEADERS)

    backup = _backup_path_for(alert_id)
    if backup is not None:
        logger.warning("serving backup voice MP3 for %s from %s", alert_id, backup.name)
        return Response(
            content=backup.read_bytes(),
            media_type="audio/mpeg",
            headers=_AUDIO_HEADERS,
        )

    logger.error("no TTS and no backup MP3 for alert id %s", alert_id)
    raise HTTPException(
        status_code=503,
        detail=f"voice alert unavailable for '{alert_id}': no TTS engine and no backup MP3",
    )
