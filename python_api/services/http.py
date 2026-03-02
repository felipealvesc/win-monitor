from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


def build_url(base_url: str, path: str, params: dict[str, Any] | None = None) -> str:
    normalized_base = base_url.rstrip("/") + "/"
    normalized_path = path.lstrip("/")
    url = urljoin(normalized_base, normalized_path)

    if not params:
        return url

    filtered = {
        key: value
        for key, value in params.items()
        if value is not None and value != ""
    }

    if not filtered:
        return url

    return f"{url}?{urlencode(filtered, doseq=True)}"


def fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 15,
    method: str = "GET",
    body: bytes | None = None,
) -> str:
    request = Request(
        url,
        headers=headers or {},
        method=method,
        data=body,
    )

    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def fetch_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 15,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> Any:
    body = None
    merged_headers = dict(headers or {})

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        merged_headers.setdefault("Content-Type", "application/json")

    content = fetch_text(
        url,
        headers=merged_headers,
        timeout=timeout,
        method=method,
        body=body,
    )
    return json.loads(content)
