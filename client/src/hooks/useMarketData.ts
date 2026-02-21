import { useState, useCallback, useEffect } from 'react';
import { MarketData } from '@/types/market';

interface UseMarketDataOptions {
  autoFetch?: boolean;
  interval?: number; // em ms
}

export function useMarketData(symbol: string = 'WINJ26', options: UseMarketDataOptions = {}) {
  const { autoFetch = false, interval = 5000 } = options;
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/market/quote/${symbol}`);

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const marketData = await response.json();
      setData(marketData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar dados';
      setError(errorMessage);
      console.error('Erro ao buscar dados do mercado:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Auto-fetch quando o componente monta ou symbol muda
  useEffect(() => {
    if (autoFetch) {
      fetchData();
      const timer = setInterval(fetchData, interval);
      return () => clearInterval(timer);
    }
  }, [autoFetch, interval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

export function useMultipleMarketData(symbols: string[], options: UseMarketDataOptions = {}) {
  const { autoFetch = false, interval = 5000 } = options;
  const [data, setData] = useState<Record<string, MarketData | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const symbolsParam = symbols.join(',');
      const response = await fetch(`/api/market/quotes?symbols=${symbolsParam}`);

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const marketData = await response.json();
      setData(marketData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar dados';
      setError(errorMessage);
      console.error('Erro ao buscar múltiplos dados:', err);
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    if (autoFetch && symbols.length > 0) {
      fetchData();
      const timer = setInterval(fetchData, interval);
      return () => clearInterval(timer);
    }
  }, [autoFetch, interval, fetchData, symbols.length]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
