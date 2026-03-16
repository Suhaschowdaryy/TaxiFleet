import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { HistoryPoint } from "@workspace/api-client-react";

interface MetricsChartProps {
  data: HistoryPoint[];
}

export function MetricsChart({ data }: MetricsChartProps) {
  // Take last 50 points for visualization
  const displayData = data.slice(-50).map(d => ({
    ...d,
    utilizationRateRaw: d.utilizationRate,
  }));

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-lg bg-background/50">
        No simulation data yet. Start the fleet to gather metrics.
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
          <XAxis 
            dataKey="timeStep" 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={20}
          />
          <YAxis 
            yAxisId="left" 
            stroke="hsl(var(--primary))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            tickMargin={10}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="hsl(var(--accent))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
              fontFamily: 'var(--font-sans)',
              padding: '12px'
            }}
            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500, paddingTop: '4px' }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px', fontSize: '12px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', opacity: 0.8 }} iconType="circle" />
          <Area 
            yAxisId="left"
            type="monotone" 
            dataKey="utilizationRateRaw" 
            name="Utilization (%)"
            stroke="hsl(var(--primary))" 
            fillOpacity={1} 
            fill="url(#colorUtil)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
          <Area 
            yAxisId="right"
            type="monotone" 
            dataKey="tripsCompleted" 
            name="Trips Completed"
            stroke="hsl(var(--accent))" 
            fillOpacity={1} 
            fill="url(#colorTrips)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "hsl(var(--accent))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
