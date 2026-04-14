const DEFAULT_TIMEOUT_MS = Number(process.env.PY_API_TIMEOUT_MS || 20000);
const DEFAULT_BASE_URL = process.env.PY_API_BASE_URL || `http://127.0.0.1:${process.env.PY_API_PORT || '3002'}`;

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Python API ${response.status}: ${body}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export interface FusionQueryParams {
  accountSize?: number;
  riskPercentage?: number;
  newsQuery?: string;
  maxNews?: number;
  maxDataAgeMinutes?: number;
}

export class PythonApiGateway {
  static get baseUrl(): string {
    return DEFAULT_BASE_URL;
  }

  static async health(): Promise<any> {
    return fetchJson('/health');
  }

  static async getFusionAnalysis(symbol: string, params: FusionQueryParams = {}): Promise<any> {
    const query = buildQuery({
      account_size: params.accountSize,
      risk_percentage: params.riskPercentage,
      news_query: params.newsQuery,
      max_news: params.maxNews,
      max_data_age_minutes: params.maxDataAgeMinutes,
    });

    return fetchJson(`/api/analysis/fusion/${symbol.toUpperCase()}${query}`);
  }

  static async getOpinion(symbol: string, params: FusionQueryParams = {}): Promise<any> {
    const query = buildQuery({
      news_query: params.newsQuery,
      max_news: params.maxNews,
    });

    return fetchJson(`/api/analysis/opinion/${symbol.toUpperCase()}${query}`);
  }
}
