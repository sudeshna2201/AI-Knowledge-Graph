import { useMemo } from "react";
import type { GraphData } from "../types";
import { BarChart2, Star, ArrowRightLeft, Sigma } from "lucide-react";

interface Props {
  graph: GraphData;
  graphFacts: string[];
}

const NODE_TYPE_COLORS: Record<string, string> = {
  Person:        "#60a5fa",
  Organization:  "#a78bfa",
  Location:      "#34d399",
  FinancialTerm: "#fbbf24",
  EnergyTerm:    "#f87171",
  Project:       "#38bdf8",
  Regulation:    "#fb923c",
  Event:         "#e879f9",
  entity:        "#94a3b8",
};

export default function GraphInsightsPanel({ graph, graphFacts }: Props) {
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    graph.nodes.forEach((n) => {
      const key = n.type || "entity";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [graph]);

  const topNodes = useMemo(() => {
    const degMap: Record<string, number> = {};
    graph.nodes.forEach((n) => { degMap[n.id] = 0; });
    graph.edges.forEach((e) => {
      degMap[e.source] = (degMap[e.source] || 0) + 1;
      degMap[e.target] = (degMap[e.target] || 0) + 1;
    });
    return graph.nodes
      .map((n) => ({ ...n, degree: degMap[n.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5);
  }, [graph]);

  const relationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    graph.edges.forEach((e) => {
      const rel = e.relation || "UNKNOWN";
      counts[rel] = (counts[rel] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [graph]);

  const density = useMemo(() => {
    const n = graph.nodes.length;
    if (n <= 1) return 0;
    const maxEdges = n * (n - 1);
    return ((graph.edges.length / maxEdges) * 100).toFixed(1);
  }, [graph]);

  const maxTypeCount = nodeTypeCounts[0]?.[1] || 1;
  const maxRelCount  = relationCounts[0]?.[1] || 1;
  const maxDeg       = topNodes[0]?.degree || 1;

  if (graph.nodes.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <BarChart2 size={14} className="text-accent-cyan" />
        <span className="text-sm font-medium text-slate-200">Graph Analysis</span>
        <span className="badge bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
          {graph.nodes.length}N · {graph.edges.length}E
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-slate-600">
          <Sigma size={10} />
          density {density}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5">
        {/* Entity Type Breakdown */}
        <div className="bg-surface-800/60 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Entity Types</span>
          </div>
          <div className="space-y-2">
            {nodeTypeCounts.map(([type, count]) => {
              const color = NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.entity;
              const pct   = (count / maxTypeCount) * 100;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-400 truncate">{type === "entity" ? "Unknown" : type}</span>
                    <span className="text-xs font-mono text-slate-500 ml-2">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Connected Nodes */}
        <div className="bg-surface-800/60 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Central Entities</span>
          </div>
          <div className="space-y-2">
            {topNodes.map((node, i) => {
              const color = NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.entity;
              const pct   = (node.degree / maxDeg) * 100;
              return (
                <div key={node.id}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[9px] font-bold"
                         style={{ background: color + "25", color }}>
                      {i + 1}
                    </div>
                    <span className="text-xs text-slate-300 truncate flex-1" title={node.label}>{node.label}</span>
                    <span className="text-xs font-mono text-slate-500">{node.degree}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden ml-5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color + "90" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Relationship Distribution */}
        <div className="bg-surface-800/60 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Relations</span>
          </div>
          <div className="space-y-2">
            {relationCounts.map(([rel, count]) => {
              const pct   = (count / maxRelCount) * 100;
              const label = rel.replace(/_/g, " ").toLowerCase();
              return (
                <div key={rel}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <ArrowRightLeft size={9} className="text-slate-600 shrink-0" />
                      <span className="text-xs text-slate-400 truncate capitalize" title={label}>{label}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 ml-2">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: "rgba(52,211,153,0.65)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick stat */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5 text-xs text-slate-600">
            <Star size={10} className="text-accent-amber" />
            <span>{graphFacts.length} facts retrieved from graph</span>
          </div>
        </div>
      </div>
    </div>
  );
}
