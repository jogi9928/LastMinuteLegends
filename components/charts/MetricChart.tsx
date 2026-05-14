"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

interface Point {
  date: string;
  value: number;
}

interface Props {
  title: string;
  unit?: string;
  data: Point[];
  color?: string;
  /** When true, lower values are better (e.g. valgus). Affects trend coloring. */
  lowerIsBetter?: boolean;
  decimals?: number;
}

export function MetricChart({ title, unit = "", data, color = "hsl(142 71% 45%)", lowerIsBetter = false, decimals = 1 }: Props) {
  const values = data.map((d) => d.value);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const trendColor = Math.abs(delta) < 1e-9 ? "text-muted-foreground" : better ? "text-emerald-400" : "text-red-400";
  const sign = delta > 0 ? "+" : "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || 1;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {last.toFixed(decimals)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          </div>
        </div>
        <div className={`text-sm font-medium tabular-nums ${trendColor}`}>
          {sign}
          {delta.toFixed(decimals)} {unit}
        </div>
      </div>
      <div className="mt-4 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(240 4% 18%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[min - pad, max + pad]} hide />
            <Tooltip
              contentStyle={{
                background: "hsl(240 7% 10%)",
                border: "1px solid hsl(240 4% 22%)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(240 5% 65%)" }}
              formatter={(v: number) => [`${v.toFixed(decimals)} ${unit}`, title]}
            />
            <ReferenceLine y={first} stroke="hsl(240 4% 28%)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
