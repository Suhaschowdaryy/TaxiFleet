import { Taxi } from "@workspace/api-client-react";
import { cn, formatCurrency } from "@/lib/utils";

interface TaxiTableProps {
  taxis: Taxi[];
  debugMode?: boolean;
}

export function TaxiTable({ taxis, debugMode = false }: TaxiTableProps) {
  const getStatusBadge = (status: Taxi["status"]) => {
    switch (status) {
      case "carrying_passenger":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Carrying
          </span>
        );
      case "moving_to_pickup":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            En Route
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Idle
          </span>
        );
    }
  };

  const getStatusColor = (status: Taxi["status"]) => {
    switch (status) {
      case "carrying_passenger": return "bg-emerald-500";
      case "moving_to_pickup":   return "bg-amber-500";
      default:                   return "bg-slate-500";
    }
  };

  const maxRevenue = Math.max(...taxis.map(t => t.revenue), 1);

  const baseGrid = "grid-cols-[1fr_1.2fr_2fr_2fr_0.8fr_0.8fr_2fr]";
  const debugGrid = "grid-cols-[1fr_1.2fr_1.6fr_1.8fr_0.8fr_0.8fr_1.8fr_1fr_1.2fr_1.4fr]";

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border flex items-center justify-between bg-card/50">
        <h3 className="font-semibold text-lg tracking-tight flex items-center gap-2">
          <span className="w-2 h-6 bg-accent rounded-full inline-block" />
          Active Fleet
        </h3>
        <div className="flex items-center gap-3">
          {debugMode && (
            <span className="text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
              Debug Columns Visible
            </span>
          )}
          <span className="text-sm text-muted-foreground font-mono bg-secondary/50 px-3 py-1 rounded-full border border-border shadow-inner">
            <span className="text-foreground font-bold">{taxis.length}</span> Vehicles
          </span>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div className={cn("flex flex-col gap-2", debugMode ? "min-w-[1300px]" : "min-w-[1000px]")}>
          {/* Header */}
          <div className={cn(
            "grid gap-4 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
            debugMode ? debugGrid : baseGrid
          )}>
            <div>Taxi ID</div>
            <div>Location</div>
            <div>Status</div>
            <div>Destination</div>
            <div className="text-right">ETA</div>
            <div className="text-right">Trips</div>
            <div>Revenue</div>
            {debugMode && <>
              <div>Action</div>
              <div className="text-right">Q-Value</div>
              <div className="text-right">Scores</div>
            </>}
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-2">
            {taxis.map(taxi => (
              <div
                key={taxi.id}
                className={cn(
                  "grid gap-4 items-center bg-background/50 hover:bg-secondary/40 border border-border hover:border-border/80 rounded-lg p-3 transition-all duration-300 relative overflow-hidden hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] hover:-translate-y-0.5",
                  debugMode ? debugGrid : baseGrid
                )}
              >
                <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-70", getStatusColor(taxi.status))} />

                <div className="font-mono text-foreground font-medium pl-2 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">#</span>
                  {taxi.id}
                </div>

                <div className="flex flex-col">
                  <span className="text-foreground font-medium">R{taxi.row}C{taxi.col}</span>
                  <span className="text-xs text-muted-foreground font-mono">[{taxi.row},{taxi.col}]</span>
                </div>

                <div>{getStatusBadge(taxi.status)}</div>

                <div className="text-sm font-medium text-muted-foreground truncate">
                  {taxi.status === "carrying_passenger" && taxi.destinationZone ? taxi.destinationZone : "—"}
                </div>

                <div className="text-right font-mono text-muted-foreground">
                  {taxi.tripTimeRemaining != null ? `${taxi.tripTimeRemaining}t` : "—"}
                </div>

                <div className="text-right font-mono text-foreground">{taxi.tripsCompleted}</div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-primary font-semibold w-16 text-right">
                    {formatCurrency(taxi.revenue)}
                  </span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full transition-all duration-1000"
                      style={{ width: `${(taxi.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                </div>

                {debugMode && taxi.debugInfo && (
                  <>
                    <div className="font-mono text-xs text-amber-400 font-semibold truncate">
                      {taxi.debugInfo.chosenAction}
                    </div>
                    <div className="text-right font-mono text-xs text-violet-400">
                      {taxi.debugInfo.qValue.toFixed(2)}
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] text-cyan-400">
                        D:{taxi.debugInfo.demandScore.toFixed(1)}
                      </span>
                      <span className="font-mono text-[10px] text-pink-400">
                        R:{taxi.debugInfo.rebalancingScore.toFixed(1)}
                      </span>
                    </div>
                  </>
                )}
                {debugMode && !taxi.debugInfo && (
                  <><div className="text-muted-foreground text-xs">—</div><div /><div /></>
                )}
              </div>
            ))}

            {taxis.length === 0 && (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-background/30">
                No taxis available in the fleet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
