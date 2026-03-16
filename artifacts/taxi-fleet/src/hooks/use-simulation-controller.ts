import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSimulationState, 
  useRunSimulation, 
  useResetSimulation,
  getGetSimulationStateQueryKey
} from "@workspace/api-client-react";

export function useSimulationController() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  // Fetch initial state and poll if we are NOT running the loop locally
  // We'll actually drive the loop locally so we have strict control, 
  // but we still want the query to fetch the initial state.
  const { 
    data: state, 
    isLoading, 
    isError 
  } = useGetSimulationState({
    query: {
      staleTime: 1000,
    }
  });

  const { mutateAsync: runStep } = useRunSimulation();
  const { mutateAsync: resetSim, isPending: isResetting } = useResetSimulation();

  const toggleRunning = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const handleReset = useCallback(async () => {
    setIsRunning(false);
    try {
      const newState = await resetSim();
      queryClient.setQueryData(getGetSimulationStateQueryKey(), newState);
    } catch (e) {
      console.error("Failed to reset simulation", e);
    }
  }, [resetSim, queryClient]);

  // Simulation loop
  useEffect(() => {
    if (!isRunning) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const tick = async () => {
      try {
        const newState = await runStep({ data: { steps: 1 } });
        if (isMounted) {
          queryClient.setQueryData(getGetSimulationStateQueryKey(), newState);
        }
      } catch (error) {
        console.error("Simulation step failed:", error);
        setIsRunning(false); // Stop on error
      }
      
      if (isMounted && isRunning) {
        timeoutId = setTimeout(tick, 2000); // 2 second interval
      }
    };

    timeoutId = setTimeout(tick, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isRunning, runStep, queryClient]);

  return {
    state,
    isLoading,
    isError,
    isRunning,
    isResetting,
    toggleRunning,
    handleReset
  };
}
