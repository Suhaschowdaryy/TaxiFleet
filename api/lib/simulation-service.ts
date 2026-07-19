import { createSimulation, stepSimulation, resetSimulation, type SimulationState } from "../../artifacts/api-server/src/simulation/citySimulator";

let state: SimulationState | null = null;

function ensureState() {
  if (!state) {
    state = createSimulation();
  }
  return state;
}

export function getSimulationState() {
  return ensureState();
}

export function runSimulation(steps = 1) {
  const current = ensureState();
  state = stepSimulation(current, Math.min(Math.max(1, Number(steps) || 1), 10));
  return state;
}

export function resetSimulationState() {
  state = resetSimulation();
  return state;
}
