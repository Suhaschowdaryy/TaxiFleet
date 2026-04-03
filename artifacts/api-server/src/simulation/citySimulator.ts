/**
 * City Simulation — environment only.
 *
 * Responsible for: zones, taxis, demand generation, EMA prediction,
 * episode management, reward calculation, and metrics.
 *
 * The RL agent (Q-learning, replay buffer, dispatch policy) lives in:
 *   src/rl/agent.ts
 */

import {
  TaxiStatus,
  Zone,
  Taxi,
  SimulationMetrics,
  HistoryPoint,
  SimulationState,
} from "./types";

import {
  RLAgent,
  createRLAgent,
  buildStateVec,
} from "../rl/agent";

export type { TaxiStatus, Zone, Taxi, SimulationMetrics, HistoryPoint };
export type { SimulationState };
export type { RLAnalytics } from "./types";

// ─── Simulation constants ─────────────────────────────────────────────────────
const GRID_SIZE      = 5;
const NUM_TAXIS      = 12;
const EPISODE_LENGTH = 50;

// ─── Zone definitions ─────────────────────────────────────────────────────────
interface ZoneDef {
  name:       string;
  lambda:     number;
  traffic:    number;
  category:   string;
  tripRevenue:number;
}

const ZONE_DEFS: ZoneDef[][] = [
  [
    { name: "Downtown North",    lambda: 3.5, traffic: 0.70, category: "business",    tripRevenue: 18 },
    { name: "Midtown West",      lambda: 2.8, traffic: 0.60, category: "business",    tripRevenue: 16 },
    { name: "City Center",       lambda: 6.0, traffic: 0.90, category: "hub",         tripRevenue: 22 },
    { name: "Midtown East",      lambda: 2.8, traffic: 0.60, category: "business",    tripRevenue: 16 },
    { name: "Downtown East",     lambda: 3.2, traffic: 0.70, category: "business",    tripRevenue: 18 },
  ],
  [
    { name: "West Business",     lambda: 3.0, traffic: 0.65, category: "business",    tripRevenue: 17 },
    { name: "Central Business",  lambda: 5.0, traffic: 0.85, category: "hub",         tripRevenue: 20 },
    { name: "Airport Terminal",  lambda: 5.5, traffic: 0.75, category: "transit",     tripRevenue: 28 },
    { name: "East Business",     lambda: 3.0, traffic: 0.65, category: "business",    tripRevenue: 17 },
    { name: "Harbor District",   lambda: 2.2, traffic: 0.50, category: "mixed",       tripRevenue: 15 },
  ],
  [
    { name: "University",        lambda: 2.5, traffic: 0.45, category: "education",   tripRevenue: 14 },
    { name: "Tech District",     lambda: 3.5, traffic: 0.60, category: "business",    tripRevenue: 19 },
    { name: "Grand Central",     lambda: 5.0, traffic: 0.80, category: "transit",     tripRevenue: 20 },
    { name: "Financial",         lambda: 4.0, traffic: 0.75, category: "business",    tripRevenue: 21 },
    { name: "Convention Center", lambda: 4.0, traffic: 0.70, category: "events",      tripRevenue: 20 },
  ],
  [
    { name: "Residential NW",    lambda: 1.8, traffic: 0.30, category: "residential", tripRevenue: 12 },
    { name: "Park District",     lambda: 2.0, traffic: 0.35, category: "leisure",     tripRevenue: 13 },
    { name: "Shopping Mall",     lambda: 3.5, traffic: 0.65, category: "retail",      tripRevenue: 15 },
    { name: "Stadium",           lambda: 4.0, traffic: 0.70, category: "events",      tripRevenue: 16 },
    { name: "Residential NE",    lambda: 1.8, traffic: 0.30, category: "residential", tripRevenue: 12 },
  ],
  [
    { name: "South West",        lambda: 1.5, traffic: 0.25, category: "residential", tripRevenue: 11 },
    { name: "Industrial",        lambda: 1.2, traffic: 0.30, category: "industrial",  tripRevenue: 13 },
    { name: "South Station",     lambda: 3.8, traffic: 0.60, category: "transit",     tripRevenue: 17 },
    { name: "Logistics Hub",     lambda: 1.5, traffic: 0.35, category: "industrial",  tripRevenue: 14 },
    { name: "South East",        lambda: 1.5, traffic: 0.25, category: "residential", tripRevenue: 11 },
  ],
];

