from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from python_api.config import get_settings
from python_api.services.analysis import MarketContextAnalyzer
from python_api.services.ibovfinancials import IbovFinancialsClient
from python_api.services.mt5_gateway import Mt5Gateway
from python_api.services.news import NewsService
from python_api.services.openai_client import OpenAIAnalysisClient

settings = get_settings()
ibov_client = IbovFinancialsClient(settings)
mt5_gateway = Mt5Gateway(settings)
news_service = NewsService(settings)
openai_client = OpenAIAnalysisClient(settings)
context_analyzer = MarketContextAnalyzer(
    ibov_client=ibov_client,
    mt5_gateway=mt5_gateway,
    news_service=news_service,
    openai_client=openai_client,
)

app = FastAPI(
    title="Win Monitor Python API",
    version="1.0.0",
    description="IbovFinancials + MT5 + noticias + analise GPT",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "win-monitor-python-api",
        "port": settings.port,
        "ibov_base_url": settings.ibov_base_url,
        "openai_enabled": openai_client.enabled,
    }


@app.get("/api/market/quote/{symbol}")
def market_quote(symbol: str) -> dict[str, object]:
    return ibov_client.get_quote(symbol)


@app.get("/api/market/book/{symbol}")
def market_book(symbol: str) -> dict[str, object]:
    return ibov_client.get_book(symbol)


@app.get("/api/market/historical/{symbol}")
def market_historical(
    symbol: str,
    timeframe: int = Query(default=5, ge=1),
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(default=300, ge=1, le=5000),
) -> dict[str, object]:
    return ibov_client.get_historical(
        symbol,
        timeframe=timeframe,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@app.get("/api/mt5/status")
def mt5_status() -> dict[str, object]:
    return mt5_gateway.get_status()


@app.get("/api/mt5/snapshot/{symbol}")
def mt5_snapshot(symbol: str) -> dict[str, object]:
    return mt5_gateway.get_symbol_snapshot(symbol)


@app.get("/api/mt5/book/{symbol}")
def mt5_book(symbol: str) -> dict[str, object]:
    return mt5_gateway.get_book(symbol)


@app.get("/api/mt5/historical/{symbol}")
def mt5_historical(
    symbol: str,
    timeframe: str = Query(default="M5"),
    limit: int = Query(default=300, ge=1, le=5000),
) -> dict[str, object]:
    return mt5_gateway.get_historical(symbol, timeframe=timeframe, limit=limit)


@app.get("/api/news/impact")
def market_news(
    symbol: str = Query(...),
    query: str | None = None,
    max_items: int = Query(default=8, ge=1, le=20),
) -> dict[str, object]:
    return news_service.get_market_impact_news(
        symbol,
        query=query,
        max_items=max_items,
    )


@app.get("/api/analysis/context/{symbol}")
def analysis_context(
    symbol: str,
    news_query: str | None = None,
    max_news: int = Query(default=8, ge=1, le=20),
    historical_timeframe: int = Query(default=5, ge=1),
) -> dict[str, object]:
    return context_analyzer.build_context(
        symbol,
        news_query=news_query,
        max_news=max_news,
        historical_timeframe=historical_timeframe,
    )


@app.get("/api/analysis/opinion/{symbol}")
def analysis_opinion(
    symbol: str,
    news_query: str | None = None,
    max_news: int = Query(default=8, ge=1, le=20),
    historical_timeframe: int = Query(default=5, ge=1),
) -> dict[str, object]:
    return context_analyzer.analyze(
        symbol,
        news_query=news_query,
        max_news=max_news,
        historical_timeframe=historical_timeframe,
    )
