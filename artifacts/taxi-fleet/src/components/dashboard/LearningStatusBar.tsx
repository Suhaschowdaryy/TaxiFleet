import { RLAnalytics } from "@workspace/api-client-react";
import { BrainCircuit, Database, Zap, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningStatusBarProps {
  analytics: RLAnalytics;
  debugMode: boolean;
  onDebugToggle: () => void;
}

interface StatusItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  accent?: boolean;
}

function StatusItem({ label, value, icon, color = "text-muted-foreground", accent }: StatusItemProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
      accent 
        ? "bg-primary/10 border-primary/30 text-primary" 
        : "bg-secondary/50 border-border/60 text-foreground"
    )}>
      <span className={cn("flex-shrink-0", color)}>{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">{label}</span>
        <span className="text-sm font-bold font-mono leading-tight mt-0.5">{value}</span>
      </div>
    </div>
  );
}

export function LearningStatusBar({ analytics, debugMode, onDebugToggle }: LearningStatusBarProps) {
  const epsilonPct = `${(analytics.epsilon * 100).toFixed(1)}%`;
  const accuracyPct = `${(analytics.predictionAccuracy * 100).toFixed(0)}%`;
  const bufferFill = Math.min(100, (analytics.replayBufferSize / 10000) * 100);

  return (
    <div className="w-full bg-card/60 border border-border/50 rounded-xl px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Label */}
        <div className="flex items-center gap-1.5 mr-1">
          <BrainCircuit className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Learning Status</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <StatusItem
            label="Episode"
            value={`#${analytics.episodeNumber}`}
            icon={<Zap className="w-3.5 h-3.5" />}
            color="text-primary"
            accent
          />

          <StatusItem
            label="Explore ε"
            value={epsilonPct}
            icon={<Target className="w-3.5 h-3.5" />}
            color={analytics.epsilon > 0.15 ? "text-amber-400" : "text-emerald-400"}
          />

          <StatusItem
            label="Replay Buffer"
            value={analytics.replayBufferSize.toLocaleString()}
            icon={<Database className="w-3.5 h-3.5" />}
            color="text-cyan-400"
          />

          <StatusItem
            label="Q-Updates"
            value={analytics.totalQUpdates.toLocaleString()}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            color="text-violet-400"
          />

          <StatusItem
            label="Avg Q-Value"
            value={analytics.avgQValue.toFixed(2)}
            icon={<BrainCircuit className="w-3.5 h-3.5" />}
            color="text-emerald-400"
          />

          <StatusItem
            label="Pred Accuracy"
            value={accuracyPct}
            icon={<Target className="w-3.5 h-3.5" />}
            color="text-pink-400"
          />

          {/* Buffer fill bar */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-secondary/50 border-border/60 min-w-[120px]">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">Buffer Fill</span>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${bufferFill}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{bufferFill.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Debug Toggle */}
        <button
          onClick={onDebugToggle}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-all flex-shrink-0",
            debugMode
              ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              : "bg-secondary/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Zap className="w-3.5 h-3.5" />
          {debugMode ? "Debug ON" : "Debug OFF"}
        </button>
      </div>
    </div>
  );
}
