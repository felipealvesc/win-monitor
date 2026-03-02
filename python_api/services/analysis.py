from __future__ import annotations

import json
from typing import Any

from python_api.services.ibovfinancials import IbovFinancialsClient
from python_api.services.mt5_gateway import Mt5Gateway
from python_api.services.news import NewsService
from python_api.services.openai_client import OpenAIAnalysisClient


def _truncate(data: Any, max_chars: int = 6000) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if len(text) <= max_chars:
        return text

    return text[: max_chars - 3] + "..."


class MarketContextAnalyzer:
    def __init__(
        self,
        ibov_client: IbovFinancialsClient,
        mt5_gateway: Mt5Gateway,
        news_service: NewsService,
        openai_client: OpenAIAnalysisClient,
    ) -> None:
        self.ibov_client = ibov_client
        self.mt5_gateway = mt5_gateway
        self.news_service = news_service
        self.openai_client = openai_client

    def build_context(
        self,
        symbol: str,
        *,
        news_query: str | None = None,
        max_news: int = 8,
        historical_timeframe: int = 5,
    ) -> dict[str, Any]:
        return {
            "symbol": symbol.upper(),
            "quote": self.ibov_client.get_quote(symbol),
            "book": self.ibov_client.get_book(symbol),
            "historical": self.ibov_client.get_historical(
                symbol,
                timeframe=historical_timeframe,
            ),
            "mt5_status": self.mt5_gateway.get_status(),
            "mt5_symbol": self.mt5_gateway.get_symbol_snapshot(symbol),
            "mt5_book": self.mt5_gateway.get_book(symbol),
            "news": self.news_service.get_market_impact_news(
                symbol,
                query=news_query,
                max_items=max_news,
            ),
        }

    def analyze(
        self,
        symbol: str,
        *,
        news_query: str | None = None,
        max_news: int = 8,
        historical_timeframe: int = 5,
    ) -> dict[str, Any]:
        context = self.build_context(
            symbol,
            news_query=news_query,
            max_news=max_news,
            historical_timeframe=historical_timeframe,
        )
        prompt = (
            f"Analise o ativo {symbol.upper()} usando o contexto abaixo.\n"
            "Quero uma resposta curta com:\n"
            "1. Leitura do fluxo e do preco\n"
            "2. Noticias que podem impactar\n"
            "3. Riscos de invalidacao\n"
            "4. Opiniao operacional informativa para o curtissimo prazo\n\n"
            f"Contexto:\n{_truncate(context)}"
        )
        gpt_analysis = self.openai_client.analyze_market_context(prompt)

        return {
            "symbol": symbol.upper(),
            "context": context,
            "gpt": gpt_analysis,
            "disclaimer": (
                "Conteudo informativo e educacional. Nao constitui recomendacao financeira."
            ),
        }
