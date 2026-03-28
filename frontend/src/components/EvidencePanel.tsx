import { useState } from "react";
import { GitBranch, Mail, ChevronRight, TrendingUp } from "lucide-react";

interface Props {
  graphFacts: string[];
  emailSnippets: string[];
}

function parseFact(fact: string): { src: string; rel: string; tgt: string } | null {
  const m = fact.match(/^(.+?)\s+\[(.+?)\]\s+(.+?)(?:\s+\(.*\))?$/);
  if (!m) return null;
  return { src: m[1].trim(), rel: m[2].trim(), tgt: m[3].trim() };
}

const RELATION_COLORS: Record<string, string> = {
  MENTIONED:              "bg-purple-500/20 text-purple-300 border-purple-500/30",
  SENT_MOST_EMAILS_ABOUT: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  RECEIVED_EMAIL_ABOUT:   "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  COMMUNICATES_WITH:      "bg-green-500/20 text-green-300 border-green-500/30",
  WORKS_AT:               "bg-amber-500/20 text-amber-300 border-amber-500/30",
  MANAGES:                "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

function relColor(rel: string): string {
  const base = rel.replace(/\s+x\d+/, "").trim();
  return RELATION_COLORS[base] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

export default function EvidencePanel({ graphFacts, emailSnippets }: Props) {
  const [tab, setTab] = useState<"graph" | "snippets">("graph");

  const tabs = [
    { id: "graph",    label: "Graph Facts",    count: graphFacts.length,    icon: <GitBranch size={13} /> },
    { id: "snippets", label: "Email Snippets", count: emailSnippets.length, icon: <Mail size={13} /> },
  ] as const;

  return (
    <div className="glass rounded-xl overflow-hidden animate-slide-up">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-surface-900/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              tab === t.id
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.icon}
            {t.label}
            <span
              className={`badge ${
                tab === t.id
                  ? "bg-accent-blue/20 text-accent-blue"
                  : "bg-surface-600/60 text-slate-500"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}

        {/* Relevance indicator */}
        <div className="ml-auto flex items-center gap-1 pr-3 text-xs text-slate-600">
          <TrendingUp size={10} />
          <span>{graphFacts.length + emailSnippets.length} total sources</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-72 overflow-y-auto">
        {tab === "graph" && (
          graphFacts.length === 0 ? (
            <EmptyState message="No graph facts retrieved" />
          ) : (
            <div className="space-y-0.5">
              {graphFacts.map((fact, i) => {
                const parsed = parseFact(fact);
                return parsed ? (
                  <div key={i} className="fact-row items-center group hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors">
                    <span className="text-xs text-slate-600 font-mono w-5 shrink-0 select-none">{i + 1}</span>
                    <span className="text-slate-200 font-medium text-xs shrink-0 max-w-[26%] truncate" title={parsed.src}>
                      {parsed.src}
                    </span>
                    <ChevronRight size={10} className="text-slate-700 shrink-0" />
                    <span className={`badge border text-[10px] py-0.5 ${relColor(parsed.rel)} shrink-0 max-w-[34%]`}>
                      {parsed.rel}
                    </span>
                    <ChevronRight size={10} className="text-slate-700 shrink-0" />
                    <span className="text-slate-300 text-xs shrink min-w-0 truncate" title={parsed.tgt}>
                      {parsed.tgt}
                    </span>
                  </div>
                ) : (
                  <div key={i} className="fact-row text-slate-400 text-xs px-1">
                    <span className="text-xs text-slate-600 font-mono w-5 shrink-0">{i + 1}</span>
                    {fact}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "snippets" && (
          emailSnippets.length === 0 ? (
            <EmptyState message="No email snippets retrieved" />
          ) : (
            <div className="space-y-2.5">
              {emailSnippets.map((snippet, i) => (
                <div key={i} className="snippet-card group hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-accent-cyan/10 border border-accent-cyan/20">
                        <Mail size={10} className="text-accent-cyan" />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">Email Snippet {i + 1}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan/40" title="Retrieved via semantic search" />
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed line-clamp-4">{snippet}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
      <div className="text-3xl mb-2">—</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
