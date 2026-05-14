"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

interface Point {
  date: string;
  value: number; // 0-100
}

interface Props {
  data: Point[];
  goal?: number; // 0-100 reference line
}

export function ScoreLineChart({ data, goal = 80 }: Props) {
  const last = data[data.length - 1]?.value ?? 0;
  const first = data[0]?.value ?? 0;
  const delta = last - first;
  const trendColor = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
  const sign = delta > 0 ? "+" : "";

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Average form score</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {Math.round(last)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className={`text-sm font-medium tabular-nums ${trendColor}`}>
          {sign}
          {Math.round(delta)} pts
        </div>
      </div>
      <div className="mt-4 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(240 4% 18%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(240 5% 65%)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="hsl(240 5% 65%)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "hsl(240 7% 10%)",
                border: "1px solid hsl(240 4% 22%)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(240 5% 65%)" }}
              formatter={(v) => [`${Math.round(Number(v))} / 100`, "Score"]}
            />
            <ReferenceLine y={goal} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(142 71% 45%)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "hsl(142 71% 45%)", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
