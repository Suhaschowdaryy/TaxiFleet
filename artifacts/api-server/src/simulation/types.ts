// ─── Shared types used by both the simulation and the RL agent ────────────────

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
