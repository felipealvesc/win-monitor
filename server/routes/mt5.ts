import { Router, Request, Response } from 'express';
import { Mt5Service } from '../services/mt5Service';
import { MarketSignalService } from '../services/marketSignalService';
import { TelegramService } from '../services/telegramService';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = Mt5Service.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Erro ao inspecionar MT5:', error);
    res.status(500).json({ error: 'Erro ao inspecionar instalacao local do MT5' });
  }
});

router.get('/telegram/test', async (_req: Request, res: Response) => {
  try {
    if (!TelegramService.isConfigured()) {
      return res.status(400).json({
        error: 'Telegram nao configurado. Preencha TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env.',
      });
    }

    const symbol = (process.env.SIGNAL_SYMBOL || 'WINJ26').toUpperCase();
    const evaluation = await MarketSignalService.evaluateSymbol(symbol);
    const now = new Date();

    const lines = [
      '<b>Teste de envio Telegram</b>',
      `Horario: <b>${now.toLocaleString('pt-BR')}</b>`,
      `Simbolo: <b>${symbol}</b>`,
    ];

    if (evaluation) {
      lines.push(`Sinal atual: <b>${evaluation.signal}</b>`);
      lines.push(`Chance atual: <b>${evaluation.confidence.toFixed(0)}%</b>`);
      lines.push(`Preco: <b>${evaluation.currentPrice.toFixed(0)}</b>`);
      lines.push(`Variacao: <b>${evaluation.changePercent >= 0 ? '+' : ''}${evaluation.changePercent.toFixed(2)}%</b>`);
    } else {
      lines.push('Nao foi possivel montar a avaliacao atual do mercado, mas o bot respondeu ao teste.');
    }

    await TelegramService.sendMessage({
      token: process.env.TELEGRAM_BOT_TOKEN as string,
      chatId: process.env.TELEGRAM_CHAT_ID as string,
      text: lines.join('\n'),
    });

    return res.json({
      ok: true,
      message: 'Mensagem de teste enviada para o Telegram.',
      symbol,
      evaluation,
    });
  } catch (error) {
    console.error('Erro ao enviar teste Telegram:', error);
    return res.status(500).json({ error: 'Erro ao enviar mensagem de teste para o Telegram.' });
  }
});

export default router;
