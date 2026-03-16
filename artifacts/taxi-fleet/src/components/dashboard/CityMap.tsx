import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Users, TrendingUp, TrendingDown, Building2, Plane, Home, Zap, Music, GraduationCap, Factory, LayoutGrid, Palmtree, ShoppingBag } from "lucide-react";
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
    if (demand >= 5.5) return "bg-red-950/40 border-red-500/50 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]";
    if (demand >= 4) return "bg-orange-950/40 border-orange-500/50 text-orange-400 shadow-[inset_0_0_15px_rgba(249,115,22,0.15)]";
    if (demand >= 2) return "bg-amber-950/40 border-amber-500/50 text-amber-400 shadow-[inset_0_0_15px_rgba(245,158,11,0.15)]";
    return "bg-cyan-950/20 border-cyan-500/20 text-cyan-400 hover:bg-cyan-900/30";
  };
  
  const getTrafficColor = (traffic: number) => {
    if (traffic >= 0.9) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
    if (traffic >= 0.5) return "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]";
    return "bg-green-500";
  };

  const getTaxiColor = (status: Taxi['status']) => {
    switch (status) {
      case 'carrying_passenger': return "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.8)]";
      case 'moving_to_pickup': return "bg-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.6)]";
      default: return "bg-slate-400 text-slate-900 shadow-sm";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'business': return <Building2 className="w-3 h-3" />;
      case 'hub': return <Building2 className="w-3 h-3" />;
      case 'transit': return <Plane className="w-3 h-3" />;
      case 'residential': return <Home className="w-3 h-3" />;
      case 'retail': return <ShoppingBag className="w-3 h-3" />;
      case 'events': return <Music className="w-3 h-3" />;
      case 'education': return <GraduationCap className="w-3 h-3" />;
      case 'industrial': return <Factory className="w-3 h-3" />;
      case 'leisure': return <Palmtree className="w-3 h-3" />;
      case 'tech': return <Zap className="w-3 h-3" />;
      case 'mixed':
      default: return <LayoutGrid className="w-3 h-3" />;
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm flex flex-col h-full relative overflow-hidden">
      {/* Decorative subtle grid background */}
      <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
          Live City Map
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full border border-border">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500/50 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></span>
            Low
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500/70 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
            Med
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500/80 shadow-[0_0_5px_rgba(249,115,22,0.5)]"></span>
            High
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
            Max
          </div>
        </div>
      </div>

      <div className="flex-1 bg-background/50 p-2 rounded-xl border border-border">
        <div 
          className="h-full grid gap-1.5 relative"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
          }}
        >
          {sortedZones.map((zone, index) => {
            // Find taxis currently in this zone
            const zoneTaxis = taxis.filter(t => t.row === zone.row && t.col === zone.col).slice(0, 5); // Limit to 5 markers to save space
            const demandStyle = getDemandColor(zone.demand);
            const zoneIdCode = `Z${index + 1}`;
            
            const isTrendingUp = (zone.predictedDemand ?? 0) > zone.demand;
            const isTrendingDown = (zone.predictedDemand ?? 0) < zone.demand;

            return (
              <div 
                key={zone.id}
                className={cn(
                  "relative rounded-lg border p-1.5 flex flex-col transition-all duration-500 overflow-hidden",
                  demandStyle
                )}
              >
                {/* Traffic Level Bar at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/80">
                  <div 
                    className={cn("h-full transition-all duration-1000", getTrafficColor(zone.trafficLevel ?? 0))}
                    style={{ width: `${Math.min(100, Math.max(5, (zone.trafficLevel ?? 0) * 100))}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-start mb-1 relative z-10">
                  <div className="flex flex-col overflow-hidden max-w-[70%]">
                    <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-0.5 whitespace-nowrap">
                      {getCategoryIcon(zone.category)}
                      <span className="truncate">{zoneIdCode}</span>
                    </div>
                    <span className="font-bold text-[10px] leading-tight truncate opacity-90">{zone.name}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <div className="flex items-center gap-0.5 text-[9px]">
                      {isTrendingUp && <TrendingUp className="w-2.5 h-2.5 text-red-400" />}
                      {isTrendingDown && <TrendingDown className="w-2.5 h-2.5 text-emerald-400" />}
                    </div>
                    {zone.waitingPassengers > 0 && (
                      <div className="flex items-center gap-0.5 text-[9px] font-mono bg-background/80 text-foreground px-1 py-px rounded border border-border">
                        <Users className="w-2.5 h-2.5 text-accent" />
                        <span>{zone.waitingPassengers}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Taxi Markers Container */}
                <div className="flex-1 mt-0.5 flex flex-wrap content-end gap-1 relative z-10 pb-1">
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
                          "w-3 h-3 rounded-full flex items-center justify-center relative group",
                          getTaxiColor(taxi.status)
                        )}
                        title={`Taxi ${taxi.id} - ${taxi.status.replace(/_/g, ' ')}`}
                      >
                        {taxi.status === 'carrying_passenger' && (
                          <span className="absolute -inset-0.5 rounded-full border border-emerald-400 animate-ping opacity-75"></span>
                        )}
                        {/* No icon inside, it's tiny */}
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-popover border border-border text-popover-foreground text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl font-mono">
                          T{taxi.id}
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
    </div>
  );
}
