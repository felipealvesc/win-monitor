# Agent Contracts

## Orderflow Agent
Input:
- ticks
- book
Output:
- ofi
- delta
- imbalance

## Regime Agent
Input:
- candles
- vwap
Output:
- regime
- confidence

## News Agent
Input:
- headlines
Output:
- impact_score
- affected_assets

## Fusion Agent
Input:
- orderflow
- regime
- news
Output:
- scenario
- probability
- confirmation_levels
- invalidation_levels

## Alert Agent
Input:
- fusion_output
Output:
- formatted_message
- priority
