# Python API

Servico FastAPI para consolidar:

- `IbovFinancials` para preco, book e historico
- `MetaTrader 5` instalado localmente
- noticias com potencial de impacto
- analise textual via OpenAI Responses API

## Endpoints

- `GET /health`
- `GET /api/market/quote/{symbol}`
- `GET /api/market/book/{symbol}`
- `GET /api/market/historical/{symbol}?timeframe=5`
- `GET /api/mt5/status`
- `GET /api/mt5/snapshot/{symbol}`
- `GET /api/mt5/book/{symbol}`
- `GET /api/mt5/historical/{symbol}?timeframe=M5&limit=300`
- `GET /api/news/impact?symbol=WINJ26`
- `GET /api/analysis/context/{symbol}`
- `GET /api/analysis/opinion/{symbol}`

## Como rodar

1. Crie e ative um ambiente virtual Python.
2. Instale as dependencias:

```bash
pip install -r python_api/requirements.txt
```

3. Copie `python_api/.env.example` e configure as chaves.
4. Inicie a API:

```bash
python -m uvicorn python_api.main:app --host 0.0.0.0 --port 3001 --reload
```

## Observacoes

- A rota de opiniao usa a `Responses API` da OpenAI.
- O bridge do `MetaTrader5` depende do pacote Python oficial.
- Se o pacote `MetaTrader5` nao tiver wheel para a sua versao do Python, use Python 3.12 para a API.
- Se voce subir esta API em `3001`, ela encaixa no proxy atual do frontend sem mudar as rotas `/api/...`.
