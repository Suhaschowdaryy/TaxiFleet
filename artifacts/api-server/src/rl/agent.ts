/**
 * RL Agent — Q-learning with Experience Replay
 *
 * Completely independent of the city simulation.
 * Imports only the shared Zone / Taxi / TaxiDebugInfo types.
 *
 * Public surface:
 *   createRLAgent()  → RLAgent
 *
 * RLAgent:
 *   dispatch(taxi, zones, gridSize, targetCounts) → { row, col, action, debug }
 *   learn(transition)
 *   decayEpsilon()
 *   epsilon, bufferSize, totalQUpdates, avgQ()
 */

import { Zone, Taxi, TaxiDebugInfo } from "../simulation/types";

// ─── Hyperparameters ──────────────────────────────────────────────────────────
export const RL_CONFIG = {
  alpha:          0.15,   // learning rate (slightly higher for faster convergence)
  gamma:          0.95,   // discount factor
  batchSize:      32,     // replay mini-batch size
  replayCapacity: 10_000, // max transitions stored
  epsilonInit:    0.3,    // starting exploration rate
  epsilonDecay:   0.995,  // per-episode multiplier
  epsilonMin:     0.05,   // floor
} as const;

// ─── Action space ─────────────────────────────────────────────────────────────
export type ActionKey = "stay" | "north" | "south" | "west" | "east" | "pickup";
export const ALL_ACTIONS: ActionKey[] = [
  "stay", "north", "south", "west", "east", "pickup",
];

// ─── State representation ─────────────────────────────────────────────────────
export interface StateVec {
  zoneIdx:         number; // 0–24
  demandBucket:    number; // 0–3  (waiting passengers, discretized)
  predictedBucket: number; // 0–3  (EMA predicted demand, discretized)
  trafficBucket:   number; // 0–2  (traffic level, discretized)
  occupied:        number; // 0|1
}

export interface Transition {
  state:     StateVec;
  action:    string;
  reward:    number;
  nextState: StateVec;
}

function discretize(val: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (val < thresholds[i]) return i;
  }
  return thresholds.length;
}

export function buildStateVec(
  row: number,
  col: number,
  gridSize: number,
  zones: Zone[],
  occupied: boolean,
): StateVec {
  const z = zones[row * gridSize + col];
  return {
    zoneIdx:         row * gridSize + col,
    demandBucket:    discretize(z.waitingPassengers, [2, 4, 7]),
    predictedBucket: discretize(z.predictedDemand,  [2, 4, 6]),
    trafficBucket:   discretize(z.trafficLevel,     [0.4, 0.7]),
    occupied:        occupied ? 1 : 0,
  };
}

export function stateKey(sv: StateVec): string {
  return `${sv.zoneIdx}|${sv.demandBucket}|${sv.predictedBucket}|${sv.trafficBucket}|${sv.occupied}`;
}

// ─── Experience Replay Buffer ─────────────────────────────────────────────────
class ReplayBuffer {
  private buf: Transition[] = [];

  constructor(private capacity = RL_CONFIG.replayCapacity) {}

  push(t: Transition) {
    if (this.buf.length >= this.capacity) this.buf.shift();
    this.buf.push(t);
  }

  sample(size: number): Transition[] {
    if (this.buf.length < size) return [...this.buf];
    const out: Transition[] = [];
    for (let i = 0; i < size; i++) {
      out.push(this.buf[Math.floor(Math.random() * this.buf.length)]);
    }
    return out;
  }

  get size() { return this.buf.length; }
}

// ─── Q-Table ──────────────────────────────────────────────────────────────────
class QTable {
  private table = new Map<string, number>();

  key(sv: StateVec, action: string) {
    return `${stateKey(sv)}::${action}`;
  }

  get(sv: StateVec, action: string): number {
    return this.table.get(this.key(sv, action)) ?? 0;
  }

  set(sv: StateVec, action: string, val: number) {
    this.table.set(this.key(sv, action), val);
  }

  avgValue(): number {
    if (this.table.size === 0) return 0;
    let sum = 0;
    for (const v of this.table.values()) sum += v;
    return sum / this.table.size;
  }
}

// ─── RL Agent ─────────────────────────────────────────────────────────────────
export interface DispatchResult {
  row:    number;
  col:    number;
  action: string;
  debug:  TaxiDebugInfo;
}

export class RLAgent {
  private qTable       = new QTable();
  private replayBuf    = new ReplayBuffer();
  private stepsSinceReplay = 0;

  epsilon: number      = RL_CONFIG.epsilonInit;
  totalQUpdates        = 0;

