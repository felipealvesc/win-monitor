import { MarketSignalService } from './marketSignalService';
import { TelegramService } from './telegramService';

const MINUTE_MS = 60 * 1000;

const formatSignalMessage = (evaluation: Awaited<ReturnType<typeof MarketSignalService.evaluateSymbol>>) => {
  if (!evaluation) {
    return '';
  }

  return [
    `<b>${evaluation.symbol}</b>`,
    `Sinal: <b>${evaluation.signal}</b>`,
    `Chance: <b>${evaluation.confidence.toFixed(0)}%</b>`,
    `Preco: <b>${evaluation.currentPrice.toFixed(0)}</b>`,
    `Variacao: <b>${evaluation.changePercent >= 0 ? '+' : ''}${evaluation.changePercent.toFixed(2)}%</b>`,
    `RSI: <b>${evaluation.rsi.toFixed(1)}</b>`,
    `Volume relativo: <b>${evaluation.volumeRatio.toFixed(2)}x</b>`,
    `Suporte/Resistencia: <b>${evaluation.support.toFixed(0)} / ${evaluation.resistance.toFixed(0)}</b>`,
    `Motivos:`,
    ...evaluation.reasons.map(reason => `- ${reason}`),
    `Atualizado em: ${new Date(evaluation.timestamp).toLocaleString('pt-BR')}`,
  ].join('\n');
};

export class TelegramSignalMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSentSignature: string | null = null;
  private readonly symbol = (process.env.SIGNAL_SYMBOL || 'WINJ26').toUpperCase();
  private readonly intervalMinutes = Number(process.env.SIGNAL_CHECK_INTERVAL_MINUTES || 15);
  private readonly minConfidence = Number(process.env.SIGNAL_MIN_CONFIDENCE || 80);
  private readonly sendWaitSignals = process.env.SIGNAL_SEND_WAIT === 'true';

  start() {
    if (this.intervalId) {
      return;
    }

    if (!TelegramService.isConfigured()) {
      console.warn(
        'TelegramSignalMonitor desativado: configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env.'
      );
      return;
    }

    const execute = async () => {
      if (this.isRunning) {
        return;
      }

      this.isRunning = true;

      try {
        const evaluation = await MarketSignalService.evaluateSymbol(this.symbol);

        if (!evaluation) {
          console.warn(`TelegramSignalMonitor: sem avaliacao para ${this.symbol}.`);
          return;
        }

        if (!evaluation.isFresh) {
          console.log(
            `TelegramSignalMonitor: dados de ${this.symbol} estao antigos. Maximo permitido: ${evaluation.maxDataAgeMinutes} min.`
          );
          return;
        }

        if (evaluation.confidence < this.minConfidence) {
          console.log(
            `TelegramSignalMonitor: chance ${evaluation.confidence}% abaixo do minimo ${this.minConfidence}% para ${this.symbol}.`
          );
          return;
        }

        if (!this.sendWaitSignals && evaluation.signal === 'WAIT') {
          console.log(
            `TelegramSignalMonitor: chance alta, mas sinal WAIT. Ajuste SIGNAL_SEND_WAIT=true se quiser enviar assim mesmo.`
          );
          return;
        }

        if (evaluation.signature === this.lastSentSignature) {
          console.log(`TelegramSignalMonitor: alerta repetido ignorado para ${this.symbol}.`);
          return;
        }

        await TelegramService.sendMessage({
          token: process.env.TELEGRAM_BOT_TOKEN as string,
          chatId: process.env.TELEGRAM_CHAT_ID as string,
          text: formatSignalMessage(evaluation),
        });

        this.lastSentSignature = evaluation.signature;
        console.log(
          `TelegramSignalMonitor: alerta enviado para ${this.symbol} com ${evaluation.confidence}% de chance.`
        );
      } catch (error) {
        console.error('TelegramSignalMonitor error:', error);
      } finally {
        this.isRunning = false;
      }
    };

    void execute();
    this.intervalId = setInterval(execute, this.intervalMinutes * MINUTE_MS);

    console.log(
      `TelegramSignalMonitor iniciado para ${this.symbol} a cada ${this.intervalMinutes} minutos. Minimo ${this.minConfidence}%.`
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
