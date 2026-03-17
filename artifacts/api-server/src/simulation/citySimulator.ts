export type TaxiStatus = "idle" | "carrying_passenger" | "moving_to_pickup";

export interface TaxiDebugInfo {
  chosenAction: string;
  qValue: number;
  demandScore: number;
  rebalancingScore: number;
  stateKey: string;
}

export interface Zone {
  id: string;
  row: number;
  col: number;
  demand: number;
  predictedDemand: number;
  waitingPassengers: number;
  taxiCount: number;
  name: string;
  trafficLevel: number;
  category: string;
  imbalance: number;
}

export interface Taxi {
  id: string;
  row: number;
  col: number;
  status: TaxiStatus;
  tripsCompleted: number;
  revenue: number;
  lastAction: string;
  destinationZone: string | null;
  tripTimeRemaining: number | null;
  debugInfo: TaxiDebugInfo | null;
}

export interface RLAnalytics {
  epsilon: number;
  replayBufferSize: number;
  episodeNumber: number;
  avgQValue: number;
  predictionAccuracy: number;
  totalQUpdates: number;
}

export interface SimulationMetrics {
  totalTripsCompleted: number;
  totalRevenue: number;
  averageWaitTime: number;
  utilizationRate: number;
  totalReward: number;
  timeStep: number;
  episodeReward: number;
}

export interface HistoryPoint {
  timeStep: number;
  tripsCompleted: number;
  revenue: number;
  utilizationRate: number;
  waitTime: number;
  reward: number;
  episodeReward: number;
  avgQValue: number;
  epsilon: number;
  predictionAccuracy: number;
}

export interface SimulationState {
  taxis: Taxi[];
  zones: Zone[];
  metrics: SimulationMetrics;
  history: HistoryPoint[];
  rlAnalytics: RLAnalytics;
  gridSize: number;
  running: boolean;
  debugMode: boolean;
}

// ─── 5×5 Grid Definition ──────────────────────────────────────────────────────
const GRID_SIZE = 5;
const NUM_TAXIS = 12;
const EPISODE_LENGTH = 50;
const ALPHA = 0.1;
const GAMMA = 0.95;
const BATCH_SIZE = 32;
const REPLAY_CAPACITY = 10_000;
const EPSILON_DECAY = 0.995;
const EPSILON_MIN = 0.05;
const EPSILON_INIT = 0.3;

interface ZoneDef {
  name: string;
  lambda: number;
  traffic: number;
  category: string;
  tripRevenue: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 20));
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function zi(row: number, col: number) { return row * GRID_SIZE + col; }

function tripDuration(r1: number, c1: number, r2: number, c2: number, traffic: number) {
  const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
  return Math.max(1, Math.round(dist * (1 + traffic)));
}

function neighbors(row: number, col: number) {
  return [
    { row: row - 1, col, action: "north" as const },
    { row: row + 1, col, action: "south" as const },
    { row, col: col - 1, action: "west"  as const },
    { row, col: col + 1, action: "east"  as const },
  ].filter(n => n.row >= 0 && n.row < GRID_SIZE && n.col >= 0 && n.col < GRID_SIZE);
}

// ─── Demand Predictor (EMA) ───────────────────────────────────────────────────
class DemandPredictor {
  private history = new Map<string, number[]>();
  private alpha = 0.35;

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
    const predicted = h[h.length - 2]; // last prediction was the previous recorded value
    return 1 - Math.min(1, Math.abs(predicted - actual) / Math.max(actual, 1));
  }
}

// ─── Experience Replay Buffer ─────────────────────────────────────────────────
interface StateVec {
  zoneIdx: number;
  demandBucket: number;   // 0-3
  predictedBucket: number;
  trafficBucket: number;  // 0-2
  occupied: number;       // 0|1
}

interface Transition {
  state: StateVec;
  action: string;
  reward: number;
  nextState: StateVec;
}

