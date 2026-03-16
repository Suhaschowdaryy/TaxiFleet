import { Router, type IRouter } from "express";
import {
  RunSimulationResponse,
  ResetSimulationResponse,
  GetSimulationStateResponse,
} from "@workspace/api-zod";
import {
  createSimulation,
  stepSimulation,
  resetSimulation,
  type SimulationState,
} from "../simulation/citySimulator.js";

const router: IRouter = Router();

let simulationState: SimulationState = createSimulation();

router.get("/simulate/state", (_req, res) => {
  const data = GetSimulationStateResponse.parse(simulationState);
  res.json(data);
});

router.post("/simulate", (req, res) => {
  const steps = req.body?.steps ?? 1;
  simulationState = stepSimulation(simulationState, Math.min(Number(steps) || 1, 10));
  const data = RunSimulationResponse.parse(simulationState);
  res.json(data);
});

router.post("/simulate/reset", (_req, res) => {
  simulationState = resetSimulation();
  const data = ResetSimulationResponse.parse(simulationState);
  res.json(data);
});

export default router;
