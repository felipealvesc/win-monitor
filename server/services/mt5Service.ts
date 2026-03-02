import fs from 'fs';
import os from 'os';
import path from 'path';

export interface Mt5ExportFileResponse {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  location: 'terminal' | 'common';
}

export interface Mt5StatusResponse {
  terminalDetected: boolean;
  installPath: string | null;
  dataPath: string | null;
  latestLogFile: string | null;
  build: string | null;
  broker: string | null;
  accountId: string | null;
  server: string | null;
  positions: number | null;
  orders: number | null;
  symbols: number | null;
  spreads: number | null;
  accountMode: 'netting' | 'hedging' | 'unknown';
  availableExports: Mt5ExportFileResponse[];
  relevantDataPoints: string[];
  notes: string[];
  recentLogEntries: string[];
}

const MAX_EXPORT_FILES = 10;
const EXPORT_FILE_EXTENSIONS = new Set(['.json', '.csv', '.txt']);

const getTerminalRoot = () => {
  const appData =
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'MetaQuotes', 'Terminal');
};

const safeReadDir = (directoryPath: string) => {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const safeStat = (targetPath: string) => {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
};

const getDirectoryTimestamp = (directoryPath: string): number => {
  const stats = safeStat(directoryPath);
  return stats ? stats.mtimeMs : 0;
};

const getLatestDataPath = (terminalRoot: string): string | null => {
  const candidates = safeReadDir(terminalRoot)
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => name !== 'Common' && name !== 'Community')
    .map(name => path.join(terminalRoot, name))
    .sort((left, right) => getDirectoryTimestamp(right) - getDirectoryTimestamp(left));

  return candidates[0] || null;
};

const getLatestLogFile = (dataPath: string | null): string | null => {
  if (!dataPath) {
    return null;
  }

  const logsPath = path.join(dataPath, 'Logs');
  const logFiles = safeReadDir(logsPath)
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.log'))
    .map(entry => path.join(logsPath, entry.name))
    .sort((left, right) => {
      return getDirectoryTimestamp(right) - getDirectoryTimestamp(left);
    });

  return logFiles[0] || null;
};

const readRecentLogLines = (logFilePath: string | null) => {
  if (!logFilePath || !fs.existsSync(logFilePath)) {
    return [];
  }

  const content = fs.readFileSync(logFilePath, 'utf-8');
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const head = lines.slice(0, 20);
  const tail = lines.slice(-20);
  return [...head, ...tail.filter(line => !head.includes(line))];
};

const collectStructuredExports = (
  directoryPath: string,
  location: 'terminal' | 'common'
): Mt5ExportFileResponse[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files: Mt5ExportFileResponse[] = [];

  for (const entry of safeReadDir(directoryPath)) {
    const entryPath = path.join(directoryPath, entry.name);

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!EXPORT_FILE_EXTENSIONS.has(extension)) {
      continue;
    }

    const stats = safeStat(entryPath);
    if (!stats) {
      continue;
    }

    files.push({
      name: entry.name,
      path: entryPath,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      location,
    });
  }

  return files;
};

const parseLog = (logLines: string[]) => {
  const parsed = {
    build: null as string | null,
    broker: null as string | null,
    accountId: null as string | null,
    server: null as string | null,
    positions: null as number | null,
    orders: null as number | null,
    symbols: null as number | null,
    spreads: null as number | null,
    accountMode: 'unknown' as 'netting' | 'hedging' | 'unknown',
    dataPath: null as string | null,
  };

  for (const line of logLines) {
    const startMatch = line.match(/build (\d+) started for (.+)$/i);
    if (startMatch) {
      parsed.build = startMatch[1];
      parsed.broker = startMatch[2];
    }

    const dataPathMatch = line.match(/([A-Z]:\\.+MetaQuotes\\Terminal\\[A-Z0-9]+)/i);
    if (dataPathMatch) {
      parsed.dataPath = dataPathMatch[1];
    }

    const authMatch = line.match(/'(\d+)': authorized on (.+?) through (.+)$/i);
    if (authMatch) {
      parsed.accountId = authMatch[1];
      parsed.server = authMatch[2];
    }

    const syncMatch = line.match(
      /'(\d+)': terminal synchronized with .+?: (\d+) positions, (\d+) orders, (\d+) symbols, (\d+) spreads/i
    );
    if (syncMatch) {
      parsed.accountId = parsed.accountId || syncMatch[1];
      parsed.positions = Number(syncMatch[2]);
      parsed.orders = Number(syncMatch[3]);
      parsed.symbols = Number(syncMatch[4]);
      parsed.spreads = Number(syncMatch[5]);
    }

    if (line.toLowerCase().includes('netting mode')) {
      parsed.accountMode = 'netting';
    }

    if (line.toLowerCase().includes('hedging mode')) {
      parsed.accountMode = 'hedging';
    }
  }

  return parsed;
};

export class Mt5Service {
  static getStatus(): Mt5StatusResponse {
    const installPath = 'C:\Program Files\MetaTrader 5 Terminal';
    const terminalRoot = getTerminalRoot();
    const detectedInstallPath = fs.existsSync(installPath) ? installPath : null;
    const dataPath = getLatestDataPath(terminalRoot);
    const latestLogFile = getLatestLogFile(dataPath);
    const recentLogEntries = readRecentLogLines(latestLogFile);
    const parsed = parseLog(recentLogEntries);

    const effectiveDataPath = parsed.dataPath || dataPath;
    const terminalExports = collectStructuredExports(
      effectiveDataPath ? path.join(effectiveDataPath, 'MQL5', 'Files') : '',
      'terminal'
    );
    const commonExports = collectStructuredExports(
      path.join(terminalRoot, 'Common', 'Files'),
      'common'
    );

    const availableExports = [...terminalExports, ...commonExports]
      .sort((left, right) => {
        return new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime();
      })
      .slice(0, MAX_EXPORT_FILES);

    const notes: string[] = [];

    if (!detectedInstallPath) {
      notes.push('Instalação do MetaTrader 5 não foi encontrada no caminho padrão.');
    }

    if (!effectiveDataPath) {
      notes.push('Pasta de dados do MT5 não foi localizada para leitura local.');
    }

    if (!availableExports.length) {
      notes.push(
        'Nenhum arquivo de exportação foi encontrado em MQL5\\Files ou Terminal\\Common\\Files.'
      );
    }

    if (parsed.positions === 0 && parsed.orders === 0) {
      notes.push('O terminal está sincronizado sem posições abertas nem ordens pendentes neste momento.');
    }

    if (parsed.accountMode === 'netting') {
      notes.push('A conta está em netting mode, então o MT5 consolida posições por ativo.');
    }

    return {
      terminalDetected: Boolean(detectedInstallPath && effectiveDataPath && latestLogFile),
      installPath: detectedInstallPath,
      dataPath: effectiveDataPath,
      latestLogFile,
      build: parsed.build,
      broker: parsed.broker,
      accountId: parsed.accountId,
      server: parsed.server,
      positions: parsed.positions,
      orders: parsed.orders,
      symbols: parsed.symbols,
      spreads: parsed.spreads,
      accountMode: parsed.accountMode,
      availableExports,
      relevantDataPoints: [
        'Posições abertas e direção líquida do ativo',
        'Ordens pendentes, preço alvo e stop cadastrados',
        'Símbolo ativo, book, volume e histórico exportado por Expert/Script',
        'Saldo, equity, margem livre e exposição atual',
        'Diário do terminal com sincronização, conta, servidor e modo netting/hedging',
      ],
      notes,
      recentLogEntries,
    };
  }
}
