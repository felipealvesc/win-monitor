import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BellRing,
  CandlestickChart,
  ChartColumnBig,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import OperationsForm from '@/components/OperationsForm';
import TaxDeclarationReport from '@/components/TaxDeclarationReport';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarketDataService } from '@/lib/marketDataService';
import { Mt5Service } from '@/lib/mt5Service';
import { TaxCalculator } from '@/lib/taxCalculator';
import { buildMarketAnalysis } from '@/lib/tradingAnalysis';
import { MarketAnalysis, Mt5Status } from '@/types/market';
import { TaxDeclaration, TradeOperation } from '@/types/operations';

const formatPoints = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) {
    return '--';
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const priceChartConfig = {
  close: {
    label: 'Fechamento',
    color: 'var(--color-chart-3)',
  },
  sma20: {
    label: 'SMA 20',
    color: 'var(--color-chart-1)',
  },
};

const returnsChartConfig = {
  returnPercent: {
    label: 'Retorno %',
    color: 'var(--color-chart-3)',
  },
};

const getTrendLabel = (trend: 'uptrend' | 'downtrend' | 'sideways') => {
  if (trend === 'uptrend') {
    return 'Alta';
  }

  if (trend === 'downtrend') {
    return 'Baixa';
  }

  return 'Lateral';
};

const getTrendClasses = (trend: 'uptrend' | 'downtrend' | 'sideways') => {
  if (trend === 'uptrend') {
    return 'border-chart-1/25 bg-chart-1/8 text-chart-1';
  }

  if (trend === 'downtrend') {
    return 'border-chart-2/25 bg-chart-2/8 text-chart-2';
  }

  return 'border-border bg-white text-muted-foreground';
};

export default function Home() {
  const [symbol, setSymbol] = useState('WINJ26');
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercentage, setRiskPercentage] = useState(1);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [intradayHistory, setIntradayHistory] = useState<any | null>(null);
  const [hourlyHistory, setHourlyHistory] = useState<any | null>(null);
  const [dailyHistory, setDailyHistory] = useState<any | null>(null);
  const [mt5Status, setMt5Status] = useState<Mt5Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingTelegramTest, setSendingTelegramTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [operations, setOperations] = useState<TradeOperation[]>([]);
  const [taxDeclaration, setTaxDeclaration] = useState<TaxDeclaration | null>(null);
  const [editingOperation, setEditingOperation] = useState<TradeOperation | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'simulator' | 'operations' | 'taxes'>('simulator');
  const lastSignalKeyRef = useRef<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [quote, intraday, hourly, daily, mt5] = await Promise.all([
        MarketDataService.fetchQuote(symbol),
        MarketDataService.fetchHistoricalData(symbol, '5m', '5d'),
        MarketDataService.fetchHistoricalData(symbol, '60m', '1mo'),
        MarketDataService.fetchHistoricalData(symbol, '1d', '6mo'),
        Mt5Service.fetchStatus(),
      ]);

      if (!quote) {
        throw new Error('Nao foi possivel carregar a cotacao atual.');
      }

      setSnapshot(quote);
      setIntradayHistory(intraday);
      setHourlyHistory(hourly);
      setDailyHistory(daily);
      setMt5Status(mt5);
      setLastRefreshAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar o dashboard');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    refreshDashboard();

    const timer = window.setInterval(() => {
      refreshDashboard();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [refreshDashboard]);

  const analysis = useMemo<MarketAnalysis | null>(() => {
    if (!snapshot) {
      return null;
    }

    return buildMarketAnalysis({
      snapshot,
      intradayResponse: intradayHistory,
      hourlyResponse: hourlyHistory,
      dailyResponse: dailyHistory,
      accountSize,
      riskPercentage,
    });
  }, [snapshot, intradayHistory, hourlyHistory, dailyHistory, accountSize, riskPercentage]);

  useEffect(() => {
    if (!analysis) {
      return;
    }

    const signalKey = `${analysis.tradeSignal.type}:${Math.round(analysis.tradeSignal.confidence)}`;

    if (!lastSignalKeyRef.current) {
      lastSignalKeyRef.current = signalKey;
      return;
    }

    if (lastSignalKeyRef.current !== signalKey) {
      if (analysis.tradeSignal.type === 'BUY') {
        toast.success(`Compra confirmada em ${symbol}`, {
          description: analysis.tradeSignal.reason[0],
        });
      } else if (analysis.tradeSignal.type === 'SELL') {
        toast.error(`Venda confirmada em ${symbol}`, {
          description: analysis.tradeSignal.reason[0],
        });
      } else if (analysis.tradeSignal.conditions.priceMovement) {
        toast.info(`Movimento acima de 1% em ${symbol}`, {
          description: 'Ainda sem alinhamento completo para compra ou venda.',
        });
      }
    }

    lastSignalKeyRef.current = signalKey;
  }, [analysis, symbol]);

  const priceChartData = useMemo(() => {
    if (!analysis) {
      return [];
    }

    return analysis.dailyBars.slice(-30).map((bar, index, bars) => {
      const window = bars.slice(Math.max(0, index - 19), index + 1);
      const sma20 =
        window.reduce((sum, item) => sum + item.close, 0) / Math.max(window.length, 1);

      return {
        label: bar.label,
        close: bar.close,
        sma20: Number(sma20.toFixed(2)),
      };
    });
  }, [analysis]);

  const returnsChartData = useMemo(() => {
    if (!analysis) {
      return [];
    }

    return analysis.dailyBars.slice(-15).map(bar => ({
      label: bar.label,
      returnPercent: bar.returnPercent,
    }));
  }, [analysis]);

  // fetch persisted operations once when the component mounts
  // helper to keep the list sorted by entry date descending
  const sortOps = (list: TradeOperation[]) =>
    list.slice().sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/operations');
        if (!res.ok) throw new Error('Não foi possível carregar operações');
        const data: TradeOperation[] = await res.json();
        const parsed = data.map(op => ({
          ...op,
          entryDate: new Date(op.entryDate as unknown as string),
          exitDate: op.exitDate ? new Date(op.exitDate as unknown as string) : undefined,
        }));
        setOperations(sortOps(parsed));
      } catch (err) {
        console.error(err);
        toast.error('Falha ao carregar operações');
      }
    };

    load();
  }, []);

  const handleAddOperation = async (operation: TradeOperation) => {
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || 'Erro ao salvar operação');
      }
      const saved: TradeOperation = await res.json();
      setOperations(previous => sortOps([...previous, saved]));
    } catch (err) {
      toast.error('Erro ao salvar operação', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  };

  const handleDeleteOperation = async (id: string) => {
    try {
      const res = await fetch(`/api/operations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || 'Erro ao deletar operação');
      }
      setOperations(previous => previous.filter(operation => operation.id !== id));
      if (editingOperation?.id === id) {
        setEditingOperation(null);
      }
    } catch (err) {
      toast.error('Erro ao deletar operação', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  };

  const handleEditOperation = (op: TradeOperation) => {
    setEditingOperation(op);
  };

  const handleUpdateOperation = async (operation: TradeOperation) => {
    try {
      const res = await fetch(`/api/operations/${operation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || 'Erro ao atualizar operação');
      }
      const updated: TradeOperation = await res.json();
      setOperations(prev => sortOps(prev.map(o => (o.id === updated.id ? updated : o))));
      setEditingOperation(null);
    } catch (err) {
      toast.error('Erro ao atualizar operação', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingOperation(null);
  };

  const handleSendTelegramTest = async () => {
    try {
      setSendingTelegramTest(true);

      const response = await fetch('/api/mt5/telegram/test');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao enviar teste para o Telegram.');
      }

      toast.success('Mensagem de teste enviada', {
        description: payload?.message || 'Verifique o chat do bot no Telegram.',
      });
    } catch (err) {
      toast.error('Falha no teste do Telegram', {
        description: err instanceof Error ? err.message : 'Erro inesperado ao testar o envio.',
      });
    } finally {
      setSendingTelegramTest(false);
    }
  };

  const generateTaxDeclaration = () => {
    const declaration = selectedMonth
      ? TaxCalculator.calculateMonthlyDeclaration(operations, selectedYear, selectedMonth)
      : TaxCalculator.calculateAnnualDeclaration(operations, selectedYear);

    setTaxDeclaration(declaration);
  };

  const signalTone =
    analysis?.tradeSignal.type === 'BUY'
      ? 'border-chart-1/30 bg-chart-1/8'
      : analysis?.tradeSignal.type === 'SELL'
        ? 'border-chart-2/30 bg-chart-2/8'
        : 'border-border bg-white/90';

  const signalIcon =
    analysis?.tradeSignal.type === 'BUY' ? (
      <TrendingUp className="h-5 w-5 text-chart-1" />
    ) : analysis?.tradeSignal.type === 'SELL' ? (
      <TrendingDown className="h-5 w-5 text-chart-2" />
    ) : (
      <ShieldAlert className="h-5 w-5 text-muted-foreground" />
    );

  const currentPrice = analysis?.marketData.currentPrice ?? 0;
  const currentChange = analysis?.marketData.changePercent ?? 0;
  const currentSignal = analysis?.tradeSignal.type ?? 'WAIT';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#edf4ff_40%,#f7fafc_100%)]">
      <header className="border-b border-border/70 bg-white/90 backdrop-blur">
        <div className="container py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  <CandlestickChart className="mr-1 h-3.5 w-3.5" />
                  Dashboard WIN
                </Badge>
                <Badge variant="outline">
                  <BellRing className="mr-1 h-3.5 w-3.5" />
                  Sinal com filtro de 1%
                </Badge>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Decisao operacional do mini indice</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                O painel combina variacao da sessao, alinhamento de tendencia em 5m, 60m e diario,
                retorno medio diario e contexto do MT5 para liberar compra, venda ou espera.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="border border-border/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preco
                </div>
                <div className="mt-1 text-xl font-bold text-foreground">{formatPoints(currentPrice)}</div>
              </Card>

              <Card className="border border-border/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dia
                </div>
                <div
                  className={`mt-1 text-xl font-bold ${
                    currentChange >= 0 ? 'text-chart-1' : 'text-chart-2'
                  }`}
                >
                  {formatPercent(currentChange)}
                </div>
              </Card>

              <Card className="border border-border/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sinal
                </div>
                <div className="mt-1 text-xl font-bold text-foreground">{currentSignal}</div>
              </Card>

              <Card className="border border-border/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atualizacao
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(lastRefreshAt)}</div>
              </Card>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6 flex gap-2 border-b border-border/70">
          {[
            { key: 'simulator', label: 'Painel' },
            { key: 'operations', label: 'Operacoes' },
            { key: 'taxes', label: 'Impostos' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'simulator' | 'operations' | 'taxes')}
              className={`px-4 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'simulator' && (
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Controle</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste risco e recarregue o contexto de mercado.
                    </p>
                  </div>
                  <Button
                    onClick={refreshDashboard}
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label>Simbolo</Label>
                    <Input
                      value={symbol}
                      onChange={event => setSymbol(event.target.value.toUpperCase())}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Capital da conta</Label>
                    <Input
                      type="number"
                      value={accountSize}
                      onChange={event => setAccountSize(Number(event.target.value))}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Risco por trade (%)</Label>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={riskPercentage}
                      onChange={event => setRiskPercentage(Number(event.target.value))}
                      className="mt-2"
                    />
                  </div>
                </div>
              </Card>

              {analysis && (
                <Card className={`border p-6 shadow-sm ${signalTone}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        {signalIcon}
                        <span className="text-lg font-bold text-foreground">Sinal operacional</span>
                      </div>
                      <div className="text-3xl font-bold text-foreground">{analysis.tradeSignal.type}</div>
                    </div>
                    <Badge
                      className={
                        analysis.tradeSignal.type === 'BUY'
                          ? 'bg-chart-1 text-white hover:bg-chart-1'
                          : analysis.tradeSignal.type === 'SELL'
                            ? 'bg-chart-2 text-white hover:bg-chart-2'
                            : 'bg-muted text-foreground hover:bg-muted'
                      }
                    >
                      {analysis.tradeSignal.confidence.toFixed(0)}% confianca
                    </Badge>
                  </div>

                  <div className="mt-5 h-2 rounded-full bg-border">
                    <div
                      className={`h-2 rounded-full ${
                        analysis.tradeSignal.type === 'BUY'
                          ? 'bg-chart-1'
                          : analysis.tradeSignal.type === 'SELL'
                            ? 'bg-chart-2'
                            : 'bg-chart-3'
                      }`}
                      style={{ width: `${analysis.tradeSignal.confidence}%` }}
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    {analysis.tradeSignal.reason.map(reason => (
                      <div key={reason} className="flex items-start gap-2 text-sm text-foreground">
                        <Activity className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">MT5 local</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Inspecao da instancia detectada na maquina.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleSendTelegramTest}
                      disabled={sendingTelegramTest}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <BellRing className={`mr-2 h-4 w-4 ${sendingTelegramTest ? 'animate-pulse' : ''}`} />
                      {sendingTelegramTest ? 'Enviando...' : 'Teste Telegram'}
                    </Button>
                    <Badge
                      className={
                        mt5Status?.terminalDetected
                          ? 'bg-chart-1 text-white hover:bg-chart-1'
                          : 'bg-muted text-foreground hover:bg-muted'
                      }
                    >
                      <Wifi className="mr-1 h-3.5 w-3.5" />
                      {mt5Status?.terminalDetected ? 'Detectado' : 'Sem leitura'}
                    </Badge>
                  </div>
                </div>

                {mt5Status ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Conta
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.accountId || '--'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Servidor
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.server || '--'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Posicoes
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.positions ?? '--'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ordens
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.orders ?? '--'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Build
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.build || '--'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-secondary/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Modo
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {mt5Status.accountMode || '--'}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-secondary/35 p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Leitura atual do MT5
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">Instalacao</span>
                          <span className="max-w-[70%] break-all text-right font-medium text-foreground">
                            {mt5Status.installPath || '--'}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">Pasta de dados</span>
                          <span className="max-w-[70%] break-all text-right font-medium text-foreground">
                            {mt5Status.dataPath || '--'}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">Ultimo log</span>
                          <span className="max-w-[70%] break-all text-right font-medium text-foreground">
                            {mt5Status.latestLogFile || '--'}
                          </span>
                        </div>
                      </div>

                      {mt5Status.notes.length ? (
                        <div className="mt-4 space-y-2">
                          {mt5Status.notes.map(note => (
                            <div key={note} className="rounded-lg bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                              {note}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-slate-950 p-4 text-slate-100">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        <Database className="h-4 w-4" />
                        Ultimo diario do terminal
                      </div>
                      <div className="max-h-60 space-y-2 overflow-y-auto pr-1 text-[12px] leading-5">
                        {mt5Status.recentLogEntries.slice(-8).map(line => (
                          <div
                            key={line}
                            className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 font-mono tracking-normal text-slate-200 whitespace-pre-wrap break-words"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        O que o MT5 pode entregar para a analise
                      </div>
                      {mt5Status.relevantDataPoints.map(item => (
                        <div key={item} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-1" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Arquivos exportados
                      </div>
                      {mt5Status.availableExports.length ? (
                        mt5Status.availableExports.map(file => (
                          <div
                            key={file.path}
                            className="rounded-lg border border-border/70 bg-secondary/50 p-3 text-sm"
                          >
                            <div className="font-semibold text-foreground">{file.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{file.location}</div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">{file.path}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          <div>Nenhum export estruturado foi encontrado.</div>
                          <div className="mt-3 space-y-2">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                                Pasta monitorada no terminal
                              </div>
                              <div className="mt-1 break-all text-xs">
                                {mt5Status.terminalFilesPath || '--'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                                Pasta monitorada comum
                              </div>
                              <div className="mt-1 break-all text-xs">
                                {mt5Status.commonFilesPath || '--'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-muted-foreground">
                    O status do terminal ainda nao foi carregado.
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              {error && (
                <Alert variant="destructive" className="border border-chart-2/30 bg-chart-2/8">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Falha na atualizacao</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {analysis && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="border border-border/70 bg-white/90 p-5 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Retorno medio diario
                      </div>
                      <div className="mt-2 text-2xl font-bold text-foreground">
                        {analysis.dailyProfile.avgDailyReturn.toFixed(2)}%
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Movimento tipico: {analysis.dailyProfile.typicalDailyMove.toFixed(2)}%
                      </div>
                    </Card>

                    <Card className="border border-border/70 bg-white/90 p-5 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        RSI
                      </div>
                      <div className="mt-2 text-2xl font-bold text-foreground">{analysis.rsi.toFixed(1)}</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Faixa favoravel: compra 55-78 | venda 22-45
                      </div>
                    </Card>

                    <Card className="border border-border/70 bg-white/90 p-5 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Volume recente
                      </div>
                      <div className="mt-2 text-2xl font-bold text-foreground">
                        {analysis.volumeRatio.toFixed(2)}x
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Em relacao a media intradiaria recente
                      </div>
                    </Card>

                    <Card className="border border-border/70 bg-white/90 p-5 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Faixa do dia
                      </div>
                      <div className="mt-2 text-2xl font-bold text-foreground">
                        {(analysis.rangePosition * 100).toFixed(0)}%
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Posicao do preco entre minima e maxima da sessao
                      </div>
                    </Card>
                  </div>

                  <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Alinhamento de tendencia</h2>
                        <p className="text-sm text-muted-foreground">
                          O sinal so libera compra ou venda quando os tres tempos ficam coerentes.
                        </p>
                      </div>
                      <Badge variant="outline">
                        Bias atual:{' '}
                        {analysis.bias === 'bullish'
                          ? 'comprador'
                          : analysis.bias === 'bearish'
                            ? 'vendedor'
                            : 'neutro'}
                      </Badge>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      {analysis.trendAnalysis.map(trend => (
                        <div
                          key={trend.timeframe}
                          className={`rounded-2xl border p-5 ${getTrendClasses(trend.trend)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">{trend.timeframe}</div>
                            <Badge variant="outline" className="border-current text-current">
                              {getTrendLabel(trend.trend)}
                            </Badge>
                          </div>
                          <div className="mt-4 text-3xl font-bold">{trend.strength.toFixed(0)}</div>
                          <div className="mt-1 text-xs uppercase tracking-wide">forca</div>
                          <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between gap-4">
                              <span>Slope</span>
                              <span className="font-semibold">{trend.slopePercent.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>SMA 9 / 21</span>
                              <span className="font-semibold">
                                {formatPoints(trend.sma9)} / {formatPoints(trend.sma21)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Suporte / resistencia</span>
                              <span className="font-semibold">
                                {formatPoints(trend.support)} / {formatPoints(trend.resistance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className="grid gap-6 2xl:grid-cols-2">
                    <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <ChartColumnBig className="h-5 w-5 text-primary" />
                        <div>
                          <h2 className="text-lg font-bold text-foreground">Historico de fechamento</h2>
                          <p className="text-sm text-muted-foreground">
                            Ultimos 30 candles diarios com media movel de 20 periodos.
                          </p>
                        </div>
                      </div>

                      <ChartContainer config={priceChartConfig} className="h-[300px] w-full">
                        <RechartsLineChart data={priceChartData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="close"
                            stroke="var(--color-close)"
                            strokeWidth={2.5}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="sma20"
                            stroke="var(--color-sma20)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ChartContainer>
                    </Card>

                    <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <div>
                          <h2 className="text-lg font-bold text-foreground">Retorno padrao dos dias</h2>
                          <p className="text-sm text-muted-foreground">
                            Ultimos 15 retornos diarios para comparar a sessao atual com o comportamento normal.
                          </p>
                        </div>
                      </div>

                      <ChartContainer config={returnsChartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={returnsChartData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <ReferenceLine y={0} stroke="var(--color-border)" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="returnPercent" radius={[6, 6, 0, 0]}>
                            {returnsChartData.map(item => (
                              <Cell
                                key={`${item.label}-${item.returnPercent}`}
                                fill={
                                  item.returnPercent >= 0
                                    ? 'var(--color-chart-1)'
                                    : 'var(--color-chart-2)'
                                }
                              />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ChartContainer>
                    </Card>
                  </div>

                  <div className="grid gap-6 2xl:grid-cols-[1.3fr_minmax(0,1fr)]">
                    <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <div>
                          <h2 className="text-lg font-bold text-foreground">Plano operacional</h2>
                          <p className="text-sm text-muted-foreground">
                            Niveis operacionais derivados do contexto atual e do risco da conta.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-border/70 bg-secondary/50 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Direcao
                          </div>
                          <div className="mt-2 text-xl font-bold text-foreground">
                            {analysis.tradeSetup.direction}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-secondary/50 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Stop
                          </div>
                          <div className="mt-2 text-xl font-bold text-chart-2">
                            {analysis.tradeSetup.stopPoints} pts
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-secondary/50 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Alvo
                          </div>
                          <div className="mt-2 text-xl font-bold text-chart-1">
                            {analysis.tradeSetup.targetPoints} pts
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-secondary/50 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Contratos
                          </div>
                          <div className="mt-2 text-xl font-bold text-foreground">
                            {analysis.tradeSetup.contractsAllowed}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
                        {[
                          ['Entrada', formatPoints(analysis.tradeSetup.entryPrice)],
                          ['Stop price', formatPoints(analysis.tradeSetup.stopPrice)],
                          ['Target price', formatPoints(analysis.tradeSetup.targetPrice)],
                          ['Risco maximo', formatCurrency(analysis.tradeSetup.maxRiskAmount)],
                          [
                            'Razao risco/recompensa',
                            analysis.tradeSetup.riskRewardRatio
                              ? `1:${analysis.tradeSetup.riskRewardRatio.toFixed(2)}`
                              : '--',
                          ],
                          [
                            'Suporte / resistencia',
                            `${formatPoints(analysis.support)} / ${formatPoints(analysis.resistance)}`,
                          ],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold text-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        <div>
                          <h2 className="text-lg font-bold text-foreground">Checklist do gatilho</h2>
                          <p className="text-sm text-muted-foreground">
                            Todos os filtros abaixo precisam cooperar para liberar sinal.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {[
                          {
                            label: 'Mudanca acima de 1%',
                            status: analysis.tradeSignal.conditions.priceMovement,
                          },
                          {
                            label: 'Breakout confirmado',
                            status: analysis.tradeSignal.conditions.breakoutConfirmed,
                          },
                          {
                            label: 'Volume acima da media',
                            status: analysis.tradeSignal.conditions.volumeAboveAverage,
                          },
                          {
                            label: 'Tendencias alinhadas',
                            status: analysis.tradeSignal.conditions.alignmentMultiframe,
                          },
                          {
                            label: 'Tecnico favoravel',
                            status: analysis.tradeSignal.conditions.technicalAlignment,
                          },
                        ].map(({ label, status }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 px-4 py-3"
                          >
                            <div className="text-sm font-medium text-foreground">{label}</div>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              {status ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-chart-1" />
                                  <span className="text-chart-1">OK</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-chart-2" />
                                  <span className="text-chart-2">Falta</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <OperationsForm
            onAddOperation={handleAddOperation}
            operations={operations}
            onDeleteOperation={handleDeleteOperation}
            onEditOperation={handleEditOperation}
            initialOperation={editingOperation}
            onUpdateOperation={handleUpdateOperation}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'taxes' && (
          <div className="space-y-6">
            <Card className="border border-border/70 bg-white/90 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-foreground">Gerar declaracao de impostos</h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={selectedYear}
                    onChange={event => setSelectedYear(Number(event.target.value))}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Mes (opcional)</Label>
                  <select
                    value={selectedMonth || ''}
                    onChange={event =>
                      setSelectedMonth(event.target.value ? Number(event.target.value) : undefined)
                    }
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Anual</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Marco</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={generateTaxDeclaration}
                className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Gerar declaracao
              </Button>
            </Card>

            {taxDeclaration && <TaxDeclarationReport declaration={taxDeclaration} />}
          </div>
        )}
      </main>
    </div>
  );
}
