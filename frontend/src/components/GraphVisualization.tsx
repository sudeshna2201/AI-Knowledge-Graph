import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData } from "../types";
import { Network, ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";

interface Props {
  graph: GraphData;
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

function nodeColor(type: string): string {
  return NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.entity;
}

/** Strip email-client artefacts like </O=ENRON/OU=...> from display labels */
function cleanLabel(raw: string): string {
  // Remove anything inside angle brackets
  let s = raw.replace(/<[^>]*>/g, "").trim();
  // Remove trailing punctuation noise
  s = s.replace(/[,;:]+$/, "").trim();
  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ");
  return s || raw;
}

interface FGNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  __degree?: number;
  __cleanLabel?: string;
}
interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  relation: string;
  weight: number;
}

export default function GraphVisualization({ graph }: Props) {
  const fgRef        = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions]   = useState({ width: 500, height: 420 });
  const [hoveredNode, setHoveredNode] = useState<FGNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setSelectedNode(null);
    setHoveredNode(null);
  }, [graph]);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setDimensions({ width: Math.max(300, width), height: Math.max(300, height) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const degreeMap = useMemo(() => {
    const map: Record<string, number> = {};
    graph.nodes.forEach((n) => { map[n.id] = 0; });
    graph.edges.forEach((e) => {
      map[e.source] = (map[e.source] || 0) + 1;
      map[e.target] = (map[e.target] || 0) + 1;
    });
    return map;
  }, [graph]);

  const maxDeg = useMemo(() => Math.max(...Object.values(degreeMap), 1), [degreeMap]);

  const neighborSet = useMemo(() => {
    if (!selectedNode) return null;
    const s = new Set<string>();
    s.add(selectedNode.id);
    graph.edges.forEach((e) => {
      if (e.source === selectedNode.id) s.add(e.target);
      if (e.target === selectedNode.id) s.add(e.source);
    });
    return s;
  }, [selectedNode, graph]);

  const connectedEdgeKeys = useMemo(() => {
    if (!selectedNode) return null;
    const s = new Set<string>();
    graph.edges.forEach((e) => {
      if (e.source === selectedNode.id || e.target === selectedNode.id)
        s.add(`${e.source}::${e.target}`);
    });
    return s;
  }, [selectedNode, graph]);

  const fgData = useMemo(() => ({
    nodes: graph.nodes.map((n) => ({
      ...n,
      __degree:     degreeMap[n.id] || 0,
      __cleanLabel: cleanLabel(n.label),
    })) as FGNode[],
    links: graph.edges.map((e) => ({
      source:   e.source,
      target:   e.target,
      relation: e.relation,
      weight:   e.weight,
    })) as FGLink[],
  }), [graph, degreeMap]);

  const isEmpty = graph.nodes.length === 0;

  const handleZoomIn  = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.4, 300);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.4, 300);
  const handleFit     = () => fgRef.current?.zoomToFit(400, 40);
  const handleReset   = () => { fgRef.current?.zoomToFit(400, 40); setSelectedNode(null); };

  const drawNode = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const deg   = node.__degree || 0;
    const r     = 4 + (deg / maxDeg) * 10;
    const color = nodeColor(node.type);
    const isHov = hoveredNode?.id === node.id;
    const isSel = selectedNode?.id === node.id;
    const isDim = neighborSet !== null && !neighborSet.has(node.id);

    ctx.save();
    ctx.globalAlpha = isDim ? 0.15 : 1;

    // Glow for hovered / selected
    if (isHov || isSel) {
      ctx.shadowBlur  = isSel ? 20 : 12;
      ctx.shadowColor = color;
    }

    // Selection pulse ring
    if (isSel) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = color + "28";
      ctx.fill();
      ctx.strokeStyle = color + "80";
      ctx.lineWidth   = 1 / globalScale;
      ctx.stroke();
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, r + (isSel ? 2 : isHov ? 1 : 0), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (isSel) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 1.5 / globalScale;
      ctx.stroke();
    }

    // ── Label visibility rules ──────────────────────────────────────────────
    // Show label if:
    //   a) This node is hovered or selected
    //   b) It's a hub (top-3 by degree) and we're not too zoomed out
    //   c) User has zoomed in enough (globalScale > 2.0) for any node
    const isHub      = deg >= Math.max(3, maxDeg * 0.5);
    const showLabel  = isHov || isSel || (isHub && globalScale > 0.6) || globalScale > 2.0;

    if (showLabel && !isDim) {
      const raw    = node.__cleanLabel || node.label;
      const maxLen = isHov || isSel ? 22 : 14;
      const label  = raw.length > maxLen ? raw.slice(0, maxLen - 1) + "…" : raw;

      const fs = Math.min(11, Math.max(7, (isHov || isSel ? 11 : 9) / Math.max(0.6, globalScale)));
      ctx.font = `${isSel ? "600" : "500"} ${fs}px Inter, system-ui`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";

      const tw  = ctx.measureText(label).width;
      const pad = 2.5;
      const lx  = node.x!;
      const ly  = node.y! + r + 3 + fs / 2 + pad;

      // Pill background
      ctx.fillStyle = "rgba(7,13,26,0.82)";
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - pad, ly - fs / 2 - pad, tw + pad * 2, fs + pad * 2, 3);
      ctx.fill();

      // Label text
      ctx.fillStyle = isHov || isSel ? "#f1f5f9" : color;
      ctx.fillText(label, lx, ly);
    }

    ctx.restore();
  }, [hoveredNode, selectedNode, degreeMap, maxDeg, neighborSet]);

  const drawLink = useCallback((link: FGLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source as FGNode;
    const tgt = link.target as FGNode;
    if (!src.x || !src.y || !tgt.x || !tgt.y) return;

    const key      = `${typeof src === "object" ? src.id : src}::${typeof tgt === "object" ? tgt.id : tgt}`;
    const isDimmed = connectedEdgeKeys !== null && !connectedEdgeKeys.has(key);
    const weight   = link.weight || 1;
    const alpha    = isDimmed ? 0.05 : Math.min(0.7, weight / 6 + 0.25);

    ctx.save();
    ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
    ctx.lineWidth   = isDimmed ? 0.4 : Math.min(3, weight * 0.5 + 0.5);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();

    // Relation label — only when zoomed in and edge is not dimmed
    if (globalScale > 1.4 && !isDimmed) {
      const mx    = (src.x + tgt.x) / 2;
      const my    = (src.y + tgt.y) / 2;
      const fs    = Math.max(5, 7 / globalScale);
      const label = link.relation.replace(/_/g, " ").toLowerCase();
      const tw    = ctx.measureText(label).width;
      const pad   = 1.5;
      ctx.font     = `${fs}px Inter, system-ui`;
      ctx.fillStyle = "rgba(7,13,26,0.72)";
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2 - pad, my - fs / 2 - pad, tw + pad * 2, fs + pad * 2, 2);
      ctx.fill();
      ctx.fillStyle    = "rgba(148,163,184,0.8)";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    }

    ctx.restore();
  }, [connectedEdgeKeys]);

  // Selected node connections for the sidebar detail
  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return graph.edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => ({
        rel:  e.relation.replace(/_/g, " "),
        peer: e.source === selectedNode.id
          ? cleanLabel(graph.nodes.find((n) => n.id === e.target)?.label ?? e.target)
          : cleanLabel(graph.nodes.find((n) => n.id === e.source)?.label ?? e.source),
        dir:  e.source === selectedNode.id ? "→" : "←",
      }));
  }, [selectedNode, graph]);

  return (
    <div className="glass rounded-xl overflow-hidden h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-accent-purple" />
          <span className="text-sm font-medium text-slate-200">Knowledge Graph</span>
          <span className="badge bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-1">
            {[
              { icon: <ZoomIn size={13} />,    title: "Zoom in",  fn: handleZoomIn },
              { icon: <ZoomOut size={13} />,   title: "Zoom out", fn: handleZoomOut },
              { icon: <Maximize2 size={13} />, title: "Fit",      fn: handleFit },
              { icon: <RotateCcw size={13} />, title: "Reset",    fn: handleReset },
            ].map((b, i) => (
              <button
                key={i}
                onClick={b.fn}
                title={b.title}
                className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
              >
                {b.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-b border-white/5 bg-surface-900/30">
          {Object.entries(NODE_TYPE_COLORS)
            .filter(([t]) => t !== "entity" && graph.nodes.some((n) => n.type === t))
            .map(([type, color]) => {
              const count = graph.nodes.filter((n) => n.type === type).length;
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {type}
                  <span className="text-slate-700">({count})</span>
                </div>
              );
            })}
          {graph.nodes.some((n) => n.type === "entity") && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              Unknown ({graph.nodes.filter((n) => n.type === "entity").length})
            </div>
          )}
          <div className="ml-auto text-xs text-slate-700 italic">hover or click nodes to explore</div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
            <Network size={40} className="opacity-30" />
            <p className="text-sm">No graph data for this query</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={fgData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeCanvasObject={drawNode as any}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={drawLink as any}
            linkCanvasObjectMode={() => "replace"}
            onNodeHover={(node) => setHoveredNode(node as FGNode | null)}
            onNodeClick={(node) =>
              setSelectedNode((prev) =>
                prev?.id === (node as FGNode).id ? null : (node as FGNode)
              )
            }
            onZoom={({ k }) => setZoom(k)}
            nodeRelSize={6}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={() => "rgba(148,163,184,0.3)"}
            linkDirectionalParticles={(link) => ((link as FGLink).weight || 1) >= 2 ? 2 : 0}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "rgba(148,163,184,0.55)"}
            cooldownTicks={160}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 40)}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            // Repulsion to spread nodes more
            d3Force="charge"
          />
        )}

        {/* Hover tooltip (no label shown inline at low zoom) */}
        {hoveredNode && !selectedNode && (
          <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 pointer-events-none max-w-[220px]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: nodeColor(hoveredNode.type) }} />
              <span className="text-xs text-slate-400">{hoveredNode.type !== "entity" ? hoveredNode.type : "Unknown"}</span>
            </div>
            <div className="text-sm font-semibold text-slate-100 break-words">
              {cleanLabel(hoveredNode.label)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {degreeMap[hoveredNode.id] || 0} connection{degreeMap[hoveredNode.id] !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {/* Selected node detail panel */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2.5 pointer-events-none max-w-[230px]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: nodeColor(selectedNode.type) }} />
              <span className="text-xs font-medium" style={{ color: nodeColor(selectedNode.type) }}>
                {selectedNode.type !== "entity" ? selectedNode.type : "Unknown"}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-100 break-words mb-2">
              {cleanLabel(selectedNode.label)}
            </div>
            <div className="text-xs text-slate-600 mb-2 font-mono">
              {selectedConnections.length} connection{selectedConnections.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedConnections.slice(0, 7).map((c, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="text-slate-700 font-mono shrink-0">{c.dir}</span>
                  <span className="text-slate-500 italic text-[10px] shrink-0 max-w-[70px] truncate">{c.rel}</span>
                  <span className="text-slate-300 truncate">{c.peer}</span>
                </div>
              ))}
              {selectedConnections.length > 7 && (
                <div className="text-xs text-slate-700">+{selectedConnections.length - 7} more</div>
              )}
            </div>
          </div>
        )}

        {/* Current zoom level indicator */}
        {!isEmpty && (
          <div className="absolute top-3 right-3 text-xs text-slate-800 pointer-events-none select-none font-mono">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
