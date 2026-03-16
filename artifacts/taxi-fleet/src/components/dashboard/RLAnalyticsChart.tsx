import { useState } from "react";
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
  ReferenceLine,
} from "recharts";
import { HistoryPoint, RLAnalytics } from "@workspace/api-client-react";

type Tab = "rewards" | "qvalue" | "epsilon";

interface RLAnalyticsChartProps {
  data: HistoryPoint[];
  analytics: RLAnalytics;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "rewards",  label: "Rewards"       },
  { id: "qvalue",   label: "Q-Convergence" },
  { id: "epsilon",  label: "ε + Accuracy"  },
];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    borderColor: "hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.3)",
    padding: "12px",
    fontFamily: "var(--font-sans)",
  },
  itemStyle:  { color: "hsl(var(--foreground))", fontWeight: 500, paddingTop: "4px" },
  labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: "8px", fontSize: "12px" },
};

function EmptyState() {
  return (
    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-lg bg-background/50">
      No RL data yet — start the simulation.
    </div>
  );
}

export function RLAnalyticsChart({ data, analytics }: RLAnalyticsChartProps) {
  const [activeTab, setActiveTab] = useState<Tab>("rewards");
  const display = data.slice(-60);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-3 flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Live badge */}
        <span className="ml-auto px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
          Ep {analytics.episodeNumber}
        </span>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {data.length === 0 ? <EmptyState /> : (
          <>
            {activeTab === "rewards" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={display} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rl-epRew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                  <XAxis dataKey="timeStep" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis yAxisId="left" stroke="hsl(var(--primary))" fontSize={11} tickLine={false} axisLine={false} width={38} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-3))" fontSize={11} tickLine={false} axisLine={false} width={38} />
                  <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", opacity: 0.8 }} iconType="circle" />
                  <Line yAxisId="left" type="step" dataKey="reward" name="Step Reward"
                    stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Area yAxisId="right" type="monotone" dataKey="episodeReward" name="Episode Reward"
                    stroke="hsl(var(--chart-3))" fill="url(#rl-epRew)" fillOpacity={1} strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeTab === "qvalue" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={display} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rl-qval" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                  <XAxis dataKey="timeStep" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis stroke="hsl(var(--chart-4))" fontSize={11} tickLine={false} axisLine={false} width={38} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", opacity: 0.8 }} iconType="circle" />
                  <Area type="monotone" dataKey="avgQValue" name="Avg Q-Value"
                    stroke="hsl(var(--chart-4))" fill="url(#rl-qval)" fillOpacity={1} strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--chart-4))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeTab === "epsilon" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={display} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                  <XAxis dataKey="timeStep" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis yAxisId="left" stroke="hsl(var(--chart-1))" fontSize={11} tickLine={false} axisLine={false} width={38} domain={[0, 0.35]} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-5))" fontSize={11} tickLine={false} axisLine={false} width={38} domain={[0, 1]} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", opacity: 0.8 }} iconType="circle" />
                  <Line yAxisId="left" type="monotone" dataKey="epsilon" name="Explore ε"
                    stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--chart-1))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                  <Line yAxisId="right" type="monotone" dataKey="predictionAccuracy" name="Pred. Accuracy"
                    stroke="hsl(var(--chart-5))" strokeWidth={2} strokeDasharray="5 3" dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--chart-5))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
