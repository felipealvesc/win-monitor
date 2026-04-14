import { Request, Response, Router } from 'express';
import { PythonApiGateway } from '../services/pythonApiGateway';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await PythonApiGateway.health();
    return res.json({
      ok: true,
      baseUrl: PythonApiGateway.baseUrl,
      python: health,
    });
  } catch (error) {
    console.error('Erro ao consultar Python API:', error);
    return res.status(502).json({
      ok: false,
      baseUrl: PythonApiGateway.baseUrl,
      error: error instanceof Error ? error.message : 'Falha ao consultar Python API',
    });
  }
});

router.get('/fusion/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { accountSize, riskPercentage, newsQuery, maxNews, maxDataAgeMinutes } = req.query;

    const payload = await PythonApiGateway.getFusionAnalysis(symbol, {
      accountSize: accountSize ? Number(accountSize) : undefined,
      riskPercentage: riskPercentage ? Number(riskPercentage) : undefined,
      newsQuery: typeof newsQuery === 'string' ? newsQuery : undefined,
      maxNews: maxNews ? Number(maxNews) : undefined,
      maxDataAgeMinutes: maxDataAgeMinutes ? Number(maxDataAgeMinutes) : undefined,
    });

    return res.json(payload);
  } catch (error) {
    console.error('Erro ao buscar analise fusion:', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha na analise fusion' });
  }
});

router.get('/opinion/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { newsQuery, maxNews } = req.query;
    const payload = await PythonApiGateway.getOpinion(symbol, {
      newsQuery: typeof newsQuery === 'string' ? newsQuery : undefined,
      maxNews: maxNews ? Number(maxNews) : undefined,
    });

    return res.json(payload);
  } catch (error) {
    console.error('Erro ao buscar opiniao:', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha na opiniao do assistente' });
  }
});

export default router;
