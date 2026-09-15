# Paying for What Matters

**Verification-Aware Marginal-Utility Incentives for DePIN Wireless Networks**

A React + TypeScript + Tailwind research workstation with an independent simulation engine, SVG spatial visualization, Recharts comparisons, seeded experiments, and CSV export. All experiments execute locally in a browser worker. No wallet, backend, or chain is required. The proposed formula is experimental, not proven optimal or empirically calibrated.

## Run locally

Use Node 22.13+ (a current Node release is recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The development command first bundles the simulation worker. After editing the engine during a running preview, run `node scripts/build-simulation.mjs` or restart the dev server.

```sh
node scripts/test-engine.mjs
npx tsc --noEmit
npm run build
```

The production build exports a static application to `dist/client/`; serve it over HTTP with any static host. Web Workers do not run from `file://`. The build automatically rebuilds `public/simulation-worker.js`. The included Sites scaffolding is optional for local research; no runtime database or authentication dependency is used by the simulation.

## Project structure

```text
app/
  page.tsx                 Workspace, experiment state, worker lifecycle, export
  globals.css              Dark research theme and responsive layouts
  layout.tsx               Document metadata
components/lab/
  network-map.tsx          Spatial coverage, demand and provider inspection
  controls.tsx             Accessible inputs and metrics
  settings.tsx             Physical, attack, audit and economic parameters
  charts.tsx               Comparisons, raw trials, statistical tables
  research-views.tsx       Economics, attacks, verification, lab, results
  details.tsx              Provider sheet and onboarding
lib/simulation/
  types.ts                 Parameters and serializable domain types
  random.ts                Seeded Mulberry32 PRNG
  network.ts               Generation, service allocation, fast and exact marginal utility
  behavior.ts              Participation, effort, placement, attack, and state updates
  attacks.ts               Topology manipulation and fabricated claims
  verification.ts          Limited random/risk-based audits and noisy detection
  rewards.ts               Four normalized reward rules and economic metrics
  engine.ts                Repeated-round orchestration and sample statistics
  worker.ts                Background batch execution
  metrics.ts               UI metric dictionary and formatting
scripts/
  build-simulation.mjs     Produce browser-compatible worker
  test-engine.mjs          Bundle and execute Node regression tests
  run-framework.mjs        Framework dev/build entrypoint
public/
  favicon.svg
  simulation-worker.js     Generated from the engine; do not hand-edit
 tests/engine.test.ts       Regression and hand-calculated correctness checks
```

## Simulation architecture

A paired trial starts each mechanism from the same seeded provider and user draw. Every mechanism then evolves its own network through repeated rounds: participation and behavior decisions → demand → service allocation → claims → verification → rewards and penalties → provider economic-state updates. Because past rewards change expected rewards, participation, effort, placement, attacks, reputation, and stake, the four mechanisms can produce different physical utility trajectories. Experiments use seeds `startingSeed + trialIndex` modulo 2³². No `Math.random`, clock-derived metrics, or fabricated chart series are used.

The city is a continuous 20 × 20 coordinate domain displayed as 400 grid cells. Uniform, clustered and underserved demand distributions are supported. Sparse, medium and dense deployment use provider-location spans of 20, 18 and 11 grid units, centered on the city. Reliability samples online/offline state in every round, conditional on participation and effort. Quality varies ±15% around the configured level, clipped to [0,1]. Users demand uniform [0.5,1.5) units.

Users are processed in ID order. Each chooses the highest-quality reachable online provider with remaining capacity, ties by provider index. A user receives up to remaining capacity from one provider; unserved residual is not split. Link quality is `providerQuality × (1 − 0.35 × distance / radius)`. User-order bias, no interference, and no within-round mobility are explicit assumptions. The adaptive process is a bounded behavioral simulation rather than a solved game-theoretic equilibrium.

For repeated-round decisions, marginal utility uses a local allocation-derived estimate based on unique coverage, served demand, delivered quality, redundancy, and cost. This keeps 50–100 round batches tractable. The final displayed seed recomputes exact marginal utility by removing each provider and reallocating all demand with the same outages and user order. Cached geometry reduces distance work. Negative MU remains visible and is clipped only in payout scores.

## Mathematical definitions

Let J be genuine users, P provider identities, B base provider count, dⱼ demand, aⱼ delivered demand, qⱼ link quality, kⱼ online coverage count, cᵢ operating cost, hᵢ claimed contribution, aᵢ actual contribution, Rᵢ paid reward and Gᵢ gross reward.

| Metric | Definition |
|---|---|
| Coverage C | count(kⱼ ≥ 1) / J; user coverage, not geographic area |
| Demand served D | Σaⱼ / Σdⱼ |
| Quality Q | Σaⱼqⱼ / Σdⱼ; unmet demand contributes zero |
| Redundancy R | count(kⱼ ≥ 2) / J, independent of remaining capacity |
| Infrastructure cost I | Σcᵢ over participating identities / (10 × B); fixed denominator during removal |
| Utility | U = w₁C + w₂D + w₃Q − w₄R − w₅I; not restricted to [0,1] |
| Marginal utility | Final displayed seed: MUᵢ = U(N) − U(N without i), with full reallocation; round histories use the disclosed local estimate |
| Actual contribution | Demand units delivered by identity i |
| Mean provider reward | ΣRᵢ / P, including offline and Sybil identities |
| Total rewards | ΣRᵢ after audit withholding |
| Fraudulent fraction fᵢ | max(0,hᵢ − aᵢ) / hᵢ; zero when hᵢ = 0 |
| Fraud leakage L | ΣRᵢfᵢ; proportional attribution, not causal attack gain |
| Detection rate | Correctly flagged inflated-claim identities / all inflated-claim identities |
| False positives | Truthful identities incorrectly flagged by an audit |
| Verification cost V | Audited count × per-audit cost |
| Fraud prevented F | ΣGᵢfᵢ over correctly detected fraudulent identities |
| Verification efficiency | F / V |
| Attack ROI | (L − total attack cost) / total attack cost |
| Participation | Share of base providers choosing to participate in a round |
| Honest participation | Participating honest base providers / honest base providers |
| Malicious participation | Participating malicious base providers / malicious base providers |
| Reward concentration | Identity HHI = Σ(Rᵢ / ΣR)² |
| Useful reward efficiency | Σ[Rᵢ(1−fᵢ) × indicator(MUᵢ>0)] / ΣR |
| Provider redundancy | Redundantly covered assigned users / assigned users |

Zero-denominator economic ratios are N/A; they are excluded from statistics individually. No-fraud leakage is zero while detection is N/A. Zero-score reward allocations pay nothing. Recoverable stake is not an attack cost; there is no slashing or stake opportunity-cost model.

## Reward mechanisms and audits

Scores:

1. Contribution: `sᵢ = claimedᵢ`.
2. Quality-adjusted: `sᵢ = claimedᵢ × qualityᵢ`.
3. Marginal utility: `sᵢ = max(0, MUᵢ)`.
4. Proposed: `sᵢ = max(0, MUᵢ) × qualityᵢ × (0.5 + 0.5 reputationᵢ) × (1 − 0.5 riskᵢ)`.

All scores become comparable gross rewards `Gᵢ = pool × sᵢ / Σs`. All four rules use the selected audit policy. Flagged providers receive zero; withholding is not redistributed, so total payout can be less than the pool. This isolates scoring differences while retaining policy control.

Risk is `clamp(0.08 + 0.55 fᵢ + 0.25(1−reputationᵢ) + uniform[-0.175,0.175], 0.01,0.99)`. Reputation starts uniformly in [0.5,0.95). **This score uses a synthetic noisy ground-truth signal, not a measured or calibrated fraud probability.** MU also uses true physical state. These assumptions can favor the proposed mechanism.

Random auditing samples without replacement. Risk auditing sorts `riskᵢ × Gᵢ` and takes values exceeding audit cost. Both obey `floor(P × budgetPercent / 100)`. Risk auditing may leave its cap unused. Correct fraud detection is Bernoulli(sensitivity), reduced by `(1 − collusionSuppression)` under collusion. Truthful audited providers are flagged with configured false-positive probability.

## Attack assumptions

- False contribution multiplies actual service by the inflation factor.
- Fake demand adds apparent traffic without genuine users or physical utility.
- Sybil creates additional colocated zero-capacity identities sharing their actor's service claim. Each incurs infrastructure cost and locks the configured stake; actors are assumed to have sufficient capital. Removing the underlying actor invalidates its dependent Sybil service claims.
- Strategic placement searches eight seeded candidate positions sequentially per malicious actor. The utility objective evaluates U; the reward objective maximizes actual served demand, a contribution-rule reward proxy. It is not a global optimizer or a best response to every mechanism. Truthful strategic placement is not classified as inflated-claim fraud.
- Collusion inflates claims and suppresses detection probability. Mutual-attestation messages are abstracted into suppression, not explicitly modeled as a validator graph.

Provider decisions use expected payoff. Honest payoff is expected reward minus operating cost. A malicious provider attacks only when expected fraud income after audit and stake-loss risk exceeds honest payoff and remains positive. Participation compares the best expected payoff with costs and includes a 2.5% exploration probability. Effort adapts gradually, affecting capacity, quality, and uptime. Every third round, participating providers compare the current location with three seeded candidates. Contribution favors demand volume and overlap; quality adjustment adds quality; marginal-utility rules favor underserved demand; the proposed rule also includes reputation and risk. Movement and effort changes incur infrastructure cost.

## Example experiment

Open Experiment Lab and use 100 providers, 1,000 users, 20% malicious actors, false contribution, inflation 3, risk-based verification at 10%, 50 rounds, 10 trials, seed 42, medium density and clustered demand. Other parameters follow `defaults` in `lib/simulation/types.ts`. Inspect Results, choose any round-level trajectory, and review the paired proposed-minus-contribution leakage interval.

For reproduction, use CSV export. Each CSV row contains model version, trial seed, mechanism, round number, all nine tracked round metrics, and the full configuration. Run exactly the completed number of trials when reproducing a cancelled batch. Results are in-memory until exported; reload resets the session.

## Statistical interpretation

For n defined observations: mean = Σx/n; sample SD = sqrt(Σ(x−mean)²/(n−1)); two-sided 95% interval = mean ± t(0.975,n−1) × SD/sqrt(n). For n>31, df=30 is used conservatively. n<2 has no SD or interval. Paired differences use proposed and contribution results from the same trial, then apply these statistics to differences. Intervals quantify simulation variability, not model validity; no multiple-comparison correction is applied.

## Future blockchain integration

Keep physical evidence off-chain. Add a settlement adapter consuming a versioned immutable trial outcome:

`provider stake → signed infrastructure claim → evidence verification → reward / penalty → reputation update`

An adapter could emit settlement instructions with chain ID, round ID, provider/actor ID, claim hash, evidence commitment, audit decision, reward and penalty. Test conservation and replay protection before connecting a contract. Store evidence outside the chain with access controls and publish commitments or attestations. Introduce stake reservation, appeals, actor budgets, calibrated fraud signals, and empirically estimated behavioral responses before drawing deployment conclusions. No decorative blockchain database or fabricated consensus is included.

