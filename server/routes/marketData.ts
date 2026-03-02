import { Request, Response, Router } from 'express';
import { Mt5MarketDataService } from '../services/mt5MarketDataService';

const router = Router();

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol e obrigatorio' });
    }

    const data = await Mt5MarketDataService.fetchQuote(symbol);

    if (!data) {
      return res.status(404).json({ error: `Dados nao encontrados no MT5 para ${symbol}` });
    }

    return res.json(data);
  } catch (error) {
    console.error('Erro ao buscar quote MT5:', error);
    return res.status(500).json({ error: 'Erro ao buscar dados do mercado no MT5' });
  }
});

router.get('/quotes', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.query;

    if (!symbols || typeof symbols !== 'string') {
      return res
        .status(400)
        .json({ error: 'Query parameter "symbols" e obrigatorio (ex: ?symbols=WINJ26,WINM26)' });
    }

    const symbolList = symbols
      .split(',')
      .map(item => item.trim().toUpperCase())
      .filter(Boolean);

    const data = await Mt5MarketDataService.fetchMultipleQuotes(symbolList);
    return res.json(data);
  } catch (error) {
    console.error('Erro ao buscar multiplos quotes MT5:', error);
    return res.status(500).json({ error: 'Erro ao buscar multiplos dados no MT5' });
  }
});

router.get('/historical/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { interval = '1d', range = '1mo' } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol e obrigatorio' });
    }

    const data = await Mt5MarketDataService.fetchHistoricalData(
      symbol,
      (interval as any) || '1d',
      (range as any) || '1mo'
    );

    if (!data) {
      return res.status(404).json({ error: `Historico nao encontrado no MT5 para ${symbol}` });
    }

    return res.json(data);
  } catch (error) {
    console.error('Erro ao buscar historico MT5:', error);
    return res.status(500).json({ error: 'Erro ao buscar historico no MT5' });
  }
});

router.get('/symbols', async (_req: Request, res: Response) => {
  try {
    const symbols = await Mt5MarketDataService.getAvailableSymbols();
    return res.json({ symbols });
  } catch (error) {
    console.error('Erro ao listar simbolos MT5:', error);
    return res.status(500).json({ error: 'Erro ao buscar simbolos do MT5' });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const symbols = await Mt5MarketDataService.getAvailableSymbols();

    return res.json({
      status: 'ok',
      service: 'market-data-mt5',
      symbolsAvailable: symbols.length,
    });
  } catch (error) {
    console.error('Erro no health MT5:', error);
    return res.status(500).json({ status: 'error', service: 'market-data-mt5' });
  }
});

export default router;
