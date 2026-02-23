# Extração da lógica do projeto `win-monitor`

## 1) Objetivo do sistema
O projeto implementa um **monitor/simulador para o mini índice (WIN)** com três blocos principais:
1. **Simulador de risco e geração de sinal** (BUY/SELL/WAIT);
2. **Registro manual de operações** (compra/venda com entrada e saída);
3. **Apuração fiscal** (declaração mensal ou anual com separação Day Trade vs Swing Trade).

No front-end, isso é organizado em três abas: `simulator`, `operations` e `taxes`.

---

## 2) Arquitetura geral (visão de fluxo)

### 2.1 Front-end (React + Vite)
- A tela principal fica em `Home.tsx` e concentra os estados de preço, conta, operações e impostos.
- A rota `/` renderiza essa Home; `/404` renderiza página de não encontrado.
- O front não consulta Yahoo diretamente: consome `/api/market/*`.

### 2.2 Back-end (Express)
- O servidor sobe API em `/api/market` e também entrega arquivos estáticos do build do cliente.
- Rotas de mercado delegam a um serviço (`YahooFinanceService`) que conversa com Yahoo Finance (endpoint quote e fallback para chart).

### 2.3 Integração client ↔ server
- Em desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:3001`.
- Em produção, o Express entrega frontend e API no mesmo processo.

---

## 3) Lógica funcional por módulo

## 3.1 Aba “Simulador”: cálculo de risco + sinal

### Entradas principais
- `accountSize` (capital da conta)
- `currentPrice` (preço atual)
- `dayOpen` (abertura)
- `dayHigh` (máxima)
- `dayLow` (mínima)

### Atualização de mercado
Ao clicar em “Atualizar Dados”, o front chama `MarketDataService.fetchWINData()`, que consulta `/api/market/quote/WINJ26`.

### Cálculos de risco (classe `RiskCalculator`)
Constantes:
- `POINT_VALUE = 0.20`
- `MIN_CONTRACT_SIZE = 1`
- `MAX_LEVERAGE = 20`

#### a) Variação diária em %
\[
\text{dailyChangePercent} = \frac{(currentPrice - dayOpen)}{dayOpen} \times 100
\]
(arredondado para 2 casas)

#### b) Regra de 1%
- `checkOnePercentThreshold` retorna `true` se `|dailyChangePercent| >= 1`.

#### c) Stop e alvo (`calculateStopLevels`)
Com base na tendência:
- **uptrend**
  - `stopLoss = support - volatility * 0.005`
  - `takeProfit = entryPrice * 1.015`
- **downtrend**
  - `stopLoss = resistance + volatility * 0.005`
  - `takeProfit = entryPrice * 0.985`
- **sideways**
  - `stopLoss = entryPrice * 0.995`
  - `takeProfit = entryPrice * 1.01`

Depois converte para pontos:
- `stopLossPoints = |entryPrice - stopLoss| / 0.20`
- `takeProfitPoints = |takeProfit - entryPrice| / 0.20`

#### d) Risco máximo permitido
\[
\text{maxRiskAmount} = accountSize \times \frac{riskPercentage}{100}
\]
(no app, `riskPercentage = 1`)

#### e) Contratos permitidos
- `riskPerContract = stopLossPoints * 0.20`
- `contracts = floor(maxRiskAmount / riskPerContract)`
- Depois limita para intervalo `[1, 20]`.

#### f) Razão risco/recompensa
\[
\text{riskRewardRatio} = \frac{takeProfitPoints}{stopLossPoints}
\]
(2 casas)

#### g) Montagem do objeto final de risco
O app cria `RiskCalculation` com:
- preço de entrada,
- risco máximo,
- pontos de stop/alvo,
- preços de stop/alvo,
- contratos permitidos,
- razão risco/recompensa.

### Geração do sinal (`TradeSignal`)
A Home monta o sinal assim:
- `type`:
  - `BUY` se bateu 1% e variação > 0,
  - `SELL` se bateu 1% e variação < 0,
  - `WAIT` caso contrário.
- `confidence = min(100, |dailyChange| * 50)`
- `reason` inclui: variação diária, risco/recompensa e contratos permitidos.
- `conditions` marca alguns flags (`priceMovement`, `breakoutConfirmed` etc.), com parte fixa em `true` na implementação atual.

### Reatividade
Sempre que muda qualquer entrada (`accountSize`, `currentPrice`, `dayOpen`, `dayHigh`, `dayLow`), `useEffect` recalcula risco e sinal automaticamente.

---

## 3.2 Aba “Operações”: registro e P&L por operação

### Formulário
`OperationsForm` cria operações fechadas (`status: CLOSED`) com:
- tipo (`BUY`/`SELL`), símbolo, quantidade,
- preço de entrada/saída,
- data de entrada/saída,
- corretagem e notas.

Validação mínima:
- exige `exitDate` para adicionar.

### Persistência
- As operações ficam apenas em estado React (`operations` em `Home.tsx`), sem banco de dados.
- Há exclusão por `id`.

### Cálculo de lucro/prejuízo exibido na tabela
Para cada operação:
- `entryValue = quantity * entryPrice`
- `exitValue = quantity * exitPrice`
- `grossProfit`:
  - BUY: `exitValue - entryValue`
  - SELL: `entryValue - exitValue`
- `netProfit = grossProfit - brokerageFee`

---

## 3.3 Aba “Impostos”: declaração mensal/anual

A lógica fiscal está em `TaxCalculator`.

### Regras e constantes
- Corretagem estimada na apuração: `0.01%` sobre entrada + saída (`BROKERAGE_FEE_RATE = 0.0001`)
- IR Day Trade: `20%`
- IR Swing Trade: `15%`
- Day Trade quando `daysHeld === 0`, caso contrário Swing Trade.

### Cálculo de imposto por operação (`calculateOperationTax`)
Pré-condição:
- Operação deve estar `CLOSED` e ter `exitPrice` + `exitDate`.

Passos:
1. `entryValue = quantity * entryPrice`
2. `exitValue = quantity * exitPrice`
3. `brokerageFee = (entryValue + exitValue) * 0.0001`
4. `grossProfit` (BUY/SELL conforme direção)
5. `netProfit = grossProfit - brokerageFee`
6. `daysHeld = floor((exitDate - entryDate)/1 dia)`
7. Define `operationType` (DAY_TRADE ou SWING_TRADE) e `irRate` (20% ou 15%)
8. `taxableIncome = max(0, netProfit)`
9. `irTax = taxableIncome * irRate`

### Consolidação mensal (`calculateMonthlyDeclaration`)
Filtra operações fechadas cujo `exitDate` coincide com `ano` e `mês` solicitados, e agrega:
- totais de compra/venda,
- lucro bruto,
- corretagem,
- lucro líquido,
- IR total,
- separação Day Trade / Swing (quantidade, lucro e imposto).

### Consolidação anual (`calculateAnnualDeclaration`)
Mesma lógica da mensal, mas filtrando somente por ano.

### Saída/relatório
`TaxDeclarationReport` mostra os totais na interface e permite “Baixar”, gerando um arquivo `.txt` com resumo e observações.

---

## 4) Lógica de dados de mercado (API)

## 4.1 Rotas (`/api/market`)
- `GET /quote/:symbol` → cotação de um símbolo
- `GET /quotes?symbols=A,B,C` → cotações múltiplas
- `GET /historical/:symbol?interval=...&range=...` → série histórica
- `GET /symbols` → símbolos conhecidos
- `GET /health` → saúde do serviço

## 4.2 Serviço Yahoo (`YahooFinanceService`)

### Mapa de símbolos
Atualmente há mapeamento:
- `WINJ26`, `WIN`, `IBOV`, `BVSP` → `^BVSP`

Ou seja: o “WIN” é aproximado usando Bovespa como proxy.

### Estratégia de consulta
1. Tenta endpoint de quote (`/v7/finance/quote`)
2. Se falhar/sem resultado, faz fallback para chart (`/v8/finance/chart`)

### Normalização do retorno
Entrega `MarketDataResponse` com:
- preço atual, abertura, máxima, mínima, volume,
- fechamento anterior,
- variação percentual vs fechamento anterior,
- variação em pontos vs abertura (`/ 0.20`),
- timestamp e metadados.

---

## 5) Inicialização, ambiente e execução

- O projeto carrega `.env` manualmente (há função de load no server e também em `server/config/loadEnv.ts`).
- Script `npm run dev` sobe **server (porta 3001)** e **client (porta 3000)** em paralelo (`scripts/dev.mjs`).
- Build produz `dist/public` (frontend) e `dist/index.js` (backend bundle).

---

## 6) Resumo da “lógica central” em pseudo-fluxo

1. Usuário abre Home e informa capital + preços.
2. Sistema calcula variação diária e detecta se atingiu gatilho de 1%.
3. Sistema estima stop/alvo em função de tendência implícita (subida/queda) e volatilidade diária.
4. Sistema calcula risco máximo (1% da conta), contratos permitidos (respeitando limite 1..20) e razão risco/recompensa.
5. Sistema produz sinal BUY/SELL/WAIT com confiança proporcional ao tamanho da variação diária.
6. Usuário pode registrar operações concluídas manualmente.
7. Sistema agrega operações por mês/ano e calcula IR com regra Day Trade (20%) vs Swing (15%).
8. Sistema gera relatório textual para download.

---

## 7) Limitações atuais observáveis no código

- Operações e relatórios não persistem em banco/localStorage (estado em memória apenas).
- Parte dos critérios do sinal (`volumeAboveAverage`, `alignmentMultiframe`, etc.) está fixa em `true` na versão atual.
- Taxa de corretagem na apuração fiscal é recalculada por fórmula percentual, independentemente do valor manual de corretagem no formulário.
- O símbolo WIN usa proxy `^BVSP`, não o contrato futuro específico da B3.
