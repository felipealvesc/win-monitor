from __future__ import annotations

from typing import Any

from python_api.config import Settings
from python_api.services.http import build_url, fetch_json


def _extract_output_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    parts: list[str] = []
    for item in payload.get("output", []) or []:
        for content in item.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())

    return "\n\n".join(parts).strip()


class OpenAIAnalysisClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return bool(self.settings.openai_api_key)

    def analyze_market_context(self, prompt: str) -> dict[str, Any]:
        if not self.enabled:
            return {
                "enabled": False,
                "model": self.settings.openai_model,
                "analysis": (
                    "OPENAI_API_KEY nao configurada. A API coletou os dados, "
                    "mas a analise GPT nao foi executada."
                ),
            }

        payload = {
            "model": self.settings.openai_model,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Voce e um analista de mercado focado em contexto. "
                                "Responda em portugues, com visao objetiva, riscos, "
                                "gatilhos e conclusao. Nao faca promessa de retorno "
                                "e deixe claro que nao e recomendacao financeira."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt,
                        }
                    ],
                },
            ],
        }
        response = fetch_json(
            build_url(self.settings.openai_base_url, "/responses"),
            headers={
                "Authorization": f"Bearer {self.settings.openai_api_key}",
                "Accept": "application/json",
            },
            timeout=self.settings.openai_timeout_seconds,
            method="POST",
            payload=payload,
        )

        return {
            "enabled": True,
            "model": self.settings.openai_model,
            "analysis": _extract_output_text(response),
            "raw": response,
        }
