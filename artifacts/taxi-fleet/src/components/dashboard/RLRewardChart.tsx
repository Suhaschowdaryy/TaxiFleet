import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import { HistoryPoint } from "@workspace/api-client-react";

interface RLRewardChartProps {
  data: HistoryPoint[];
  currentEpisode: number;
}

export function RLRewardChart({ data, currentEpisode }: RLRewardChartProps) {
  // Take last 50 points for visualization
  const displayData = data.slice(-50).map(d => ({
    ...d,
  }));

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-lg bg-background/50">
        No RL data available yet.
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[300px] flex flex-col relative">
      <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
        <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/30">
          Episode {currentEpisode}
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorEpisodeReward" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
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
            tickMargin={10}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="hsl(var(--chart-3))" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
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
          
          <Line 
            yAxisId="left"
            type="step" 
            dataKey="reward" 
            name="Step Reward"
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area 
            yAxisId="right"
            type="monotone" 
            dataKey="episodeReward" 
            name="Episode Cum. Reward"
            stroke="hsl(var(--chart-3))" 
            fillOpacity={1} 
            fill="url(#colorEpisodeReward)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "hsl(var(--chart-3))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
