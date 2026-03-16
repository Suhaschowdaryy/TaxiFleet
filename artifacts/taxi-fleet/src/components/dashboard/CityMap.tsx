import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Users } from "lucide-react";
import { Zone, Taxi } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface CityMapProps {
  zones: Zone[];
  taxis: Taxi[];
  gridSize: number;
}

export function CityMap({ zones, taxis, gridSize }: CityMapProps) {
  // Ensure zones are sorted by row, then col to render perfectly in grid
  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => {
      if (a.row === b.row) return a.col - b.col;
      return a.row - b.row;
    });
  }, [zones]);

  const getDemandColor = (demand: number) => {
    if (demand >= 3) return "bg-red-500/15 border-red-500/40 text-red-400";
    if (demand >= 1) return "bg-amber-500/15 border-amber-500/40 text-amber-400";
    return "bg-cyan-500/10 border-cyan-500/30 text-cyan-400";
  };

  const getTaxiColor = (status: Taxi['status']) => {
    switch (status) {
      case 'carrying_passenger': return "bg-emerald-500 text-white shadow-emerald-500/50";
      case 'moving_to_pickup': return "bg-amber-500 text-white shadow-amber-500/50";
      default: return "bg-slate-400 text-slate-900 shadow-slate-400/50";
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Live City Map</h2>
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/50"></span>
            Low Demand
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></span>
            Medium
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50"></span>
            High Demand
          </div>
        </div>
      </div>

      <div 
        className="flex-1 grid gap-3"
        style={{ 
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
        }}
      >
        {sortedZones.map((zone) => {
          // Find taxis currently in this zone
          const zoneTaxis = taxis.filter(t => t.row === zone.row && t.col === zone.col);
          const demandStyle = getDemandColor(zone.demand);

          return (
            <div 
              key={zone.id}
              className={cn(
                "relative rounded-xl border-2 p-3 flex flex-col transition-colors duration-500",
                demandStyle
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg opacity-80">{zone.name}</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-mono bg-background/50 px-2 py-0.5 rounded-md">
                    <Users className="w-3 h-3" />
                    <span>{zone.waitingPassengers} waiting</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                    Demand: {zone.demand.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Taxi Markers Container */}
              <div className="flex-1 mt-2 flex flex-wrap content-start gap-1.5">
                <AnimatePresence>
                  {zoneTaxis.map((taxi) => (
                    <motion.div
                      key={taxi.id}
                      layoutId={`taxi-${taxi.id}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 25,
                        mass: 2
                      }}
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shadow-lg relative group",
                        getTaxiColor(taxi.status)
                      )}
                      title={`Taxi ${taxi.id} - ${taxi.status.replace(/_/g, ' ')}`}
                    >
                      <Car className="w-4 h-4" />
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border text-popover-foreground text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {taxi.id}: {taxi.status.replace(/_/g, ' ')}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
