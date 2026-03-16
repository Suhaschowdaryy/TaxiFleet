export type TaxiStatus = "idle" | "carrying_passenger" | "moving_to_pickup";

export interface Zone {
  id: string;
  row: number;
  col: number;
  demand: number;
  waitingPassengers: number;
  taxiCount: number;
  name: string;
}

export interface Taxi {
  id: string;
  row: number;
  col: number;
  status: TaxiStatus;
  tripsCompleted: number;
  revenue: number;
  lastAction: string;
  passengerWaitSteps?: number;
  destinationRow?: number;
  destinationCol?: number;
  stepsToDeliver?: number;
}

export interface SimulationMetrics {
  totalTripsCompleted: number;
  totalRevenue: number;
  averageWaitTime: number;
  utilizationRate: number;
  totalReward: number;
  timeStep: number;
}

export interface HistoryPoint {
  timeStep: number;
  tripsCompleted: number;
  revenue: number;
  utilizationRate: number;
  waitTime: number;
  reward: number;
}

export interface SimulationState {
  taxis: Taxi[];
  zones: Zone[];
  metrics: SimulationMetrics;
  history: HistoryPoint[];
  gridSize: number;
  running: boolean;
}

const GRID_SIZE = 3;
const NUM_TAXIS = 6;
const TRIP_REVENUE = 15;
const BASE_DEMAND_LAMBDA = [0.5, 1.2, 0.8, 1.5, 2.0, 1.0, 0.7, 1.8, 1.3];
const ZONE_NAMES = ["Downtown North", "Midtown", "Airport", "West Side", "City Center", "East District", "South End", "Financial District", "Uptown"];

function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function createInitialZones(): Zone[] {
  const zones: Zone[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const idx = r * GRID_SIZE + c;
      zones.push({
        id: `Z${idx + 1}`,
        row: r,
        col: c,
        demand: BASE_DEMAND_LAMBDA[idx],
        waitingPassengers: poissonSample(BASE_DEMAND_LAMBDA[idx]),
        taxiCount: 0,
        name: ZONE_NAMES[idx],
      });
    }
  }
  return zones;
}

function createInitialTaxis(): Taxi[] {
  const taxis: Taxi[] = [];
  for (let i = 0; i < NUM_TAXIS; i++) {
    taxis.push({
      id: `T${String(i + 1).padStart(2, "0")}`,
      row: Math.floor(Math.random() * GRID_SIZE),
      col: Math.floor(Math.random() * GRID_SIZE),
      status: "idle",
      tripsCompleted: 0,
      revenue: 0,
      lastAction: "initialized",
    });
  }
  return taxis;
}

