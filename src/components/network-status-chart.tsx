'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { NetworkStatusHistory } from '@/lib/types';

interface Props {
  history: NetworkStatusHistory[];
}

const LINE_CONFIG = [
  { key: 'trustIndex',         label: 'TRUST',    color: '#4ade80' },
  { key: 'stabilityIndex',     label: 'STABILITY', color: '#a3e635' },
  { key: 'chaosLevel',         label: 'CHAOS',    color: '#f87171' },
  { key: 'survivalProbability', label: 'SURVIVAL', color: '#facc15' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border/60 px-3 py-2 font-mono text-[11px]">
      <p className="text-muted-foreground/60 mb-1 tracking-widest">{label}</p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function NetworkStatusChart({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-muted-foreground/40 font-mono">
        NO HISTORICAL DATA — CALCULATING FIRST SNAPSHOT...
      </div>
    );
  }

  // Format date label
  const data = history.map((h) => ({
    ...h,
    dateLabel: h.date.slice(5), // "MM-DD"
  }));

  // Key events (hardcoded narrative events)
  const eventDays: { date: string; label: string }[] = [];
  if (data.length > 0) {
    const midIdx = Math.floor(data.length / 2);
    if (data[midIdx]) eventDays.push({ date: data[midIdx].dateLabel, label: 'Governance shift' });
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', paddingTop: '8px', opacity: 0.6 }}
          formatter={(val) => val}
        />
        {eventDays.map((ev) => (
          <ReferenceLine
            key={ev.date}
            x={ev.date}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="3 3"
            label={{ value: ev.label, fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
          />
        ))}
        {LINE_CONFIG.map(({ key, label, color }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={label}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