class ReplayBuffer {
  private buf: Transition[] = [];
  private capacity: number;

  constructor(capacity = REPLAY_CAPACITY) { this.capacity = capacity; }

  push(t: Transition) {
    if (this.buf.length >= this.capacity) this.buf.shift();
    this.buf.push(t);
  }

  sample(size: number): Transition[] {
    if (this.buf.length < size) return [...this.buf];
    const out: Transition[] = [];
    for (let i = 0; i < size; i++)
      out.push(this.buf[Math.floor(Math.random() * this.buf.length)]);
    return out;
  }

  get size() { return this.buf.length; }
}

// ─── Q-Learning Dispatcher with Experience Replay ─────────────────────────────
type ActionKey = "stay" | "north" | "south" | "west" | "east" | "pickup";

function discretize(val: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) if (val < thresholds[i]) return i;
  return thresholds.length;
}

function stateVec(row: number, col: number, zones: Zone[], occupied: boolean): StateVec {
  const z = zones[zi(row, col)];
  return {
    zoneIdx: zi(row, col),
    demandBucket:    discretize(z.waitingPassengers,   [2, 4, 7]),
    predictedBucket: discretize(z.predictedDemand,    [2, 4, 6]),
    trafficBucket:   discretize(z.trafficLevel,        [0.4, 0.7]),
    occupied:        occupied ? 1 : 0,
  };
}

function stateKey(sv: StateVec) {
  return `${sv.zoneIdx}|${sv.demandBucket}|${sv.predictedBucket}|${sv.trafficBucket}|${sv.occupied}`;
}

class RLDispatcher {
  private qTable = new Map<string, number>();
  private replayBuf = new ReplayBuffer();
  epsilon = EPSILON_INIT;
  totalQUpdates = 0;
  private stepsSinceReplay = 0;

  private qKey(sv: StateVec, action: string) {
    return `${stateKey(sv)}::${action}`;
  }

  private getQ(sv: StateVec, action: string): number {
    return this.qTable.get(this.qKey(sv, action)) ?? 0;
  }

  private setQ(sv: StateVec, action: string, val: number) {
    this.qTable.set(this.qKey(sv, action), val);
  }

  avgQ(): number {
    if (this.qTable.size === 0) return 0;
    let sum = 0;
    for (const v of this.qTable.values()) sum += v;
    return sum / this.qTable.size;
  }

  // Store transition and periodically do a batch update
  learn(t: Transition) {
    this.replayBuf.push(t);
    this.stepsSinceReplay++;

    if (this.stepsSinceReplay >= 4 && this.replayBuf.size >= BATCH_SIZE) {
      this.stepsSinceReplay = 0;
      const batch = this.replayBuf.sample(BATCH_SIZE);
      for (const { state, action, reward, nextState } of batch) {
        const allActions: ActionKey[] = ["stay", "north", "south", "west", "east", "pickup"];
        const bestNext = Math.max(...allActions.map(a => this.getQ(nextState, a)));
        const current = this.getQ(state, action);
        const updated = current + ALPHA * (reward + GAMMA * bestNext - current);
        this.setQ(state, action, updated);
        this.totalQUpdates++;
      }
    }
  }