// ─── Environment helpers ──────────────────────────────────────────────────────
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 20));
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function zi(row: number, col: number) { return row * GRID_SIZE + col; }

function tripDuration(
  r1: number, c1: number,
  r2: number, c2: number,
  traffic: number,
): number {
  const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
  return Math.max(1, Math.round(dist * (1 + traffic)));
}

// ─── EMA Demand Predictor ────────────────────────────────────────────────────
class DemandPredictor {
  private history = new Map<string, number[]>();
  private alpha   = 0.35;

  record(id: string, val: number) {
    const h = this.history.get(id) ?? [];
    h.push(val);
    if (h.length > 20) h.shift();
    this.history.set(id, h);
  }

  predict(id: string, base: number): number {
    const h = this.history.get(id);
    if (!h || h.length < 2) return base;
    let ema = h[0];
    for (let i = 1; i < h.length; i++) ema = this.alpha * h[i] + (1 - this.alpha) * ema;
    const trend = h[h.length - 1] - h[h.length - 2];
    return Math.max(0, ema + trend * 0.2);
  }

  accuracy(id: string, actual: number): number {
    const h = this.history.get(id);
    if (!h || h.length < 2) return 1;
    const predicted = h[h.length - 2];
    return 1 - Math.min(1, Math.abs(predicted - actual) / Math.max(actual, 1));
  }
}

// ─── Zone / Taxi factories ────────────────────────────────────────────────────
function createZones(): Zone[] {
  const zones: Zone[] = [];
  let idx = 1;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const d = ZONE_DEFS[r][c];
      zones.push({
        id: `Z${idx++}`, row: r, col: c,
        demand: d.lambda, predictedDemand: d.lambda,
        waitingPassengers: poissonSample(d.lambda),
        taxiCount: 0, name: d.name,
        trafficLevel: d.traffic, category: d.category,
        imbalance: 0,
      });
    }
  }
  return zones;
}

function createTaxis(): Taxi[] {
  return Array.from({ length: NUM_TAXIS }, (_, i) => ({
    id: `T${String(i + 1).padStart(2, "0")}`,
    row: Math.floor(Math.random() * GRID_SIZE),
    col: Math.floor(Math.random() * GRID_SIZE),
    status: "idle" as TaxiStatus,
    tripsCompleted: 0, revenue: 0,
    lastAction: "initialized",
    destinationZone: null, tripTimeRemaining: null,
    debugInfo: null,
  }));
}

function updateCounts(zones: Zone[], taxis: Taxi[]) {
  zones.forEach(z => z.taxiCount = 0);
  taxis.forEach(t => zones[zi(t.row, t.col)].taxiCount++);
}

// ─── Persistent singletons (survive across HTTP calls) ───────────────────────
const agent: RLAgent       = createRLAgent();
const predictor            = new DemandPredictor();

// ─── Public API ───────────────────────────────────────────────────────────────
export function createSimulation(): SimulationState {
  const zones = createZones();
  const taxis = createTaxis();
  updateCounts(zones, taxis);
  return {
    taxis, zones,
    metrics: {
      totalTripsCompleted: 0, totalRevenue: 0,
      averageWaitTime: 0,     utilizationRate: 0,
      totalReward: 0,         timeStep: 0,
      episodeReward: 0,
    },
    history: [],
    rlAnalytics: {
      epsilon:           agent.epsilon,
      replayBufferSize:  0,
      episodeNumber:     1,
      avgQValue:         0,
      predictionAccuracy:1,
      totalQUpdates:     0,
    },
    gridSize: GRID_SIZE,
    running:  false,
    debugMode:false,
  };
}

