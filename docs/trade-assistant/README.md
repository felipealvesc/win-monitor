# Assistente de Análise de Trade

Este diretório define a visão, arquitetura, contratos, roadmap e critérios de qualidade para evoluir o `win-monitor` em um assistente analítico de trade focado em mini índice.

## Objetivo

Transformar o projeto em um copiloto analítico intraday capaz de:

- consolidar fluxo, contexto, regime, drivers e notícias
- gerar leituras explicáveis e acionáveis
- enviar alertas no momento certo
- apoiar a decisão humana sem executar ordens

## O que este assistente não deve fazer

- não deve enviar ordens para corretora
- não deve prometer previsão determinística
- não deve operar sem confirmação humana
- não deve tratar notícia isolada como sinal suficiente

## Pilares

1. Fonte única de verdade para métricas e sinais
2. Análise orientada a regime
3. Uso de microestrutura e fluxo como motor principal
4. IA usada para contexto, explicação e classificação
5. Alertas por mudança de estado, não por polling cego
6. Medição rigorosa de precisão e utilidade

## Estrutura desta pasta

- `prd.md`: visão de produto e requisitos
- `technical-blueprint.md`: arquitetura técnica alvo
- `agent-contracts.md`: contratos de entrada e saída dos agentes
- `rollout-plan.md`: plano por fases
- `alert-playbook.md`: regras de alerta e payload recomendado
- `system-prompt.md`: prompt base do assistente analítico
- `backlog.md`: tarefas priorizadas para implementação

## Resultado esperado

Ao final da evolução, o sistema deve responder com clareza:

- qual o regime do dia
- quais fatores estão dirigindo o mini índice agora
- se há aceitação ou rejeição do movimento
- quais níveis confirmam a leitura
- quais níveis invalidam a leitura
- quais eventos macro e notícias podem quebrar o cenário
- quando vale a pena chamar a atenção do operador
