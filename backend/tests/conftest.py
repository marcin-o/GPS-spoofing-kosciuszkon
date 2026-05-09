import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Force TTS off so tests don't try to spawn piper subprocesses.
os.environ.setdefault("TTS_ENABLED", "false")