function getZoneIndex(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

function rlDispatchAction(taxi: Taxi, zones: Zone[]): { row: number; col: number; action: string } {
  const currentZoneIdx = getZoneIndex(taxi.row, taxi.col);
  const currentDemand = zones[currentZoneIdx].waitingPassengers;

  if (currentDemand > 0) {
    return { row: taxi.row, col: taxi.col, action: "pickup" };
  }

  let bestDemand = -1;
  let bestRow = taxi.row;
  let bestCol = taxi.col;
  let bestAction = "wait";

  const neighbors = [
    { row: taxi.row - 1, col: taxi.col, action: "move_north" },
    { row: taxi.row + 1, col: taxi.col, action: "move_south" },
    { row: taxi.row, col: taxi.col - 1, action: "move_west" },
    { row: taxi.row, col: taxi.col + 1, action: "move_east" },
  ].filter(n => n.row >= 0 && n.row < GRID_SIZE && n.col >= 0 && n.col < GRID_SIZE);

  for (const neighbor of neighbors) {
    const zoneIdx = getZoneIndex(neighbor.row, neighbor.col);
    const neighborDemand = zones[zoneIdx].waitingPassengers + zones[zoneIdx].demand * 0.5;
    if (neighborDemand > bestDemand) {
      bestDemand = neighborDemand;
      bestRow = neighbor.row;
      bestCol = neighbor.col;
      bestAction = neighbor.action;
    }
  }

  const noise = Math.random();
  if (noise < 0.15 && neighbors.length > 0) {
    const random = neighbors[Math.floor(Math.random() * neighbors.length)];
    return { row: random.row, col: random.col, action: random.action + "_explore" };
  }

  return { row: bestRow, col: bestCol, action: bestAction };
}

export function createSimulation(): SimulationState {
  const zones = createInitialZones();
  const taxis = createInitialTaxis();

  zones.forEach(z => z.taxiCount = 0);
  taxis.forEach(t => {
    const idx = getZoneIndex(t.row, t.col);
    zones[idx].taxiCount++;
  });

  return {
    taxis,
    zones,
    metrics: {
      totalTripsCompleted: 0,
      totalRevenue: 0,
      averageWaitTime: 0,
      utilizationRate: 0,
      totalReward: 0,
      timeStep: 0,
    },
    history: [],
    gridSize: GRID_SIZE,
    running: false,
  };
}

export function stepSimulation(state: SimulationState, steps: number = 1): SimulationState {
  let s = { ...state, taxis: state.taxis.map(t => ({ ...t })), zones: state.zones.map(z => ({ ...z })) };
  s.running = true;

  for (let step = 0; step < steps; step++) {
    s.metrics = { ...s.metrics, timeStep: s.metrics.timeStep + 1 };

    for (const zone of s.zones) {
      const idx = getZoneIndex(zone.row, zone.col);
      const newPassengers = poissonSample(BASE_DEMAND_LAMBDA[idx] * (0.8 + 0.4 * Math.random()));
      zone.waitingPassengers = Math.min(zone.waitingPassengers + newPassengers, 10);
    }

    s.zones.forEach(z => z.taxiCount = 0);
    s.taxis.forEach(t => {
      const idx = getZoneIndex(t.row, t.col);
      s.zones[idx].taxiCount++;
    });

    let stepReward = 0;

    for (const taxi of s.taxis) {
      if (taxi.status === "carrying_passenger") {
        if (taxi.stepsToDeliver !== undefined && taxi.stepsToDeliver > 0) {
          taxi.stepsToDeliver--;
        }
        if (!taxi.stepsToDeliver || taxi.stepsToDeliver <= 0) {
          taxi.tripsCompleted++;
          taxi.revenue += TRIP_REVENUE + Math.random() * 10;
          s.metrics.totalTripsCompleted++;
          s.metrics.totalRevenue += TRIP_REVENUE + Math.random() * 10;
          taxi.status = "idle";
          taxi.lastAction = "delivered_passenger";
          stepReward += 10;
        } else {
          taxi.lastAction = "delivering";
        }
        continue;
      }

      const dispatch = rlDispatchAction(taxi, s.zones);

      if (dispatch.action === "pickup") {
        const zoneIdx = getZoneIndex(taxi.row, taxi.col);
        if (s.zones[zoneIdx].waitingPassengers > 0) {
          s.zones[zoneIdx].waitingPassengers--;
          taxi.status = "carrying_passenger";
          taxi.stepsToDeliver = 1 + Math.floor(Math.random() * 3);
          taxi.lastAction = "picked_up_passenger";
          const isHighDemand = s.zones[zoneIdx].demand > 1.5;
          stepReward += isHighDemand ? 15 : 10;
        } else {
          taxi.lastAction = "wait_no_passengers";
          stepReward -= 1;
        }
      } else {
        const oldRow = taxi.row;
        const oldCol = taxi.col;
        taxi.row = dispatch.row;
        taxi.col = dispatch.col;
        taxi.status = "idle";
        taxi.lastAction = dispatch.action;

        const newZoneIdx = getZoneIndex(taxi.row, taxi.col);
        const movedToHighDemand = s.zones[newZoneIdx].waitingPassengers > 2;
        if (!movedToHighDemand && oldRow === taxi.row && oldCol === taxi.col) {
          stepReward -= 1;
        }
      }

      if (taxi.passengerWaitSteps !== undefined) {
        taxi.passengerWaitSteps++;
        if (taxi.passengerWaitSteps > 5) {
          stepReward -= 10;
        }
      }
    }

    s.zones.forEach(z => z.taxiCount = 0);
    s.taxis.forEach(t => {
      const idx = getZoneIndex(t.row, t.col);
      s.zones[idx].taxiCount++;
    });

    const activeTaxis = s.taxis.filter(t => t.status === "carrying_passenger").length;
    const utilizationRate = (activeTaxis / s.taxis.length) * 100;

    const totalWaiting = s.zones.reduce((sum, z) => sum + z.waitingPassengers, 0);
    const avgWaitTime = totalWaiting / s.zones.length;

    s.metrics = {
      ...s.metrics,
      utilizationRate: Math.round(utilizationRate * 10) / 10,
      averageWaitTime: Math.round(avgWaitTime * 10) / 10,
      totalReward: s.metrics.totalReward + stepReward,
    };

    if (s.history.length > 100) {
      s.history = s.history.slice(s.history.length - 100);
    }

    s.history = [
      ...s.history,
      {
        timeStep: s.metrics.timeStep,
        tripsCompleted: s.metrics.totalTripsCompleted,
        revenue: Math.round(s.metrics.totalRevenue * 100) / 100,
        utilizationRate: s.metrics.utilizationRate,
        waitTime: s.metrics.averageWaitTime,
        reward: Math.round(stepReward * 10) / 10,
      },
    ];
  }

  return s;
}

export function resetSimulation(): SimulationState {
  return createSimulation();
}
