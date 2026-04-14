import { HistoricalBar, MarketAnalysis } from '@/types/market';

const normalizeBars = (bars: any[] | undefined): HistoricalBar[] => {
  return (bars || []).map((bar: any) => ({
    ...bar,
    timestamp: bar?.timestamp ? new Date(bar.timestamp) : new Date(),
  }));
};

const normalizeAnalysis = (payload: any): MarketAnalysis => {
  return {
    ...payload,
    marketData: {
      ...payload.marketData,
      timestamp: payload?.marketData?.timestamp ? new Date(payload.marketData.timestamp) : new Date(),
    },
    intradayBars: normalizeBars(payload?.intradayBars),
    hourlyBars: normalizeBars(payload?.hourlyBars),
    dailyBars: normalizeBars(payload?.dailyBars),
    tradeSignal: {
      ...payload.tradeSignal,
      timestamp: payload?.tradeSignal?.timestamp ? new Date(payload.tradeSignal.timestamp) : new Date(),
    },
  } as MarketAnalysis;
};

export class TradeAssistantService {
  private static readonly BASE_URL = '/api/analysis';

  static async fetchFusionAnalysis(
    symbol: string,
    options: {
      accountSize?: number;
      riskPercentage?: number;
      newsQuery?: string;
      maxNews?: number;
      maxDataAgeMinutes?: number;
    } = {}
  ): Promise<MarketAnalysis | null> {
    try {
      const search = new URLSearchParams();

      if (options.accountSize !== undefined) {
        search.set('accountSize', String(options.accountSize));
      }

      if (options.riskPercentage !== undefined) {
        search.set('riskPercentage', String(options.riskPercentage));
      }

      if (options.newsQuery) {
        search.set('newsQuery', options.newsQuery);
      }

      if (options.maxNews !== undefined) {
        search.set('maxNews', String(options.maxNews));
      }

      if (options.maxDataAgeMinutes !== undefined) {
        search.set('maxDataAgeMinutes', String(options.maxDataAgeMinutes));
      }

      const query = search.toString();
      const response = await fetch(`${this.BASE_URL}/fusion/${symbol}${query ? `?${query}` : ''}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const payload = await response.json();
      return normalizeAnalysis(payload);
    } catch (error) {
      console.error(`Erro ao buscar analise fusion de ${symbol}:`, error);
      return null;
    }
  }
}