  // ── Bellman batch update ────────────────────────────────────────────────────
  learn(t: Transition) {
    this.replayBuf.push(t);
    this.stepsSinceReplay++;

    if (
      this.stepsSinceReplay >= 4 &&
      this.replayBuf.size >= RL_CONFIG.batchSize
    ) {
      this.stepsSinceReplay = 0;
      const batch = this.replayBuf.sample(RL_CONFIG.batchSize);

      for (const { state, action, reward, nextState } of batch) {
        const bestNext = Math.max(
          ...ALL_ACTIONS.map(a => this.qTable.get(nextState, a))
        );
        const current = this.qTable.get(state, action);
        const updated =
          current +
          RL_CONFIG.alpha * (reward + RL_CONFIG.gamma * bestNext - current);
        this.qTable.set(state, action, updated);
        this.totalQUpdates++;
      }
    }
  }

  // ── Q-value dominant dispatch ───────────────────────────────────────────────
  //
  // Decisions are primarily driven by learned Q-values (weight 2.0).
  // The only heuristic retained is a small pickup nudge to help early
  // exploration converge faster toward the high-reward pickup action.
  // Everything else (demand scores, rebalancing bonuses, crowd penalties)
  // has been removed — the agent learns all of that through rewards.
  dispatch(
    taxi:         Taxi,
    zones:        Zone[],
    gridSize:     number,
    targetCounts: Map<number, number>,
  ): DispatchResult {
    const sv = buildStateVec(taxi.row, taxi.col, gridSize, zones, false);

    // Build candidate actions (valid neighbors + stay + pickup)
    const neighborCells = ([
      { row: taxi.row - 1, col: taxi.col,     action: "north" as ActionKey },
      { row: taxi.row + 1, col: taxi.col,     action: "south" as ActionKey },
      { row: taxi.row,     col: taxi.col - 1, action: "west"  as ActionKey },
      { row: taxi.row,     col: taxi.col + 1, action: "east"  as ActionKey },
    ] as { row: number; col: number; action: ActionKey }[]).filter(n =>
      n.row >= 0 && n.row < gridSize &&
      n.col >= 0 && n.col < gridSize
    );

    const candidates: { row: number; col: number; action: ActionKey }[] = [
      { row: taxi.row, col: taxi.col, action: "stay"   },
      { row: taxi.row, col: taxi.col, action: "pickup" },
      ...neighborCells,
    ];

    // Training progress: 0 (fresh) → 1 (fully trained), derived from epsilon decay.
    // As epsilon falls from epsilonInit → epsilonMin, progress rises 0 → 1.
    const trainingProgress =
      1 - (this.epsilon - RL_CONFIG.epsilonMin) /
          (RL_CONFIG.epsilonInit - RL_CONFIG.epsilonMin);

    // Q-value weight scales 1.0 → 2.0 as the agent trains.
    // Early: Q-values are noisy so we trust them less (weight 1.0).
    // Late:  Q-values are reliable so they dominate fully (weight 2.0).
    const qScale = 1.0 + trainingProgress;

    // Pickup nudge decays with epsilon (max 1.0 early, ~0 when fully trained).
    // Only guides early exploration; Q-values take over as training progresses.
    const nudgeStrength = this.epsilon / RL_CONFIG.epsilonInit; // 1.0 → ~0.17

    const scored = candidates.map(c => {
      const z           = zones[c.row * gridSize + c.col];
      const qv          = this.qTable.get(sv, c.action);
      const pickupNudge =
        c.action === "pickup" && z.waitingPassengers > 0 ? nudgeStrength : 0;

      const totalScore = qv * qScale + pickupNudge;

      return {
        ...c,
        totalScore,
        qv,
        predictedDemand:   z.predictedDemand,
        futureDemandBonus: z.predictedDemand * 1.0,
      };
    });

    // Epsilon-greedy selection
    let chosen = scored[0];
    if (Math.random() < this.epsilon) {
      chosen = scored[Math.floor(Math.random() * scored.length)];
    } else {
      for (const s of scored) {
        if (s.totalScore > chosen.totalScore) chosen = s;
      }
    }

    return {
      row:    chosen.row,
      col:    chosen.col,
      action: chosen.action,
      debug: {
        chosenAction:     chosen.action,
        qValue:           Math.round(chosen.qv               * 100) / 100,
        demandScore:      Math.round(chosen.predictedDemand   * 100) / 100,
        rebalancingScore: Math.round(chosen.futureDemandBonus * 100) / 100,
        stateKey:         stateKey(sv),
      },
    };
  }

  // ── Epsilon decay (call once per episode) ───────────────────────────────────
  decayEpsilon() {
    this.epsilon = Math.max(
      RL_CONFIG.epsilonMin,
      this.epsilon * RL_CONFIG.epsilonDecay,
    );
  }

  // ── Analytics helpers ───────────────────────────────────────────────────────
  get bufferSize()  { return this.replayBuf.size; }
  avgQ()            { return this.qTable.avgValue(); }
}

/** Factory — creates a fresh RL agent with default hyperparameters */
export function createRLAgent(): RLAgent {
  return new RLAgent();
}