export function stepSimulation(state: SimulationState, steps = 1): SimulationState {
  let s: SimulationState = {
    ...state,
    taxis:       state.taxis.map(t => ({ ...t })),
    zones:       state.zones.map(z => ({ ...z })),
    metrics:     { ...state.metrics },
    history:     [...state.history],
    rlAnalytics: { ...state.rlAnalytics },
    running: true,
  };

  for (let step = 0; step < steps; step++) {
    s.metrics.timeStep++;
    const isEpisodeEnd = s.metrics.timeStep % EPISODE_LENGTH === 0;

    // Reset episode reward at the start of each new episode
    if (s.metrics.timeStep % EPISODE_LENGTH === 1 && s.metrics.timeStep > 1) {
      s.metrics.episodeReward = 0;
    }

    // ── 1. Demand generation ─────────────────────────────────────────────────
    let totalPredAcc = 0;
    for (const zone of s.zones) {
      const lambdaMod =
        zone.demand * (0.7 + 0.6 * Math.random()) * (1 + 0.3 * zone.trafficLevel);
      const newPass = poissonSample(lambdaMod);
      zone.waitingPassengers = Math.min(zone.waitingPassengers + newPass, 8);
      totalPredAcc += predictor.accuracy(zone.id, zone.waitingPassengers);
      predictor.record(zone.id, zone.waitingPassengers);
    }

    // ── 2. Update EMA predictions ────────────────────────────────────────────
    for (const zone of s.zones) {
      zone.predictedDemand =
        Math.round(predictor.predict(zone.id, zone.demand) * 10) / 10;
    }

    updateCounts(s.zones, s.taxis);

    // ── 3. Compute supply–demand imbalance & target counts ───────────────────
    const targetCounts = new Map<number, number>();
    for (const zone of s.zones) {
      zone.imbalance =
        Math.round((zone.predictedDemand - zone.taxiCount) * 10) / 10;
      targetCounts.set(zi(zone.row, zone.col), zone.taxiCount);
    }

    let stepReward = 0;

    // Max predicted demand across all zones — used for gradient penalty below
    const maxDemandInGrid = Math.max(...s.zones.map(z => z.predictedDemand));

    // ── 4. Step each taxi ────────────────────────────────────────────────────
    for (const taxi of s.taxis) {
      // ── 4a. Taxis currently on a trip ──────────────────────────────────────
      if (taxi.status === "carrying_passenger") {
        if (taxi.tripTimeRemaining !== null && taxi.tripTimeRemaining > 1) {
          taxi.tripTimeRemaining--;
          taxi.lastAction = `delivering (${taxi.tripTimeRemaining}t)`;
        } else {
          const def  = ZONE_DEFS[taxi.row]?.[taxi.col];
          const fare = (def?.tripRevenue ?? 15) + 5 + Math.random() * 8;
          taxi.tripsCompleted++;
          taxi.revenue += fare;
          s.metrics.totalTripsCompleted++;
          s.metrics.totalRevenue += fare;
          taxi.status            = "idle";
          taxi.destinationZone   = null;
          taxi.tripTimeRemaining = null;
          taxi.lastAction        = "delivered_passenger";
          stepReward += 5; // small delivery completion credit (metrics only)
        }
        continue;
      }

      // ── 4b. Dispatch idle taxi via RL agent ────────────────────────────────
      const prevSv   = buildStateVec(taxi.row, taxi.col, GRID_SIZE, s.zones, false);
      const decision = agent.dispatch(taxi, s.zones, GRID_SIZE, targetCounts);

      taxi.debugInfo = decision.debug;

      // ── 4c. Execute action & compute reward ────────────────────────────────
      if (decision.action === "pickup") {
        const z = s.zones[zi(taxi.row, taxi.col)];

        if (z.waitingPassengers > 0) {
          z.waitingPassengers--;
          const destRow = Math.floor(Math.random() * GRID_SIZE);
          const destCol = Math.floor(Math.random() * GRID_SIZE);
          const duration =
            tripDuration(taxi.row, taxi.col, destRow, destCol, z.trafficLevel);
          taxi.status            = "carrying_passenger";
          taxi.destinationZone   = ZONE_DEFS[destRow][destCol].name;
          taxi.tripTimeRemaining = duration;
          taxi.lastAction        = "picked_up_passenger";

          // +20 for successful pickup — the dominant positive reward signal
          const reward = 20;
          stepReward  += reward;

          const nextSv = buildStateVec(taxi.row, taxi.col, GRID_SIZE, s.zones, false);
          agent.learn({ state: prevSv, action: "pickup", reward, nextState: nextSv });

        } else {
          // Failed pickup attempt (no passengers here)
          taxi.lastAction = "wait_no_passengers";
          const reward = -2;
          stepReward += reward;
          agent.learn({ state: prevSv, action: "pickup", reward, nextState: prevSv });
        }

      } else {
        // Movement or stay
        const oldRow = taxi.row, oldCol = taxi.col;
        taxi.row        = decision.row;
        taxi.col        = decision.col;
        taxi.lastAction = decision.action;

        // Update live target counts
        const newIdx = zi(taxi.row, taxi.col);
        targetCounts.set(newIdx, (targetCounts.get(newIdx) ?? 0) + 1);
        if (oldRow !== taxi.row || oldCol !== taxi.col) {
          const oldIdx = zi(oldRow, oldCol);
          targetCounts.set(oldIdx, Math.max(0, (targetCounts.get(oldIdx) ?? 1) - 1));
        }

        const destZone = s.zones[zi(taxi.row, taxi.col)];

        // ── Reward design: RL-driven, minimal heuristics ─────────────────
        //
        // Normalize demand so reward magnitudes stay stable regardless of how
        // stochastic demand fluctuates. All demand-based terms use this value.
        // normalizedDemand ∈ [0, 1], = 1.0 at the grid's best zone.
        const normalizedDemand =
          maxDemandInGrid > 0 ? destZone.predictedDemand / maxDemandInGrid : 0;
        //
        // 1. Time-step cost: encourages urgency on every step
        const timePenalty = -1;
        //
        // 2. Future demand alignment bonus (capped at +4.0).
        //    Movement toward the best zone earns +4.0 max — well below the
        //    +20 pickup reward so the agent always prefers actual pickups.
        const futureDemandBonus = normalizedDemand * 3.5;
        //
        // 3. Hard low-demand penalty: strongly discourage parking in dead zones
        //    that have no current passengers and negligible predicted demand.
        const lowDemandPenalty =
          destZone.predictedDemand < 1.5 && destZone.waitingPassengers === 0
            ? -10
            : 0;
        //
        // 4. Gradient penalty (normalized, reduced from 0.5 → 0.3 scalar).
        //    Provides smooth directional guidance without over-penalizing
        //    mid-tier zones.  Penalty = 0 at best zone, max 2.0 at worst.
        const gradientPenalty = (1 - normalizedDemand) * 2.0;
        //
        // 5. Directional penalty: discourage moves that lead to a zone with
        //    meaningfully lower predicted demand than the best available neighbor
        //    of the origin. A 0.1 tolerance filters out prediction noise so
        //    near-equal choices are not punished.
        const moved = oldRow !== taxi.row || oldCol !== taxi.col;
        let directionalPenalty = 0;
        if (moved) {
          const bestNeighborDemand = Math.max(
            ...([ [oldRow-1,oldCol],[oldRow+1,oldCol],[oldRow,oldCol-1],[oldRow,oldCol+1] ]
              .filter(([r,c]) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE)
              .map(([r,c]) => s.zones[zi(r as number, c as number)].predictedDemand)),
          );
          if (destZone.predictedDemand < bestNeighborDemand - 0.1) directionalPenalty = -1;
        }
        //
        // 6. Passive positioning reward: if the taxi is already in a high-demand
        //    zone (top 30% of grid demand) reward staying put with a small bonus.
        //    Prevents premature departure from well-positioned zones.
        const positioningBonus = normalizedDemand > 0.7 ? 1 : 0;
        //
        // 7. Idle penalty: -5 total (-1 time + -4 here) when staying put
        //    while passengers are waiting in other zones.
        let idlePenalty = 0;
        if (decision.action === "stay") {
          const passengersElsewhere = s.zones.some(
            z => !(z.row === taxi.row && z.col === taxi.col) && z.waitingPassengers > 0,
          );
          if (passengersElsewhere) idlePenalty = -4;
        }

        const moveReward =
          timePenalty + futureDemandBonus + lowDemandPenalty
          - gradientPenalty + directionalPenalty + positioningBonus + idlePenalty;
        stepReward += moveReward;

        const nextSv = buildStateVec(taxi.row, taxi.col, GRID_SIZE, s.zones, false);
        agent.learn({ state: prevSv, action: decision.action, reward: moveReward, nextState: nextSv });
      }
    }

    // ── 5. Track waiting passengers for metrics ───────────────────────────────
    const totalWaiting = s.zones.reduce((sum, z) => sum + z.waitingPassengers, 0);

    // ── 6. Episode end: decay ε, soft-reset queues ───────────────────────────
    if (isEpisodeEnd) {
      agent.decayEpsilon();
      for (const zone of s.zones) {
        zone.waitingPassengers = poissonSample(zone.demand * 0.3);
      }
      for (const taxi of s.taxis) {
        if (taxi.status !== "carrying_passenger") {
          taxi.status            = "idle";
          taxi.destinationZone   = null;
          taxi.tripTimeRemaining = null;
          taxi.lastAction        = "episode_reset";
        }
      }
    }

    updateCounts(s.zones, s.taxis);

    // ── 7. Update metrics & history ──────────────────────────────────────────
    const activeTaxis = s.taxis.filter(t => t.status === "carrying_passenger").length;
    s.metrics.utilizationRate =
      Math.round((activeTaxis / s.taxis.length) * 1000) / 10;
    s.metrics.averageWaitTime =
      Math.round((totalWaiting / s.zones.length) * 10) / 10;
    s.metrics.totalReward   += stepReward;
    s.metrics.episodeReward += stepReward;

    const predAcc     = Math.round((totalPredAcc / s.zones.length) * 1000) / 1000;
    const avgQ        = Math.round(agent.avgQ() * 100) / 100;
    const episodeNum  = Math.floor(s.metrics.timeStep / EPISODE_LENGTH) + 1;

    s.rlAnalytics = {
      epsilon:           Math.round(agent.epsilon        * 1000) / 1000,
      replayBufferSize:  agent.bufferSize,
      episodeNumber:     episodeNum,
      avgQValue:         avgQ,
      predictionAccuracy:predAcc,
      totalQUpdates:     agent.totalQUpdates,
    };

    if (s.history.length >= 200) s.history = s.history.slice(-200);
    s.history.push({
      timeStep:          s.metrics.timeStep,
      tripsCompleted:    s.metrics.totalTripsCompleted,
      revenue:           Math.round(s.metrics.totalRevenue * 100) / 100,
      utilizationRate:   s.metrics.utilizationRate,
      waitTime:          s.metrics.averageWaitTime,
      reward:            Math.round(stepReward  * 10) / 10,
      episodeReward:     Math.round(s.metrics.episodeReward * 10) / 10,
      avgQValue:         avgQ,
      epsilon:           Math.round(agent.epsilon * 1000) / 1000,
      predictionAccuracy:predAcc,
    });
  }

  return s;
}

export function resetSimulation(): SimulationState {
  return createSimulation();
}