  dispatch(
    taxi: Taxi,
    zones: Zone[],
    targetCounts: Map<number, number>,
    debugMode: boolean
  ): { row: number; col: number; action: string; debug: TaxiDebugInfo } {
    const sv = stateVec(taxi.row, taxi.col, zones, taxi.status === "carrying_passenger");
    const currentZone = zones[zi(taxi.row, taxi.col)];

    // Pickup if passengers waiting
    if (currentZone.waitingPassengers > 0) {
      const qv = this.getQ(sv, "stay");
      return {
        row: taxi.row, col: taxi.col, action: "pickup",
        debug: { chosenAction: "pickup", qValue: qv, demandScore: currentZone.waitingPassengers, rebalancingScore: 0, stateKey: stateKey(sv) },
      };
    }

    // Build candidates: stay + neighbors
    const candidates: { row: number; col: number; action: ActionKey }[] = [
      { row: taxi.row, col: taxi.col, action: "stay" },
      ...neighbors(taxi.row, taxi.col),
    ];

    // Score each candidate
    const scored = candidates.map(c => {
      const z = zones[zi(c.row, c.col)];
      const supply = targetCounts.get(zi(c.row, c.col)) ?? 0;

      // Multi-agent coordination: penalise overcrowded zones
      const crowdPenalty = supply > 3 ? -5 * (supply - 2) : 0;

      // Supply-demand rebalancing score
      const rebalScore = 0.6 * z.predictedDemand - 0.3 * supply + crowdPenalty;

      // Q-value
      const destSv = stateVec(c.row, c.col, zones, false);
      const qv = this.getQ(destSv, c.action);

      const domainScore = z.predictedDemand * (1 + 0.3 * z.trafficLevel) + z.waitingPassengers * 2;
      const totalScore = domainScore + qv * 0.4 + rebalScore;

      return { ...c, totalScore, qv, domainScore, rebalScore };
    });

    // Epsilon-greedy selection
    let chosen = scored[0];
    if (Math.random() < this.epsilon) {
      chosen = scored[Math.floor(Math.random() * scored.length)];
    } else {
      for (const s of scored) if (s.totalScore > chosen.totalScore) chosen = s;
    }

    return {
      row: chosen.row,
      col: chosen.col,
      action: chosen.action,
      debug: {
        chosenAction: chosen.action,
        qValue: Math.round(chosen.qv * 100) / 100,
        demandScore: Math.round(chosen.domainScore * 100) / 100,
        rebalancingScore: Math.round(chosen.rebalScore * 100) / 100,
        stateKey: stateKey(sv),
      },
    };
  }

  decayEpsilon() {
    this.epsilon = Math.max(EPSILON_MIN, this.epsilon * EPSILON_DECAY);
  }

  get bufferSize() { return this.replayBuf.size; }
}

// ─── Singletons (survive across steps) ───────────────────────────────────────
const dispatcher = new RLDispatcher();
const predictor = new DemandPredictor();

// ─── Factory ──────────────────────────────────────────────────────────────────
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

export function createSimulation(): SimulationState {
  const zones = createZones();
  const taxis = createTaxis();
  updateCounts(zones, taxis);
  return {
    taxis, zones,
    metrics: { totalTripsCompleted: 0, totalRevenue: 0, averageWaitTime: 0, utilizationRate: 0, totalReward: 0, timeStep: 0, episodeReward: 0 },
    history: [],
    rlAnalytics: {
      epsilon: dispatcher.epsilon,
      replayBufferSize: 0,
      episodeNumber: 1,
      avgQValue: 0,
      predictionAccuracy: 1,
      totalQUpdates: 0,
    },
    gridSize: GRID_SIZE,
    running: false,
    debugMode: false,
  };
}

function demandScore(zone: Zone): number {
  return zone.waitingPassengers + zone.predictedDemand * 0.7;
}

