"""
Generate nation-themed commander victory & defeat voice lines using Gemini 3.8 Flash TTS.
Usage:
  pip install google-genai
  set GEMINI_API_KEY=your_api_key
  python scripts/generate_commander_voices.py
"""

import os
import sys
import time
import wave
from pathlib import Path
from google import genai
from google.genai import types
from google.genai.errors import ClientError

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "sound" / "voices"
OUT_DIR.mkdir(parents=True, exist_ok=True)

COMMANDER_SCRIPTS = [
    # Kael Vance (USA - English)
    {"file": "kael_vance_select.wav", "voice": "Fenrir", "prompt": "Vanguard ready!"},
    {"file": "kael_vance_win.wav", "voice": "Fenrir", "prompt": "Vanguard victorious!"},
    {"file": "kael_vance_lose.wav", "voice": "Fenrir", "prompt": "Fall back and regroup!"},
    # Vespera Noctis (France - French)
    {"file": "vespera_noctis_select.wav", "voice": "Aoede", "prompt": "Les ombres attendent."},
    {"file": "vespera_noctis_win.wav", "voice": "Aoede", "prompt": "La flotte fantôme triomphe !"},
    {"file": "vespera_noctis_lose.wav", "voice": "Aoede", "prompt": "L'illusion se dissipe..."},
    # Akira Sato (Japan - Japanese)
    {"file": "akira_sato_select.wav", "voice": "Puck", "prompt": "いつでも出撃できる！"},
    {"file": "akira_sato_win.wav", "voice": "Puck", "prompt": "速すぎて捉えられないな！"},
    {"file": "akira_sato_lose.wav", "voice": "Puck", "prompt": "見事な一戦だった。"},
    # Lyra Chen (China - Mandarin Chinese)
    {"file": "lyra_chen_select.wav", "voice": "Kore", "prompt": "声呐已上线。"},
    {"file": "lyra_chen_win.wav", "voice": "Kore", "prompt": "目标已全部清除！"},
    {"file": "lyra_chen_lose.wav", "voice": "Kore", "prompt": "信号已丢失…"},
    # Viktor Krane (Russia - Russian)
    {"file": "viktor_krane_select.wav", "voice": "Charon", "prompt": "Крепость наготове."},
    {"file": "viktor_krane_win.wav", "voice": "Charon", "prompt": "Сокрушены сталью!"},
    {"file": "viktor_krane_lose.wav", "voice": "Charon", "prompt": "Крепость падает…"},
]


def save_wav(out_path: Path, raw_bytes: bytes):
    if raw_bytes.startswith(b"RIFF"):
        out_path.write_bytes(raw_bytes)
        return
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(raw_bytes)


def load_dotenv():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and v and k not in os.environ:
            os.environ[k] = v


def main():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("ERROR: Please set GEMINI_API_KEY in .env before running this script.")

    start_from = None
    if "--from" in sys.argv:
        idx = sys.argv.index("--from")
        if idx + 1 < len(sys.argv):
            start_from = sys.argv[idx + 1]

    client = genai.Client(api_key=api_key)
    started = start_from is None

    for i, item in enumerate(COMMANDER_SCRIPTS):
        if not started:
            if item["file"] == start_from:
                started = True
            else:
                continue

        print(f"Generating {item['file']} ({item['voice']})...", flush=True)
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model="gemini-3.8-flash-tts",
                    contents=item["prompt"],
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=item["voice"]
                                )
                            )
                        ),
                    ),
                )
                break
            except ClientError as err:
                if err.code == 429 and attempt < 2:
                    print("  Rate limit (429). Waiting 60s before retry...", flush=True)
                    time.sleep(60)
                else:
                    raise

        saved = False
        for part in response.parts:
            if part.inline_data and part.inline_data.data:
                save_wav(OUT_DIR / item["file"], part.inline_data.data)
                saved = True
                break
        if not saved:
            print(f"  WARNING: No audio returned for {item['file']}", flush=True)

        # Stay safely within Free Tier 3 requests/min limit
        if i < len(COMMANDER_SCRIPTS) - 1:
            time.sleep(21)

    print("Done! All commander voices saved to", OUT_DIR)


if __name__ == "__main__":
    main()

