import { useState, useEffect } from "react";
import { runQuery, checkHealth } from "./api";
import type { QueryResponse, HealthResponse } from "./types";
import QueryBar from "./components/QueryBar";
import AnswerPanel from "./components/AnswerPanel";
import EvidencePanel from "./components/EvidencePanel";
import GraphVisualization from "./components/GraphVisualization";
import GraphInsightsPanel from "./components/GraphInsightsPanel";
import WarningBanner from "./components/WarningBanner";
import DiagnosticsBar from "./components/DiagnosticsBar";
import { Network, AlertCircle, CheckCircle2, Activity, BookOpen, Sparkles } from "lucide-react";

export default function App() {
  const [result, setResult]     = useState<QueryResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [health, setHealth]     = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState(false);

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => setHealthErr(true));
  }, []);

  const handleQuery = async (question: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await runQuery(question);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Query failed");
    } finally {
      setLoading(false);
    }
  };

  const hasResult = !!result;
  const warnings  = result?.diagnostics.warnings ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-surface-800/50 backdrop-blur-sm px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 border border-white/10">
              <Network size={18} className="text-accent-blue" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 leading-tight">
                Enterprise Knowledge Graph
              </h1>
              <p className="text-xs text-slate-500">Enron Email Dataset · Hybrid RAG Intelligence</p>
            </div>
          </div>

          {/* Health badge */}
          <div className="flex items-center gap-2">
            {healthErr ? (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={13} />
                Backend offline
              </div>
            ) : health ? (
              <div className={`flex items-center gap-1.5 text-xs ${health.status === "ok" ? "text-green-400" : "text-amber-400"}`}>
                {health.status === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {health.status === "ok"
                  ? "All systems operational"
                  : `Degraded — missing: ${health.missing_env.join(", ")}`}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Activity size={13} className="animate-pulse" />
                Checking backend…
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-5">
        {/* Query bar */}
        <QueryBar onQuery={handleQuery} isLoading={isLoading} />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-fade-in">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && <WarningBanner warnings={warnings} />}

        {/* Loading skeleton */}
        {isLoading && !result && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="h-14 rounded-xl shimmer" />
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-5">
              <div className="flex flex-col gap-5">
                <div className="h-52 rounded-xl shimmer" />
                <div className="h-64 rounded-xl shimmer" />
              </div>
              <div className="h-[480px] rounded-xl shimmer hidden xl:block" />
            </div>
            <div className="h-28 rounded-xl shimmer" />
          </div>
        )}

        {/* Results */}
        {hasResult && !isLoading && (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Diagnostics */}
            <DiagnosticsBar diagnostics={result!.diagnostics} />

            {/* Two-column layout: Left = Answer + Evidence, Right = Graph */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-5">
              {/* Left column */}
              <div className="flex flex-col gap-5 min-w-0">
                <AnswerPanel question={result!.question} answer={result!.answer} />
                <EvidencePanel
                  graphFacts={result!.graph_facts}
                  emailSnippets={result!.email_snippets}
                />
              </div>

              {/* Right column: Graph */}
              <div className="min-h-[500px] xl:min-h-0 xl:h-auto">
                <GraphVisualization graph={result!.graph} />
              </div>
            </div>

            {/* Full-width Graph Insights panel */}
            {result!.graph.nodes.length > 0 && (
              <GraphInsightsPanel
                graph={result!.graph}
                graphFacts={result!.graph_facts}
              />
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasResult && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-slate-700 animate-fade-in">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-surface-800/50 flex items-center justify-center">
                <BookOpen size={36} className="text-slate-600" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
                <Network size={12} className="text-accent-blue" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-slate-500 mb-1">Ready to answer your questions</p>
              <p className="text-sm text-slate-600 max-w-sm">
                Ask anything about the Enron email dataset. Results combine Neo4j knowledge graph facts with Pinecone semantic search.
              </p>
            </div>
            {/* Feature callouts */}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {[
                { icon: <Network size={11} />, label: "Interactive knowledge graph", color: "text-accent-purple" },
                { icon: <Sparkles size={11} />, label: "LLM-grounded answers", color: "text-accent-blue" },
                { icon: <Activity size={11} />, label: "Graph analytics & insights", color: "text-accent-cyan" },
              ].map((f, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs ${f.color} bg-surface-800/40 border border-white/5 px-3 py-1.5 rounded-full`}>
                  {f.icon}
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between text-xs text-slate-700">
          <span>Milestone 3 · Hybrid RAG · Neo4j + Pinecone + LLM</span>
          {result && (
            <span className="font-mono">
              {result.diagnostics.latency_ms.total.toLocaleString()} ms total
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
