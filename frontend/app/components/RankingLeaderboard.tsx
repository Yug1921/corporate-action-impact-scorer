"use client";
import { AnalysisResult, getRatingColor } from "../lib/api";

interface Props { results: AnalysisResult[]; }

export default function RankingLeaderboard({ results }: Props) {
  const sorted = [...results]
    .filter(r => r.scores)
    .sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0));

  const medals = ["medal-1", "medal-2", "medal-3"];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Impact Rankings</h2>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>Ranked by total impact score · {sorted.length} filings</p>
        </div>
        <div className="text-[10px] font-mono px-2.5 py-1 rounded" style={{ background: "var(--bg-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          MAX 100 PTS
        </div>
      </div>

      {/* Table header */}
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[9px] font-mono tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg-raised)" }}>
        <span className="col-span-1">#</span>
        <span className="col-span-5">COMPANY</span>
        <span className="col-span-2 text-right">SCORE</span>
        <span className="col-span-2 text-right">RATING</span>
        <span className="col-span-2 text-right">VALUE</span>
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {sorted.map((result, idx) => {
          const score = result.scores?.total_score ?? 0;
          const rating = result.scores?.rating ?? "UNKNOWN";
          const color = result.scores?.rating_color ?? getRatingColor(rating);
          const pct = (score / 100) * 100;
          const company = result.extracted?.company_name || result.label.split("—")[0].trim();

          return (
            <div
              key={result.id}
              className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center transition-colors"
              style={{ background: idx === 0 ? "rgba(245,158,11,0.03)" : "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = idx === 0 ? "rgba(245,158,11,0.03)" : "transparent")}
            >
              {/* Rank */}
              <div className="col-span-1">
                {idx < 3 ? (
                  <span className={`${medals[idx]} inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold`}>
                    {idx + 1}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>#{idx + 1}</span>
                )}
              </div>

              {/* Company */}
              <div className="col-span-5 min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{company}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {result.extracted?.ticker && (
                    <span className="text-[9px] font-mono" style={{ color: "var(--accent)" }}>{result.extracted.ticker}</span>
                  )}
                  <span className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{result.extracted?.announcement_type || "—"}</span>
                </div>
                {/* Mini bar */}
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                  <div className="h-full rounded-full bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }} />
                </div>
              </div>

              {/* Score */}
              <div className="col-span-2 text-right">
                <span className="text-base font-bold font-mono" style={{ color }}>{score}</span>
                <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>/100</span>
              </div>

              {/* Rating chip */}
              <div className="col-span-2 text-right">
                <span className={`chip chip-${rating}`}>{rating}</span>
              </div>

              {/* Value */}
              <div className="col-span-2 text-right">
                <span className="text-[10px] font-mono" style={{ color: result.extracted?.financial_value ? "var(--positive)" : "var(--text-muted)" }}>
                  {result.extracted?.financial_value || "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}