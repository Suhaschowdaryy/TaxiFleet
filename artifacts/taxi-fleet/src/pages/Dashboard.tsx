import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  Clock, 
  Route, 
  DollarSign,
  BrainCircuit
} from "lucide-react";
import { useSimulationController } from "@/hooks/use-simulation-controller";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { CityMap } from "@/components/dashboard/CityMap";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { TaxiTable } from "@/components/dashboard/TaxiTable";
import { RLRewardChart } from "@/components/dashboard/RLRewardChart";

export default function Dashboard() {
  const { 
    state, 
    isLoading, 
    isError, 
    isRunning, 
    isResetting,
    toggleRunning, 
    handleReset 
  } = useSimulationController();

  if (isLoading && !state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-primary">
        <Activity className="w-12 h-12 animate-pulse mb-4" />
        <h2 className="text-xl font-semibold tracking-tight">Initializing Simulation...</h2>
      </div>
    );
  }

  if (isError || !state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-destructive">
        <h2 className="text-xl font-semibold tracking-tight">Error connecting to simulation server</h2>
        <p className="text-sm text-muted-foreground mt-2">Please ensure the backend API is running.</p>
      </div>
    );
  }

  const { metrics, taxis, zones, gridSize, history } = state;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 pb-20">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-3 mb-1 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 blur-xl rounded-full opacity-50 animate-pulse-slow"></div>
              <h1 className="relative text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-primary via-cyan-300 to-accent bg-clip-text text-transparent drop-shadow-sm">
                AutoFleet
              </h1>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isRunning ? 'bg-primary/10 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-muted text-muted-foreground border border-border'}`}>
                {isRunning && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}
                {!isRunning && <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />}
                {isRunning ? 'Live' : 'Paused'}
              </div>
            </div>
            <p className="text-muted-foreground text-sm font-medium ml-1">Autonomous Taxi Fleet Management System</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-secondary/80 rounded-lg border border-border/50 mr-2 font-mono text-sm shadow-inner text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              T-Step: <span className="text-primary font-bold text-base tracking-widest">{metrics.timeStep.toString().padStart(4, '0')}</span>
            </div>
            
            <button
              onClick={toggleRunning}
              disabled={isResetting}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 ${
                isRunning 
                  ? 'bg-secondary text-foreground hover:bg-secondary/80 border border-border shadow-md'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]'
              }`}
            >
              {isRunning ? (
                <><Square className="w-4 h-4 fill-current" /> Pause</>
              ) : (
                <><Play className="w-4 h-4 fill-current" /> Start</>
              )}
            </button>
            
            <button
              onClick={handleReset}
              disabled={isResetting || isRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              Reset
            </button>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: City Map */}
          <div className="lg:col-span-6 xl:col-span-5 h-[800px] lg:h-[700px]">
            <CityMap zones={zones} taxis={taxis} gridSize={gridSize} />
          </div>

          {/* Right Panel: Metrics & Charts */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-6">
            
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard 
                title="Utilization Rate" 
                value={formatPercent(metrics.utilizationRate)}
                icon={<Activity className="w-5 h-5" />}
                colorClass="border-primary"
              />
              <StatCard 
                title="Avg Wait Time" 
                value={`${metrics.averageWaitTime.toFixed(1)}t`}
                icon={<Clock className="w-5 h-5" />}
                colorClass="border-accent"
              />
              <StatCard 
                title="Total Trips" 
                value={metrics.totalTripsCompleted}
                icon={<Route className="w-5 h-5" />}
                colorClass="border-emerald-500"
              />
              <StatCard 
                title="Total Revenue" 
                value={formatCurrency(metrics.totalRevenue)}
                icon={<DollarSign className="w-5 h-5" />}
                colorClass="border-amber-500"
              />
              <StatCard 
                title="Episode Reward" 
                value={metrics.episodeReward > 0 ? `+${Math.round(metrics.episodeReward)}` : `${Math.round(metrics.episodeReward)}`}
                icon={<BrainCircuit className="w-5 h-5" />}
                colorClass={metrics.episodeReward >= 0 ? "border-emerald-400" : "border-red-400"}
              />
            </div>

            {/* Performance Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex flex-col min-h-[300px]">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg tracking-tight">Fleet Performance History</h3>
                  <p className="text-xs text-muted-foreground">Utilization vs. Completed Trips over time</p>
                </div>
                <div className="flex-1 -ml-4">
                  <MetricsChart data={history} />
                </div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex flex-col min-h-[300px]">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg tracking-tight">RL Agent Performance</h3>
                  <p className="text-xs text-muted-foreground">Step reward & episode cumulative reward</p>
                </div>
                <div className="flex-1 -ml-4">
                  <RLRewardChart data={history} currentEpisode={Math.floor(metrics.timeStep / 50) + 1} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Table */}
        <div className="mt-6">
          <TaxiTable taxis={taxis} />
        </div>

      </div>
    </div>
  );
}
