# WIN Monitor - API Documentation

## Visão Geral

O WIN Monitor agora possui um backend que integra com Yahoo Finance para fornecer dados reais do mercado. Todas as requisições são feitas através de endpoints REST.

## Endpoints Disponíveis

### 1. Buscar Dados de um Símbolo

**Endpoint:**
```
GET /api/market/quote/:symbol
```

**Parâmetros:**
- `symbol` (path) - Símbolo do ativo (ex: WINJ26, IBOV, BVSP)

**Exemplo:**
```bash
curl http://localhost:3000/api/market/quote/WINJ26
```

**Resposta:**
```json
{
  "symbol": "WINJ26",
  "currentPrice": 125000,
  "dayOpen": 124000,
  "dayHigh": 125500,
  "dayLow": 123800,
  "volume": 1500000,
  "previousClose": 124000,
  "changePercent": 0.81,
  "changePoints": 1000,
  "timestamp": "2026-02-21T06:40:00.000Z",
  "currency": "BRL",
  "name": "Mini Índice"
}
```

### 2. Buscar Múltiplos Símbolos

**Endpoint:**
```
GET /api/market/quotes?symbols=WINJ26,IBOV,BVSP
```

**Parâmetros:**
- `symbols` (query) - Símbolos separados por vírgula

**Exemplo:**
```bash
curl "http://localhost:3000/api/market/quotes?symbols=WINJ26,IBOV"
```

**Resposta:**
```json
{
  "WINJ26": { /* dados do WINJ26 */ },
  "IBOV": { /* dados do IBOV */ }
}
```

### 3. Buscar Dados Históricos

**Endpoint:**
```
GET /api/market/historical/:symbol?interval=1d&range=1mo
```

**Parâmetros:**
- `symbol` (path) - Símbolo do ativo
- `interval` (query) - Intervalo: 1m, 5m, 15m, 30m, 60m, 1d (padrão: 1d)
- `range` (query) - Período: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max (padrão: 1mo)

**Exemplo:**
```bash
curl "http://localhost:3000/api/market/historical/WINJ26?interval=1d&range=3mo"
```

### 4. Listar Símbolos Disponíveis

**Endpoint:**
```
GET /api/market/symbols
```

**Exemplo:**
```bash
curl http://localhost:3000/api/market/symbols
```

**Resposta:**
```json
{
  "symbols": ["WINJ26", "WIN", "IBOV", "BVSP"]
}
```

### 5. Verificar Saúde do Serviço

**Endpoint:**
```
GET /api/market/health
```

**Exemplo:**
```bash
curl http://localhost:3000/api/market/health
```

**Resposta:**
```json
{
  "status": "ok",
  "service": "market-data"
}
```

## Símbolos Mapeados

| Símbolo | Descrição | Mapeado para |
|---------|-----------|--------------|
| WINJ26 | Mini Índice (Contrato Futuro) | ^BVSP |
| WIN | Mini Índice | ^BVSP |
| IBOV | Índice Bovespa | ^BVSP |
| BVSP | Bovespa | ^BVSP |

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 400 | Parâmetro obrigatório ausente |
| 404 | Dados não encontrados |
| 500 | Erro interno do servidor |

## Exemplos de Uso no Frontend

### Usando o Hook `useMarketData`

```typescript
import { useMarketData } from '@/hooks/useMarketData';

export function MyComponent() {
  const { data, loading, error, refetch } = useMarketData('WINJ26', {
    autoFetch: true,
    interval: 5000, // Atualizar a cada 5 segundos
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <p>Preço: {data?.currentPrice}</p>
      <p>Variação: {data?.changePercent}%</p>
      <button onClick={() => refetch()}>Atualizar</button>
    </div>
  );
}
```

### Usando o Serviço `MarketDataService`

```typescript
import { MarketDataService } from '@/lib/marketDataService';

// Buscar um símbolo
const data = await MarketDataService.fetchQuote('WINJ26');

// Buscar múltiplos símbolos
const data = await MarketDataService.fetchMultipleSymbols(['WINJ26', 'IBOV']);

// Buscar dados históricos
const historical = await MarketDataService.fetchHistoricalData('WINJ26', '1d', '1mo');

// Listar símbolos disponíveis
const symbols = await MarketDataService.getAvailableSymbols();
```

## Estrutura do Backend

```
server/
├── index.ts                 # Servidor Express
├── routes/
│   └── marketData.ts       # Rotas da API
└── services/
    └── yahooFinanceService.ts  # Serviço Yahoo Finance
```

## Configuração

O backend não requer configuração adicional. Ele chama a API pública do Yahoo Finance automaticamente.

## Performance

- Cache: Não implementado (cada requisição chama Yahoo Finance)
- Timeout: 10 segundos por requisição
- Rate Limit: Sem limite (respeitar limite do Yahoo Finance)

## Próximas Melhorias

1. **Cache em Redis** - Cachear dados por 1-5 minutos
2. **Rate Limiting** - Limitar requisições por IP
3. **WebSocket** - Atualizar dados em tempo real
4. **Histórico Local** - Armazenar histórico de preços
5. **Múltiplas Fontes** - Integrar com outras APIs (BrAPI, Finnhub, etc)

## Troubleshooting

### Erro: "Dados não encontrados para WINJ26"

O Yahoo Finance pode não ter dados para este símbolo. Tente usar `^BVSP` (Bovespa) como alternativa.

### Erro: "Timeout"

A requisição levou mais de 10 segundos. Tente novamente ou verifique sua conexão.

### Erro: "CORS"

Se estiver acessando de um domínio diferente, certifique-se de que o backend está configurado corretamente.

---

**Última atualização:** Fevereiro 2026
**Versão:** 2.2
