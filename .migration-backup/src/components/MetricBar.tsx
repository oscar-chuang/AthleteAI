"use client";

import { useEffect, useState } from "react";

interface MetricBarProps {
  label: string;
  value: number;
  color?: string;
  showValue?: boolean;
  delta?: number;
}

export function MetricBar({ label, value, color = "#0ea5e9", showValue = true, delta }: MetricBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const getBarColor = () => {
    if (value >= 80) return "#22c55e";
    if (value >= 60) return color;
    if (value >= 40) return "#eab308";
    return "#ef4444";
  };

  const barColor = getBarColor();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <span
              className="text-xs font-medium"
              style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {delta >= 0 ? "+" : ""}{delta}
            </span>
          )}
          {showValue && (
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
          )}
        </div>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
            boxShadow: `0 0 8px ${barColor}44`,
          }}
        />
      </div>
    </div>
  );
}
