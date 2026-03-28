import type { Diagnostics } from "../types";
import { Database, Layers, Clock, Zap } from "lucide-react";

interface Props {
  diagnostics: Diagnostics;
}

function latencyColor(ms: number): string {
  if (ms < 500)  return "text-emerald-400";
  if (ms < 1500) return "text-amber-400";
  return "text-red-400";
}

function latencyBar(ms: number, maxMs: number): { width: string; color: string } {
  const pct   = Math.min(100, (ms / Math.max(maxMs, 1)) * 100);
  const color = ms < 500 ? "#34d399" : ms < 1500 ? "#fbbf24" : "#f87171";
  return { width: `${pct}%`, color };
}

function Stat({
  icon, label, value, unit = "", color, bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  color: string;
  bar?: { width: string; color: string };
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[90px]">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={color}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>
        {value.toLocaleString()}
        {unit && <span className="text-xs font-normal text-slate-600 ml-0.5">{unit}</span>}
      </div>
      {bar && (
        <div className="h-0.5 rounded-full bg-surface-700 overflow-hidden w-full">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: bar.width, background: bar.color }} />
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsBar({ diagnostics }: Props) {
  const { latency_ms, graph_count, vector_count } = diagnostics;
  const maxLatency = Math.max(latency_ms.graph, latency_ms.vector, latency_ms.llm, 1);

  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-3.5 rounded-xl bg-surface-800/40 border border-white/5 text-xs">
      {/* Retrieval counts */}
      <div className="flex items-start gap-4 pr-4 border-r border-white/5">
        <Stat
          icon={<Database size={12} />}
          label="Graph facts"
          value={graph_count}
          color="text-accent-purple"
        />
        <Stat
          icon={<Layers size={12} />}
          label="Snippets"
          value={vector_count}
          color="text-accent-cyan"
        />
      </div>

      {/* Latency breakdown */}
      <div className="flex items-start gap-4 flex-1">
        <Stat
          icon={<Database size={12} />}
          label="Graph"
          value={latency_ms.graph}
          unit="ms"
          color={latencyColor(latency_ms.graph)}
          bar={latencyBar(latency_ms.graph, maxLatency)}
        />
        <Stat
          icon={<Layers size={12} />}
          label="Vector"
          value={latency_ms.vector}
          unit="ms"
          color={latencyColor(latency_ms.vector)}
          bar={latencyBar(latency_ms.vector, maxLatency)}
        />
        <Stat
          icon={<Zap size={12} />}
          label="LLM"
          value={latency_ms.llm}
          unit="ms"
          color={latencyColor(latency_ms.llm)}
          bar={latencyBar(latency_ms.llm, maxLatency)}
        />
        <div className="ml-auto text-right">
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <Clock size={11} />
            <span>Total</span>
          </div>
          <div className={`text-base font-bold font-mono ${latencyColor(latency_ms.total)}`}>
            {latency_ms.total.toLocaleString()}
            <span className="text-xs font-normal text-slate-600 ml-0.5">ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
