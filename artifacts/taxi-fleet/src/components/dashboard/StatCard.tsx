import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  colorClass?: string;
  className?: string;
}

export function StatCard({ title, value, icon, trend, colorClass = "border-primary", className }: StatCardProps) {
  // Extract just the color name to use for backgrounds
  const colorName = colorClass.replace("border-", "");
  
  return (
    <div className={cn(
      "relative bg-card rounded-xl p-5 shadow-sm shadow-black/20 overflow-hidden group",
      "border border-card-border border-t-2", colorClass,
      "bg-gradient-to-br from-card to-card hover:to-secondary/50 transition-colors duration-300",
      className
    )}>
      {/* Subtle background glow */}
      <div className={cn("absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-10", `bg-${colorName}`)} />
      
      <div className="flex items-center justify-between relative z-10">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn("p-2 rounded-lg bg-gradient-to-br from-secondary to-background shadow-inner", `text-${colorName}`)}>
          {icon}
        </div>
      </div>
      
      <div className="mt-4 flex items-baseline gap-2 relative z-10">
        <h3 className="text-3xl font-bold tracking-tight text-foreground font-mono">
          {value}
        </h3>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trend.isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {trend.isPositive ? "+" : "-"}{trend.value}
          </span>
        )}
      </div>
      
      {/* Bottom sparkline/trend decorative bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50 overflow-hidden">
        <div 
          className={cn("h-full opacity-60", `bg-${colorName}`)} 
          style={{ width: `${Math.max(30, Math.random() * 100)}%` }}
        />
      </div>
    </div>
  );
}