export function stepSimulation(state: SimulationState, steps = 1): SimulationState {
  let s: SimulationState = {
    ...state,
    taxis: state.taxis.map(t => ({ ...t })),
    zones: state.zones.map(z => ({ ...z })),
    metrics: { ...state.metrics },
    history: [...state.history],
    rlAnalytics: { ...state.rlAnalytics },
    running: true,
  };

  for (let step = 0; step < steps; step++) {
    s.metrics.timeStep++;
    const isEpisodeEnd = s.metrics.timeStep % EPISODE_LENGTH === 0;
    if (s.metrics.timeStep % EPISODE_LENGTH === 1 && s.metrics.timeStep > 1) {
      s.metrics.episodeReward = 0;
    }

    // --- 1. Demand generation ---
    let totalPredError = 0;
    for (const zone of s.zones) {
      const lambdaMod = zone.demand * (0.7 + 0.6 * Math.random()) * (1 + 0.3 * zone.trafficLevel);
      const newPass = poissonSample(lambdaMod);
      const before = zone.waitingPassengers;
      zone.waitingPassengers = Math.min(zone.waitingPassengers + newPass, 8);
      totalPredError += predictor.accuracy(zone.id, zone.waitingPassengers);
      predictor.record(zone.id, zone.waitingPassengers);
    }

    // --- 2. Update predictions ---
    for (const zone of s.zones) {
      zone.predictedDemand = Math.round(predictor.predict(zone.id, zone.demand) * 10) / 10;
    }

    updateCounts(s.zones, s.taxis);

    // --- 3. Compute supply-demand imbalance & target counts ---
    const targetCounts = new Map<number, number>();
    for (const zone of s.zones) {
      zone.imbalance = Math.round((zone.predictedDemand - zone.taxiCount) * 10) / 10;
      targetCounts.set(zi(zone.row, zone.col), zone.taxiCount);
    }

    let stepReward = 0;

    // --- 4. Step each taxi ---
    for (const taxi of s.taxis) {
      if (taxi.status === "carrying_passenger") {
        if (taxi.tripTimeRemaining !== null && taxi.tripTimeRemaining > 1) {
          taxi.tripTimeRemaining--;
          taxi.lastAction = `delivering (${taxi.tripTimeRemaining}t)`;
        } else {
          const def = ZONE_DEFS[taxi.row]?.[taxi.col];
          const fare = (def?.tripRevenue ?? 15) + 5 + Math.random() * 8;
          taxi.tripsCompleted++;
          taxi.revenue += fare;
          s.metrics.totalTripsCompleted++;
          s.metrics.totalRevenue += fare;
          taxi.status = "idle";
          taxi.destinationZone = null;
          taxi.tripTimeRemaining = null;
          taxi.lastAction = "delivered_passenger";
          stepReward += 10;

          // Learn from delivery
          const sv = stateVec(taxi.row, taxi.col, s.zones, false);
          dispatcher.learn({ state: sv, action: "pickup", reward: 10, nextState: sv });
        }
        continue;
      }

      // Dispatch idle taxi
      const prevSv = stateVec(taxi.row, taxi.col, s.zones, false);
      const dispatch = dispatcher.dispatch(taxi, s.zones, targetCounts, s.debugMode);

      taxi.debugInfo = dispatch.debug; // always populate; frontend controls display

      if (dispatch.action === "pickup") {
        const z = s.zones[zi(taxi.row, taxi.col)];
        if (z.waitingPassengers > 0) {
          z.waitingPassengers--;
          const destRow = Math.floor(Math.random() * GRID_SIZE);
          const destCol = Math.floor(Math.random() * GRID_SIZE);
          const destDef = ZONE_DEFS[destRow][destCol];
          const duration = tripDuration(taxi.row, taxi.col, destRow, destCol, z.trafficLevel);
          taxi.status = "carrying_passenger";
          taxi.destinationZone = destDef.name;
          taxi.tripTimeRemaining = duration;
          taxi.lastAction = "picked_up_passenger";
          const reward = z.waitingPassengers >= 3 ? 15 : 10;
          stepReward += reward;

          const nextSv = stateVec(taxi.row, taxi.col, s.zones, true);
          dispatcher.learn({ state: prevSv, action: "pickup", reward, nextState: nextSv });
        } else {
          taxi.lastAction = "wait_no_passengers";
          stepReward -= 1;
          dispatcher.learn({ state: prevSv, action: "pickup", reward: -1, nextState: prevSv });
        }
      } else {
        const oldRow = taxi.row, oldCol = taxi.col;
        taxi.row = dispatch.row;
        taxi.col = dispatch.col;
        taxi.lastAction = dispatch.action;

        // Update target count to prevent crowding
        const newIdx = zi(taxi.row, taxi.col);
        targetCounts.set(newIdx, (targetCounts.get(newIdx) ?? 0) + 1);
        if (oldRow !== taxi.row || oldCol !== taxi.col) {
          const oldIdx = zi(oldRow, oldCol);
          targetCounts.set(oldIdx, Math.max(0, (targetCounts.get(oldIdx) ?? 1) - 1));
        }

        const moved = oldRow !== taxi.row || oldCol !== taxi.col;
        const oldZone = s.zones[zi(oldRow, oldCol)];
        const newZone = s.zones[zi(taxi.row, taxi.col)];
        const oldScore = demandScore(oldZone);
        const newScore = demandScore(newZone);

        const delta = newScore - oldScore;
        let moveReward = moved ? delta * 0.5 : -0.2;
        moveReward = Math.max(-2, Math.min(3, moveReward));
        stepReward += moveReward;

        const nextSv = stateVec(taxi.row, taxi.col, s.zones, false);
        dispatcher.learn({ state: prevSv, action: dispatch.action, reward: moveReward, nextState: nextSv });
      }
    }

    // --- 5. Overcrowding penalty (smooth, not spiked) ---
    const totalWaiting = s.zones.reduce((sum, z) => sum + z.waitingPassengers, 0);
    stepReward -= totalWaiting * 0.2;

    // --- 6. Episode end: decay epsilon, reset queues ---
    if (isEpisodeEnd) {
      dispatcher.decayEpsilon();
      // Soft reset: clear waiting passengers but keep Q-table & taxis
      for (const zone of s.zones) zone.waitingPassengers = poissonSample(zone.demand * 0.3);
      for (const taxi of s.taxis) {
        if (taxi.status !== "carrying_passenger") {
          taxi.status = "idle";
          taxi.destinationZone = null;
          taxi.tripTimeRemaining = null;
          taxi.lastAction = "episode_reset";
        }
      }
    }

    updateCounts(s.zones, s.taxis);

    const activeTaxis = s.taxis.filter(t => t.status === "carrying_passenger").length;
    s.metrics.utilizationRate = Math.round((activeTaxis / s.taxis.length) * 1000) / 10;
    s.metrics.averageWaitTime = Math.round((totalWaiting / s.zones.length) * 10) / 10;
    s.metrics.totalReward += stepReward;
    s.metrics.episodeReward += stepReward;

    const predAcc = Math.round((totalPredError / s.zones.length) * 1000) / 1000;
    const avgQ = Math.round(dispatcher.avgQ() * 100) / 100;
    const episodeNumber = Math.floor(s.metrics.timeStep / EPISODE_LENGTH) + 1;

    s.rlAnalytics = {
      epsilon: Math.round(dispatcher.epsilon * 1000) / 1000,
      replayBufferSize: dispatcher.bufferSize,
      episodeNumber,
      avgQValue: avgQ,
      predictionAccuracy: predAcc,
      totalQUpdates: dispatcher.totalQUpdates,
    };

    if (s.history.length >= 200) s.history = s.history.slice(s.history.length - 200);
    s.history.push({
      timeStep: s.metrics.timeStep,
      tripsCompleted: s.metrics.totalTripsCompleted,
      revenue: Math.round(s.metrics.totalRevenue * 100) / 100,
      utilizationRate: s.metrics.utilizationRate,
      waitTime: s.metrics.averageWaitTime,
      reward: Math.round(stepReward * 10) / 10,
      episodeReward: Math.round(s.metrics.episodeReward * 10) / 10,
      avgQValue: avgQ,
      epsilon: Math.round(dispatcher.epsilon * 1000) / 1000,
      predictionAccuracy: predAcc,
    });
  }

  return s;
}

export function resetSimulation(): SimulationState {
  return createSimulation();
}
