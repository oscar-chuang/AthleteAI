"use client";

import { useMemo } from "react";

interface DataPoint { date: string; value: number; }

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export function LineChart({ data, color = "#06b6d4", height = 160 }: LineChartProps) {
  const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

  const { points, path, fillPath, yTicks, xLabels } = useMemo(() => {
    if (data.length < 2) return { points: [], path: "", fillPath: "", yTicks: [], xLabels: [] };

    const vals  = data.map(d => d.value);
    const minV  = Math.floor(Math.min(...vals) / 10) * 10;
    const maxV  = Math.ceil(Math.max(...vals)  / 10) * 10 + 5;
    const range = maxV - minV || 1;
    const W     = 400 - PAD.left - PAD.right;
    const H     = height - PAD.top - PAD.bottom;

    const points = data.map((d, i) => ({
      x: PAD.left + (i / (data.length - 1)) * W,
      y: PAD.top  + (1 - (d.value - minV) / range) * H,
      value: d.value,
      date: d.date,
    }));

    // Smooth curve via cubic bezier
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX  = (prev.x + curr.x) / 2;
      path += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const fillPath = `${path} L ${last.x} ${PAD.top + H} L ${first.x} ${PAD.top + H} Z`;

    // Y-axis ticks
    const yTicks = [0, 25, 50, 75, 100].filter(v => v >= minV - 5 && v <= maxV + 5);

    // X-axis labels — pick ~4 evenly spaced
    const step  = Math.floor(data.length / 4) || 1;
    const xLabels = data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .slice(0, 5)
      .map(d => {
        const date = new Date(d.date);
        return { x: PAD.left + (data.indexOf(d) / (data.length - 1)) * W, label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
      });

    return { points, path, fillPath, yTicks, xLabels, minV, maxV, W, H };
  }, [data, height]);

  if (!points.length) return null;

  const gradId = `grad-${color.replace("#", "")}`;
  const clipId = `clip-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 400 ${height}`} className="w-full" style={{ height, overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y gridlines + labels */}
      {yTicks.map(tick => {
        const vals   = data.map(d => d.value);
        const minV   = Math.floor(Math.min(...vals) / 10) * 10;
        const maxV   = Math.ceil(Math.max(...vals)  / 10) * 10 + 5;
        const range  = maxV - minV || 1;
        const H      = height - PAD.top - PAD.bottom;
        const W      = 400 - PAD.left - PAD.right;
        const y      = PAD.top + (1 - (tick - minV) / range) * H;
        if (y < PAD.top - 4 || y > PAD.top + H + 4) return null;
        return (
          <g key={tick}>
            <line x1={PAD.left} y1={y} x2={PAD.left + W} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize="10" fill="rgba(255,255,255,0.25)" fontFamily="system-ui">{tick}</text>
          </g>
        );
      })}

      {/* Fill */}
      <path d={fillPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 5px ${color}66)` }} />

      {/* Last point dot */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1];
        return (
          <g>
            <circle cx={last.x} cy={last.y} r={5} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <circle cx={last.x} cy={last.y} r={2.5} fill="#fff" />
          </g>
        );
      })()}

      {/* X-axis labels */}
      {xLabels.map(({ x, label }, i) => (
        <text key={i} x={x} y={height - 4} textAnchor="middle"
          fontSize="9" fill="rgba(255,255,255,0.22)" fontFamily="system-ui">{label}</text>
      ))}

      {/* Y-axis line */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={height - PAD.bottom}
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
    </svg>
  );
}
