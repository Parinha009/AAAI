"""AI provider layer (FR-07 / FR-08 / FR-03).

Two interchangeable clients with the same two calls:
- `transcribe(path, mime)`  -> speech-to-text (Whisper-1)
- `chat(messages, ...)`     -> GPT-4o-mini completion (plain text or JSON object)

`OpenAIClient` makes the real calls. `FakeAIClient` returns clearly-labelled simulated
output so the whole interview flow runs without an API key (and tests never spend money).
`get_client()` picks one from settings: AI_PROVIDER=auto uses OpenAI only when
OPENAI_API_KEY is set.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.config import settings

SIMULATED_TAG = "[Simulated]"


@dataclass
class Transcription:
    text: str
    language: str | None = None
    duration_seconds: float = 0.0
    # Probability (0-1) that the audio held no speech, when the provider reports it.
    no_speech_prob: float | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class ChatResult:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    raw: dict = field(default_factory=dict)


class OpenAIClient:
    name = "openai"

    def __init__(self) -> None:
        from openai import OpenAI  # imported lazily so the fake path needs no SDK

        self._client = OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.ai_timeout_seconds,
            max_retries=2,
        )

    def transcribe(self, path: str, mime: str | None) -> Transcription:
        p = Path(path)
        with p.open("rb") as fh:
            result = self._client.audio.transcriptions.create(
                model=settings.openai_transcribe_model,
                file=(p.name, fh, mime or "audio/webm"),
                response_format="verbose_json",
                temperature=0.0,
            )
        raw = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        segments = raw.get("segments") or []
        no_speech = (
            min(float(s.get("no_speech_prob", 0.0)) for s in segments) if segments else None
        )
        return Transcription(
            text=(raw.get("text") or "").strip(),
            language=raw.get("language"),
            duration_seconds=float(raw.get("duration") or 0.0),
            no_speech_prob=no_speech,
            raw=raw,
        )

    def chat(self, messages: list[dict], *, json_mode: bool = False, max_tokens: int = 400) -> ChatResult:
        kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
        result = self._client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            **kwargs,
        )
        usage = result.usage
        return ChatResult(
            text=(result.choices[0].message.content or "").strip(),
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
            raw=result.model_dump(),
        )


class FakeAIClient:
    """Deterministic stand-in used when no API key is configured (and in tests)."""

    name = "fake"

    def transcribe(self, path: str, mime: str | None) -> Transcription:
        size = Path(path).stat().st_size if Path(path).exists() else 0
        if size == 0:
            return Transcription(text="", no_speech_prob=1.0)
        text = (
            f"{SIMULATED_TAG} Transcript placeholder - set OPENAI_API_KEY for real "
            f"Whisper transcription ({size} bytes of audio received)."
        )
        return Transcription(text=text, language="en", duration_seconds=round(size / 16000, 1))

    def chat(self, messages: list[dict], *, json_mode: bool = False, max_tokens: int = 400) -> ChatResult:
        if json_mode:
            note = f"{SIMULATED_TAG} Placeholder score - set OPENAI_API_KEY for real AI grading."
            body = {
                "technical_skill": 3, "communication": 3, "problem_solving": 3, "job_fit": 3,
                "rationale": {
                    "technical_skill": note, "communication": note,
                    "problem_solving": note, "job_fit": note, "robotic_language": "none",
                },
            }
            return ChatResult(text=json.dumps(body))
        return ChatResult(
            text=f"{SIMULATED_TAG} Can you walk me through one of your answers in more detail - "
            "what trade-offs did you consider, and what would you do differently next time?"
        )


def get_client() -> OpenAIClient | FakeAIClient:
    provider = settings.ai_provider.lower()
    if provider == "openai" or (provider == "auto" and settings.openai_api_key):
        return OpenAIClient()
    return FakeAIClient()
