import { Router, Request, Response } from 'express';
import { YahooFinanceService, MarketDataResponse } from '../services/yahooFinanceService';

const router = Router();

/**
 * GET /api/market/quote/:symbol
 * Busca dados de um símbolo específico
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol é obrigatório' });
    }

    const data = await YahooFinanceService.fetchQuote(symbol);

    if (!data) {
      return res.status(404).json({ error: `Dados não encontrados para ${symbol}` });
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar quote:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do mercado' });
  }
});

/**
 * GET /api/market/quotes
 * Busca dados de múltiplos símbolos
 * Query: symbols=WINJ26,IBOV,BVSP
 */
router.get('/quotes', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.query;

    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Query parameter "symbols" é obrigatório (ex: ?symbols=WINJ26,IBOV)' });
    }

    const symbolList = symbols.split(',').map(s => s.trim());
    const data = await YahooFinanceService.fetchMultipleQuotes(symbolList);

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar múltiplos quotes:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do mercado' });
  }
});

/**
 * GET /api/market/historical/:symbol
 * Busca dados históricos de um símbolo
 * Query: interval=1d&range=1mo
 */
router.get('/historical/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { interval = '1d', range = '1mo' } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol é obrigatório' });
    }

    const data = await YahooFinanceService.fetchHistoricalData(
      symbol,
      (interval as any) || '1d',
      (range as any) || '1mo'
    );

    if (!data) {
      return res.status(404).json({ error: `Dados históricos não encontrados para ${symbol}` });
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados históricos:', error);
    res.status(500).json({ error: 'Erro ao buscar dados históricos' });
  }
});

/**
 * GET /api/market/symbols
 * Retorna lista de símbolos disponíveis
 */
router.get('/symbols', (req: Request, res: Response) => {
  try {
    const symbols = YahooFinanceService.getAvailableSymbols();
    res.json({ symbols });
  } catch (error) {
    console.error('Erro ao buscar símbolos:', error);
    res.status(500).json({ error: 'Erro ao buscar símbolos disponíveis' });
  }
});

/**
 * GET /api/market/health
 * Verifica saúde do serviço
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'market-data' });
});

export default router;
