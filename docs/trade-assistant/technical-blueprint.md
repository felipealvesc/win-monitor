# Technical Blueprint

## Arquitetura alvo

React (UI)
 -> Node (API + Alert Dispatcher)
    -> Python (Intelligence Core)
        -> MT5 Gateway
        -> Orderflow Engine
        -> Regime Engine
        -> News Engine
        -> Fusion Engine

## Responsabilidades

### Node
- agregação de endpoints
- persistência
- envio de alertas
- controle de sessão

### Python
- cálculo de sinais
- classificação de regime
- análise de notícias
- fusão probabilística
- explicação estruturada

## Comunicação

Node -> Python via HTTP

Endpoints principais:
- /analysis/context
- /analysis/opinion
- /analysis/fusion

## Decisão de design

- não usar LLM como motor de direção
- usar LLM para:
  - explicação
  - classificação de notícia
  - síntese

## Dados essenciais

- preço
- volume
- fluxo
- VWAP
- range
- macro agenda

## Métricas

- precisão de alertas
- taxa de invalidação
- latência de resposta
- qualidade percebida do alerta
