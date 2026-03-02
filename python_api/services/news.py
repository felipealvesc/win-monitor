from __future__ import annotations

from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlencode
from xml.etree import ElementTree

from python_api.config import Settings
from python_api.services.http import fetch_text


class NewsService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _build_query(self, symbol: str, extra_query: str | None) -> str:
        if extra_query:
            return extra_query

        return f'"{symbol}" OR ibovespa OR copom OR selic OR dolar OR fiscal'

    def get_market_impact_news(
        self,
        symbol: str,
        *,
        query: str | None = None,
        max_items: int = 8,
    ) -> dict[str, Any]:
        search_query = self._build_query(symbol, query)
        params = urlencode(
            {
                "q": f"{search_query} when:3d",
                "hl": "pt-BR",
                "gl": "BR",
                "ceid": "BR:pt-419",
            }
        )
        url = f"{self.settings.news_rss_base_url}?{params}"
        xml_text = fetch_text(url, timeout=10)
        root = ElementTree.fromstring(xml_text)

        items: list[dict[str, Any]] = []
        for item in root.findall("./channel/item"):
            title = item.findtext("title") or ""
            link = item.findtext("link") or ""
            pub_date = item.findtext("pubDate") or ""
            source_element = item.find("source")
            source = source_element.text if source_element is not None else ""
            published_at = None

            if pub_date:
                try:
                    published_at = parsedate_to_datetime(pub_date).isoformat()
                except (TypeError, ValueError, IndexError):
                    published_at = pub_date

            items.append(
                {
                    "title": title,
                    "link": link,
                    "source": source,
                    "published_at": published_at,
                }
            )

            if len(items) >= max_items:
                break

        return {
            "symbol": symbol.upper(),
            "query": search_query,
            "items": items,
            "source": "google-news-rss",
        }
