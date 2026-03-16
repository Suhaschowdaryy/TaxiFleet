export type TaxiStatus = "idle" | "carrying_passenger" | "moving_to_pickup";

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
}

export interface SimulationState {
  taxis: Taxi[];
  zones: Zone[];
  metrics: SimulationMetrics;
  history: HistoryPoint[];
  gridSize: number;
  running: boolean;
}

// ─── 5×5 City Grid Definition ─────────────────────────────────────────────────
const GRID_SIZE = 5;
const NUM_TAXIS = 12;
const EPISODE_LENGTH = 50;

interface ZoneDef {
  name: string;
  lambda: number;
  traffic: number;
  category: string;
  tripRevenue: number; // base fare
}

// Row-major order: row 0 = top, row 4 = bottom
const ZONE_DEFS: ZoneDef[][] = [
  // Row 0 — North Strip
  [
    { name: "Downtown North", lambda: 3.5, traffic: 0.7, category: "business", tripRevenue: 18 },
    { name: "Midtown West",   lambda: 2.8, traffic: 0.6, category: "business", tripRevenue: 16 },
    { name: "City Center",    lambda: 6.0, traffic: 0.9, category: "hub",      tripRevenue: 22 },
    { name: "Midtown East",   lambda: 2.8, traffic: 0.6, category: "business", tripRevenue: 16 },
    { name: "Downtown East",  lambda: 3.2, traffic: 0.7, category: "business", tripRevenue: 18 },
  ],
  // Row 1 — Business Belt
  [
    { name: "West Business",     lambda: 3.0, traffic: 0.65, category: "business",    tripRevenue: 17 },
    { name: "Central Business",  lambda: 5.0, traffic: 0.85, category: "hub",         tripRevenue: 20 },
    { name: "Airport Terminal",  lambda: 5.5, traffic: 0.75, category: "transit",     tripRevenue: 28 },
    { name: "East Business",     lambda: 3.0, traffic: 0.65, category: "business",    tripRevenue: 17 },
    { name: "Harbor District",   lambda: 2.2, traffic: 0.5,  category: "mixed",       tripRevenue: 15 },
  ],
  // Row 2 — Mid Belt
  [
    { name: "University",        lambda: 2.5, traffic: 0.45, category: "education",   tripRevenue: 14 },
    { name: "Tech District",     lambda: 3.5, traffic: 0.6,  category: "business",    tripRevenue: 19 },
    { name: "Grand Central",     lambda: 5.0, traffic: 0.8,  category: "transit",     tripRevenue: 20 },
    { name: "Financial",         lambda: 4.0, traffic: 0.75, category: "business",    tripRevenue: 21 },
    { name: "Convention Center", lambda: 4.0, traffic: 0.7,  category: "events",      tripRevenue: 20 },
  ],
  // Row 3 — Mixed Zone
  [
    { name: "Residential NW",  lambda: 1.8, traffic: 0.3,  category: "residential", tripRevenue: 12 },
    { name: "Park District",   lambda: 2.0, traffic: 0.35, category: "leisure",     tripRevenue: 13 },
    { name: "Shopping Mall",   lambda: 3.5, traffic: 0.65, category: "retail",      tripRevenue: 15 },
    { name: "Stadium",         lambda: 4.0, traffic: 0.7,  category: "events",      tripRevenue: 16 },
    { name: "Residential NE",  lambda: 1.8, traffic: 0.3,  category: "residential", tripRevenue: 12 },
  ],
  // Row 4 — South Strip
  [
    { name: "South West",    lambda: 1.5, traffic: 0.25, category: "residential", tripRevenue: 11 },
    { name: "Industrial",    lambda: 1.2, traffic: 0.3,  category: "industrial",  tripRevenue: 13 },
    { name: "South Station", lambda: 3.8, traffic: 0.6,  category: "transit",     tripRevenue: 17 },
    { name: "Logistics Hub", lambda: 1.5, traffic: 0.35, category: "industrial",  tripRevenue: 14 },
    { name: "South East",    lambda: 1.5, traffic: 0.25, category: "residential", tripRevenue: 11 },
  ],
];

