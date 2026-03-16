import {
  ResponsiveContainer,
  LineChart,
  Line,
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
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        No simulation data yet
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
            dataKey="timeStep" 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="left" 
            stroke="hsl(var(--primary))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="hsl(var(--accent))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="utilizationRateRaw" 
            name="Utilization (%)"
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="tripsCompleted" 
            name="Trips Completed"
            stroke="#a855f7" // Purple accent
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "#a855f7", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
