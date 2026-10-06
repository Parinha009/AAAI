"""AI provider layer (FR-07 / FR-08 / FR-03).

Interchangeable clients with the same two calls:
- `transcribe(path, mime)`  -> speech-to-text (Whisper)
- `chat(messages, ...)`     -> chat completion (plain text or JSON object)

`OpenAIClient` makes real calls to any OpenAI-compatible API: OpenAI itself (Whisper-1 +
GPT-4o-mini, the SRS models, billed) or Groq (Whisper large-v3 + Llama, free tier).
`FakeAIClient` returns clearly-labelled simulated output so the flow runs with no key
(and tests never call out). `get_client()` picks from settings - AI_PROVIDER=auto uses
OpenAI if OPENAI_API_KEY is set, else Groq if GROQ_API_KEY is set, else the simulator.
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
    """Real calls to an OpenAI-compatible API (OpenAI or Groq)."""

    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        transcribe_model: str,
        chat_model: str,
        base_url: str | None = None,
        billable: bool = True,
    ) -> None:
        from openai import OpenAI  # imported lazily so the fake path needs no SDK

        self.name = name
        self.transcribe_model = transcribe_model
        self.chat_model = chat_model
        self.billable = billable  # False = free tier: nothing charged to the budget (FR-16)
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=settings.ai_timeout_seconds,
            max_retries=2,
        )

    def transcribe(self, path: str, mime: str | None) -> Transcription:
        p = Path(path)
        with p.open("rb") as fh:
            result = self._client.audio.transcriptions.create(
                model=self.transcribe_model,
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
            model=self.chat_model,
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
    transcribe_model = "simulated"
    chat_model = "simulated"
    billable = False

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


def _openai() -> OpenAIClient:
    return OpenAIClient(
        name="openai", api_key=settings.openai_api_key,
        transcribe_model=settings.openai_transcribe_model, chat_model=settings.openai_chat_model,
    )


def _groq() -> OpenAIClient:
    return OpenAIClient(
        name="groq", api_key=settings.groq_api_key, base_url=settings.groq_base_url,
        transcribe_model=settings.groq_transcribe_model, chat_model=settings.groq_chat_model,
        billable=False,
    )


def get_client() -> OpenAIClient | FakeAIClient:
    provider = settings.ai_provider.lower()
    if provider == "openai":
        return _openai()
    if provider == "groq":
        return _groq()
    if provider == "auto":
        if settings.openai_api_key:
            return _openai()
        if settings.groq_api_key:
            return _groq()
    return FakeAIClient()