// ─── Demand Prediction (Exponential Moving Average) ───────────────────────────
class DemandPredictor {
  private history: Map<string, number[]> = new Map();
  private alpha = 0.35; // EMA smoothing factor

  record(zoneId: string, demand: number) {
    const hist = this.history.get(zoneId) ?? [];
    hist.push(demand);
    if (hist.length > 20) hist.shift();
    this.history.set(zoneId, hist);
  }

  predict(zoneId: string, baseLambda: number): number {
    const hist = this.history.get(zoneId);
    if (!hist || hist.length < 2) return baseLambda;
    // EMA over history
    let ema = hist[0];
    for (let i = 1; i < hist.length; i++) {
      ema = this.alpha * hist[i] + (1 - this.alpha) * ema;
    }
    // Add slight trend (last diff)
    const trend = hist.length >= 2 ? hist[hist.length - 1] - hist[hist.length - 2] : 0;
    return Math.max(0, ema + trend * 0.2);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 20));
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function zoneIdx(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

function manhattanDist(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function tripDuration(
  fromRow: number, fromCol: number,
  toRow: number, toCol: number,
  trafficLevel: number
): number {
  const dist = manhattanDist(fromRow, fromCol, toRow, toCol);
  return Math.max(1, Math.round(dist * (1 + trafficLevel)));
}

// ─── RL Dispatch Policy ───────────────────────────────────────────────────────
// Uses predicted demand with epsilon-greedy exploration
// Q-values stored per (zone, action) to accumulate simple reward signals
const ACTIONS = ["stay", "north", "south", "west", "east"] as const;
type Action = typeof ACTIONS[number];

class RLDispatcher {
  private qTable: Map<string, number> = new Map();
  private epsilon = 0.15;
  private learningRate = 0.05;
  private gamma = 0.9;

  private qKey(row: number, col: number, action: Action): string {
    return `${row},${col},${action}`;
  }

  private getQ(row: number, col: number, action: Action): number {
    return this.qTable.get(this.qKey(row, col, action)) ?? 0;
  }

  updateQ(row: number, col: number, action: Action, reward: number, nextRow: number, nextCol: number) {
    const currentQ = this.getQ(row, col, action);
    const bestNextQ = Math.max(...ACTIONS.map(a => this.getQ(nextRow, nextCol, a)));
    const newQ = currentQ + this.learningRate * (reward + this.gamma * bestNextQ - currentQ);
    this.qTable.set(this.qKey(row, col, action), newQ);
  }

  dispatch(taxi: Taxi, zones: Zone[]): { row: number; col: number; action: string } {
    const currentZone = zones[zoneIdx(taxi.row, taxi.col)];

    // If passengers waiting → pickup
    if (currentZone.waitingPassengers > 0) {
      return { row: taxi.row, col: taxi.col, action: "pickup" };
    }

    // Build candidate moves
    const candidates: { row: number; col: number; action: Action }[] = [
      { row: taxi.row, col: taxi.col, action: "stay" },
    ];
    if (taxi.row > 0) candidates.push({ row: taxi.row - 1, col: taxi.col, action: "north" });
    if (taxi.row < GRID_SIZE - 1) candidates.push({ row: taxi.row + 1, col: taxi.col, action: "south" });
    if (taxi.col > 0) candidates.push({ row: taxi.row, col: taxi.col - 1, action: "west" });
    if (taxi.col < GRID_SIZE - 1) candidates.push({ row: taxi.row, col: taxi.col + 1, action: "east" });

    // Epsilon-greedy
    if (Math.random() < this.epsilon) {
      const rnd = candidates[Math.floor(Math.random() * candidates.length)];
      return { row: rnd.row, col: rnd.col, action: rnd.action + "_explore" };
    }

    // Score by predicted demand (Q-value + domain score)
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates) {
      const z = zones[zoneIdx(c.row, c.col)];
      const domainScore = z.predictedDemand * (1 + 0.5 * z.trafficLevel) + z.waitingPassengers * 2;
      const qScore = this.getQ(taxi.row, taxi.col, c.action);
      const score = domainScore + qScore * 0.3;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    return { row: best.row, col: best.col, action: best.action };
  }
}

// ─── Simulation Factory ───────────────────────────────────────────────────────
const dispatcher = new RLDispatcher();
const predictor = new DemandPredictor();

function createZones(): Zone[] {
  const zones: Zone[] = [];
  let idx = 1;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const def = ZONE_DEFS[r][c];
      zones.push({
        id: `Z${idx++}`,
        row: r, col: c,
        demand: def.lambda,
        predictedDemand: def.lambda,
        waitingPassengers: poissonSample(def.lambda),
        taxiCount: 0,
        name: def.name,
        trafficLevel: def.traffic,
        category: def.category,
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
    tripsCompleted: 0,
    revenue: 0,
    lastAction: "initialized",
    destinationZone: null,
    tripTimeRemaining: null,
  }));
}

function updateTaxiCounts(zones: Zone[], taxis: Taxi[]) {
  zones.forEach(z => z.taxiCount = 0);
  taxis.forEach(t => zones[zoneIdx(t.row, t.col)].taxiCount++);
}

export function createSimulation(): SimulationState {
  const zones = createZones();
  const taxis = createTaxis();
  updateTaxiCounts(zones, taxis);
  return {
    taxis, zones,
    metrics: { totalTripsCompleted: 0, totalRevenue: 0, averageWaitTime: 0, utilizationRate: 0, totalReward: 0, timeStep: 0, episodeReward: 0 },
    history: [],
    gridSize: GRID_SIZE,
    running: false,
  };
}

export function stepSimulation(state: SimulationState, steps = 1): SimulationState {
  let s: SimulationState = {
    ...state,
    taxis: state.taxis.map(t => ({ ...t })),
    zones: state.zones.map(z => ({ ...z })),
    metrics: { ...state.metrics },
    history: [...state.history],
    running: true,
  };

  for (let step = 0; step < steps; step++) {
    s.metrics.timeStep++;
    const isNewEpisode = s.metrics.timeStep % EPISODE_LENGTH === 1;
    if (isNewEpisode) s.metrics.episodeReward = 0;

    // --- 1. Generate new passengers (Poisson) with traffic modifier ---
    for (const zone of s.zones) {
      const lambdaMod = zone.demand * (0.7 + 0.6 * Math.random()) * (1 + 0.3 * zone.trafficLevel);
      const newPassengers = poissonSample(lambdaMod);
      zone.waitingPassengers = Math.min(zone.waitingPassengers + newPassengers, 15);
      predictor.record(zone.id, zone.waitingPassengers);
    }

    // --- 2. Update demand predictions ---
    for (const zone of s.zones) {
      zone.predictedDemand = Math.round(predictor.predict(zone.id, zone.demand) * 10) / 10;
    }

    updateTaxiCounts(s.zones, s.taxis);

    let stepReward = 0;

    // --- 3. Step each taxi ---
    for (const taxi of s.taxis) {
      // Carrying passenger — count down trip
      if (taxi.status === "carrying_passenger") {
        if (taxi.tripTimeRemaining !== null && taxi.tripTimeRemaining > 1) {
          taxi.tripTimeRemaining--;
          taxi.lastAction = `delivering (${taxi.tripTimeRemaining}t left)`;
        } else {
          // Drop off
          const def = ZONE_DEFS[taxi.row]?.[taxi.col];
          const fare = (def?.tripRevenue ?? 15) + 5 + Math.random() * 10;
          taxi.tripsCompleted++;
          taxi.revenue += fare;
          s.metrics.totalTripsCompleted++;
          s.metrics.totalRevenue += fare;
          taxi.status = "idle";
          taxi.destinationZone = null;
          taxi.tripTimeRemaining = null;
          taxi.lastAction = "delivered_passenger";
          stepReward += 10;
          dispatcher.updateQ(taxi.row, taxi.col, "stay", 10, taxi.row, taxi.col);
        }
        continue;
      }

      // Idle — ask RL dispatcher
      const dispatch = dispatcher.dispatch(taxi, s.zones);

      if (dispatch.action === "pickup") {
        const z = s.zones[zoneIdx(taxi.row, taxi.col)];
        if (z.waitingPassengers > 0) {
          z.waitingPassengers--;
          // Random destination
          const destRow = Math.floor(Math.random() * GRID_SIZE);
          const destCol = Math.floor(Math.random() * GRID_SIZE);
          const destDef = ZONE_DEFS[destRow][destCol];
          const duration = tripDuration(taxi.row, taxi.col, destRow, destCol, z.trafficLevel);
          taxi.status = "carrying_passenger";
          taxi.destinationZone = destDef.name;
          taxi.tripTimeRemaining = duration;
          taxi.lastAction = "picked_up_passenger";
          const isHighDemand = z.demand >= 4;
          const reward = isHighDemand ? 15 : 10;
          stepReward += reward;
          dispatcher.updateQ(taxi.row, taxi.col, "stay", reward, taxi.row, taxi.col);
        } else {
          taxi.lastAction = "wait_no_passengers";
          stepReward -= 1;
          dispatcher.updateQ(taxi.row, taxi.col, "stay", -1, taxi.row, taxi.col);
        }
      } else {
        const oldRow = taxi.row, oldCol = taxi.col;
        taxi.row = dispatch.row;
        taxi.col = dispatch.col;
        taxi.status = "idle";
        taxi.lastAction = dispatch.action;

        const moved = oldRow !== taxi.row || oldCol !== taxi.col;
        const newZ = s.zones[zoneIdx(taxi.row, taxi.col)];
        const moveReward = moved ? (newZ.predictedDemand > 2 ? 1 : -2) : -1;
        stepReward += moveReward;

        const actionName = ACTIONS.find(a => dispatch.action.startsWith(a)) ?? "stay";
        dispatcher.updateQ(oldRow, oldCol, actionName, moveReward, taxi.row, taxi.col);
      }
    }

    // Check for long-waiting passengers (penalize)
    const totalWaiting = s.zones.reduce((sum, z) => sum + z.waitingPassengers, 0);
    if (totalWaiting > 10) {
      stepReward -= Math.floor(totalWaiting / 10) * 10;
    }

    updateTaxiCounts(s.zones, s.taxis);

    const activeTaxis = s.taxis.filter(t => t.status === "carrying_passenger").length;
    const utilizationRate = Math.round((activeTaxis / s.taxis.length) * 1000) / 10;
    const avgWaitTime = Math.round((totalWaiting / s.zones.length) * 10) / 10;

    s.metrics.utilizationRate = utilizationRate;
    s.metrics.averageWaitTime = avgWaitTime;
    s.metrics.totalReward += stepReward;
    s.metrics.episodeReward += stepReward;

    if (s.history.length >= 200) s.history = s.history.slice(s.history.length - 200);
    s.history.push({
      timeStep: s.metrics.timeStep,
      tripsCompleted: s.metrics.totalTripsCompleted,
      revenue: Math.round(s.metrics.totalRevenue * 100) / 100,
      utilizationRate,
      waitTime: avgWaitTime,
      reward: Math.round(stepReward * 10) / 10,
      episodeReward: Math.round(s.metrics.episodeReward * 10) / 10,
    });
  }

  return s;
}

export function resetSimulation(): SimulationState {
  return createSimulation();
}
